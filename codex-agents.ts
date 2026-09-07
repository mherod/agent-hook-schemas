import { z } from "zod";

/**
 * Codex collaboration contracts from rust-v0.153.4. V1 and V2 are distinct
 * interfaces selected by the host; a parsed shape does not imply availability.
 * https://github.com/openai/codex/blob/rust-v0.153.4/codex-rs/core/src/tools/handlers/multi_agents_spec.rs
 * Objects stay loose for compatibility with captured and future host extensions.
 */
export const CodexCollaborationV1ToolNameSchema = z.enum([
  "spawn_agent", "send_input", "resume_agent", "wait_agent", "close_agent",
]);
export type CodexCollaborationV1ToolName = z.infer<typeof CodexCollaborationV1ToolNameSchema>;

export const CodexCollaborationV2ToolNameSchema = z.enum([
  "spawn_agent", "send_message", "followup_task", "list_agents", "wait_agent", "interrupt_agent",
]);
export type CodexCollaborationV2ToolName = z.infer<typeof CodexCollaborationV2ToolNameSchema>;

/** Published item fields; type-specific runtime requirements are not enforced here. */
export const CodexCollaborationInputItemSchema = z.object({
  type: z.enum(["text", "image", "local_image", "audio", "local_audio", "skill", "mention"]).or(z.string()),
  text: z.string().optional(),
  image_url: z.string().optional(),
  audio_url: z.string().optional(),
  path: z.string().optional(),
  name: z.string().optional(),
}).loose();
export type CodexCollaborationInputItem = z.infer<typeof CodexCollaborationInputItemSchema>;

const NonemptyMessageSchema = z.string().refine((message) => message.trim().length > 0, {
  message: "Message must contain non-whitespace text",
});
const v1MessageFields = {
  message: NonemptyMessageSchema.optional(),
  items: z.array(CodexCollaborationInputItemSchema).nonempty().optional(),
};
const oneInputSource = (input: { message?: string; items?: unknown[] }) =>
  (input.message !== undefined) !== (input.items !== undefined);
const inputSourceError = { message: "Provide exactly one of message or items", path: ["message"] };

export const CodexSpawnAgentV1ToolInputSchema = z.object({
  ...v1MessageFields,
  agent_type: z.string().optional(),
  fork_context: z.boolean().optional(),
  model: z.string().optional(),
  reasoning_effort: z.string().optional(),
}).loose().refine(oneInputSource, inputSourceError);
export type CodexSpawnAgentV1ToolInput = z.infer<typeof CodexSpawnAgentV1ToolInputSchema>;

export const CodexSendInputV1ToolInputSchema = z.object({
  target: z.string(),
  ...v1MessageFields,
  interrupt: z.boolean().optional(),
}).loose().refine(oneInputSource, inputSourceError);
export type CodexSendInputV1ToolInput = z.infer<typeof CodexSendInputV1ToolInputSchema>;

export const CodexResumeAgentV1ToolInputSchema = z.object({ id: z.string() }).loose();
export type CodexResumeAgentV1ToolInput = z.infer<typeof CodexResumeAgentV1ToolInputSchema>;

/** Targeted waiting. Timeouts are adjusted by the host, not clamped during parsing. */
export const CodexWaitAgentV1ToolInputSchema = z.object({
  targets: z.array(z.string()),
  timeout_ms: z.number().optional(),
}).loose();
export type CodexWaitAgentV1ToolInput = z.infer<typeof CodexWaitAgentV1ToolInputSchema>;

export const CodexCloseAgentV1ToolInputSchema = z.object({ target: z.string() }).loose();
export type CodexCloseAgentV1ToolInput = z.infer<typeof CodexCloseAgentV1ToolInputSchema>;

export const CodexForkTurnsSchema = z.string().regex(/^(?:all|none|[1-9][0-9]*)$/);
export type CodexForkTurns = z.infer<typeof CodexForkTurnsSchema>;

export const CodexSpawnAgentV2ToolInputSchema = z.object({
  task_name: z.string().regex(/^[a-z0-9_]+$/),
  message: NonemptyMessageSchema,
  agent_type: z.string().optional(),
  fork_turns: CodexForkTurnsSchema.optional(),
  // Hosts may hide these options; presence here does not grant an override.
  model: z.string().optional(),
  reasoning_effort: z.string().optional(),
}).loose();
export type CodexSpawnAgentV2ToolInput = z.infer<typeof CodexSpawnAgentV2ToolInputSchema>;

