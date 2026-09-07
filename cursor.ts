import { z } from "zod";
import { JsonObjectSchema, NullableStringSchema, OptionalBooleanField, OptionalNumberField, OptionalStringField, OptionalToolNameField } from "./common.ts";

// ---------------------------------------------------------------------------
// Cursor Agent hooks — stdin JSON (Cursor `hooks.json` / Agent hooks)
// Shapes from real Cursor payloads: lifecycle, shell, prompt, tool, compaction, agent response, stop.
// ---------------------------------------------------------------------------

/** `hook_event_name` values wired here; extend the union as new samples are confirmed. */
export const CursorHookEventNameSchema = z.enum([
  "afterAgentResponse",
  "afterAgentThought",
  "afterFileEdit",
  "afterMCPExecution",
  "afterShellExecution",
  "afterTabFileEdit",
  "beforeMCPExecution",
  "beforeReadFile",
  "beforeShellExecution",
  "beforeSubmitPrompt",
  "beforeTabFileRead",
  "postToolUse",
  "postToolUseFailure",
  "preCompact",
  "preToolUse",
  "sessionEnd",
  "sessionStart",
  "stop",
  "subagentStart",
  "subagentStop",
  "workspaceOpen",
]);
export type CursorHookEventName = z.infer<typeof CursorHookEventNameSchema>;

export const CursorModelParamSchema = z.object({ id: z.string(), value: z.string() }).loose();
export type CursorModelParam = z.infer<typeof CursorModelParamSchema>;

/**
 * Fields shared by most Cursor hook stdin payloads. `transcript_path` may be null (e.g. session
 * lifecycle). `generation_id` may be an empty string when not yet assigned.
 */
export const CursorHookInputBaseSchema = z.object({
  conversation_id: OptionalStringField,
  generation_id: OptionalStringField,
  model: OptionalStringField,
  model_id: OptionalStringField,
  model_params: z.array(CursorModelParamSchema).optional(),
  session_id: OptionalStringField,
  cursor_version: OptionalStringField,
  workspace_roots: z.array(z.string()).optional(),
  user_email: NullableStringSchema.optional(),
  transcript_path: NullableStringSchema.optional(),
});
export type CursorHookInputBase = z.infer<typeof CursorHookInputBaseSchema>;

/** Attachment on `beforeSubmitPrompt` and `beforeReadFile` (e.g. rule file refs). */
export const CursorBeforeSubmitPromptAttachmentSchema = z
  .object({
    type: z.string(),
    file_path: z.string(),
  })
  .loose();
export type CursorBeforeSubmitPromptAttachment = z.infer<
  typeof CursorBeforeSubmitPromptAttachmentSchema
>;

/** Edit entry on `afterFileEdit`. */
export const CursorFileEditSchema = z
  .object({
    old_string: z.string().optional(),
    new_string: z.string().optional(),
  })
  .loose();
export type CursorFileEdit = z.infer<typeof CursorFileEditSchema>;

/** Character range on a `afterTabFileEdit` edit entry. */
export const CursorTabFileEditRangeSchema = z
  .object({
    start_line_number: OptionalNumberField,
    start_column: OptionalNumberField,
    end_line_number: OptionalNumberField,
    end_column: OptionalNumberField,
  })
  .loose();
export type CursorTabFileEditRange = z.infer<typeof CursorTabFileEditRangeSchema>;

/** Edit entry on `afterTabFileEdit` — includes range and surrounding line context. */
export const CursorTabFileEditSchema = z
  .object({
    old_string: z.string().optional(),
    new_string: z.string().optional(),
    range: CursorTabFileEditRangeSchema.optional(),
    old_line: z.string().optional(),
    new_line: z.string().optional(),
  })
  .loose();
export type CursorTabFileEdit = z.infer<typeof CursorTabFileEditSchema>;

// ---------------------------------------------------------------------------
// Per-event hook input schemas
// ---------------------------------------------------------------------------

/** `hook_event_name: "afterAgentResponse"` — assistant message text + token usage for the turn. */
export const CursorAfterAgentResponseHookInputSchema = CursorHookInputBaseSchema.extend({
  hook_event_name: z.literal("afterAgentResponse"),
  text: z.string().optional(),
  input_tokens: OptionalNumberField,
  output_tokens: OptionalNumberField,
  cache_read_tokens: OptionalNumberField,
  cache_write_tokens: OptionalNumberField,
}).loose();
export type CursorAfterAgentResponseHookInput = z.infer<
  typeof CursorAfterAgentResponseHookInputSchema
