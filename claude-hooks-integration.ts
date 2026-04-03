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
  switch (input.hook_event_name) {
    case "PreToolUse":
    case "PermissionRequest":
    case "PostToolUse":
    case "PostToolUseFailure":
    case "PermissionDenied":
      return { toolName: input.tool_name, toolInput: input.tool_input };
    default:
      return {};
  }
}

function subjectForClaudeInput(input: HookEventInput): string {
  switch (input.hook_event_name) {
    case "SessionStart":
      return input.source;
    case "InstructionsLoaded":
      return input.file_path;
    case "UserPromptSubmit":
      return input.prompt;
    case "PreToolUse":
    case "PermissionRequest":
    case "PostToolUse":
    case "PostToolUseFailure":
    case "PermissionDenied":
      return input.tool_name;
    case "Notification":
      return input.notification_type;
    case "SubagentStart":
      return input.agent_type;
    case "SubagentStop":
      return input.last_assistant_message;
    case "TaskCreated":
    case "TaskCompleted":
      return input.task_subject;
    case "Stop":
      return input.last_assistant_message;
    case "StopFailure":
      return input.error;
    case "TeammateIdle":
      return input.teammate_name;
    case "ConfigChange":
      return input.source;
    case "CwdChanged":
      return input.new_cwd;
    case "FileChanged":
      return input.file_path;
    case "WorktreeCreate":
      return input.name;
    case "WorktreeRemove":
      return input.worktree_path;
    case "PreCompact":
    case "PostCompact":
      return input.trigger;
    case "SessionEnd":
      return input.reason;
    case "Elicitation":
      return input.mcp_server_name;
    case "ElicitationResult":
      return `${input.mcp_server_name}:${input.action}`;
    default: {
      const _exhaustive: never = input;
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
    input.hook_event_name,
    claudeResolutionContextFromInput(input),
  );
}

/** Effective timeout in seconds (Claude command/http handlers; default 600 when omitted). */
export function effectiveClaudeHandlerTimeoutSec(handler: Pick<HookHandler, "timeout">): number {
  return handler.timeout ?? 600;
}