/** Queues a message without triggering a turn. */
export const CodexSendMessageV2ToolInputSchema = z.object({
  target: z.string(),
  message: NonemptyMessageSchema,
}).loose();
export type CodexSendMessageV2ToolInput = z.infer<typeof CodexSendMessageV2ToolInputSchema>;

/** Starts a turn on an idle non-root agent; same arguments, different operation. */
export const CodexFollowupTaskV2ToolInputSchema = CodexSendMessageV2ToolInputSchema;
export type CodexFollowupTaskV2ToolInput = z.infer<typeof CodexFollowupTaskV2ToolInputSchema>;

/** Discovers the current root's agent tree, not independent user sessions. */
export const CodexListAgentsV2ToolInputSchema = z.object({ path_prefix: z.string().optional() }).loose();
export type CodexListAgentsV2ToolInput = z.infer<typeof CodexListAgentsV2ToolInputSchema>;

/** Mailbox waiting has no target list; V1's targets do not select V2 recipients. */
export const CodexWaitAgentV2ToolInputSchema = z.object({ timeout_ms: z.number().optional() }).loose();
export type CodexWaitAgentV2ToolInput = z.infer<typeof CodexWaitAgentV2ToolInputSchema>;

/** Interrupts the turn while retaining the agent for subsequent messages/tasks. */
export const CodexInterruptAgentV2ToolInputSchema = z.object({ target: z.string() }).loose();
export type CodexInterruptAgentV2ToolInput = z.infer<typeof CodexInterruptAgentV2ToolInputSchema>;

export const CodexAgentStatusSchema = z.union([
  z.enum(["pending_init", "running", "interrupted", "shutdown", "not_found"]),
  z.object({ completed: z.string().nullable() }).loose(),
  z.object({ errored: z.string() }).loose(),
]).refine((status) => typeof status !== "object" || !("completed" in status && "errored" in status), {
  message: "Agent status cannot be both completed and errored",
});
export type CodexAgentStatus = z.infer<typeof CodexAgentStatusSchema>;

export const CodexSpawnAgentV1ToolResponseSchema = z.object({
  agent_id: z.string(),
  nickname: z.string().nullable(),
}).loose();
export type CodexSpawnAgentV1ToolResponse = z.infer<typeof CodexSpawnAgentV1ToolResponseSchema>;

/** Hosts hiding metadata return only task_name. */
export const CodexSpawnAgentV2ToolResponseSchema = z.object({
  task_name: z.string(),
  nickname: z.string().nullable().optional(),
}).loose();
export type CodexSpawnAgentV2ToolResponse = z.infer<typeof CodexSpawnAgentV2ToolResponseSchema>;

export const CodexSendInputV1ToolResponseSchema = z.object({ submission_id: z.string() }).loose();
export type CodexSendInputV1ToolResponse = z.infer<typeof CodexSendInputV1ToolResponseSchema>;

export const CodexResumeAgentV1ToolResponseSchema = z.object({ status: CodexAgentStatusSchema }).loose();
export type CodexResumeAgentV1ToolResponse = z.infer<typeof CodexResumeAgentV1ToolResponseSchema>;

export const CodexWaitAgentV1ToolResponseSchema = z.object({
  status: z.record(z.string(), CodexAgentStatusSchema),
  timed_out: z.boolean(),
}).loose();
export type CodexWaitAgentV1ToolResponse = z.infer<typeof CodexWaitAgentV1ToolResponseSchema>;

export const CodexCloseAgentV1ToolResponseSchema = z.object({ previous_status: CodexAgentStatusSchema }).loose();
export type CodexCloseAgentV1ToolResponse = z.infer<typeof CodexCloseAgentV1ToolResponseSchema>;
export const CodexInterruptAgentV2ToolResponseSchema = CodexCloseAgentV1ToolResponseSchema;
export type CodexInterruptAgentV2ToolResponse = z.infer<typeof CodexInterruptAgentV2ToolResponseSchema>;

export const CodexListAgentsV2ToolResponseSchema = z.object({
  agents: z.array(z.object({
    agent_name: z.string(),
    agent_status: CodexAgentStatusSchema,
  }).loose()),
}).loose();
export type CodexListAgentsV2ToolResponse = z.infer<typeof CodexListAgentsV2ToolResponseSchema>;

export const CodexWaitAgentV2ToolResponseSchema = z.object({
  message: z.string(),
  timed_out: z.boolean(),
}).loose();
export type CodexWaitAgentV2ToolResponse = z.infer<typeof CodexWaitAgentV2ToolResponseSchema>;

