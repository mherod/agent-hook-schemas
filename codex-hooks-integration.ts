import { z } from "zod";
import {
  CodexHookEventNameSchema,
  CodexHooksFileSchema,
  type CodexCommandHookHandler,
  type CodexHookHandler,
  type CodexHookEventInput,
  type CodexHookEventName,
  type CodexHooksConfig,
  type CodexMatcherGroup,
} from "./codex-schemas.ts";
import {
  defaultedTimeoutSec,
  mergeHookConfigLayers,
  parseSchemaResult,
  regexMatcherMatches,
  simpleGlobToRegExp,
  type HookResolutionContext,
} from "./common.ts";

// ---------------------------------------------------------------------------
// Config merge
// ---------------------------------------------------------------------------

/**
 * Codex loads every `hooks.json` from active config layers; higher-precedence
 * layers do not replace lower-precedence hooks — matcher groups are concatenated
 * per event (see Codex hooks docs).
 */
export function mergeCodexHooksFiles(
  files: unknown[],
):
  | { ok: true; config: CodexHooksConfig }
  | { ok: false; index: number; error: z.ZodError } {
  // Lazy evaluation: extract options inside function to avoid module-level initialization
  // issues when bundler splits this into separate chunks
  const codexHookEvents = CodexHookEventNameSchema.options;
  return mergeHookConfigLayers<CodexHookEventName, CodexMatcherGroup, typeof CodexHooksFileSchema>({
    files,
    schema: CodexHooksFileSchema,
    events: codexHookEvents,
    getHooks: (layer) => layer.hooks,
  });
}

// ---------------------------------------------------------------------------
// Matcher matching
// ---------------------------------------------------------------------------

/**
 * `matcher` is a regex on the subject field (tool name or session source), or
 * match-all when omitted, `""`, or `"*"` (Codex hooks docs).
 */
export const codexMatcherMatches: (matcher: string | undefined, subject: string) => boolean =
  regexMatcherMatches;

/**
 * Evaluate a handler's `if` guard against a Codex tool call.
 * This library extension checks `Bash(glob)` against `tool_input.command`.
 * Returns `true` when `if` is omitted (no guard).
 */
export function codexToolIfMatches(
  toolName: string,
  toolInput: Record<string, unknown>,
  ifRule: string | undefined,
): boolean {
  if (ifRule === undefined) return true;
  const first = ifRule.indexOf("(");
  const last = ifRule.lastIndexOf(")");
  if (first === -1 || last <= first) return false;
  const tool = ifRule.slice(0, first).trim();
  const pattern = ifRule.slice(first + 1, last).trim();
  if (toolName !== tool) return false;
  if (pattern === "" || pattern === "*") return true;

  let globRe: RegExp;
  try {
    globRe = simpleGlobToRegExp(pattern);
  } catch {
    return false;
  }

  if (toolName === "Bash" && typeof toolInput.command === "string") {
    return globRe.test(toolInput.command);
  }
  return false;
}

// ---------------------------------------------------------------------------
// Handler resolution
// ---------------------------------------------------------------------------

/** Context for matcher + optional `if` guard. */
export type CodexHookResolutionContext = HookResolutionContext;

function codexMatcherIgnoredForEvent(
  event: CodexHookEventName,
): event is "UserPromptSubmit" | "Stop" | "Interrupt" {
  return event === "UserPromptSubmit" || event === "Stop" || event === "Interrupt";
}

function handlerIfPasses(
  handler: CodexHookHandler,
  ctx: CodexHookResolutionContext,
): boolean {
  const ifRule = "if" in handler ? handler.if : undefined;
  if (ifRule === undefined) return true;
  if (ctx.toolName === undefined || ctx.toolInput === undefined) return false;
  return codexToolIfMatches(ctx.toolName, ctx.toolInput, ifRule);
}

