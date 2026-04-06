import { z } from "zod";
import {
  CommandHookHandlerSchema,
  HookHandlerCommonSchema,
  HookShellSchema,
  JsonObjectSchema,
  OptionalBooleanField,
  OptionalToolNameField,
  PreToolPermissionDecisionSchema,
  type SharedHookSpecificContextOnlyEventName,
  SharedHookEventNameSchema,
  SharedHookSpecificPostToolUseOutputSchema,
  SharedHookSpecificPreToolUseOutputSchema,
  SharedHookSpecificSessionStartOutputSchema,
  SharedHookSpecificUserPromptSubmitOutputSchema,
  ToolCallCoreSchema,
  sharedHookSpecificAdditionalContextSchema,
} from "./common.ts";

export type { JsonObject, PreToolPermissionDecision } from "./common.ts";
export {
  CommandHookHandlerSchema,
  HookShellSchema,
  JsonObjectSchema,
  PreToolPermissionDecisionSchema,
  ToolCallCoreSchema,
} from "./common.ts";

// ---------------------------------------------------------------------------
// Enums & shared literals
// ---------------------------------------------------------------------------

/**
 * Claude Code `defaultMode` / hook stdin `permission_mode` values (configure permissions).
 * See [Permission modes](https://code.claude.com/docs/en/permission-modes.md).
 *
 * - `default` — prompt on first use of each tool
 * - `acceptEdits` — auto-accept file edits for the session (except protected dirs)
 * - `plan` — plan mode: analyze only, no file changes or shell
 * - `auto` — auto-approve with classifier safety checks (research preview)
 * - `dontAsk` — auto-deny unless pre-approved via `/permissions` or allow rules
 * - `bypassPermissions` — skip prompts except protected dirs; use only in isolated envs
 */
export const PermissionModeSchema = z.enum([
  "default",
  "acceptEdits",
  "plan",
  "auto",
  "dontAsk",
  "bypassPermissions",
]);

/**
 * Forward-compatible version of PermissionModeSchema for hook input parsing.
 * Accepts known values + any unknown string for future compatibility.
 */
export const PermissionModeInputSchema = PermissionModeSchema.or(z.string());
export type PermissionMode = z.infer<typeof PermissionModeSchema>;

export const HookEventNameSchema = z.enum([
  "SessionStart",
  "InstructionsLoaded",
  "UserPromptSubmit",
  "PreToolUse",
  "PermissionRequest",
  "PostToolUse",
  "PostToolUseFailure",
  "PermissionDenied",
  "Notification",
  "SubagentStart",
  "SubagentStop",
  "TaskCreated",
  "TaskCompleted",
  "Stop",
  "StopFailure",
  "TeammateIdle",
  "ConfigChange",
  "CwdChanged",
  "FileChanged",
  "WorktreeCreate",
  "WorktreeRemove",
  "PreCompact",
  "PostCompact",
  "SessionEnd",
  "Elicitation",
  "ElicitationResult",
]);

/**
 * Forward-compatible version of HookEventNameSchema for hook input parsing.
 * Accepts known event names + any unknown string for future event types.
 */
export const HookEventNameInputSchema = HookEventNameSchema.or(z.string());
export type HookEventName = z.infer<typeof HookEventNameSchema>;

export const SessionStartSourceSchema = z.enum(["startup", "resume", "clear", "compact"]);
export type SessionStartSource = z.infer<typeof SessionStartSourceSchema>;

/**
 * Forward-compatible version of SessionStartSourceSchema for hook input parsing.
 * Accepts known sources + any unknown string for future source types.
 */
export const SessionStartSourceInputSchema = SessionStartSourceSchema.or(z.string());

export const MemoryTypeSchema = z.enum(["User", "Project", "Local", "Managed"]);
export type MemoryType = z.infer<typeof MemoryTypeSchema>;

export const InstructionsLoadReasonSchema = z.enum([
  "session_start",
  "nested_traversal",
  "path_glob_match",
  "include",
  "compact",
]);
export type InstructionsLoadReason = z.infer<typeof InstructionsLoadReasonSchema>;

export const ConfigChangeSourceSchema = z.enum([
  "user_settings",
  "project_settings",
  "local_settings",
  "policy_settings",
  "skills",
]);

/**
 * Forward-compatible version of ConfigChangeSourceSchema for hook input parsing.
 * Accepts known sources + any unknown string for future source types.
 */
export const ConfigChangeSourceInputSchema = ConfigChangeSourceSchema.or(z.string());
export type ConfigChangeSource = z.infer<typeof ConfigChangeSourceSchema>;

export const NotificationTypeSchema = z.enum([
  "permission_prompt",
  "idle_prompt",
  "auth_success",
  "elicitation_dialog",
]);

/**
 * Forward-compatible version of NotificationTypeSchema for hook input parsing.
 * Accepts known types + any unknown string for future notification types.
 */
export const NotificationTypeInputSchema = NotificationTypeSchema.or(z.string());
export type NotificationType = z.infer<typeof NotificationTypeSchema>;

export const CompactTriggerSchema = z.enum(["manual", "auto"]);
export type CompactTrigger = z.infer<typeof CompactTriggerSchema>;

export const SessionEndReasonSchema = z.enum([
  "clear",
  "resume",
  "logout",
  "prompt_input_exit",
  "bypass_permissions_disabled",
  "other",
]);
export type SessionEndReason = z.infer<typeof SessionEndReasonSchema>;

