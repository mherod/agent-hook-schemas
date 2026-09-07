import { z } from "zod";
import { bashHookIfMatches } from "./claude-bash-if.ts";
import {
  ClaudeSettingsFragmentSchema,
  ClaudeSettingsSchema,
  HookEventNameSchema,
  LooksLikeMcpToolName,
  type ClaudeSettings,
  type HookEventInput,
  type HookEventName,
  type HookHandler,
  type HooksConfig,
  type MatcherGroup,
  type PermissionRuleString,
  type SettingsPermissions,
} from "./claude.ts";
import {
  appendHookEntriesByEvent,
  mergeHookConfigLayers,
  parseSchemaResult,
  regexMatcherMatches,
  simpleGlobToRegExp,
  type HookResolutionContext,
} from "./common.ts";

/** Context for matcher + optional `if` (tool-shaped stdin only). */
export type ClaudeHookResolutionContext = HookResolutionContext;

/**
 * Merge hook matcher groups from multiple Claude settings fragments (user + project + local +
 * policy order is a caller concern). Later entries append after earlier ones per event, like Codex
 * `hooks.json` discovery.
 *
 * A layer with `disableAllHooks: true` clears all hooks accumulated so far — subsequent layers
 * can re-add hooks after the disable (matching Claude Code's layered settings precedence).
 */
export function mergeClaudeHooksFiles(
  files: unknown[],
): { ok: true; config: HooksConfig } | { ok: false; index: number; error: z.ZodError } {
  // Lazy evaluation: extract options inside function to avoid module-level initialization
  // issues when bundler splits this into separate chunks
  const claudeHookEvents = HookEventNameSchema.options;
  return mergeHookConfigLayers<HookEventName, MatcherGroup, typeof ClaudeSettingsFragmentSchema>({
    files,
    schema: ClaudeSettingsFragmentSchema,
    events: claudeHookEvents,
    getHooks: (layer) => layer.hooks,
    shouldReset: (layer) => layer.disableAllHooks === true,
  });
}

/**
 * Simple names/lists match exactly; patterns with other characters use RegExp.
 * Omitted, empty, and star matchers match everything.
 */
