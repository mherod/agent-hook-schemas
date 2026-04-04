import { z } from "zod";

// ---------------------------------------------------------------------------
// Codex update_plan schema
// ---------------------------------------------------------------------------

/**
 * Captured `update_plan` payloads use a small, explicit plan state machine.
 * We keep the step object loose so raw captures can retain any future fields
 * without breaking parsing, while still validating the known core contract.
 */
export const UpdatePlanStepStatusSchema = z.enum([
  "pending",
  "in_progress",
  "completed",
]);
export type UpdatePlanStepStatus = z.infer<typeof UpdatePlanStepStatusSchema>;

export const UpdatePlanStepSchema = z
  .object({
    step: z.string(),
    status: UpdatePlanStepStatusSchema,
  })
  .loose();
export type UpdatePlanStep = z.infer<typeof UpdatePlanStepSchema>;

/**
 * Raw arguments passed to Codex `update_plan`.
 *
 * Captured payloads show:
 * - `explanation` is optional
 * - `plan` is an ordered array of step records
 * - each step has `step` and `status`
 */
export const UpdatePlanArgumentsSchema = z
  .object({
    explanation: z.string().optional(),
    plan: z.array(UpdatePlanStepSchema).nonempty(),
  })
  .loose();
export type UpdatePlanArguments = z.infer<typeof UpdatePlanArgumentsSchema>;

/**
 * Raw function-call envelope captured in archived sessions before the
 * arguments string is parsed.
 */
export const UpdatePlanFunctionCallSchema = z
  .object({
    type: z.literal("function_call"),
    name: z.literal("update_plan"),
    arguments: z.string(),
    call_id: z.string(),
  })
  .loose();
export type UpdatePlanFunctionCall = z.infer<typeof UpdatePlanFunctionCallSchema>;

/**
 * Raw function-call output captured in archived sessions after `update_plan`
 * completes. The captured payload is a plain completion string.
 */
export const UpdatePlanFunctionCallOutputSchema = z
  .object({
    type: z.literal("function_call_output"),
    call_id: z.string(),
    output: z.string(),
  })
  .loose();
export type UpdatePlanFunctionCallOutput = z.infer<
  typeof UpdatePlanFunctionCallOutputSchema
>;

/**
 * Backwards-compatible alias for the captured `update_plan` argument payload.
 * The previous Codex task schema name is kept so existing imports continue to
 * compile, but the contract now reflects the real tool payload.
 */
export const CodexTaskToolInputSchema = UpdatePlanArgumentsSchema;
export type CodexTaskToolInput = z.infer<typeof CodexTaskToolInputSchema>;

export const CodexUpdatePlanToolInputSchema = UpdatePlanArgumentsSchema;
export type CodexUpdatePlanToolInput = z.infer<typeof CodexUpdatePlanToolInputSchema>;

export const CodexUpdatePlanFunctionCallSchema = UpdatePlanFunctionCallSchema;
export type CodexUpdatePlanFunctionCall = z.infer<
  typeof CodexUpdatePlanFunctionCallSchema
>;

export const CodexUpdatePlanFunctionCallOutputSchema =
  UpdatePlanFunctionCallOutputSchema;
export type CodexUpdatePlanFunctionCallOutput = z.infer<
  typeof CodexUpdatePlanFunctionCallOutputSchema
>;

/** Parse raw `update_plan` arguments that have already been JSON-decoded. */
export function ParseUpdatePlanToolInput(toolInput: unknown) {
  return UpdatePlanArgumentsSchema.safeParse(toolInput);
}

/** Parse the outer `update_plan` function-call envelope captured in transcripts. */
export function ParseUpdatePlanFunctionCall(functionCall: unknown) {
  return UpdatePlanFunctionCallSchema.safeParse(functionCall);
}

/** Parse the outer `update_plan` function-call output captured in transcripts. */
export function ParseUpdatePlanFunctionCallOutput(functionCallOutput: unknown) {
  return UpdatePlanFunctionCallOutputSchema.safeParse(functionCallOutput);
}

/** Parse the JSON-string arguments field from a captured `update_plan` call. */
export function ParseUpdatePlanArguments(argumentsText: string) {
  try {
    return UpdatePlanArgumentsSchema.safeParse(JSON.parse(argumentsText) as unknown);
  } catch {
    return UpdatePlanArgumentsSchema.safeParse(null);
  }
}

/**
 * Legacy helper retained for compatibility with the previous Codex task module
 * name. This now parses the `update_plan` argument payload rather than Claude
 * task-update tool input.
 */
export function ParseCodexTaskCreateToolInput(toolInput: unknown) {
  return ParseUpdatePlanToolInput(toolInput);
}

/**
 * Legacy helper retained for compatibility with the previous Codex task module
 * name. This now parses the `update_plan` arguments payload.
 */
export function ParseCodexTaskUpdateToolInput(toolInput: unknown) {
  return ParseUpdatePlanToolInput(toolInput);
}

/**
 * Legacy helper retained for compatibility with the previous Codex task module
 * name. This now parses the outer `update_plan` function-call output.
 */
export function ParseCodexTaskUpdateToolResponse(toolResponse: unknown) {
  return ParseUpdatePlanFunctionCallOutput(toolResponse);
}

/**
 * Legacy helper retained for compatibility with the previous Codex task module
 * name. `update_plan` has no list/get response, so this simply reuses the
 * argument parser.
 */
export function ParseCodexTaskListToolResponse(toolResponse: unknown) {
  return ParseUpdatePlanToolInput(toolResponse);
}

/**
 * Legacy helper retained for compatibility with the previous Codex task module
 * name. `update_plan` has no list/get response, so this simply reuses the
 * argument parser.
 */
export function ParseCodexTaskGetToolResponse(toolResponse: unknown) {
  return ParseUpdatePlanToolInput(toolResponse);
}