>;

/** `hook_event_name: "afterAgentThought"` — fully aggregated thinking block text + duration. */
export const CursorAfterAgentThoughtHookInputSchema = CursorHookInputBaseSchema.extend({
  hook_event_name: z.literal("afterAgentThought"),
  text: z.string().optional(),
  duration_ms: OptionalNumberField,
}).loose();
export type CursorAfterAgentThoughtHookInput = z.infer<
  typeof CursorAfterAgentThoughtHookInputSchema
>;

/** `hook_event_name: "afterFileEdit"` — agent edited a file. */
export const CursorAfterFileEditHookInputSchema = CursorHookInputBaseSchema.extend({
  hook_event_name: z.literal("afterFileEdit"),
  file_path: z.string().optional(),
  edits: z.array(CursorFileEditSchema).optional(),
}).loose();
export type CursorAfterFileEditHookInput = z.infer<typeof CursorAfterFileEditHookInputSchema>;

/** `hook_event_name: "afterMCPExecution"` — MCP tool completed; includes full result JSON. */
export const CursorAfterMCPExecutionHookInputSchema = CursorHookInputBaseSchema.extend({
  hook_event_name: z.literal("afterMCPExecution"),
  tool_name: OptionalToolNameField,
  tool_input: z.string().optional(),
  mcp_server_name: OptionalStringField,
  mcp_server_url: OptionalStringField,
  result_json: z.string().optional(),
  duration: OptionalNumberField,
}).loose();
export type CursorAfterMCPExecutionHookInput = z.infer<
  typeof CursorAfterMCPExecutionHookInputSchema
>;

/** `hook_event_name: "afterShellExecution"` — shell command after run. */
export const CursorAfterShellExecutionHookInputSchema = CursorHookInputBaseSchema.extend({
  hook_event_name: z.literal("afterShellExecution"),
  command: z.string().optional(),
  output: z.string().optional(),
  duration: OptionalNumberField,
  sandbox: OptionalBooleanField,
}).loose();
export type CursorAfterShellExecutionHookInput = z.infer<
  typeof CursorAfterShellExecutionHookInputSchema
>;

/** `hook_event_name: "afterTabFileEdit"` — Tab (inline completion) edited a file; includes character-level range. */
export const CursorAfterTabFileEditHookInputSchema = CursorHookInputBaseSchema.extend({
  hook_event_name: z.literal("afterTabFileEdit"),
  file_path: z.string().optional(),
  edits: z.array(CursorTabFileEditSchema).optional(),
}).loose();
export type CursorAfterTabFileEditHookInput = z.infer<typeof CursorAfterTabFileEditHookInputSchema>;

/**
 * `hook_event_name: "beforeMCPExecution"` — MCP tool about to run.
 * Includes either `url` (HTTP server) or `command` (stdio server) to identify the MCP server.
 */
export const CursorBeforeMCPExecutionHookInputSchema = CursorHookInputBaseSchema.extend({
  hook_event_name: z.literal("beforeMCPExecution"),
  tool_name: OptionalToolNameField,
  tool_input: z.string().optional(),
  mcp_server_name: OptionalStringField,
  mcp_server_url: OptionalStringField,
  url: z.string().optional(),
  command: z.string().optional(),
}).loose();
export type CursorBeforeMCPExecutionHookInput = z.infer<
  typeof CursorBeforeMCPExecutionHookInputSchema
>;

/** `hook_event_name: "beforeReadFile"` — agent about to read a file. */
export const CursorBeforeReadFileHookInputSchema = CursorHookInputBaseSchema.extend({
  hook_event_name: z.literal("beforeReadFile"),
  file_path: z.string().optional(),
  content: z.string().optional(),
  attachments: z.array(CursorBeforeSubmitPromptAttachmentSchema).optional(),
}).loose();
export type CursorBeforeReadFileHookInput = z.infer<typeof CursorBeforeReadFileHookInputSchema>;

