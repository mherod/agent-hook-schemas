import { z } from "zod";
import { JsonObjectSchema, SharedHookSpecificOutputSchema } from "./common.ts";

// ---------------------------------------------------------------------------
// Gemini CLI hooks — settings + stdin/stdout (see Gemini CLI hooks reference)
// ---------------------------------------------------------------------------

export const GeminiHookEventNameSchema = z.enum([
  "SessionStart",
  "SessionEnd",
  "BeforeAgent",
  "AfterAgent",
  "BeforeModel",
  "AfterModel",
  "BeforeToolSelection",
  "BeforeTool",
  "AfterTool",
  "PreCompress",
  "Notification",
]);
export type GeminiHookEventName = z.infer<typeof GeminiHookEventNameSchema>;

/** Hook handler in `settings.json`; `timeout` is milliseconds (default runtime: 60000). */
export const GeminiCommandHookHandlerSchema = z.object({
  type: z.literal("command"),
  command: z.string(),
  name: z.string().optional(),
  timeout: z.number().optional(),
  description: z.string().optional(),
});
export type GeminiCommandHookHandler = z.infer<typeof GeminiCommandHookHandlerSchema>;

/**
 * Whether `matcher` is usable at runtime: omitted, `""`, and `*` are wildcards (Gemini docs);
 * any other value must compile as a JavaScript `RegExp` source (tool hooks use regex; lifecycle
 * values such as `startup` are valid literal patterns).
 */
export function geminiMatcherPatternCompiles(matcher: string | undefined): boolean {
  if (matcher === undefined) return true;
  if (matcher === "" || matcher === "*") return true;
  try {
    new RegExp(matcher);
    return true;
  } catch {
    return false;
  }
}

/**
 * Matcher group: optional `matcher` (regex for tool events, exact string for lifecycle),
 * optional `sequential` execution, and required `hooks` list.
 */
export const GeminiMatcherGroupSchema = z
  .object({
    matcher: z.string().optional(),
    sequential: z.boolean().optional(),
    hooks: z.array(GeminiCommandHookHandlerSchema),
  })
  .superRefine((data, ctx) => {
    if (!geminiMatcherPatternCompiles(data.matcher)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'matcher must be omitted, "", "*", or a valid JavaScript regular expression source',
        path: ["matcher"],
      });
    }
  });
export type GeminiMatcherGroup = z.infer<typeof GeminiMatcherGroupSchema>;

const GeminiMatcherGroupListSchema = z.array(GeminiMatcherGroupSchema);

export const GeminiHooksConfigSchema = z
  .object({
    SessionStart: GeminiMatcherGroupListSchema,
    SessionEnd: GeminiMatcherGroupListSchema,
    BeforeAgent: GeminiMatcherGroupListSchema,
    AfterAgent: GeminiMatcherGroupListSchema,
    BeforeModel: GeminiMatcherGroupListSchema,
    AfterModel: GeminiMatcherGroupListSchema,
    BeforeToolSelection: GeminiMatcherGroupListSchema,
    BeforeTool: GeminiMatcherGroupListSchema,
    AfterTool: GeminiMatcherGroupListSchema,
    PreCompress: GeminiMatcherGroupListSchema,
    Notification: GeminiMatcherGroupListSchema,
  })
  .partial();
export type GeminiHooksConfig = z.infer<typeof GeminiHooksConfigSchema>;

/** `hooks` object inside Gemini `settings.json` (merged across config layers). */
export const GeminiSettingsHooksFragmentSchema = z
  .object({
    hooks: GeminiHooksConfigSchema,
  })
  .loose();
export type GeminiSettingsHooksFragment = z.infer<typeof GeminiSettingsHooksFragmentSchema>;

// --- stdin (discriminated on hook_event_name) --------------------------------

const GeminiHookInputBaseSchema = z.object({
  session_id: z.string(),
  transcript_path: z.string(),
  cwd: z.string(),
  timestamp: z.string(),
});