/**
 * Returns command and MCP handlers for this event and subject, in
 * merge order then matcher-group order. Codex launches them concurrently; this
 * list is the integration surface for "what runs".
 *
 * When `ctx` includes `toolName`/`toolInput`, handler `if` guards are evaluated
 * (matching Claude Code's `if` semantics).
 */
export function resolveMatchingCodexHandlers(
  config: CodexHooksConfig,
  event: CodexHookEventName,
  ctx: CodexHookResolutionContext,
): CodexHookHandler[] {
  const groups = config[event];
  if (!groups?.length) return [];

  const out: CodexHookHandler[] = [];
  if (codexMatcherIgnoredForEvent(event)) {
    for (const g of groups) {
      for (const h of g.hooks) {
        if (handlerIfPasses(h, ctx)) out.push(h);
      }
    }
    return out;
  }
  for (const g of groups) {
    const subjects =
      (event === "PreToolUse" || event === "PermissionRequest" || event === "PostToolUse") &&
      ctx.subject === "apply_patch"
        ? [ctx.subject, "Edit", "Write"]
        : [ctx.subject];
    if (!subjects.some((subject) => codexMatcherMatches(g.matcher, subject))) continue;
    for (const h of g.hooks) {
      if (handlerIfPasses(h, ctx)) out.push(h);
    }
  }
  return out;
}

/** Derive resolution context from parsed Codex hook stdin. */
export function codexResolutionContextFromInput(
  input: CodexHookEventInput,
): CodexHookResolutionContext {
  switch (input.hook_event_name) {
    case "SessionStart":
      return { subject: input.source ?? "" };
    case "SessionEnd":
      return { subject: input.reason ?? "" };
    case "SubagentStart":
    case "SubagentStop":
      return { subject: input.agent_type ?? "" };
    case "PreToolUse":
    case "PermissionRequest":
    case "PostToolUse":
      return {
        subject: input.tool_name ?? "",
        toolName: input.tool_name ?? "",
        toolInput: input.tool_input !== null && typeof input.tool_input === "object" && !Array.isArray(input.tool_input)
          ? input.tool_input as Record<string, unknown> : undefined,
      };
    case "PreCompact":
    case "PostCompact":
      return { subject: input.trigger ?? "" };
    case "UserPromptSubmit":
      return { subject: "" };
    case "Stop":
    case "Interrupt":
      return { subject: "" };
  }
}

/** Resolve handlers from merged config + parsed stdin (wire) payload. */
export function resolveMatchingCodexHandlersFromInput(
  config: CodexHooksConfig,
  input: CodexHookEventInput,
): CodexHookHandler[] {
  return resolveMatchingCodexHandlers(
    config,
    input.hook_event_name,
    codexResolutionContextFromInput(input),
  );
}

/**
 * Effective timeout in seconds: explicit `timeout` wins over `timeoutSec`.
 * For `SessionEnd`: defaults to 1 second and is capped at 3 seconds maximum.
 * For `Interrupt`: defaults to 1 second and is clamped to 1–3 seconds.
 * For other events: defaults to 600 seconds.
 */
export function effectiveCodexHandlerTimeoutSec(
  handler: Pick<CodexCommandHookHandler, "timeout" | "timeoutSec">,
  event?: CodexHookEventName,
): number {
  const raw = handler.timeout ?? handler.timeoutSec;
  if (event === "Interrupt") return Math.min(Math.max(raw ?? 1, 1), 3);
  if (event === "SessionEnd") {
    if (raw === undefined) return 1;
    return Math.min(Math.max(raw, 0), 3);
  }
  return defaultedTimeoutSec(raw, 600);
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/** Validate a `hooks.json` file. Returns typed config or Zod error. */
export function parseCodexHooksFile(json: unknown):
  | { ok: true; config: CodexHooksConfig }
  | { ok: false; error: z.ZodError } {
  const result = parseSchemaResult(CodexHooksFileSchema, json, "file");
  if (!result.ok) return result;
  return { ok: true, config: result.file.hooks };
}