/** `hook_event_name: "beforeShellExecution"` — shell command before run. */
export const CursorBeforeShellExecutionHookInputSchema = CursorHookInputBaseSchema.extend({
  hook_event_name: z.literal("beforeShellExecution"),
  command: z.string().optional(),
  cwd: z.string().optional(),
  sandbox: OptionalBooleanField,
}).loose();
export type CursorBeforeShellExecutionHookInput = z.infer<
  typeof CursorBeforeShellExecutionHookInputSchema
>;

/** `hook_event_name: "beforeSubmitPrompt"` — user prompt about to be sent. */
export const CursorBeforeSubmitPromptHookInputSchema = CursorHookInputBaseSchema.extend({
  hook_event_name: z.literal("beforeSubmitPrompt"),
  composer_mode: z.string().optional(),
  prompt: z.string().optional(),
  attachments: z.array(CursorBeforeSubmitPromptAttachmentSchema).optional(),
}).loose();
export type CursorBeforeSubmitPromptHookInput = z.infer<
  typeof CursorBeforeSubmitPromptHookInputSchema
>;

/** `hook_event_name: "beforeTabFileRead"` — Tab (inline completion) about to read a file. */
export const CursorBeforeTabFileReadHookInputSchema = CursorHookInputBaseSchema.extend({
  hook_event_name: z.literal("beforeTabFileRead"),
  file_path: z.string().optional(),
  content: z.string().optional(),
}).loose();
export type CursorBeforeTabFileReadHookInput = z.infer<
  typeof CursorBeforeTabFileReadHookInputSchema
>;

/** `hook_event_name: "postToolUse"` — after tool execution; `tool_output` is often a JSON string. */
export const CursorPostToolUseHookInputSchema = CursorHookInputBaseSchema.extend({
  hook_event_name: z.literal("postToolUse"),
  tool_name: OptionalToolNameField,
  tool_input: JsonObjectSchema.optional(),
  tool_output: z.union([z.string(), JsonObjectSchema]).optional(),
  duration: OptionalNumberField,
  tool_use_id: z.string().optional(),
  cwd: z.string().optional(),
}).loose();
export type CursorPostToolUseHookInput = z.infer<typeof CursorPostToolUseHookInputSchema>;

/** `hook_event_name: "postToolUseFailure"` — tool failed, timed out, or was denied. */
export const CursorPostToolUseFailureHookInputSchema = CursorHookInputBaseSchema.extend({
  hook_event_name: z.literal("postToolUseFailure"),
  tool_name: OptionalToolNameField,
  tool_input: JsonObjectSchema.optional(),
  tool_use_id: z.string().optional(),
  cwd: z.string().optional(),
  error_message: z.string().optional(),
  failure_type: z.enum(["error", "timeout", "permission_denied"]).or(z.string()).optional(),
  duration: OptionalNumberField,
  is_interrupt: OptionalBooleanField,
}).loose();
export type CursorPostToolUseFailureHookInput = z.infer<
  typeof CursorPostToolUseFailureHookInputSchema
>;

/** `hook_event_name: "preCompact"` — context compaction about to run. */
export const CursorPreCompactHookInputSchema = CursorHookInputBaseSchema.extend({
  hook_event_name: z.literal("preCompact"),
  trigger: z.string().optional(),
  context_usage_percent: OptionalNumberField,
  context_tokens: OptionalNumberField,
  context_window_size: OptionalNumberField,
  message_count: OptionalNumberField,
  messages_to_compact: OptionalNumberField,
  is_first_compaction: OptionalBooleanField,
}).loose();
export type CursorPreCompactHookInput = z.infer<typeof CursorPreCompactHookInputSchema>;

/** `hook_event_name: "preToolUse"` — before a tool runs. */
export const CursorPreToolUseHookInputSchema = CursorHookInputBaseSchema.extend({
  hook_event_name: z.literal("preToolUse"),
  tool_name: OptionalToolNameField,
  tool_input: JsonObjectSchema.optional(),
  tool_use_id: z.string().optional(),
  cwd: z.string().optional(),
  agent_message: z.string().optional(),
}).loose();
export type CursorPreToolUseHookInput = z.infer<typeof CursorPreToolUseHookInputSchema>;

