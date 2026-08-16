import { z } from "zod";
import {
  JsonObjectSchema,
  OptionalBooleanField,
  OptionalNumberField,
  OptionalStringField,
} from "./common.ts";

// ---------------------------------------------------------------------------
// Google Antigravity external lifecycle hooks — configuration & stdin/stdout
// (see Antigravity hooks reference)
// ---------------------------------------------------------------------------

export const AntigravityHookEventNameSchema = z.enum([
  "PreToolUse",
  "PostToolUse",
  "PreInvocation",
  "PostInvocation",
  "Stop",
]);
export type AntigravityHookEventName = z.infer<typeof AntigravityHookEventNameSchema>;

/** Individual hook command handler in `hooks.json`. `timeout` is in seconds (default runtime: 30s). */
export const AntigravityCommandHookHandlerSchema = z.object({
  type: z.literal("command").default("command").optional(),
  command: z.string(),
  timeout: OptionalNumberField,
});
export type AntigravityCommandHookHandler = z.infer<typeof AntigravityCommandHookHandlerSchema>;

/** Tool-specific events (`PreToolUse`, `PostToolUse`) group handlers by tool regex matcher. */
export const AntigravityToolMatcherGroupSchema = z.object({
  matcher: OptionalStringField,
  hooks: z.array(AntigravityCommandHookHandlerSchema),
});
export type AntigravityToolMatcherGroup = z.infer<typeof AntigravityToolMatcherGroupSchema>;

/** A single named hook specification in `hooks.json`. */
export const AntigravityHookSpecSchema = z
  .object({
    enabled: OptionalBooleanField,
    PreToolUse: z.array(AntigravityToolMatcherGroupSchema).optional(),
    PostToolUse: z.array(AntigravityToolMatcherGroupSchema).optional(),
    PreInvocation: z.array(AntigravityCommandHookHandlerSchema).optional(),
    PostInvocation: z.array(AntigravityCommandHookHandlerSchema).optional(),
    Stop: z.array(AntigravityCommandHookHandlerSchema).optional(),
  })
  .loose();
export type AntigravityHookSpec = z.infer<typeof AntigravityHookSpecSchema>;

/** Root `hooks.json` file schema: mapping of hook names to their event configurations. */
export const AntigravityHooksFileSchema = z.record(z.string(), AntigravityHookSpecSchema);
export type AntigravityHooksFile = z.infer<typeof AntigravityHooksFileSchema>;

// ---------------------------------------------------------------------------
// Stdin payloads (protojson camelCase encoding)
// ---------------------------------------------------------------------------

/** Common metadata fields delivered to stdin for all Antigravity hook events. */
export const AntigravityHookInputBaseSchema = z
  .object({
    conversationId: OptionalStringField,
    workspacePaths: z.array(z.string()).optional(),
    transcriptPath: OptionalStringField,
    artifactDirectoryPath: OptionalStringField,
    modelName: OptionalStringField,
  })
  .loose();
export type AntigravityHookInputBase = z.infer<typeof AntigravityHookInputBaseSchema>;

/** Antigravity tool call representation in hook stdin / stdout step injections. */
export const AntigravityToolCallSchema = z
  .object({
    name: z.string(),
    args: JsonObjectSchema.optional(),
  })
  .loose();
export type AntigravityToolCall = z.infer<typeof AntigravityToolCallSchema>;

export const AntigravityPreToolUseInputSchema = AntigravityHookInputBaseSchema.extend({
  toolCall: AntigravityToolCallSchema.optional(),
  stepIdx: OptionalNumberField,
}).loose();
export type AntigravityPreToolUseInput = z.infer<typeof AntigravityPreToolUseInputSchema>;

export const AntigravityPostToolUseInputSchema = AntigravityHookInputBaseSchema.extend({
  stepIdx: OptionalNumberField,
  error: OptionalStringField,
}).loose();
export type AntigravityPostToolUseInput = z.infer<typeof AntigravityPostToolUseInputSchema>;

