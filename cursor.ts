import { z } from "zod";
import { JsonObjectSchema } from "./common.ts";

// ---------------------------------------------------------------------------
// Cursor Agent hooks — stdin JSON (Cursor `hooks.json` / Agent hooks)
// Shapes from real Cursor payloads: lifecycle, shell, prompt, tool, compaction, agent response, stop.
// ---------------------------------------------------------------------------

/** `hook_event_name` values wired here; extend the union as new samples are confirmed. */
export const CursorHookEventNameSchema = z.enum([
  "afterAgentResponse",
  "afterShellExecution",
  "beforeShellExecution",
  "beforeSubmitPrompt",
  "postToolUse",
  "preCompact",
  "preToolUse",
  "sessionEnd",
  "sessionStart",
  "stop",
]);
export type CursorHookEventName = z.infer<typeof CursorHookEventNameSchema>;

/**
 * Fields shared by most Cursor hook stdin payloads. `transcript_path` may be null (e.g. session
 * lifecycle). `generation_id` may be an empty string when not yet assigned.
 */
export const CursorHookInputBaseSchema = z.object({
  conversation_id: z.string(),
  generation_id: z.string(),
  model: z.string(),
  session_id: z.string(),
  cursor_version: z.string(),
  workspace_roots: z.array(z.string()),
  user_email: z.string(),
  transcript_path: z.union([z.string(), z.null()]),
});
export type CursorHookInputBase = z.infer<typeof CursorHookInputBaseSchema>;

/** Attachment on `beforeSubmitPrompt` (e.g. rule file refs). */
export const CursorBeforeSubmitPromptAttachmentSchema = z
  .object({
    type: z.string(),
    file_path: z.string(),
  })
  .loose();
export type CursorBeforeSubmitPromptAttachment = z.infer<
  typeof CursorBeforeSubmitPromptAttachmentSchema
>;

/** `hook_event_name: "afterAgentResponse"` — assistant message text + token usage for the turn. */
export const CursorAfterAgentResponseHookInputSchema = CursorHookInputBaseSchema.extend({
  hook_event_name: z.literal("afterAgentResponse"),
  text: z.string(),
  input_tokens: z.number(),
  output_tokens: z.number(),
  cache_read_tokens: z.number(),
  cache_write_tokens: z.number(),
}).loose();
export type CursorAfterAgentResponseHookInput = z.infer<
  typeof CursorAfterAgentResponseHookInputSchema
>;

/** `hook_event_name: "stop"` — end of agent turn / usage summary. */
export const CursorStopHookInputSchema = CursorHookInputBaseSchema.extend({
  hook_event_name: z.literal("stop"),
  status: z.string(),
  loop_count: z.number(),
  input_tokens: z.number(),
  output_tokens: z.number(),
  cache_read_tokens: z.number(),
  cache_write_tokens: z.number(),
}).loose();
export type CursorStopHookInput = z.infer<typeof CursorStopHookInputSchema>;

/** `hook_event_name: "sessionStart"` — new agent session. */
export const CursorSessionStartHookInputSchema = CursorHookInputBaseSchema.extend({
  hook_event_name: z.literal("sessionStart"),
  is_background_agent: z.boolean(),
  composer_mode: z.string(),
}).loose();
export type CursorSessionStartHookInput = z.infer<typeof CursorSessionStartHookInputSchema>;

/** `hook_event_name: "sessionEnd"` — session closed. */
export const CursorSessionEndHookInputSchema = CursorHookInputBaseSchema.extend({
  hook_event_name: z.literal("sessionEnd"),
  reason: z.string(),
  duration_ms: z.number(),
  is_background_agent: z.boolean(),
  final_status: z.string(),
}).loose();
export type CursorSessionEndHookInput = z.infer<typeof CursorSessionEndHookInputSchema>;