/** `hook_event_name: "sessionEnd"` — session closed. */
export const CursorSessionEndHookInputSchema = CursorHookInputBaseSchema.extend({
  hook_event_name: z.literal("sessionEnd"),
  reason: z.string().optional(),
  duration_ms: OptionalNumberField,
  is_background_agent: OptionalBooleanField,
  final_status: z.string().optional(),
  error_message: z.string().optional(),
}).loose();
export type CursorSessionEndHookInput = z.infer<typeof CursorSessionEndHookInputSchema>;

/** `hook_event_name: "sessionStart"` — new agent session. */
export const CursorSessionStartHookInputSchema = CursorHookInputBaseSchema.extend({
  hook_event_name: z.literal("sessionStart"),
  is_background_agent: OptionalBooleanField,
  composer_mode: z.string().optional(),
}).loose();
export type CursorSessionStartHookInput = z.infer<typeof CursorSessionStartHookInputSchema>;

/** `hook_event_name: "stop"` — end of agent turn / usage summary. */
export const CursorStopHookInputSchema = CursorHookInputBaseSchema.extend({
  hook_event_name: z.literal("stop"),
  status: z.string().optional(),
  loop_count: OptionalNumberField,
  input_tokens: OptionalNumberField,
  output_tokens: OptionalNumberField,
  cache_read_tokens: OptionalNumberField,
  cache_write_tokens: OptionalNumberField,
}).loose();
export type CursorStopHookInput = z.infer<typeof CursorStopHookInputSchema>;

/** `hook_event_name: "subagentStart"` — before spawning a subagent (Task tool). */
export const CursorSubagentStartHookInputSchema = CursorHookInputBaseSchema.extend({
  hook_event_name: z.literal("subagentStart"),
  subagent_id: z.string().optional(),
  subagent_type: z.string().optional(),
  task: z.string().optional(),
  parent_conversation_id: z.string().optional(),
  tool_call_id: z.string().optional(),
  subagent_model: z.string().optional(),
  is_parallel_worker: OptionalBooleanField,
  git_branch: z.string().optional(),
}).loose();
export type CursorSubagentStartHookInput = z.infer<typeof CursorSubagentStartHookInputSchema>;

/** `hook_event_name: "subagentStop"` — subagent completed, errored, or was aborted. */
export const CursorSubagentStopHookInputSchema = CursorHookInputBaseSchema.extend({
  hook_event_name: z.literal("subagentStop"),
  subagent_type: z.string().optional(),
  status: z.enum(["completed", "error", "aborted"]).or(z.string()).optional(),
  task: z.string().optional(),
  description: z.string().optional(),
  summary: z.string().optional(),
  duration_ms: OptionalNumberField,
  message_count: OptionalNumberField,
  tool_call_count: OptionalNumberField,
  loop_count: OptionalNumberField,
  modified_files: z.array(z.string()).optional(),
  agent_transcript_path: NullableStringSchema.optional(),
}).loose();
export type CursorSubagentStopHookInput = z.infer<typeof CursorSubagentStopHookInputSchema>;

/** App lifecycle metadata; no agent conversation needs to exist. */
export const CursorWorkspaceOpenHookInputSchema = z.object({
  hook_event_name: z.literal("workspaceOpen"),
  cursor_version: OptionalStringField,
  workspace_roots: z.array(z.string()).optional(),
  user_email: NullableStringSchema.optional(),
}).loose();
export type CursorWorkspaceOpenHookInput = z.infer<typeof CursorWorkspaceOpenHookInputSchema>;

export const CursorHookEventInputSchema = z.discriminatedUnion("hook_event_name", [
  CursorWorkspaceOpenHookInputSchema,
  CursorAfterAgentResponseHookInputSchema,
  CursorAfterAgentThoughtHookInputSchema,
  CursorAfterFileEditHookInputSchema,
  CursorAfterMCPExecutionHookInputSchema,
  CursorAfterShellExecutionHookInputSchema,
  CursorAfterTabFileEditHookInputSchema,
  CursorBeforeMCPExecutionHookInputSchema,
  CursorBeforeReadFileHookInputSchema,
  CursorBeforeShellExecutionHookInputSchema,
  CursorBeforeSubmitPromptHookInputSchema,
  CursorBeforeTabFileReadHookInputSchema,
  CursorPostToolUseHookInputSchema,
  CursorPostToolUseFailureHookInputSchema,
  CursorPreCompactHookInputSchema,
  CursorPreToolUseHookInputSchema,
  CursorSessionEndHookInputSchema,
  CursorSessionStartHookInputSchema,
  CursorStopHookInputSchema,
  CursorSubagentStartHookInputSchema,
  CursorSubagentStopHookInputSchema,
]);
export type CursorHookEventInput = z.infer<typeof CursorHookEventInputSchema>;