export function claudeMatcherMatches(
  matcher: string | undefined,
  subject: string,
  event?: HookEventName,
): boolean {
  if (matcher === undefined || matcher === "" || matcher === "*") return true;
  const narrow = event === "FileChanged" || event === "StopFailure";
  if ((narrow ? /^[A-Za-z0-9_|]+$/ : /^[A-Za-z0-9_\- ,|]+$/).test(matcher)) {
    return matcher.split(narrow ? /\|/ : /[|,]/).some((value) => (narrow ? value : value.trim()) === subject);
  }
  return regexMatcherMatches(matcher, subject);
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
    globRe = simpleGlobToRegExp(pattern);
  } catch {
    return false;
  }

  if (toolName === "Bash" && typeof toolInput.command === "string") {
    return bashHookIfMatches(toolInput.command, pattern);
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
 * Command, HTTP, MCP, prompt and agent handlers are returned when supported by the event.
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
    const ignoresMatcher = ["UserPromptSubmit", "MessageDisplay", "PostToolBatch", "Stop", "TeammateIdle",
      "TaskCreated", "TaskCompleted", "CwdChanged", "WorktreeCreate", "WorktreeRemove"].includes(event);
    if (!ignoresMatcher && !claudeMatcherMatches(g.matcher, ctx.subject, event)) continue;
    for (const h of g.hooks) {
      if ((event === "PreModelSwitch" || event === "PostModelSwitch") && (h.type === "prompt" || h.type === "agent")) continue;
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
    case "Setup":
      return i.trigger as string;
    case "InstructionsLoaded":
      return i.load_reason as string;
    case "UserPromptSubmit":
      return i.prompt as string;
    case "UserPromptExpansion":
      return i.command_name as string;
    case "PreToolUse":
    case "PermissionRequest":
    case "PostToolUse":
    case "PostToolUseFailure":
    case "PermissionDenied":
      return i.tool_name as string;
    case "PostToolBatch":
      return "";
    case "Notification":
      return i.notification_type as string;
    case "MessageDisplay":
      return i.message_text as string;
    case "SubagentStart":
      return i.agent_type as string;
    case "SubagentStop":
      return i.agent_type as string;
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
    case "DirectoryAdded":
      return i.source as string;
    case "PreCompact":
    case "PostCompact":
      return i.trigger as string;
    case "PreModelSwitch":
    case "PostModelSwitch":
      // The reference uses canonical model names; callers with provider-specific
      // IDs may supply their canonical subject to resolveMatchingClaudeHandlers.
      return i.to_model as string;
    case "SessionEnd":
      return i.reason as string;
    case "Elicitation":
      return i.mcp_server_name as string;
    case "ElicitationResult":
      return i.mcp_server_name as string;
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

/** Shared SessionEnd budget from settings handlers; plugin timeouts do not raise it. */
export function effectiveClaudeSessionEndBudgetSec(
  settingsHandlers: readonly Pick<HookHandler, "timeout">[],
): number {
  return settingsHandlers.reduce((budget, handler) => Math.min(Math.max(budget, handler.timeout ?? 0), 60), 1.5);
}

/**
 * Event/type defaults. Infinity denotes async:true without asyncRewake.
 * For SessionEnd, pass the shared settings budget (or explicit environment override
 * in seconds). When omitted, estimate the budget using this handler alone.
 */
export function effectiveClaudeHandlerTimeoutSec(
  handler: Pick<HookHandler, "timeout"> & { type?: HookHandler["type"]; async?: boolean; asyncRewake?: boolean },
  event?: HookEventName,
  sessionEndBudgetSec?: number,
): number {
  if ((handler.type === undefined || handler.type === "command") && handler.async && !handler.asyncRewake) return Infinity;
  if (event === "SessionEnd") {
    const budget = sessionEndBudgetSec ?? effectiveClaudeSessionEndBudgetSec([handler]);
    return Math.min(handler.timeout ?? budget, budget);
  }
  if (handler.timeout !== undefined) return handler.timeout;
  if (handler.type === "prompt") return 30;
  if (handler.type === "agent") return 60;
  if (event === "MessageDisplay") return 10;
  if (event === "UserPromptSubmit" || event === "PreModelSwitch" || event === "PostModelSwitch") return 30;
  return 600;
}

// ---------------------------------------------------------------------------
// Permission rule matching (settings.json `permissions.allow` / `permissions.deny`)
// ---------------------------------------------------------------------------

/**
 * Parse a permission rule string into tool name and optional glob pattern.
 * Rules follow the same `Tool(glob)` syntax as hook handler `if`, e.g.
 * `"Bash(git *)"`, `"Edit(*.ts)"`, or bare `"Read"`.
 *
 * Returns `undefined` for malformed rules.
 */
export function parsePermissionRule(
  rule: PermissionRuleString,
): { toolName: string; pattern: string | undefined } | undefined {
  const parenOpen = rule.indexOf("(");
  if (parenOpen === -1) {
    const toolName = rule.trim();
    return toolName ? { toolName, pattern: undefined } : undefined;
  }
  const parenClose = rule.lastIndexOf(")");
  if (parenClose <= parenOpen) return undefined;
  const toolName = rule.slice(0, parenOpen).trim();
  if (!toolName) return undefined;
  const pattern = rule.slice(parenOpen + 1, parenClose).trim();
  return { toolName, pattern: pattern || undefined };
}

/**
 * Whether a permission rule matches a given tool call. Uses the same glob matching
 * semantics as hook `if` guards via {@link claudeToolIfMatches}.
 *
 * Bare rules (e.g. `"Bash"`) match all invocations of that tool.
 * Rules with a glob (e.g. `"Bash(git *)"`) match only when the tool input satisfies the glob.
 */
export function claudePermissionRuleMatches(
  rule: PermissionRuleString,
  toolName: string,
  toolInput: Record<string, unknown>,
): boolean {
  const parsed = parsePermissionRule(rule);
  if (!parsed) return false;
  if (parsed.toolName !== toolName) {
    // Support colon-separated patterns like "Bash(git status:*)"
    // where the colon is part of the glob, not a tool:pattern separator
    if (!rule.startsWith(`${toolName}(`)) return false;
  }
  if (!parsed.pattern) return parsed.toolName === toolName;
  // Hook filters intentionally run on uncertain shell syntax. Permission rules
  // must never turn that conservative hook selection into an authorization.
  if (toolName === "Bash") {
    return typeof toolInput.command === "string" && simpleGlobToRegExp(parsed.pattern).test(toolInput.command);
  }
  return claudeToolIfMatches(toolName, toolInput, rule);
}

/**
 * Check whether a tool call is allowed, denied, or unspecified by the
 * `permissions` block of a settings file.
 *
 * Evaluation order (matching Claude Code behaviour):
 * 1. If any `deny` rule matches → `"deny"`
 * 2. If any `allow` rule matches → `"allow"`
 * 3. Otherwise → `undefined` (falls through to permission mode / prompt)
 */
export function evaluateSettingsPermissions(
  permissions: SettingsPermissions | undefined,
  toolName: string,
  toolInput: Record<string, unknown>,
): "allow" | "deny" | undefined {
  if (!permissions) return undefined;
  if (permissions.deny?.some((r) => claudePermissionRuleMatches(r, toolName, toolInput))) {
    return "deny";
  }
  if (permissions.allow?.some((r) => claudePermissionRuleMatches(r, toolName, toolInput))) {
    return "allow";
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Full settings merge (hooks + permissions + env)
// ---------------------------------------------------------------------------

/** Result of merging multiple complete settings layers. */
export type MergedClaudeSettings = {
  hooks: HooksConfig;
  permissions: SettingsPermissions;
  env: Record<string, string>;
  disableAllHooks: boolean;
};

/**
 * Merge complete Claude settings layers (user → project → local → policy order).
 *
 * - **Hooks** are appended per event (same as {@link mergeClaudeHooksFiles}), with
 *   `disableAllHooks` clearing accumulated hooks at the layer that sets it.
 * - **Permissions** `allow`/`deny` arrays are concatenated across layers.
 * - **Env** vars are shallow-merged (later layers override earlier ones).
 */
export function mergeClaudeSettings(
  files: unknown[],
):
  | { ok: true; settings: MergedClaudeSettings }
  | { ok: false; index: number; error: z.ZodError } {
  let hooks: HooksConfig = {};
  let disableAllHooks = false;
  const allow: PermissionRuleString[] = [];
  const deny: PermissionRuleString[] = [];
  const env: Record<string, string> = {};

  for (let i = 0; i < files.length; i++) {
    const parsed = ClaudeSettingsSchema.safeParse(files[i]);
    if (!parsed.success) return { ok: false, index: i, error: parsed.error };
    const data = parsed.data;

    // Hooks
    if (data.disableAllHooks) {
      hooks = {};
      disableAllHooks = true;
    }
    if (data.hooks) {
      appendHookEntriesByEvent(hooks, data.hooks, HookEventNameSchema.options);
    }

    // Permissions
    if (data.permissions?.allow) allow.push(...data.permissions.allow);
    if (data.permissions?.deny) deny.push(...data.permissions.deny);

    // Env
    if (data.env) Object.assign(env, data.env);
  }

  return {
    ok: true,
    settings: {
      hooks,
      permissions: {
        ...(allow.length ? { allow } : {}),
        ...(deny.length ? { deny } : {}),
      },
      env,
      disableAllHooks,
    },
  };
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/** Validate a complete `settings.json` file. Returns typed settings or Zod error. */
export function parseClaudeSettings(json: unknown):
  | { ok: true; settings: ClaudeSettings }
  | { ok: false; error: z.ZodError } {
  return parseSchemaResult(ClaudeSettingsSchema, json, "settings");
}
