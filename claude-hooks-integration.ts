import { z } from "zod";
import {
  ClaudeSettingsFragmentSchema,
  HookEventNameSchema,
  LooksLikeMcpToolName,
  type HookEventInput,
  type HookEventName,
  type HookHandler,
  type HooksConfig,
} from "./claude.ts";

const CLAUDE_HOOK_EVENTS = HookEventNameSchema.options;

/**
 * Context for matcher + optional `if` (tool-shaped stdin only). `subject` is matched with
 * {@link claudeMatcherMatches} (JavaScript RegExp when not wildcard).
 */
export type ClaudeHookResolutionContext = {
  subject: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
};

/**
 * Merge hook matcher groups from multiple Claude settings fragments (user + project + local +
 * policy order is a caller concern). Later entries append after earlier ones per event, like Codex
 * `hooks.json` discovery.
 */
export function mergeClaudeHooksFiles(
  files: unknown[],
): { ok: true; config: HooksConfig } | { ok: false; index: number; error: z.ZodError } {
  const merged: HooksConfig = {};
  for (let i = 0; i < files.length; i++) {
    const parsed = ClaudeSettingsFragmentSchema.safeParse(files[i]);
    if (!parsed.success) return { ok: false, index: i, error: parsed.error };
    const hooks = parsed.data.hooks;
    if (!hooks) continue;
    for (const event of CLAUDE_HOOK_EVENTS) {
      const list = hooks[event];
      if (!list?.length) continue;
      merged[event] = [...(merged[event] ?? []), ...list];
    }
  }
  return { ok: true, config: merged };
}

/**
 * Hook `matcher` is a RegExp source on `subject`, or match-all when omitted, `""`, or `"*"`
 * (Claude Code hooks guide).
 */
export function claudeMatcherMatches(matcher: string | undefined, subject: string): boolean {
  if (matcher === undefined || matcher === "" || matcher === "*") return true;
  try {
    return new RegExp(matcher).test(subject);
  } catch {
    return false;
  }
}

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
 * `if` permission-rule style guard (`Bash(git *)`, `Edit(*.ts)`). When `if` is set but stdin is
 * not tool-shaped, the handler does not run (stricter than skipping the guard).
 */
export function claudeToolIfMatches(
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
  if (
    (toolName === "Edit" || toolName === "Write" || toolName === "Read") &&
    typeof toolInput.file_path === "string"
  ) {
    return globRe.test(toolInput.file_path);
  }
  if (toolName === "Glob" && typeof toolInput.pattern === "string") {
    return globRe.test(toolInput.pattern);
  }
  if (toolName === "Grep" && typeof toolInput.pattern === "string") {
    return globRe.test(toolInput.pattern);
  }
  if (LooksLikeMcpToolName(toolName)) {
    return globRe.test(JSON.stringify(toolInput));
  }
  return false;
}

function handlerIfPasses(handler: HookHandler, ctx: ClaudeHookResolutionContext): boolean {
  const ifRule = "if" in handler ? handler.if : undefined;
  if (ifRule === undefined) return true;
  if (ctx.toolName === undefined || ctx.toolInput === undefined) return false;
  return claudeToolIfMatches(ctx.toolName, ctx.toolInput, ifRule);
}

/**
 * Handlers that would run for this event (merge order, then matcher group order, then hook order).
 * All handler types (command / http / prompt / agent) are included; only `if` and `matcher` gate.
 */
export function resolveMatchingClaudeHandlers(
  config: HooksConfig,
  event: HookEventName,
  ctx: ClaudeHookResolutionContext,
): HookHandler[] {
  const groups = config[event];
  if (!groups?.length) return [];
  const out: HookHandler[] = [];
  for (const g of groups) {
    if (!claudeMatcherMatches(g.matcher, ctx.subject)) continue;
    for (const h of g.hooks) {
      if (handlerIfPasses(h, ctx)) out.push(h);
    }
  }
  return out;
}

/** Derive matcher subject and optional tool fields from hook stdin. */
export function claudeResolutionContextFromInput(input: HookEventInput): ClaudeHookResolutionContext {
  const toolSlice = toolContextFromInput(input);
  return {
    subject: subjectForClaudeInput(input),
    ...toolSlice,
  };
}

function toolContextFromInput(
  input: HookEventInput,
): { toolName?: string; toolInput?: Record<string, unknown> } {
  // Zod v4 .loose() infers Record<string, unknown> via Prettify, erasing named property types.
  // Cast to a plain discriminated shape so the switch and property reads type-check cleanly.
  const i = input as { hook_event_name: HookEventName } & Record<string, unknown>;
  switch (i.hook_event_name) {
    case "PreToolUse":
    case "PermissionRequest":
    case "PostToolUse":
    case "PostToolUseFailure":
    case "PermissionDenied":
      return {
        toolName: i.tool_name as string | undefined,
        toolInput: i.tool_input as Record<string, unknown> | undefined,
      };
    default:
      return {};
  }
}

function subjectForClaudeInput(input: HookEventInput): string {
  // Same Zod v4 .loose() cast as toolContextFromInput — all props are unknown without it.
  const i = input as { hook_event_name: HookEventName } & Record<string, unknown>;
  switch (i.hook_event_name) {
    case "SessionStart":
      return i.source as string;
    case "InstructionsLoaded":
      return i.file_path as string;
    case "UserPromptSubmit":
      return i.prompt as string;
    case "PreToolUse":
    case "PermissionRequest":
    case "PostToolUse":
    case "PostToolUseFailure":
    case "PermissionDenied":
      return i.tool_name as string;
    case "Notification":
      return i.notification_type as string;
    case "SubagentStart":
      return i.agent_type as string;
    case "SubagentStop":
      return i.last_assistant_message as string;
    case "TaskCreated":
    case "TaskCompleted":
      return i.task_subject as string;
    case "Stop":
      return i.last_assistant_message as string;
    case "StopFailure":
      return i.error as string;
    case "TeammateIdle":
      return i.teammate_name as string;
    case "ConfigChange":
      return i.source as string;
    case "CwdChanged":
      return i.new_cwd as string;
    case "FileChanged":
      return i.file_path as string;
    case "WorktreeCreate":
      return i.name as string;
    case "WorktreeRemove":
      return i.worktree_path as string;
    case "PreCompact":
    case "PostCompact":
      return i.trigger as string;
    case "SessionEnd":
      return i.reason as string;
    case "Elicitation":
      return i.mcp_server_name as string;
    case "ElicitationResult":
      return `${i.mcp_server_name as string}:${i.action as string}`;
    default: {
      const _exhaustive: never = i.hook_event_name;
      return _exhaustive;
    }
  }
}

/** Resolve handlers from merged config + parsed stdin payload. */
export function resolveMatchingClaudeHandlersFromInput(
  config: HooksConfig,
  input: HookEventInput,
): HookHandler[] {
  return resolveMatchingClaudeHandlers(
    config,
    (input as { hook_event_name: HookEventName }).hook_event_name,
    claudeResolutionContextFromInput(input),
  );
}

/** Effective timeout in seconds (Claude command/http handlers; default 600 when omitted). */
export function effectiveClaudeHandlerTimeoutSec(handler: Pick<HookHandler, "timeout">): number {
  return handler.timeout ?? 600;
}