export const GeminiSessionStartInputSchema = GeminiHookInputBaseSchema.extend({
  hook_event_name: z.literal("SessionStart"),
  source: z.enum(["startup", "resume", "clear"]),
}).loose();
export type GeminiSessionStartInput = z.infer<typeof GeminiSessionStartInputSchema>;

export const GeminiSessionEndInputSchema = GeminiHookInputBaseSchema.extend({
  hook_event_name: z.literal("SessionEnd"),
  reason: z.enum(["exit", "clear", "logout", "prompt_input_exit", "other"]),
}).loose();
export type GeminiSessionEndInput = z.infer<typeof GeminiSessionEndInputSchema>;

export const GeminiBeforeAgentInputSchema = GeminiHookInputBaseSchema.extend({
  hook_event_name: z.literal("BeforeAgent"),
  prompt: z.string(),
}).loose();
export type GeminiBeforeAgentInput = z.infer<typeof GeminiBeforeAgentInputSchema>;

export const GeminiAfterAgentInputSchema = GeminiHookInputBaseSchema.extend({
  hook_event_name: z.literal("AfterAgent"),
  prompt: z.string(),
  prompt_response: z.string(),
  stop_hook_active: z.boolean(),
}).loose();
export type GeminiAfterAgentInput = z.infer<typeof GeminiAfterAgentInputSchema>;

export const GeminiBeforeModelInputSchema = GeminiHookInputBaseSchema.extend({
  hook_event_name: z.literal("BeforeModel"),
  llm_request: JsonObjectSchema,
}).loose();
export type GeminiBeforeModelInput = z.infer<typeof GeminiBeforeModelInputSchema>;

export const GeminiAfterModelInputSchema = GeminiHookInputBaseSchema.extend({
  hook_event_name: z.literal("AfterModel"),
  llm_request: JsonObjectSchema,
  llm_response: JsonObjectSchema,
}).loose();
export type GeminiAfterModelInput = z.infer<typeof GeminiAfterModelInputSchema>;

export const GeminiBeforeToolSelectionInputSchema = GeminiHookInputBaseSchema.extend({
  hook_event_name: z.literal("BeforeToolSelection"),
  llm_request: JsonObjectSchema,
}).loose();
export type GeminiBeforeToolSelectionInput = z.infer<typeof GeminiBeforeToolSelectionInputSchema>;

export const GeminiBeforeToolInputSchema = GeminiHookInputBaseSchema.extend({
  hook_event_name: z.literal("BeforeTool"),
  tool_name: z.string(),
  tool_input: JsonObjectSchema,
  mcp_context: JsonObjectSchema.optional(),
  original_request_name: z.string().optional(),
}).loose();
export type GeminiBeforeToolInput = z.infer<typeof GeminiBeforeToolInputSchema>;

export const GeminiAfterToolInputSchema = GeminiHookInputBaseSchema.extend({
  hook_event_name: z.literal("AfterTool"),
  tool_name: z.string(),
  tool_input: JsonObjectSchema,
  tool_response: JsonObjectSchema,
  mcp_context: JsonObjectSchema.optional(),
  original_request_name: z.string().optional(),
}).loose();
export type GeminiAfterToolInput = z.infer<typeof GeminiAfterToolInputSchema>;

export const GeminiPreCompressInputSchema = GeminiHookInputBaseSchema.extend({
  hook_event_name: z.literal("PreCompress"),
  trigger: z.enum(["auto", "manual"]),
}).loose();
export type GeminiPreCompressInput = z.infer<typeof GeminiPreCompressInputSchema>;

export const GeminiNotificationInputSchema = GeminiHookInputBaseSchema.extend({
  hook_event_name: z.literal("Notification"),
  notification_type: z.enum(["ToolPermission"]),
  message: z.string(),
  details: JsonObjectSchema,
}).loose();
export type GeminiNotificationInput = z.infer<typeof GeminiNotificationInputSchema>;

