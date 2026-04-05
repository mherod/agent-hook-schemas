import { z } from "zod";
import {
  CodexHookEventNameSchema,
  CodexHooksFileSchema,
  type CodexCommandHookHandler,
  type CodexHookEventInput,
  type CodexHookEventName,
  type CodexHooksConfig,
} from "./codex.ts";

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
  const merged: CodexHooksConfig = {};
  // Lazy evaluation: extract options inside function to avoid module-level initialization
  // issues when bundler splits this into separate chunks
  const codexHookEvents = CodexHookEventNameSchema.options;
  for (let i = 0; i < files.length; i++) {
    const parsed = CodexHooksFileSchema.safeParse(files[i]);
    if (!parsed.success) return { ok: false, index: i, error: parsed.error };
    const hooks = parsed.data.hooks;
    for (const event of codexHookEvents) {
      const groups = hooks[event];
      if (!groups?.length) continue;
      merged[event] = [...(merged[event] ?? []), ...groups];
    }
  }
  return { ok: true, config: merged };
}

// ---------------------------------------------------------------------------
// Matcher matching
// ---------------------------------------------------------------------------

/**
 * `matcher` is a regex on the subject field (tool name or session source), or
 * match-all when omitted, `""`, or `"*"` (Codex hooks docs).
 */
export function codexMatcherMatches(matcher: string | undefined, subject: string): boolean {
  if (matcher === undefined || matcher === "" || matcher === "*") return true;
  try {
    return new RegExp(matcher).test(subject);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// `if` guard matching (Bash-only for Codex today)
// ---------------------------------------------------------------------------

/** Convert a simple glob (`*`, `?`) to a RegExp anchored at both ends. */
function globToRegExp(globPat: string): RegExp {
  let re = "";
  for (let i = 0; i < globPat.length; i++) {
    const c = globPat[i]!;
    if (c === "*") re += ".*";
    else if (c === "?") re += ".";
    else if (/[.+^${}()|[\]\\]/.test(c)) re += `\\${c}`;
    else re += c;
  }
  return new RegExp(`^${re}$`);
}

/**
 * Evaluate a handler's `if` guard against a Codex tool call.
 * Codex currently only emits `Bash` tool events, so this checks `Bash(glob)` against
 * `tool_input.command`. Returns `true` when `if` is omitted (no guard).
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
    globRe = globToRegExp(pattern);
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
export type CodexHookResolutionContext = {
  subject: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
};

function codexMatcherIgnoredForEvent(
  event: CodexHookEventName,
): event is "UserPromptSubmit" | "Stop" {
  return event === "UserPromptSubmit" || event === "Stop";
}

function handlerIfPasses(
  handler: CodexCommandHookHandler,
  ctx: CodexHookResolutionContext,
): boolean {
  const ifRule = handler.if;
  if (ifRule === undefined) return true;
  if (ctx.toolName === undefined || ctx.toolInput === undefined) return false;
  return codexToolIfMatches(ctx.toolName, ctx.toolInput, ifRule);
}

/**
 * Returns all command handlers that would run for this event and subject, in
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
): CodexCommandHookHandler[] {
  const groups = config[event];
  if (!groups?.length) return [];

  const out: CodexCommandHookHandler[] = [];
  if (codexMatcherIgnoredForEvent(event)) {
    for (const g of groups) {
      for (const h of g.hooks) {
        if (handlerIfPasses(h, ctx)) out.push(h);
      }
    }
    return out;
  }
  for (const g of groups) {
    if (!codexMatcherMatches(g.matcher, ctx.subject)) continue;
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
    case "PreToolUse":
    case "PostToolUse":
      return {
        subject: input.tool_name ?? "",
        toolName: input.tool_name ?? "",
        toolInput: (input.tool_input ?? {}) as Record<string, unknown>,
      };
    case "UserPromptSubmit":
      return { subject: "" };
    case "Stop":
      return { subject: "" };
  }
}

/** Resolve handlers from merged config + parsed stdin (wire) payload. */
export function resolveMatchingCodexHandlersFromInput(
  config: CodexHooksConfig,
  input: CodexHookEventInput,
): CodexCommandHookHandler[] {
  return resolveMatchingCodexHandlers(
    config,
    input.hook_event_name,
    codexResolutionContextFromInput(input),
  );
}

/** Effective timeout in seconds: explicit `timeout` wins over `timeoutSec`; default 600. */
export function effectiveCodexHandlerTimeoutSec(
  handler: Pick<CodexCommandHookHandler, "timeout" | "timeoutSec">,
): number {
  return handler.timeout ?? handler.timeoutSec ?? 600;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/** Validate a `hooks.json` file. Returns typed config or Zod error. */
export function parseCodexHooksFile(json: unknown):
  | { ok: true; config: CodexHooksConfig }
  | { ok: false; error: z.ZodError } {
  const result = CodexHooksFileSchema.safeParse(json);
  if (!result.success) return { ok: false, error: result.error };
  return { ok: true, config: result.data.hooks };
}
