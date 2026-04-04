import { z } from "zod";

// ---------------------------------------------------------------------------
// Task status enum
// ---------------------------------------------------------------------------

/**
 * Status lifecycle for structured tasks: `pending` → `in_progress` → `completed`.
 * `deleted` is a terminal state used to permanently remove a task.
 */
export const TaskStatusSchema = z.enum(["pending", "in_progress", "completed"]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

/** Includes the `deleted` terminal state accepted by TaskUpdate. */
export const TaskStatusWithDeletedSchema = z.enum([
  "pending",
  "in_progress",
  "completed",
  "deleted",
]);
export type TaskStatusWithDeleted = z.infer<typeof TaskStatusWithDeletedSchema>;

// ---------------------------------------------------------------------------
// TaskCreate
// ---------------------------------------------------------------------------

/** Tool input for the `TaskCreate` built-in tool. */
export const TaskCreateToolInputSchema = z
  .object({
    subject: z.string(),
    description: z.string(),
    activeForm: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .loose();
export type TaskCreateToolInput = z.infer<typeof TaskCreateToolInputSchema>;

/** Successful response from `TaskCreate`. */
export const TaskCreateToolResponseSchema = z
  .object({
    task: z.object({
      id: z.string(),
      subject: z.string(),
    }),
  })
  .loose();
export type TaskCreateToolResponse = z.infer<typeof TaskCreateToolResponseSchema>;

// ---------------------------------------------------------------------------
// TaskUpdate
// ---------------------------------------------------------------------------

/** Tool input for the `TaskUpdate` built-in tool. */
export const TaskUpdateToolInputSchema = z
  .object({
    taskId: z.string(),
    status: TaskStatusWithDeletedSchema.optional(),
    subject: z.string().optional(),
    description: z.string().optional(),
    activeForm: z.string().optional(),
    owner: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    addBlocks: z.array(z.string()).optional(),
    addBlockedBy: z.array(z.string()).optional(),
  })
  .loose();
export type TaskUpdateToolInput = z.infer<typeof TaskUpdateToolInputSchema>;

/** Successful response from `TaskUpdate`. */
export const TaskUpdateToolResponseSuccessSchema = z
  .object({
    success: z.literal(true),
    taskId: z.string(),
    updatedFields: z.array(z.string()),
    statusChange: z
      .object({
        from: TaskStatusSchema,
        to: TaskStatusSchema,
      })
      .optional(),
    verificationNudgeNeeded: z.boolean().optional(),
  })
  .loose();
export type TaskUpdateToolResponseSuccess = z.infer<
  typeof TaskUpdateToolResponseSuccessSchema
>;

/** Error response from `TaskUpdate` (e.g. task not found). */
export const TaskUpdateToolResponseErrorSchema = z
  .object({
    success: z.literal(false),
    taskId: z.string(),
    updatedFields: z.array(z.string()),
    error: z.string(),
  })
  .loose();
export type TaskUpdateToolResponseError = z.infer<
  typeof TaskUpdateToolResponseErrorSchema
>;

/** Discriminated response from `TaskUpdate`. */
export const TaskUpdateToolResponseSchema = z.discriminatedUnion("success", [
  TaskUpdateToolResponseSuccessSchema,
  TaskUpdateToolResponseErrorSchema,
]);
export type TaskUpdateToolResponse = z.infer<typeof TaskUpdateToolResponseSchema>;

// ---------------------------------------------------------------------------
// TaskList
// ---------------------------------------------------------------------------

/** Tool input for the `TaskList` built-in tool (no parameters). */
export const TaskListToolInputSchema = z.object({}).loose();
export type TaskListToolInput = z.infer<typeof TaskListToolInputSchema>;

/** A single task summary returned by `TaskList`. */
export const TaskListItemSchema = z
  .object({
    id: z.string(),
    subject: z.string(),
    status: TaskStatusSchema,
    owner: z.string().optional(),
    blockedBy: z.array(z.string()).optional(),
  })
  .loose();
export type TaskListItem = z.infer<typeof TaskListItemSchema>;

/** Response from `TaskList`. */
export const TaskListToolResponseSchema = z
  .object({
    tasks: z.array(TaskListItemSchema),
  })
  .loose();
export type TaskListToolResponse = z.infer<typeof TaskListToolResponseSchema>;

// ---------------------------------------------------------------------------
// TaskGet
// ---------------------------------------------------------------------------

/** Tool input for the `TaskGet` built-in tool. */
export const TaskGetToolInputSchema = z
  .object({
    taskId: z.string(),
  })
  .loose();
export type TaskGetToolInput = z.infer<typeof TaskGetToolInputSchema>;

/** Full task detail returned by `TaskGet`. */
export const TaskGetToolResponseSchema = z
  .object({
    id: z.string(),
    subject: z.string(),
    description: z.string().optional(),
    status: TaskStatusSchema,
    owner: z.string().optional(),
    activeForm: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    blocks: z.array(z.string()).optional(),
    blockedBy: z.array(z.string()).optional(),
  })
  .loose();
export type TaskGetToolResponse = z.infer<typeof TaskGetToolResponseSchema>;

// ---------------------------------------------------------------------------
// TaskOutput (background task execution)
// ---------------------------------------------------------------------------

/** Tool input for the `TaskOutput` built-in tool (background task streaming). */
export const TaskOutputToolInputSchema = z
  .object({
    task_id: z.string(),
    block: z.boolean().optional(),
    timeout: z.number().optional(),
  })
  .loose();
export type TaskOutputToolInput = z.infer<typeof TaskOutputToolInputSchema>;

// ---------------------------------------------------------------------------
// TaskStop (background task execution)
// ---------------------------------------------------------------------------

/** Tool input for the `TaskStop` built-in tool. */
export const TaskStopToolInputSchema = z
  .object({
    task_id: z.string().optional(),
    shell_id: z.string().optional(),
  })
  .loose();
export type TaskStopToolInput = z.infer<typeof TaskStopToolInputSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse a `TaskCreate` tool_input from a hook payload. */
export function ParseTaskCreateToolInput(toolInput: unknown) {
  return TaskCreateToolInputSchema.safeParse(toolInput);
}

/** Parse a `TaskUpdate` tool_input from a hook payload. */
export function ParseTaskUpdateToolInput(toolInput: unknown) {
  return TaskUpdateToolInputSchema.safeParse(toolInput);
}

/** Parse a `TaskUpdate` tool_response (discriminated on `success`). */
export function ParseTaskUpdateToolResponse(toolResponse: unknown) {
  return TaskUpdateToolResponseSchema.safeParse(toolResponse);
}

/** Parse a `TaskList` tool_response from a hook payload. */
export function ParseTaskListToolResponse(toolResponse: unknown) {
  return TaskListToolResponseSchema.safeParse(toolResponse);
}

/** Parse a `TaskGet` tool_response from a hook payload. */
export function ParseTaskGetToolResponse(toolResponse: unknown) {
  return TaskGetToolResponseSchema.safeParse(toolResponse);
}