export const StopFailureErrorSchema = z.enum([
  "rate_limit",
  "authentication_failed",
  "billing_error",
  "invalid_request",
  "server_error",
  "max_output_tokens",
  "unknown",
]);
export type StopFailureError = z.infer<typeof StopFailureErrorSchema>;

export const FileWatchEventSchema = z.enum(["change", "add", "unlink"]);
export type FileWatchEvent = z.infer<typeof FileWatchEventSchema>;

export const ElicitationModeSchema = z.enum(["form", "url"]);
export type ElicitationMode = z.infer<typeof ElicitationModeSchema>;

export const ElicitationActionSchema = z.enum(["accept", "decline", "cancel"]);
export type ElicitationAction = z.infer<typeof ElicitationActionSchema>;

export const PermissionDestinationSchema = z.enum([
  "session",
  "localSettings",
  "projectSettings",
  "userSettings",
]);
export type PermissionDestination = z.infer<typeof PermissionDestinationSchema>;

/**
 * Built-in Claude Code tool names from the hooks guide. MCP tools use
 * {@link McpToolNamePattern} instead (`mcp__<server>__<tool>`).
 */
export const ClaudeCodeBuiltinToolNameSchema = z.enum([
  "Agent",
  "AskUserQuestion",
  "Bash",
  "Edit",
  "ExitPlanMode",
  "Glob",
  "Grep",
  "Read",
  "TaskCreate",
  "TaskGet",
  "TaskList",
  "TaskOutput",
  "TaskStop",
  "TaskUpdate",
  "ToolSearch",
  "WebFetch",
  "WebSearch",
  "Write",
]);
export type ClaudeCodeBuiltinToolName = z.infer<typeof ClaudeCodeBuiltinToolNameSchema>;

/** Matches MCP tool names such as `mcp__github__search_repositories`. */
export const McpToolNamePattern = /^mcp__[^_]+__.+/;

export const McpToolNameSchema = z.string().regex(McpToolNamePattern, {
  message: 'Expected MCP tool name like "mcp__github__search_repositories"',
});

/**
 * Permission-rule syntax for hook handler `if` (tool events only), e.g.
 * `Bash(git *)`, `Edit(*.ts)`. Requires Claude Code v2.1.85+.
 */
export const ToolHookIfRuleSchema = z.string().min(1);
export type ToolHookIfRule = z.infer<typeof ToolHookIfRuleSchema>;

/** Common matcher strings from the hooks guide (regex fragments; still typed as string). */
export const PostToolUseEditWriteMatcher = "Edit|Write" as const;
export const PreToolUseBashMatcher = "Bash" as const;

// ---------------------------------------------------------------------------
// Tool inputs / responses — see claude-tool-schemas.ts
// ---------------------------------------------------------------------------

export * from "./claude-tool-schemas.ts";
import { BashToolInputSchema, EditToolInputSchema, GenericToolInputSchema, WriteToolInputSchema } from "./claude-tool-schemas.ts";

// ---------------------------------------------------------------------------
// Permission suggestions & updates
// ---------------------------------------------------------------------------

export const PermissionRuleSchema = z.object({
  toolName: z.string(),
  ruleContent: z.string().optional(),
});
export type PermissionRule = z.infer<typeof PermissionRuleSchema>;

export const PermissionRuleBehaviorSchema = z.enum(["allow", "deny", "ask"]);
export type PermissionRuleBehavior = z.infer<typeof PermissionRuleBehaviorSchema>;

const PermissionUpdateRulesPayloadSchema = z.object({
  rules: z.array(PermissionRuleSchema),
  behavior: PermissionRuleBehaviorSchema,
  destination: PermissionDestinationSchema,
});

export const PermissionUpdateAddRulesSchema = PermissionUpdateRulesPayloadSchema.extend({
  type: z.literal("addRules"),
});

export const PermissionUpdateReplaceRulesSchema = PermissionUpdateRulesPayloadSchema.extend({
  type: z.literal("replaceRules"),
});

export const PermissionUpdateRemoveRulesSchema = PermissionUpdateRulesPayloadSchema.extend({
  type: z.literal("removeRules"),
});

/** Same shape as `addRules` permission updates (hooks reference). */
export const PermissionSuggestionSchema = PermissionUpdateAddRulesSchema;
export type PermissionSuggestion = z.infer<typeof PermissionSuggestionSchema>;

export const PermissionUpdateSetModeSchema = z.object({
  type: z.literal("setMode"),
  mode: PermissionModeSchema,
  destination: PermissionDestinationSchema,
});

const PermissionUpdateDirectoriesPayloadSchema = z.object({
  directories: z.array(z.string()),
  destination: PermissionDestinationSchema,
});

export const PermissionUpdateAddDirectoriesSchema = z
  .object({ type: z.literal("addDirectories") })
  .extend(PermissionUpdateDirectoriesPayloadSchema.shape);

export const PermissionUpdateRemoveDirectoriesSchema = z
  .object({ type: z.literal("removeDirectories") })
  .extend(PermissionUpdateDirectoriesPayloadSchema.shape);

export const PermissionUpdateEntrySchema = z.discriminatedUnion("type", [
  PermissionUpdateAddRulesSchema,
  PermissionUpdateReplaceRulesSchema,
  PermissionUpdateRemoveRulesSchema,
  PermissionUpdateSetModeSchema,
  PermissionUpdateAddDirectoriesSchema,
  PermissionUpdateRemoveDirectoriesSchema,
]);
export type PermissionUpdateEntry = z.infer<typeof PermissionUpdateEntrySchema>;