export const AntigravityPreInvocationInputSchema = AntigravityHookInputBaseSchema.extend({
  invocationNum: OptionalNumberField,
  initialNumSteps: OptionalNumberField,
}).loose();
export type AntigravityPreInvocationInput = z.infer<typeof AntigravityPreInvocationInputSchema>;

export const AntigravityPostInvocationInputSchema = AntigravityHookInputBaseSchema.extend({
  invocationNum: OptionalNumberField,
  initialNumSteps: OptionalNumberField,
}).loose();
export type AntigravityPostInvocationInput = z.infer<typeof AntigravityPostInvocationInputSchema>;

export const AntigravityStopInputSchema = AntigravityHookInputBaseSchema.extend({
  executionNum: OptionalNumberField,
  terminationReason: OptionalStringField,
  error: OptionalStringField,
  fullyIdle: OptionalBooleanField,
}).loose();
export type AntigravityStopInput = z.infer<typeof AntigravityStopInputSchema>;

/** Parse hook stdin for a specific Antigravity lifecycle event. */
export function ParseAntigravityHookInput(
  event: "PreToolUse",
  json: unknown,
): ReturnType<typeof AntigravityPreToolUseInputSchema.safeParse>;
export function ParseAntigravityHookInput(
  event: "PostToolUse",
  json: unknown,
): ReturnType<typeof AntigravityPostToolUseInputSchema.safeParse>;
export function ParseAntigravityHookInput(
  event: "PreInvocation",
  json: unknown,
): ReturnType<typeof AntigravityPreInvocationInputSchema.safeParse>;
export function ParseAntigravityHookInput(
  event: "PostInvocation",
  json: unknown,
): ReturnType<typeof AntigravityPostInvocationInputSchema.safeParse>;
export function ParseAntigravityHookInput(
  event: "Stop",
  json: unknown,
): ReturnType<typeof AntigravityStopInputSchema.safeParse>;
export function ParseAntigravityHookInput(
  event: AntigravityHookEventName,
  json: unknown,
):
  | ReturnType<typeof AntigravityPreToolUseInputSchema.safeParse>
  | ReturnType<typeof AntigravityPostToolUseInputSchema.safeParse>
  | ReturnType<typeof AntigravityPreInvocationInputSchema.safeParse>
  | ReturnType<typeof AntigravityPostInvocationInputSchema.safeParse>
  | ReturnType<typeof AntigravityStopInputSchema.safeParse>;
export function ParseAntigravityHookInput(
  event: AntigravityHookEventName,
  json: unknown,
) {
  switch (event) {
    case "PreToolUse":
      return AntigravityPreToolUseInputSchema.safeParse(json);
    case "PostToolUse":
      return AntigravityPostToolUseInputSchema.safeParse(json);
    case "PreInvocation":
      return AntigravityPreInvocationInputSchema.safeParse(json);
    case "PostInvocation":
      return AntigravityPostInvocationInputSchema.safeParse(json);
    case "Stop":
      return AntigravityStopInputSchema.safeParse(json);
    default:
      return AntigravityHookInputBaseSchema.safeParse(json);
  }
}

// ---------------------------------------------------------------------------
// Stdout payloads
// ---------------------------------------------------------------------------

/** Permission decisions supported exclusively on `PreToolUse`. */
export const AntigravityPreToolUseDecisionSchema = z.enum([
  "allow",
  "deny",
  "ask",
  "force_ask",
  "deny_unless_prior_grant",
]);
export type AntigravityPreToolUseDecision = z.infer<typeof AntigravityPreToolUseDecisionSchema>;

export const AntigravityPreToolUseStdoutSchema = z
  .object({
    decision: AntigravityPreToolUseDecisionSchema.optional(),
    reason: OptionalStringField,
    permissionOverrides: z.array(z.string()).optional(),
    overwrite: JsonObjectSchema.optional(),
  })
  .loose();
export type AntigravityPreToolUseStdout = z.infer<typeof AntigravityPreToolUseStdoutSchema>;

