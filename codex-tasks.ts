import { z } from "zod";
import {
  TaskCreateToolInputSchema as ClaudeTaskCreateToolInputSchema,
  TaskCreateToolResponseSchema as ClaudeTaskCreateToolResponseSchema,
  TaskGetToolInputSchema as ClaudeTaskGetToolInputSchema,
  TaskGetToolResponseSchema as ClaudeTaskGetToolResponseSchema,
  TaskListItemSchema as ClaudeTaskListItemSchema,
  TaskListToolInputSchema as ClaudeTaskListToolInputSchema,
  TaskListToolResponseSchema as ClaudeTaskListToolResponseSchema,
  TaskOutputToolInputSchema as ClaudeTaskOutputToolInputSchema,
  TaskStatusSchema as ClaudeTaskStatusSchema,
  TaskStatusWithDeletedSchema as ClaudeTaskStatusWithDeletedSchema,
  TaskStopToolInputSchema as ClaudeTaskStopToolInputSchema,
  TaskUpdateToolInputSchema as ClaudeTaskUpdateToolInputSchema,
  TaskUpdateToolResponseErrorSchema as ClaudeTaskUpdateToolResponseErrorSchema,
  TaskUpdateToolResponseSchema as ClaudeTaskUpdateToolResponseSchema,
  TaskUpdateToolResponseSuccessSchema as ClaudeTaskUpdateToolResponseSuccessSchema,
} from "./claude-tasks.ts";

// ---------------------------------------------------------------------------
// Codex task schemas
// ---------------------------------------------------------------------------

/**
 * Codex task schemas are structurally identical to Claude task schemas.
 *
 * Codex hook payloads use `update_plan` as a compatibility alias for the
 * update-shaped task tool, so the discriminated union accepts both names.
 */

export const CodexTaskStatusSchema = ClaudeTaskStatusSchema;
export type CodexTaskStatus = z.infer<typeof CodexTaskStatusSchema>;

export const CodexTaskStatusWithDeletedSchema = ClaudeTaskStatusWithDeletedSchema;
export type CodexTaskStatusWithDeleted = z.infer<
  typeof CodexTaskStatusWithDeletedSchema
>;

export const CodexTaskCreateToolInputSchema = ClaudeTaskCreateToolInputSchema;
export type CodexTaskCreateToolInput = z.infer<
  typeof CodexTaskCreateToolInputSchema
>;

export const CodexTaskCreateToolResponseSchema = ClaudeTaskCreateToolResponseSchema;
export type CodexTaskCreateToolResponse = z.infer<
  typeof CodexTaskCreateToolResponseSchema
>;

export const CodexTaskUpdateToolInputSchema = ClaudeTaskUpdateToolInputSchema;
export type CodexTaskUpdateToolInput = z.infer<
  typeof CodexTaskUpdateToolInputSchema
>;

export const CodexTaskUpdateToolResponseSuccessSchema =
  ClaudeTaskUpdateToolResponseSuccessSchema;
export type CodexTaskUpdateToolResponseSuccess = z.infer<
  typeof CodexTaskUpdateToolResponseSuccessSchema
>;

export const CodexTaskUpdateToolResponseErrorSchema =
  ClaudeTaskUpdateToolResponseErrorSchema;
export type CodexTaskUpdateToolResponseError = z.infer<
  typeof CodexTaskUpdateToolResponseErrorSchema
>;

export const CodexTaskUpdateToolResponseSchema = ClaudeTaskUpdateToolResponseSchema;
export type CodexTaskUpdateToolResponse = z.infer<
  typeof CodexTaskUpdateToolResponseSchema
>;

export const CodexTaskListToolInputSchema = ClaudeTaskListToolInputSchema;
export type CodexTaskListToolInput = z.infer<typeof CodexTaskListToolInputSchema>;

export const CodexTaskListItemSchema = ClaudeTaskListItemSchema;
export type CodexTaskListItem = z.infer<typeof CodexTaskListItemSchema>;

export const CodexTaskListToolResponseSchema = ClaudeTaskListToolResponseSchema;
export type CodexTaskListToolResponse = z.infer<
  typeof CodexTaskListToolResponseSchema
>;

export const CodexTaskGetToolInputSchema = ClaudeTaskGetToolInputSchema;
export type CodexTaskGetToolInput = z.infer<typeof CodexTaskGetToolInputSchema>;

export const CodexTaskGetToolResponseSchema = ClaudeTaskGetToolResponseSchema;
export type CodexTaskGetToolResponse = z.infer<
  typeof CodexTaskGetToolResponseSchema
>;

export const CodexTaskOutputToolInputSchema = ClaudeTaskOutputToolInputSchema;
export type CodexTaskOutputToolInput = z.infer<
  typeof CodexTaskOutputToolInputSchema
>;

export const CodexTaskStopToolInputSchema = ClaudeTaskStopToolInputSchema;
export type CodexTaskStopToolInput = z.infer<typeof CodexTaskStopToolInputSchema>;

/**
 * Codex aliases `update_plan` to the same payload shape as `TaskUpdate`.
 * Keep the canonical `TaskUpdate` name in the union for compatibility.
 */
export const CodexUpdatePlanToolInputSchema = CodexTaskUpdateToolInputSchema;
export type CodexUpdatePlanToolInput = z.infer<
  typeof CodexUpdatePlanToolInputSchema
>;

export const CodexTaskToolInputSchema = z.discriminatedUnion("tool_name", [
  z.object({ tool_name: z.literal("TaskCreate"), tool_input: CodexTaskCreateToolInputSchema }),
  z.object({ tool_name: z.literal("TaskUpdate"), tool_input: CodexTaskUpdateToolInputSchema }),
  z.object({ tool_name: z.literal("update_plan"), tool_input: CodexUpdatePlanToolInputSchema }),
  z.object({ tool_name: z.literal("TaskList"), tool_input: CodexTaskListToolInputSchema }),
  z.object({ tool_name: z.literal("TaskGet"), tool_input: CodexTaskGetToolInputSchema }),
  z.object({ tool_name: z.literal("TaskOutput"), tool_input: CodexTaskOutputToolInputSchema }),
  z.object({ tool_name: z.literal("TaskStop"), tool_input: CodexTaskStopToolInputSchema }),
]);
export type CodexTaskToolInput = z.infer<typeof CodexTaskToolInputSchema>;

export function ParseCodexTaskCreateToolInput(toolInput: unknown) {
  return CodexTaskCreateToolInputSchema.safeParse(toolInput);
}

export function ParseCodexTaskUpdateToolInput(toolInput: unknown) {
  return CodexTaskUpdateToolInputSchema.safeParse(toolInput);
}

export function ParseUpdatePlanToolInput(toolInput: unknown) {
  return CodexUpdatePlanToolInputSchema.safeParse(toolInput);
}

export function ParseCodexTaskUpdateToolResponse(toolResponse: unknown) {
  return CodexTaskUpdateToolResponseSchema.safeParse(toolResponse);
}

export function ParseCodexTaskListToolResponse(toolResponse: unknown) {
  return CodexTaskListToolResponseSchema.safeParse(toolResponse);
}

export function ParseCodexTaskGetToolResponse(toolResponse: unknown) {
  return CodexTaskGetToolResponseSchema.safeParse(toolResponse);
}
