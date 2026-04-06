import { z } from "zod";
import { JsonObjectSchema, NullableStringSchema, OptionalStringField, OptionalToolNameField } from "./common.ts";

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
]);
export type CursorHookEventName = z.infer<typeof CursorHookEventNameSchema>;

/**
 * Fields shared by most Cursor hook stdin payloads. `transcript_path` may be null (e.g. session
 * lifecycle). `generation_id` may be an empty string when not yet assigned.
 */
export const CursorHookInputBaseSchema = z.object({
  conversation_id: OptionalStringField,
  generation_id: OptionalStringField,
  model: OptionalStringField,
  session_id: OptionalStringField,
  cursor_version: OptionalStringField,
  workspace_roots: z.array(z.string()).optional(),
  user_email: OptionalStringField,
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
    start_line_number: z.number().optional(),
    start_column: z.number().optional(),
    end_line_number: z.number().optional(),
    end_column: z.number().optional(),
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
  input_tokens: z.number().optional(),
  output_tokens: z.number().optional(),
  cache_read_tokens: z.number().optional(),
  cache_write_tokens: z.number().optional(),
}).loose();
export type CursorAfterAgentResponseHookInput = z.infer<
  typeof CursorAfterAgentResponseHookInputSchema
>;

/** `hook_event_name: "afterAgentThought"` — fully aggregated thinking block text + duration. */
export const CursorAfterAgentThoughtHookInputSchema = CursorHookInputBaseSchema.extend({
  hook_event_name: z.literal("afterAgentThought"),
  text: z.string().optional(),
  duration_ms: z.number().optional(),
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
  result_json: z.string().optional(),
  duration: z.number().optional(),
}).loose();
export type CursorAfterMCPExecutionHookInput = z.infer<
  typeof CursorAfterMCPExecutionHookInputSchema
>;

/** `hook_event_name: "afterShellExecution"` — shell command after run. */
export const CursorAfterShellExecutionHookInputSchema = CursorHookInputBaseSchema.extend({
  hook_event_name: z.literal("afterShellExecution"),
  command: z.string().optional(),
  output: z.string().optional(),
  duration: z.number().optional(),
  sandbox: z.boolean().optional(),
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
  sandbox: z.boolean().optional(),
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
  duration: z.number().optional(),
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
  duration: z.number().optional(),
  is_interrupt: z.boolean().optional(),
}).loose();
export type CursorPostToolUseFailureHookInput = z.infer<
  typeof CursorPostToolUseFailureHookInputSchema
>;

/** `hook_event_name: "preCompact"` — context compaction about to run. */
export const CursorPreCompactHookInputSchema = CursorHookInputBaseSchema.extend({
  hook_event_name: z.literal("preCompact"),
  trigger: z.string().optional(),
  context_usage_percent: z.number().optional(),
  context_tokens: z.number().optional(),
  context_window_size: z.number().optional(),
  message_count: z.number().optional(),
  messages_to_compact: z.number().optional(),
  is_first_compaction: z.boolean().optional(),
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
  duration_ms: z.number().optional(),
  is_background_agent: z.boolean().optional(),
  final_status: z.string().optional(),
  error_message: z.string().optional(),
}).loose();
export type CursorSessionEndHookInput = z.infer<typeof CursorSessionEndHookInputSchema>;

/** `hook_event_name: "sessionStart"` — new agent session. */
export const CursorSessionStartHookInputSchema = CursorHookInputBaseSchema.extend({
  hook_event_name: z.literal("sessionStart"),
  is_background_agent: z.boolean().optional(),
  composer_mode: z.string().optional(),
}).loose();
export type CursorSessionStartHookInput = z.infer<typeof CursorSessionStartHookInputSchema>;

/** `hook_event_name: "stop"` — end of agent turn / usage summary. */
export const CursorStopHookInputSchema = CursorHookInputBaseSchema.extend({
  hook_event_name: z.literal("stop"),
  status: z.string().optional(),
  loop_count: z.number().optional(),
  input_tokens: z.number().optional(),
  output_tokens: z.number().optional(),
  cache_read_tokens: z.number().optional(),
  cache_write_tokens: z.number().optional(),
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
  is_parallel_worker: z.boolean().optional(),
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
  duration_ms: z.number().optional(),
  message_count: z.number().optional(),
  tool_call_count: z.number().optional(),
  loop_count: z.number().optional(),
  modified_files: z.array(z.string()).optional(),
  agent_transcript_path: z.union([z.string(), z.null()]).optional(),
}).loose();
export type CursorSubagentStopHookInput = z.infer<typeof CursorSubagentStopHookInputSchema>;

export const CursorHookEventInputSchema = z.discriminatedUnion("hook_event_name", [
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