export const AntigravityPostToolUseStdoutSchema = z.object({}).loose();
export type AntigravityPostToolUseStdout = z.infer<typeof AntigravityPostToolUseStdoutSchema>;

export const AntigravityStepInjectionSchema = z
  .object({
    toolCall: AntigravityToolCallSchema.optional(),
    userMessage: OptionalStringField,
    ephemeralMessage: OptionalStringField,
  })
  .loose();
export type AntigravityStepInjection = z.infer<typeof AntigravityStepInjectionSchema>;

export const AntigravityPreInvocationStdoutSchema = z
  .object({
    injectSteps: z.array(AntigravityStepInjectionSchema).optional(),
  })
  .loose();
export type AntigravityPreInvocationStdout = z.infer<typeof AntigravityPreInvocationStdoutSchema>;

export const AntigravityTerminationBehaviorSchema = z.enum([
  "force_continue",
  "terminate",
  "",
]);
export type AntigravityTerminationBehavior = z.infer<
  typeof AntigravityTerminationBehaviorSchema
>;

export const AntigravityPostInvocationStdoutSchema = z
  .object({
    injectSteps: z.array(AntigravityStepInjectionSchema).optional(),
    terminationBehavior: AntigravityTerminationBehaviorSchema.or(z.string()).optional(),
  })
  .loose();
export type AntigravityPostInvocationStdout = z.infer<
  typeof AntigravityPostInvocationStdoutSchema
>;

export const AntigravityStopDecisionSchema = z.enum(["continue"]);
export type AntigravityStopDecision = z.infer<typeof AntigravityStopDecisionSchema>;

export const AntigravityStopStdoutSchema = z
  .object({
    decision: AntigravityStopDecisionSchema.or(z.string()).optional(),
    reason: OptionalStringField,
  })
  .loose();
export type AntigravityStopStdout = z.infer<typeof AntigravityStopStdoutSchema>;

/** Parse hook stdout for a specific Antigravity lifecycle event. */
export function ParseAntigravityHookOutput(
  event: "PreToolUse",
  json: unknown,
): ReturnType<typeof AntigravityPreToolUseStdoutSchema.safeParse>;
export function ParseAntigravityHookOutput(
  event: "PostToolUse",
  json: unknown,
): ReturnType<typeof AntigravityPostToolUseStdoutSchema.safeParse>;
export function ParseAntigravityHookOutput(
  event: "PreInvocation",
  json: unknown,
): ReturnType<typeof AntigravityPreInvocationStdoutSchema.safeParse>;
export function ParseAntigravityHookOutput(
  event: "PostInvocation",
  json: unknown,
): ReturnType<typeof AntigravityPostInvocationStdoutSchema.safeParse>;
export function ParseAntigravityHookOutput(
  event: "Stop",
  json: unknown,
): ReturnType<typeof AntigravityStopStdoutSchema.safeParse>;
export function ParseAntigravityHookOutput(
  event: AntigravityHookEventName,
  json: unknown,
):
  | ReturnType<typeof AntigravityPreToolUseStdoutSchema.safeParse>
  | ReturnType<typeof AntigravityPostToolUseStdoutSchema.safeParse>
  | ReturnType<typeof AntigravityPreInvocationStdoutSchema.safeParse>
  | ReturnType<typeof AntigravityPostInvocationStdoutSchema.safeParse>
  | ReturnType<typeof AntigravityStopStdoutSchema.safeParse>;
export function ParseAntigravityHookOutput(
  event: AntigravityHookEventName,
  json: unknown,
) {
  switch (event) {
    case "PreToolUse":
      return AntigravityPreToolUseStdoutSchema.safeParse(json);
    case "PostToolUse":
      return AntigravityPostToolUseStdoutSchema.safeParse(json);
    case "PreInvocation":
      return AntigravityPreInvocationStdoutSchema.safeParse(json);
    case "PostInvocation":
      return AntigravityPostInvocationStdoutSchema.safeParse(json);
    case "Stop":
      return AntigravityStopStdoutSchema.safeParse(json);
  }
}