/** Parse Cursor Agent hook stdin JSON. */
export function ParseCursorHookInput(json: unknown) {
  return CursorHookEventInputSchema.safeParse(json);
}

// Configuration follows the executable string-matcher examples in the reference.
// The reference's table says "object" but specifies no object matcher contract.
export const CursorHookHandlerCommonSchema = z.object({
  timeout: z.number().nonnegative().optional(),
  matcher: z.string().optional(),
  loop_limit: z.number().int().nonnegative().nullable().optional(),
  failClosed: z.boolean().optional(),
});
export type CursorHookHandlerCommon = z.infer<typeof CursorHookHandlerCommonSchema>;

export const CursorCommandHookHandlerSchema = CursorHookHandlerCommonSchema.extend({
  type: z.literal("command").default("command"),
  command: z.string(),
});
export type CursorCommandHookHandler = z.infer<typeof CursorCommandHookHandlerSchema>;

export const CursorPromptHookHandlerSchema = CursorHookHandlerCommonSchema.extend({
  type: z.literal("prompt"),
  prompt: z.string(),
  model: z.string().optional(),
});
export type CursorPromptHookHandler = z.infer<typeof CursorPromptHookHandlerSchema>;

export const CursorHookHandlerSchema = z.union([
  CursorCommandHookHandlerSchema,
  CursorPromptHookHandlerSchema,
]);
export type CursorHookHandler = z.infer<typeof CursorHookHandlerSchema>;

export const CursorHooksConfigSchema = z.partialRecord(CursorHookEventNameSchema, z.array(CursorHookHandlerSchema));
export type CursorHooksConfig = z.infer<typeof CursorHooksConfigSchema>;
export const CursorHooksFileSchema = z.object({
  version: z.literal(1).default(1),
  hooks: CursorHooksConfigSchema,
}).loose();
export type CursorHooksFile = z.infer<typeof CursorHooksFileSchema>;

/** Cloud agents execute command hooks only. Validate separately from desktop configuration. */
export const CursorCloudHooksFileSchema = CursorHooksFileSchema.superRefine((file, ctx) => {
  for (const [event, handlers] of Object.entries(file.hooks)) {
    for (const [index, handler] of handlers.entries()) {
      if (handler.type === "prompt") ctx.addIssue({ code: "custom", message: "Cloud agents only support command hooks", path: ["hooks", event, index, "type"] });
    }
  }
});
export type CursorCloudHooksFile = z.infer<typeof CursorCloudHooksFileSchema>;

export function ParseCursorHooksFile(json: unknown) { return CursorHooksFileSchema.safeParse(json); }

/** Cursor's schema accepts ask here; preToolUse callers currently only enforce allow/deny. */
export const CursorPermissionDecisionSchema = z.enum(["allow", "deny", "ask"]);
export type CursorPermissionDecision = z.infer<typeof CursorPermissionDecisionSchema>;

export const CursorBeforeShellExecutionStdoutSchema = z.object({
  permission: CursorPermissionDecisionSchema.optional(),
  user_message: OptionalStringField,
  agent_message: OptionalStringField,
}).strict();
export type CursorBeforeShellExecutionStdout = z.infer<typeof CursorBeforeShellExecutionStdoutSchema>;
export const CursorBeforeMCPExecutionStdoutSchema = CursorBeforeShellExecutionStdoutSchema;
export type CursorBeforeMCPExecutionStdout = CursorBeforeShellExecutionStdout;
export const CursorPreToolUseStdoutSchema = CursorBeforeShellExecutionStdoutSchema.extend({
  updated_input: JsonObjectSchema.optional(),
});
export type CursorPreToolUseStdout = z.infer<typeof CursorPreToolUseStdoutSchema>;

export const CursorPostToolUseStdoutSchema = z.object({
  updated_mcp_tool_output: JsonObjectSchema.optional(),
  additional_context: OptionalStringField,
}).strict();
export type CursorPostToolUseStdout = z.infer<typeof CursorPostToolUseStdoutSchema>;