export const PermissionRequestBehaviorSchema = z.enum(["allow", "deny"]);
export type PermissionRequestBehavior = z.infer<typeof PermissionRequestBehaviorSchema>;

export const PermissionRequestDecisionOutputSchema = z.object({
  behavior: PermissionRequestBehaviorSchema,
  updatedInput: JsonObjectSchema.optional(),
  updatedPermissions: z.array(PermissionUpdateEntrySchema).optional(),
  message: z.string().optional(),
  interrupt: OptionalBooleanField,
});
export type PermissionRequestDecisionOutput = z.infer<typeof PermissionRequestDecisionOutputSchema>;

// ---------------------------------------------------------------------------
// Common hook input fragments (optional fields vary by event)
// ---------------------------------------------------------------------------

export const AgentHookContextSchema = z.object({
  agent_id: z.string().optional(),
  agent_type: z.string().optional(),
});
export type AgentHookContext = z.infer<typeof AgentHookContextSchema>;

/** Shared stdin fields for most hook events (+ optional subagent context). All fields optional for resilient parsing. */
export const HookInputBaseSchema = z
  .object({
    session_id: z.string().optional(),
    transcript_path: z.string().optional(),
    cwd: z.string().optional(),
    permission_mode: PermissionModeInputSchema.optional(),
  })
  .extend(AgentHookContextSchema.partial().shape);
export type HookInputBase = z.infer<typeof HookInputBaseSchema>;

/**
 * Claude Code hook stdin: {@link HookInputBaseSchema} + `hook_event_name` + `fields`.
 * Unknown keys are allowed (`.loose()`). Tool- and task-shaped events use explicit `.extend()` chains.
 */
function hookStdinLoose<const N extends HookEventName>(
  hookEventName: N,
  fields: z.ZodRawShape,
) {
  return HookInputBaseSchema.extend({ hook_event_name: z.literal(hookEventName) })
    .extend(fields)
    .loose();
}