/** V2 message handlers return text (an empty string on success in v0.153.4). */
export const CodexSendMessageV2ToolResponseSchema = z.string();
export type CodexSendMessageV2ToolResponse = z.infer<typeof CodexSendMessageV2ToolResponseSchema>;
export const CodexFollowupTaskV2ToolResponseSchema = CodexSendMessageV2ToolResponseSchema;
export type CodexFollowupTaskV2ToolResponse = z.infer<typeof CodexFollowupTaskV2ToolResponseSchema>;

export const CodexCollaborationV1ToolInputSchema = z.discriminatedUnion("tool_name", [
  z.object({ tool_name: z.literal("spawn_agent"), tool_input: CodexSpawnAgentV1ToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("send_input"), tool_input: CodexSendInputV1ToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("resume_agent"), tool_input: CodexResumeAgentV1ToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("wait_agent"), tool_input: CodexWaitAgentV1ToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("close_agent"), tool_input: CodexCloseAgentV1ToolInputSchema }).loose(),
]);
export type CodexCollaborationV1ToolInput = z.infer<typeof CodexCollaborationV1ToolInputSchema>;

export const CodexCollaborationV2ToolInputSchema = z.discriminatedUnion("tool_name", [
  z.object({ tool_name: z.literal("spawn_agent"), tool_input: CodexSpawnAgentV2ToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("send_message"), tool_input: CodexSendMessageV2ToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("followup_task"), tool_input: CodexFollowupTaskV2ToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("list_agents"), tool_input: CodexListAgentsV2ToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("wait_agent"), tool_input: CodexWaitAgentV2ToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("interrupt_agent"), tool_input: CodexInterruptAgentV2ToolInputSchema }).loose(),
]);
export type CodexCollaborationV2ToolInput = z.infer<typeof CodexCollaborationV2ToolInputSchema>;

export const CodexCollaborationV1ToolResponseSchemas = {
  spawn_agent: CodexSpawnAgentV1ToolResponseSchema,
  send_input: CodexSendInputV1ToolResponseSchema,
  resume_agent: CodexResumeAgentV1ToolResponseSchema,
  wait_agent: CodexWaitAgentV1ToolResponseSchema,
  close_agent: CodexCloseAgentV1ToolResponseSchema,
} satisfies Record<CodexCollaborationV1ToolName, z.ZodType>;

export const CodexCollaborationV2ToolResponseSchemas = {
  spawn_agent: CodexSpawnAgentV2ToolResponseSchema,
  send_message: CodexSendMessageV2ToolResponseSchema,
  followup_task: CodexFollowupTaskV2ToolResponseSchema,
  list_agents: CodexListAgentsV2ToolResponseSchema,
  wait_agent: CodexWaitAgentV2ToolResponseSchema,
  interrupt_agent: CodexInterruptAgentV2ToolResponseSchema,
} satisfies Record<CodexCollaborationV2ToolName, z.ZodType>;

export type CodexCollaborationV1ToolResponse<N extends CodexCollaborationV1ToolName = CodexCollaborationV1ToolName> =
  z.infer<(typeof CodexCollaborationV1ToolResponseSchemas)[N]>;
export type CodexCollaborationV2ToolResponse<N extends CodexCollaborationV2ToolName = CodexCollaborationV2ToolName> =
  z.infer<(typeof CodexCollaborationV2ToolResponseSchemas)[N]>;

/** Use the tool basename; transport namespaces belong on the outer call envelope. */
export function ParseCodexCollaborationV1ToolInput(input: unknown) {
  return CodexCollaborationV1ToolInputSchema.safeParse(input);
}

export function ParseCodexCollaborationV2ToolInput(input: unknown) {
  return CodexCollaborationV2ToolInputSchema.safeParse(input);
}

export function ParseCodexCollaborationV1ToolResponse<N extends CodexCollaborationV1ToolName>(name: N, response: unknown) {
  return CodexCollaborationV1ToolResponseSchemas[name].safeParse(response) as z.ZodSafeParseResult<CodexCollaborationV1ToolResponse<N>>;
}

export function ParseCodexCollaborationV2ToolResponse<N extends CodexCollaborationV2ToolName>(name: N, response: unknown) {
  return CodexCollaborationV2ToolResponseSchemas[name].safeParse(response) as z.ZodSafeParseResult<CodexCollaborationV2ToolResponse<N>>;
}