export const CursorSubagentStartStdoutSchema = z.object({
  permission: z.enum(["allow", "deny"]).optional(),
  user_message: OptionalStringField,
}).strict();
export type CursorSubagentStartStdout = z.infer<typeof CursorSubagentStartStdoutSchema>;
export const CursorBeforeReadFileStdoutSchema = CursorSubagentStartStdoutSchema;
export type CursorBeforeReadFileStdout = CursorSubagentStartStdout;
export const CursorBeforeTabFileReadStdoutSchema = z.object({ permission: z.enum(["allow", "deny"]).optional() }).strict();
export type CursorBeforeTabFileReadStdout = z.infer<typeof CursorBeforeTabFileReadStdoutSchema>;

export const CursorStopStdoutSchema = z.object({ followup_message: OptionalStringField }).strict();
export type CursorStopStdout = z.infer<typeof CursorStopStdoutSchema>;
export const CursorSubagentStopStdoutSchema = CursorStopStdoutSchema;
export type CursorSubagentStopStdout = CursorStopStdout;
export const CursorBeforeSubmitPromptStdoutSchema = z.object({
  continue: OptionalBooleanField,
  user_message: OptionalStringField,
}).strict();
export type CursorBeforeSubmitPromptStdout = z.infer<typeof CursorBeforeSubmitPromptStdoutSchema>;

/** continue/user_message parse for compatibility but cannot block session creation. */
export const CursorSessionStartStdoutSchema = CursorBeforeSubmitPromptStdoutSchema.extend({
  env: z.record(z.string(), z.string()).optional(),
  additional_context: OptionalStringField,
});
export type CursorSessionStartStdout = z.infer<typeof CursorSessionStartStdoutSchema>;
export const CursorPreCompactStdoutSchema = z.object({ user_message: OptionalStringField }).strict();
export type CursorPreCompactStdout = z.infer<typeof CursorPreCompactStdoutSchema>;
export const CursorWorkspaceOpenStdoutSchema = z.object({ pluginPaths: z.array(z.string()).optional() }).strict();
export type CursorWorkspaceOpenStdout = z.infer<typeof CursorWorkspaceOpenStdoutSchema>;

export const CursorObservationalStdoutSchema = z.object({}).strict();
export type CursorObservationalStdout = z.infer<typeof CursorObservationalStdoutSchema>;
export const CursorHookOutputSchemas = {
  preToolUse: CursorPreToolUseStdoutSchema,
  postToolUse: CursorPostToolUseStdoutSchema,
  subagentStart: CursorSubagentStartStdoutSchema,
  subagentStop: CursorSubagentStopStdoutSchema,
  beforeShellExecution: CursorBeforeShellExecutionStdoutSchema,
  beforeMCPExecution: CursorBeforeMCPExecutionStdoutSchema,
  beforeReadFile: CursorBeforeReadFileStdoutSchema,
  beforeTabFileRead: CursorBeforeTabFileReadStdoutSchema,
  beforeSubmitPrompt: CursorBeforeSubmitPromptStdoutSchema,
  stop: CursorStopStdoutSchema,
  sessionStart: CursorSessionStartStdoutSchema,
  preCompact: CursorPreCompactStdoutSchema,
  workspaceOpen: CursorWorkspaceOpenStdoutSchema,
  postToolUseFailure: CursorObservationalStdoutSchema,
  afterAgentResponse: CursorObservationalStdoutSchema,
  afterAgentThought: CursorObservationalStdoutSchema,
  afterFileEdit: CursorObservationalStdoutSchema,
  afterMCPExecution: CursorObservationalStdoutSchema,
  afterShellExecution: CursorObservationalStdoutSchema,
  afterTabFileEdit: CursorObservationalStdoutSchema,
  sessionEnd: CursorObservationalStdoutSchema,
} satisfies Record<CursorHookEventName, z.ZodType>;
export type CursorHookOutput<E extends CursorHookEventName = CursorHookEventName> = z.infer<(typeof CursorHookOutputSchemas)[E]>;

/** Select the event before validating stdout; an empty-output schema must not mask invalid decisions. */
export function ParseCursorHookOutput<E extends CursorHookEventName>(event: E, json: unknown) {
  return CursorHookOutputSchemas[event].safeParse(json) as z.ZodSafeParseResult<CursorHookOutput<E>>;
}