const TaskTimelinePayloadSchema = z.object({
  task_id: z.string(),
  task_subject: z.string(),
  task_description: z.string().optional(),
  teammate_name: z.string().optional(),
  team_name: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Per-event hook inputs (stdin / HTTP body)
// ---------------------------------------------------------------------------

export const SessionStartInputSchema = hookStdinLoose("SessionStart", {
  source: SessionStartSourceInputSchema.optional(),
  model: z.string().optional(),
});
export type SessionStartInput = z.infer<typeof SessionStartInputSchema>;

export const InstructionsLoadedInputSchema = hookStdinLoose("InstructionsLoaded", {
  file_path: z.string().optional(),
  memory_type: MemoryTypeSchema.optional(),
  load_reason: InstructionsLoadReasonSchema.optional(),
  globs: z.array(z.string()).optional(),
  trigger_file_path: z.string().optional(),
  parent_file_path: z.string().optional(),
});
export type InstructionsLoadedInput = z.infer<typeof InstructionsLoadedInputSchema>;

export const UserPromptSubmitInputSchema = hookStdinLoose("UserPromptSubmit", {
  prompt: z.string().optional(),
});
export type UserPromptSubmitInput = z.infer<typeof UserPromptSubmitInputSchema>;

export const PreToolUseInputSchema = HookInputBaseSchema.extend({
  hook_event_name: z.literal("PreToolUse"),
})
  .extend(ToolCallCoreSchema.partial().shape)
  .extend({ tool_use_id: z.string().optional() })
  .loose();
export type PreToolUseInput = z.infer<typeof PreToolUseInputSchema>;

export const PermissionRequestInputSchema = HookInputBaseSchema.extend({
  hook_event_name: z.literal("PermissionRequest"),
})
  .extend(ToolCallCoreSchema.partial().shape)
  .extend({
    permission_suggestions: z.array(PermissionSuggestionSchema).optional(),
  })
  .loose();
export type PermissionRequestInput = z.infer<typeof PermissionRequestInputSchema>;

export const PostToolUseInputSchema = HookInputBaseSchema.extend({
  hook_event_name: z.literal("PostToolUse"),
})
  .extend(ToolCallCoreSchema.partial().shape)
  .extend({
    tool_response: JsonObjectSchema.optional(),
    tool_use_id: z.string().optional(),
  })
  .loose();
export type PostToolUseInput = z.infer<typeof PostToolUseInputSchema>;

export const PostToolUseFailureInputSchema = HookInputBaseSchema.extend({
  hook_event_name: z.literal("PostToolUseFailure"),
})
  .extend(ToolCallCoreSchema.partial().shape)
  .extend({
    tool_use_id: z.string().optional(),
    error: z.string().optional(),
    is_interrupt: OptionalBooleanField,
  })
  .loose();
export type PostToolUseFailureInput = z.infer<typeof PostToolUseFailureInputSchema>;

export const PermissionDeniedInputSchema = HookInputBaseSchema.extend({
  hook_event_name: z.literal("PermissionDenied"),
})
  .extend(ToolCallCoreSchema.partial().shape)
  .extend({
    tool_use_id: z.string().optional(),
    reason: z.string().optional(),
  })
  .loose();
export type PermissionDeniedInput = z.infer<typeof PermissionDeniedInputSchema>;

export const NotificationInputSchema = hookStdinLoose("Notification", {
  message: z.string().optional(),
  title: z.string().optional(),
  notification_type: NotificationTypeInputSchema.optional(),
});
export type NotificationInput = z.infer<typeof NotificationInputSchema>;

export const SubagentStartInputSchema = hookStdinLoose("SubagentStart", {
  agent_id: z.string().optional(),
  agent_type: z.string().optional(),
});
export type SubagentStartInput = z.infer<typeof SubagentStartInputSchema>;

export const SubagentStopInputSchema = hookStdinLoose("SubagentStop", {
  stop_hook_active: OptionalBooleanField,
  agent_id: z.string().optional(),
  agent_type: z.string().optional(),
  agent_transcript_path: z.string().optional(),
  last_assistant_message: z.string().optional(),
});
export type SubagentStopInput = z.infer<typeof SubagentStopInputSchema>;

export const TaskCreatedInputSchema = HookInputBaseSchema.extend({
  hook_event_name: z.literal("TaskCreated"),
})
  .extend(TaskTimelinePayloadSchema.partial().shape)
  .loose();
export type TaskCreatedInput = z.infer<typeof TaskCreatedInputSchema>;

export const TaskCompletedInputSchema = HookInputBaseSchema.extend({
  hook_event_name: z.literal("TaskCompleted"),
})
  .extend(TaskTimelinePayloadSchema.partial().shape)
  .loose();
export type TaskCompletedInput = z.infer<typeof TaskCompletedInputSchema>;

export const StopInputSchema = hookStdinLoose("Stop", {
  stop_hook_active: OptionalBooleanField,
  last_assistant_message: z.string().optional(),
});
export type StopInput = z.infer<typeof StopInputSchema>;

export const StopFailureInputSchema = hookStdinLoose("StopFailure", {
  error: StopFailureErrorSchema.optional(),
  error_details: z.string().optional(),
  last_assistant_message: z.string().optional(),
});
export type StopFailureInput = z.infer<typeof StopFailureInputSchema>;

export const TeammateIdleInputSchema = hookStdinLoose("TeammateIdle", {
  teammate_name: z.string().optional(),
  team_name: z.string().optional(),
});
export type TeammateIdleInput = z.infer<typeof TeammateIdleInputSchema>;

export const ConfigChangeInputSchema = hookStdinLoose("ConfigChange", {
  source: ConfigChangeSourceInputSchema.optional(),
  file_path: z.string().optional(),
});
export type ConfigChangeInput = z.infer<typeof ConfigChangeInputSchema>;

export const CwdChangedInputSchema = hookStdinLoose("CwdChanged", {
  old_cwd: z.string().optional(),
  new_cwd: z.string().optional(),
});
export type CwdChangedInput = z.infer<typeof CwdChangedInputSchema>;

export const FileChangedInputSchema = hookStdinLoose("FileChanged", {
  file_path: z.string().optional(),
  event: FileWatchEventSchema.optional(),
});
export type FileChangedInput = z.infer<typeof FileChangedInputSchema>;

export const WorktreeCreateInputSchema = hookStdinLoose("WorktreeCreate", {
  name: z.string().optional(),
});
export type WorktreeCreateInput = z.infer<typeof WorktreeCreateInputSchema>;

export const WorktreeRemoveInputSchema = hookStdinLoose("WorktreeRemove", {
  worktree_path: z.string().optional(),
});
export type WorktreeRemoveInput = z.infer<typeof WorktreeRemoveInputSchema>;

export const PreCompactInputSchema = hookStdinLoose("PreCompact", {
  trigger: CompactTriggerSchema.optional(),
  custom_instructions: z.string().optional(),
});
export type PreCompactInput = z.infer<typeof PreCompactInputSchema>;

export const PostCompactInputSchema = hookStdinLoose("PostCompact", {
  trigger: CompactTriggerSchema.optional(),
  compact_summary: z.string().optional(),
});
export type PostCompactInput = z.infer<typeof PostCompactInputSchema>;

export const SessionEndInputSchema = hookStdinLoose("SessionEnd", {
  reason: SessionEndReasonSchema.optional(),
});
export type SessionEndInput = z.infer<typeof SessionEndInputSchema>;

export const ElicitationInputSchema = hookStdinLoose("Elicitation", {
  mcp_server_name: z.string().optional(),
  message: z.string().optional(),
  mode: ElicitationModeSchema.optional(),
  url: z.string().optional(),
  elicitation_id: z.string().optional(),
  requested_schema: JsonObjectSchema.optional(),
});
export type ElicitationInput = z.infer<typeof ElicitationInputSchema>;

const ElicitationResultPayloadSchema = z.object({
  mcp_server_name: z.string().optional(),
  action: ElicitationActionSchema.optional(),
  mode: ElicitationModeSchema.optional(),
  elicitation_id: z.string().optional(),
  content: JsonObjectSchema.optional(),
});

export const ElicitationResultInputSchema = HookInputBaseSchema.extend({
  hook_event_name: z.literal("ElicitationResult"),
})
  .extend(ElicitationResultPayloadSchema.shape)
  .loose();
export type ElicitationResultInput = z.infer<typeof ElicitationResultInputSchema>;

/**
 * Fallback catch-all schema for unknown Claude hook events (forward compatibility).
 * Accepts only hook_event_name values that aren't in the known HookEventNameSchema enum.
 * This prevents known events with validation failures from being accepted via fallback.
 */
const UnknownHookEventInputSchema = HookInputBaseSchema.extend({
  hook_event_name: z.string().refine(
    (name) => !HookEventNameSchema.safeParse(name).success,
    { message: "Use specific event schema for known event names" },
  ),
}).loose();

/** Discriminated union: parse unknown hook stdin in one step. */
export const HookEventInputSchema = z.discriminatedUnion("hook_event_name", [
  SessionStartInputSchema,
  InstructionsLoadedInputSchema,
  UserPromptSubmitInputSchema,
  PreToolUseInputSchema,
  PermissionRequestInputSchema,
  PostToolUseInputSchema,
  PostToolUseFailureInputSchema,
  PermissionDeniedInputSchema,
  NotificationInputSchema,
  SubagentStartInputSchema,
  SubagentStopInputSchema,
  TaskCreatedInputSchema,
  TaskCompletedInputSchema,
  StopInputSchema,
  StopFailureInputSchema,
  TeammateIdleInputSchema,
  ConfigChangeInputSchema,
  CwdChangedInputSchema,
  FileChangedInputSchema,
  WorktreeCreateInputSchema,
  WorktreeRemoveInputSchema,
  PreCompactInputSchema,
  PostCompactInputSchema,
  SessionEndInputSchema,
  ElicitationInputSchema,
  ElicitationResultInputSchema,
]).or(UnknownHookEventInputSchema);
export type HookEventInput = z.infer<typeof HookEventInputSchema>;

// ---------------------------------------------------------------------------
// Hook stdout / HTTP response JSON
// ---------------------------------------------------------------------------

/**
 * Fields every `hookSpecificOutput` payload shares (Claude Code hooks reference).
 * Event-specific schemas narrow `hookEventName` with `z.literal(...)`.
 */
export const BaseHookSpecificOutputSchema = z.object({
  hookEventName: HookEventNameSchema,
});
export type BaseHookSpecificOutput = z.infer<typeof BaseHookSpecificOutputSchema>;

function isSharedHookEventName(name: HookEventName): name is z.infer<typeof SharedHookEventNameSchema> {
  return SharedHookEventNameSchema.safeParse(name).success;
}

/** `hookSpecificOutput` with optional `additionalContext` (shared with Codex stdout for overlapping events). */
export function HookSpecificAdditionalContextSchema<const N extends HookEventName>(hookEventName: N) {
  if (hookEventName === "PreToolUse") {
    return SharedHookSpecificPreToolUseOutputSchema;
  }
  if (isSharedHookEventName(hookEventName)) {
    return sharedHookSpecificAdditionalContextSchema(
      hookEventName as SharedHookSpecificContextOnlyEventName,
    );
  }
  return BaseHookSpecificOutputSchema.extend({
    hookEventName: z.literal(hookEventName),
    additionalContext: z.string().optional(),
  });
}

const HookSpecificElicitationBodySchema = z.object({
  action: ElicitationActionSchema,
  content: JsonObjectSchema.optional(),
});

export const HookSpecificPreToolUseOutputSchema = SharedHookSpecificPreToolUseOutputSchema;
export type HookSpecificPreToolUseOutput = z.infer<typeof HookSpecificPreToolUseOutputSchema>;

export const HookSpecificPermissionRequestOutputSchema = BaseHookSpecificOutputSchema.extend({
  hookEventName: z.literal("PermissionRequest"),
  decision: PermissionRequestDecisionOutputSchema,
});
export type HookSpecificPermissionRequestOutput = z.infer<
  typeof HookSpecificPermissionRequestOutputSchema
>;

export const HookSpecificPermissionDeniedOutputSchema = BaseHookSpecificOutputSchema.extend({
  hookEventName: z.literal("PermissionDenied"),
  retry: OptionalBooleanField,
});
export type HookSpecificPermissionDeniedOutput = z.infer<
  typeof HookSpecificPermissionDeniedOutputSchema
>;

export const HookSpecificSessionStartOutputSchema = SharedHookSpecificSessionStartOutputSchema;
export type HookSpecificSessionStartOutput = z.infer<typeof HookSpecificSessionStartOutputSchema>;

export const HookSpecificUserPromptSubmitOutputSchema =
  SharedHookSpecificUserPromptSubmitOutputSchema;
export type HookSpecificUserPromptSubmitOutput = z.infer<
  typeof HookSpecificUserPromptSubmitOutputSchema
>;

export const HookSpecificPostToolUseOutputSchema = SharedHookSpecificPostToolUseOutputSchema;
export type HookSpecificPostToolUseOutput = z.infer<typeof HookSpecificPostToolUseOutputSchema>;

export const HookSpecificPostToolUseFailureOutputSchema =
  HookSpecificAdditionalContextSchema("PostToolUseFailure");
export type HookSpecificPostToolUseFailureOutput = z.infer<
  typeof HookSpecificPostToolUseFailureOutputSchema
>;

export const HookSpecificSubagentStartOutputSchema =
  HookSpecificAdditionalContextSchema("SubagentStart");
export type HookSpecificSubagentStartOutput = z.infer<typeof HookSpecificSubagentStartOutputSchema>;

export const HookSpecificNotificationOutputSchema =
  HookSpecificAdditionalContextSchema("Notification");
export type HookSpecificNotificationOutput = z.infer<typeof HookSpecificNotificationOutputSchema>;

export const HookSpecificElicitationOutputSchema = BaseHookSpecificOutputSchema.extend({
  hookEventName: z.literal("Elicitation"),
}).extend(HookSpecificElicitationBodySchema.shape);
export type HookSpecificElicitationOutput = z.infer<typeof HookSpecificElicitationOutputSchema>;

export const HookSpecificElicitationResultOutputSchema = BaseHookSpecificOutputSchema.extend({
  hookEventName: z.literal("ElicitationResult"),
}).extend(HookSpecificElicitationBodySchema.shape);
export type HookSpecificElicitationResultOutput = z.infer<
  typeof HookSpecificElicitationResultOutputSchema
>;

export const HookSpecificWorktreeCreateOutputSchema = BaseHookSpecificOutputSchema.extend({
  hookEventName: z.literal("WorktreeCreate"),
  worktreePath: z.string(),
});
export type HookSpecificWorktreeCreateOutput = z.infer<
  typeof HookSpecificWorktreeCreateOutputSchema
>;

export const HookSpecificOutputSchema = z.union([
  HookSpecificPreToolUseOutputSchema,
  HookSpecificPermissionRequestOutputSchema,
  HookSpecificPermissionDeniedOutputSchema,
  HookSpecificSessionStartOutputSchema,
  HookSpecificUserPromptSubmitOutputSchema,
  HookSpecificPostToolUseOutputSchema,
  HookSpecificPostToolUseFailureOutputSchema,
  HookSpecificSubagentStartOutputSchema,
  HookSpecificNotificationOutputSchema,
  HookSpecificElicitationOutputSchema,
  HookSpecificElicitationResultOutputSchema,
  HookSpecificWorktreeCreateOutputSchema,
]);
export type HookSpecificOutput = z.infer<typeof HookSpecificOutputSchema>;

/** Broad stdout JSON: combine universal fields + optional event payload + block decision. */
export const HookCommandOutputSchema = z
  .object({
    continue: OptionalBooleanField,
    stopReason: z.string().optional(),
    suppressOutput: OptionalBooleanField,
    systemMessage: z.string().optional(),
    decision: z.literal("block").optional(),
    reason: z.string().optional(),
    additionalContext: z.string().optional(),
    watchPaths: z.array(z.string()).optional(),
    hookSpecificOutput: HookSpecificOutputSchema.optional(),
  })
  .loose();
export type HookCommandOutput = z.infer<typeof HookCommandOutputSchema>;

/** Prompt / agent hook model response. */
export const PromptHookModelResponseSchema = z.object({
  ok: z.boolean(),
  reason: z.string().optional(),
});
export type PromptHookModelResponse = z.infer<typeof PromptHookModelResponseSchema>;

// ---------------------------------------------------------------------------
// Settings: hook configuration (practical for plugins / settings.json)
// ---------------------------------------------------------------------------

export const HookHandlerTypeSchema = z.enum(["command", "http", "prompt", "agent"]);
export type HookHandlerType = z.infer<typeof HookHandlerTypeSchema>;

const PromptOrAgentHookPromptFieldsSchema = z.object({
  prompt: z.string(),
  model: z.string().optional(),
});

export type CommandHookHandler = z.infer<typeof CommandHookHandlerSchema>;

export const HttpHookHandlerSchema = HookHandlerCommonSchema.extend({
  type: z.literal("http"),
  url: z.string(),
  headers: z.record(z.string(), z.string()).optional(),
  allowedEnvVars: z.array(z.string()).optional(),
});
export type HttpHookHandler = z.infer<typeof HttpHookHandlerSchema>;

export const PromptHookHandlerSchema = HookHandlerCommonSchema.extend({
  type: z.literal("prompt"),
}).extend(PromptOrAgentHookPromptFieldsSchema.shape);
export type PromptHookHandler = z.infer<typeof PromptHookHandlerSchema>;

export const AgentHookHandlerSchema = HookHandlerCommonSchema.extend({
  type: z.literal("agent"),
}).extend(PromptOrAgentHookPromptFieldsSchema.shape);
export type AgentHookHandler = z.infer<typeof AgentHookHandlerSchema>;

export const HookHandlerSchema = z.discriminatedUnion("type", [
  CommandHookHandlerSchema,
  HttpHookHandlerSchema,
  PromptHookHandlerSchema,
  AgentHookHandlerSchema,
]);
export type HookHandler = z.infer<typeof HookHandlerSchema>;

/**
 * Hook matcher group. `matcher` may be omitted, `"*"`, or `""` to match all
 * occurrences where the event supports matchers (see hooks guide).
 */
export const MatcherGroupSchema = z.object({
  matcher: z.string().optional(),
  hooks: z.array(HookHandlerSchema),
});
export type MatcherGroup = z.infer<typeof MatcherGroupSchema>;

const MatcherGroupListSchema = z.array(MatcherGroupSchema);

const hooksConfigShape = Object.fromEntries(
  HookEventNameSchema.options.map((eventName) => [eventName, MatcherGroupListSchema]),
) as Record<HookEventName, typeof MatcherGroupListSchema>;

export const HooksConfigSchema = z.object(hooksConfigShape).partial();
export type HooksConfig = z.infer<typeof HooksConfigSchema>;

/**
 * For merge / matcher / `if` resolution over this config shape, see
 * {@link mergeClaudeHooksFiles} in `claude-hooks-integration.ts`.
 */

export const ClaudeSettingsHooksSchema = z.object({
  description: z.string().optional(),
  hooks: HooksConfigSchema,
});
export type ClaudeSettingsHooks = z.infer<typeof ClaudeSettingsHooksSchema>;

// ---------------------------------------------------------------------------
// Settings: permission rules (allow / deny lists in settings.json)
// ---------------------------------------------------------------------------

/**
 * Individual permission rule string as it appears in `permissions.allow` or
 * `permissions.deny` arrays. Same `Tool(glob)` syntax as hook handler `if`.
 *
 * Examples: `"Bash(git *)"`, `"Edit"`, `"WebFetch(domain:*.example.com)"`.
 */
export const PermissionRuleStringSchema = z.string().min(1);
export type PermissionRuleString = z.infer<typeof PermissionRuleStringSchema>;

export const SettingsPermissionsSchema = z.object({
  allow: z.array(PermissionRuleStringSchema).optional(),
  deny: z.array(PermissionRuleStringSchema).optional(),
});
export type SettingsPermissions = z.infer<typeof SettingsPermissionsSchema>;

// ---------------------------------------------------------------------------
// Settings: attribution, env, plugins, statusLine
// ---------------------------------------------------------------------------

export const SettingsAttributionSchema = z.object({
  commit: z.string().optional(),
  pr: z.string().optional(),
});
export type SettingsAttribution = z.infer<typeof SettingsAttributionSchema>;

export const StatusLineCommandSchema = z.object({
  type: z.literal("command"),
  command: z.string(),
});
export type StatusLineCommand = z.infer<typeof StatusLineCommandSchema>;

export const PluginSourceSchema = z.object({
  source: z.object({
    source: z.string(),
    repo: z.string(),
  }),
});

export const SettingsPluginsSchema = z.object({
  user: z.record(z.string(), z.string()).optional(),
});
export type SettingsPlugins = z.infer<typeof SettingsPluginsSchema>;

export const TeammateModeSchema = z.enum(["tmux", "tabs"]);
export type TeammateMode = z.infer<typeof TeammateModeSchema>;

// ---------------------------------------------------------------------------
// Settings: full settings.json schema
// ---------------------------------------------------------------------------

/**
 * Complete `~/.claude/settings.json` schema modelling hooks, permissions,
 * environment, plugins, and all known top-level fields.
 *
 * Every field is optional so the schema validates partial / layered files
 * (user, project, local, policy).
 */
export const ClaudeSettingsSchema = z
  .object({
    // Hooks
    hooks: HooksConfigSchema.optional(),
    disableAllHooks: OptionalBooleanField,

    // Permissions
    permissions: SettingsPermissionsSchema.optional(),
    defaultMode: PermissionModeSchema.optional(),

    // Environment
    env: z.record(z.string(), z.string()).optional(),

    // Attribution
    attribution: SettingsAttributionSchema.optional(),

    // Plugins
    enabledPlugins: z.record(z.string(), z.boolean()).optional(),
    plugins: SettingsPluginsSchema.optional(),
    extraKnownMarketplaces: z.record(z.string(), PluginSourceSchema).optional(),

    // UI / UX
    statusLine: StatusLineCommandSchema.optional(),
    teammateMode: TeammateModeSchema.optional(),

    // Misc
    effortLevel: z.string().optional(),
    autoUpdatesChannel: z.string().optional(),
    voiceEnabled: OptionalBooleanField,
    skipDangerousModePermissionPrompt: OptionalBooleanField,
  })
  .loose();
export type ClaudeSettings = z.infer<typeof ClaudeSettingsSchema>;

/**
 * Fragment of `~/.claude/settings.json` or `.claude/settings.json` that
 * configures hooks. Other keys are allowed (`.loose()`).
 *
 * For the full settings shape, see {@link ClaudeSettingsSchema}.
 */
export const ClaudeSettingsFragmentSchema = z
  .object({
    hooks: HooksConfigSchema.optional(),
    disableAllHooks: OptionalBooleanField,
  })
  .loose();
export type ClaudeSettingsFragment = z.infer<typeof ClaudeSettingsFragmentSchema>;

/**
 * Plugin `hooks/hooks.json` or skill/agent frontmatter `hooks:` — same shape as
 * {@link ClaudeSettingsHooksSchema} without top-level settings keys.
 */
export const SkillOrAgentHooksFragmentSchema = ClaudeSettingsHooksSchema;
export type SkillOrAgentHooksFragment = z.infer<typeof SkillOrAgentHooksFragmentSchema>;

// ---------------------------------------------------------------------------
// Guide-oriented hook outputs (ready-made stdout bodies)
// ---------------------------------------------------------------------------

const PermissionRequestAllowDecisionSchema = z.object({
  behavior: z.literal("allow"),
  updatedInput: JsonObjectSchema.optional(),
  updatedPermissions: z.array(PermissionUpdateEntrySchema).optional(),
  message: z.string().optional(),
  interrupt: OptionalBooleanField,
});

const PermissionRequestStdoutWithDecisionSchema = <D extends z.ZodTypeAny>(decisionSchema: D) =>
  z.object({
    hookSpecificOutput: z
      .object({ hookEventName: z.literal("PermissionRequest") })
      .extend({ decision: decisionSchema }),
  });

/** Minimal PermissionRequest approval (e.g. matcher `ExitPlanMode`). */
export const PermissionRequestAllowStdoutSchema =
  PermissionRequestStdoutWithDecisionSchema(PermissionRequestAllowDecisionSchema);
export type PermissionRequestAllowStdout = z.infer<typeof PermissionRequestAllowStdoutSchema>;

/** Allow and set session permission mode to `acceptEdits` (hooks guide recipe). */
export const PermissionRequestAllowAcceptEditsSessionStdoutSchema =
  PermissionRequestStdoutWithDecisionSchema(
    z.object({
      behavior: z.literal("allow"),
      updatedPermissions: z.array(PermissionUpdateSetModeSchema),
    }),
  );
export type PermissionRequestAllowAcceptEditsSessionStdout = z.infer<
  typeof PermissionRequestAllowAcceptEditsSessionStdoutSchema
>;

// ---------------------------------------------------------------------------
// Downstream-friendly variants for consumer-side hook validation
// ---------------------------------------------------------------------------

/**
 * All-optional variant of HookInputBaseSchema for resilient downstream parsing.
 * Hooks must tolerate missing fields; this schema accepts partial payloads.
 * Use when consuming hooks in downstream apps that need graceful degradation.
 */
export const HookInputBaseSchemaPartial = HookInputBaseSchema.partial().catchall(z.unknown());
export type HookInputBasePartial = z.infer<typeof HookInputBaseSchemaPartial>;

/**
 * Shared base for tool-shaped hook events (PreToolUse, PostToolUse, PostToolUseFailure).
 * Combines HookInputBaseSchema with tool call metadata for custom tool input parsers.
 * Enables downstream consumers to build uniform parsers for tool-related events.
 */
export const ToolHookInputBaseSchema = HookInputBaseSchema.extend({
  tool_name: OptionalToolNameField,
  tool_use_id: z.string().optional(),
  tool_input: z.record(z.string(), z.unknown()).optional(),
}).loose();
export type ToolHookInputBase = z.infer<typeof ToolHookInputBaseSchema>;

/**
 * Pre-commit Git hook event schema.
 * Triggered before git commit validation (linting, tests, format checks).
 * Allows hooks to inspect staged files and potentially modify the commit.
 */
export const PreCommitInputSchema = HookInputBaseSchema.extend({
  hook_event_name: z.literal("PreCommit"),
  cwd: z.string().optional(),
  staged_files: z.array(z.string()).optional(),
  branch: z.string().optional(),
}).loose();
export type PreCommitInput = z.infer<typeof PreCommitInputSchema>;

/**
 * Pre-push Git hook event schema.
 * Triggered before git push to remote (branch protection, CI checks, etc).
 * Allows hooks to validate branch state, verify CI status, or require review.
 */
const CommitSchema = z.object({
  sha: z.string(),
  message: z.string(),
}).passthrough();

export const PrePushInputSchema = HookInputBaseSchema.extend({
  hook_event_name: z.literal("PrePush"),
  cwd: z.string().optional(),
  branch: z.string().optional(),
  remote: z.string().optional(),
  commits: z.array(CommitSchema).optional(),
}).loose();
export type PrePushInput = z.infer<typeof PrePushInputSchema>;

/**
 * Loose variant of hook command output schema for cross-event validation.
 * Accepts any additional fields from future versions without breaking parsing.
 * Use when building unified output validators across multiple hook event types.
 */
export const HookCommandOutputSchemaLoose = z.object({
  decision: z.enum(["allow", "deny", "block"]).optional(),
  reason: z.string().optional(),
  continue: OptionalBooleanField,
  systemMessage: z.string().optional(),
}).passthrough();
export type HookCommandOutputLoose = z.infer<typeof HookCommandOutputSchemaLoose>;

// ---------------------------------------------------------------------------
// Practical helpers
// ---------------------------------------------------------------------------

/** Parse hook stdin / POST body; returns discriminated result or Zod error. */
export function ParseHookInput(json: unknown) {
  return HookEventInputSchema.safeParse(json);
}

/** Narrow `tool_input` after checking `tool_name` (e.g. `Bash`). */
export function ParseBashToolInput(toolInput: unknown) {
  return BashToolInputSchema.safeParse(toolInput);
}

/** For PostToolUse / PreToolUse `Edit` | `Write` format-on-save style hooks. */
export function ParseWriteToolInput(toolInput: unknown) {
  return WriteToolInputSchema.safeParse(toolInput);
}

export function ParseEditToolInput(toolInput: unknown) {
  return EditToolInputSchema.safeParse(toolInput);
}

/** Whether `tool_name` follows the `mcp__server__tool` convention. */
export function LooksLikeMcpToolName(toolName: string): boolean {
  return McpToolNamePattern.test(toolName);
}

/**
 * When `stop_hook_active` is true, Stop/SubagentStop hooks should usually exit 0
 * immediately to avoid an infinite continue loop (hooks guide troubleshooting).
 */
export function StopHookGuardShouldSkip(input: { stop_hook_active: boolean }): boolean {
  return input.stop_hook_active === true;
}

function ToolInputStringField(key: string, toolInput: unknown): string | undefined {
  const parsed = GenericToolInputSchema.safeParse(toolInput);
  if (!parsed.success) return undefined;
  const v = parsed.data[key];
  return typeof v === "string" ? v : undefined;
}

/** `tool_input.file_path` for Edit/Write/Read-style tools, if present. */
export function ToolInputFilePath(toolInput: unknown): string | undefined {
  return ToolInputStringField("file_path", toolInput);
}

/** `tool_input.command` for Bash-style tools, if present. */
export function ToolInputCommand(toolInput: unknown): string | undefined {
  return ToolInputStringField("command", toolInput);
}