/** `hook_event_name: "beforeSubmitPrompt"` — user prompt about to be sent. */
export const CursorBeforeSubmitPromptHookInputSchema = CursorHookInputBaseSchema.extend({
  hook_event_name: z.literal("beforeSubmitPrompt"),
  composer_mode: z.string(),
  prompt: z.string(),
  attachments: z.array(CursorBeforeSubmitPromptAttachmentSchema),
}).loose();
export type CursorBeforeSubmitPromptHookInput = z.infer<
  typeof CursorBeforeSubmitPromptHookInputSchema
>;

/** `hook_event_name: "beforeShellExecution"` — shell command before run. */
export const CursorBeforeShellExecutionHookInputSchema = CursorHookInputBaseSchema.extend({
  hook_event_name: z.literal("beforeShellExecution"),
  command: z.string(),
  cwd: z.string(),
  sandbox: z.boolean(),
}).loose();
export type CursorBeforeShellExecutionHookInput = z.infer<
  typeof CursorBeforeShellExecutionHookInputSchema
>;

/** `hook_event_name: "afterShellExecution"` — shell command after run. */
export const CursorAfterShellExecutionHookInputSchema = CursorHookInputBaseSchema.extend({
  hook_event_name: z.literal("afterShellExecution"),
  command: z.string(),
  output: z.string(),
  duration: z.number(),
  sandbox: z.boolean(),
}).loose();
export type CursorAfterShellExecutionHookInput = z.infer<
  typeof CursorAfterShellExecutionHookInputSchema
>;

/** `hook_event_name: "preToolUse"` — before a tool runs. */
export const CursorPreToolUseHookInputSchema = CursorHookInputBaseSchema.extend({
  hook_event_name: z.literal("preToolUse"),
  tool_name: z.string(),
  tool_input: JsonObjectSchema,
  tool_use_id: z.string(),
}).loose();
export type CursorPreToolUseHookInput = z.infer<typeof CursorPreToolUseHookInputSchema>;

/** `hook_event_name: "postToolUse"` — after tool execution; `tool_output` is often a JSON string. */
export const CursorPostToolUseHookInputSchema = CursorHookInputBaseSchema.extend({
  hook_event_name: z.literal("postToolUse"),
  tool_name: z.string(),
  tool_input: JsonObjectSchema,
  tool_output: z.union([z.string(), JsonObjectSchema]),
  duration: z.number(),
  tool_use_id: z.string(),
}).loose();
export type CursorPostToolUseHookInput = z.infer<typeof CursorPostToolUseHookInputSchema>;

/** `hook_event_name: "preCompact"` — context compaction about to run. */
export const CursorPreCompactHookInputSchema = CursorHookInputBaseSchema.extend({
  hook_event_name: z.literal("preCompact"),
  trigger: z.string(),
  context_usage_percent: z.number(),
  context_tokens: z.number(),
  context_window_size: z.number(),
  message_count: z.number(),
  messages_to_compact: z.number(),
  is_first_compaction: z.boolean(),
}).loose();
export type CursorPreCompactHookInput = z.infer<typeof CursorPreCompactHookInputSchema>;

export const CursorHookEventInputSchema = z.discriminatedUnion("hook_event_name", [
  CursorAfterAgentResponseHookInputSchema,
  CursorAfterShellExecutionHookInputSchema,
  CursorBeforeShellExecutionHookInputSchema,
  CursorBeforeSubmitPromptHookInputSchema,
  CursorPostToolUseHookInputSchema,
  CursorPreCompactHookInputSchema,
  CursorPreToolUseHookInputSchema,
  CursorSessionEndHookInputSchema,
  CursorSessionStartHookInputSchema,
  CursorStopHookInputSchema,
]);
export type CursorHookEventInput = z.infer<typeof CursorHookEventInputSchema>;

/** Parse Cursor Agent hook stdin JSON. */
export function ParseCursorHookInput(json: unknown) {
  return CursorHookEventInputSchema.safeParse(json);
}
