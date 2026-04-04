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
  conversation_id: z.string().optional(),
  generation_id: z.string().optional(),
  model: z.string().optional(),
  session_id: z.string().optional(),
  cursor_version: z.string().optional(),
  workspace_roots: z.array(z.string()).optional(),
  user_email: z.string().optional(),
  transcript_path: z.union([z.string(), z.null()]).optional(),
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
  text: z.string().optional(),
  input_tokens: z.number().optional(),
  output_tokens: z.number().optional(),
  cache_read_tokens: z.number().optional(),
  cache_write_tokens: z.number().optional(),
}).loose();
export type CursorAfterAgentResponseHookInput = z.infer<
  typeof CursorAfterAgentResponseHookInputSchema
>;

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

/** `hook_event_name: "sessionStart"` — new agent session. */
export const CursorSessionStartHookInputSchema = CursorHookInputBaseSchema.extend({
  hook_event_name: z.literal("sessionStart"),
  is_background_agent: z.boolean().optional(),
  composer_mode: z.string().optional(),
}).loose();
export type CursorSessionStartHookInput = z.infer<typeof CursorSessionStartHookInputSchema>;

/** `hook_event_name: "sessionEnd"` — session closed. */
export const CursorSessionEndHookInputSchema = CursorHookInputBaseSchema.extend({
  hook_event_name: z.literal("sessionEnd"),
  reason: z.string().optional(),
  duration_ms: z.number().optional(),
  is_background_agent: z.boolean().optional(),
  final_status: z.string().optional(),
}).loose();
export type CursorSessionEndHookInput = z.infer<typeof CursorSessionEndHookInputSchema>;

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

/** `hook_event_name: "preToolUse"` — before a tool runs. */
export const CursorPreToolUseHookInputSchema = CursorHookInputBaseSchema.extend({
  hook_event_name: z.literal("preToolUse"),
  tool_name: z.string().optional(),
  tool_input: JsonObjectSchema.optional(),
  tool_use_id: z.string().optional(),
}).loose();
export type CursorPreToolUseHookInput = z.infer<typeof CursorPreToolUseHookInputSchema>;

/** `hook_event_name: "postToolUse"` — after tool execution; `tool_output` is often a JSON string. */
export const CursorPostToolUseHookInputSchema = CursorHookInputBaseSchema.extend({
  hook_event_name: z.literal("postToolUse"),
  tool_name: z.string().optional(),
  tool_input: JsonObjectSchema.optional(),
  tool_output: z.union([z.string(), JsonObjectSchema]).optional(),
  duration: z.number().optional(),
  tool_use_id: z.string().optional(),
}).loose();
export type CursorPostToolUseHookInput = z.infer<typeof CursorPostToolUseHookInputSchema>;

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