/** Discriminated union for Gemini hook stdin JSON. */
export const GeminiHookEventInputSchema = z.discriminatedUnion("hook_event_name", [
  GeminiSessionStartInputSchema,
  GeminiSessionEndInputSchema,
  GeminiBeforeAgentInputSchema,
  GeminiAfterAgentInputSchema,
  GeminiBeforeModelInputSchema,
  GeminiAfterModelInputSchema,
  GeminiBeforeToolSelectionInputSchema,
  GeminiBeforeToolInputSchema,
  GeminiAfterToolInputSchema,
  GeminiPreCompressInputSchema,
  GeminiNotificationInputSchema,
]);
export type GeminiHookEventInput = z.infer<typeof GeminiHookEventInputSchema>;

// --- stdout (common + hookSpecificOutput bag) --------------------------------

/** Documented `decision` values; `"block"` is an alias of deny-style blocking. */
export const GeminiHookStdoutDecisionSchema = z.enum(["allow", "deny", "block"]);
export type GeminiHookStdoutDecision = z.infer<typeof GeminiHookStdoutDecisionSchema>;

/**
 * Gemini-only `hookSpecificOutput` keys from the hooks reference (no `hookEventName`).
 * Union with {@link SharedHookSpecificOutputSchema} for Claude/Codex-compatible payloads.
 */
export const GeminiHookSpecificOutputExtensionSchema = z
  .object({
    tool_input: JsonObjectSchema.optional(),
    additionalContext: z.string().optional(),
    llm_request: JsonObjectSchema.optional(),
    llm_response: JsonObjectSchema.optional(),
    toolConfig: z
      .object({
        mode: z.enum(["AUTO", "ANY", "NONE"]).optional(),
        allowedFunctionNames: z.array(z.string()).optional(),
      })
      .optional(),
    tailToolCallRequest: z
      .object({
        name: z.string(),
        args: JsonObjectSchema,
      })
      .optional(),
    clearContext: z.boolean().optional(),
  })
  .loose();

/** `hookSpecificOutput`: discriminated shared events ∪ documented Gemini extension shape. */
export const GeminiHookSpecificOutputSchema = z.union([
  SharedHookSpecificOutputSchema,
  GeminiHookSpecificOutputExtensionSchema,
]);
export type GeminiHookSpecificOutput = z.infer<typeof GeminiHookSpecificOutputSchema>;

/**
 * Common stdout fields (most hooks). Advisory-only hooks ignore flow-control fields.
 * Use `.loose()` at call sites if you need extra keys.
 */
export const GeminiHookStdoutCommonFieldsSchema = z.object({
  systemMessage: z.string().optional(),
  suppressOutput: z.boolean().optional(),
  continue: z.boolean().optional(),
  stopReason: z.string().optional(),
  decision: GeminiHookStdoutDecisionSchema.optional(),
  reason: z.string().optional(),
  hookSpecificOutput: GeminiHookSpecificOutputSchema.optional(),
});
export type GeminiHookStdoutCommonFields = z.infer<typeof GeminiHookStdoutCommonFieldsSchema>;

/** Broad hook stdout: common fields plus unknown keys (forward-compatible). */
export const GeminiHookCommandOutputSchema = GeminiHookStdoutCommonFieldsSchema.loose();
export type GeminiHookCommandOutput = z.infer<typeof GeminiHookCommandOutputSchema>;

/** Parse hook stdin; returns discriminated result or Zod error. */
export function ParseGeminiHookInput(json: unknown) {
  return GeminiHookEventInputSchema.safeParse(json);
}

/** Parse hook stdout JSON (after stripping non-JSON pollution — hooks must only emit JSON). */
export function ParseGeminiHookOutput(json: unknown) {
  return GeminiHookCommandOutputSchema.safeParse(json);
}

// Merge / matcher / resolve helpers live in `gemini-hooks-integration.ts` (no re-export here:
// that would circularly import this module before schemas initialize).
