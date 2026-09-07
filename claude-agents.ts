import { z } from "zod";
import { JsonObjectSchema } from "./common.ts";
import { AgentToolInputSchema } from "./claude-tool-schemas.ts";

export { AgentToolInputSchema, type AgentToolInput } from "./claude-tool-schemas.ts";

/**
 * Documentation-derived discovery input. No parameter contract is published;
 * preserve any runtime-specific filters instead of inventing required fields.
 * https://code.claude.com/docs/en/cross-session-messaging
 */
export const ListAgentsToolInputSchema = z.object({}).loose();
export type ListAgentsToolInput = z.infer<typeof ListAgentsToolInputSchema>;

/**
 * Models documented text delivery and idle subscriptions. Object messages are
 * retained as opaque JSON for compatibility, without validating a protocol.
 * https://code.claude.com/docs/en/cross-session-messaging
 */
export const SendMessageToolInputSchema = z.object({
  to: z.string(),
  message: z.union([z.string(), JsonObjectSchema]).optional(),
  summary: z.string().optional(),
  notify_when_idle: z.boolean().optional(),
}).loose().refine((input) => input.message !== undefined || input.notify_when_idle === true, {
  message: "Provide a message or request an idle notification",
  path: ["message"],
});
export type SendMessageToolInput = z.infer<typeof SendMessageToolInputSchema>;

/** Decoded tool payloads; Task is the SDK's backward-compatible name for Agent. */
export const ClaudeAgentToolInputSchema = z.discriminatedUnion("tool_name", [
  z.object({ tool_name: z.literal("Agent"), tool_input: AgentToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("Task"), tool_input: AgentToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("ListAgents"), tool_input: ListAgentsToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("SendMessage"), tool_input: SendMessageToolInputSchema }).loose(),
]);
export type ClaudeAgentToolInput = z.infer<typeof ClaudeAgentToolInputSchema>;

export function ParseAgentToolInput(input: unknown) {
  return AgentToolInputSchema.safeParse(input);
}

export function ParseListAgentsToolInput(input: unknown) {
  return ListAgentsToolInputSchema.safeParse(input);
}

export function ParseSendMessageToolInput(input: unknown) {
  return SendMessageToolInputSchema.safeParse(input);
}

export function ParseClaudeAgentToolInput(input: unknown) {
  return ClaudeAgentToolInputSchema.safeParse(input);
}
