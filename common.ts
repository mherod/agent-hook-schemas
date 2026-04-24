import { z } from "zod";

/** Shared JSON object shape for MCP / OpenAI-style tool payloads. */
export const JsonObjectSchema = z.record(z.string(), z.unknown());
export type JsonObject = z.infer<typeof JsonObjectSchema>;

/** Nullable string (`string | null`) for fields like transcript_path, last_assistant_message. */
export const NullableStringSchema = z.union([z.string(), z.null()]);
export type NullableString = z.infer<typeof NullableStringSchema>;

/** Nullable string with null default — `z.union([z.string(), z.null()]).default(null)` for Codex wire output fields. */
export const NullableStringDefaultSchema = z.union([z.string(), z.null()]).default(null);
export type NullableStringDefault = z.infer<typeof NullableStringDefaultSchema>;

/** Optional string field for repeated `z.string().optional()` pattern in hook input schemas. */
export const OptionalStringField = z.string().optional();
export type OptionalString = z.infer<typeof OptionalStringField>;

/** Optional number field for repeated `z.number().optional()` pattern (token counts, durations, line numbers). */
export const OptionalNumberField = z.number().optional();
export type OptionalNumber = z.infer<typeof OptionalNumberField>;

/** Optional boolean field for repeated `z.boolean().optional()` pattern (flags, toggles). */
export const OptionalBooleanField = z.boolean().optional();
export type OptionalBoolean = z.infer<typeof OptionalBooleanField>;

/** Generic tool name field for platforms without specific tool name validation. */
export const ToolNameSchema = z.string();
export type ToolName = z.infer<typeof ToolNameSchema>;

/**
 * Build a cross-agent-tolerant variant of a hook input schema.
 *
 * Widens `hook_event_name` to accept any string (including other agents' event
 * names, e.g., Claude `PreCompact` ↔ Gemini `PreCompress`) and makes all fields
 * optional. Unknown keys pass through via `.catchall(z.unknown())`.
 *
 * Use this in shared dispatch logic that must accept payloads from multiple
 * agent platforms through a single schema. For strict single-agent parsing,
 * continue to use the platform-specific schema (e.g., `PreCompactInputSchema`).
 */
export function toCrossAgentInputSchema<T extends z.ZodObject>(schema: T) {
  return schema
    .partial()
    .extend({ hook_event_name: OptionalStringField })
    .catchall(z.unknown());
}

/** Optional tool name field for repeated `tool_name: z.string().optional()` pattern. */
export const OptionalToolNameField = z.string().optional();
export type OptionalToolName = z.infer<typeof OptionalToolNameField>;

/**
 * Claude Code permission decision values for PreToolUse hooks.
 *
 * - `"allow"` — permit the tool call without prompting the user
 * - `"deny"` — block the tool call; the agent receives the denial reason
 * - `"ask"` — defer to the user for interactive approval (default CLI behavior)
 * - `"defer"` — let downstream hooks or the default policy decide (Claude-only;
 *   enables background/headless agent workflows where interactive prompts are impossible)
 *
 * **Why 4 values (vs. Codex 3, Gemini 3):** Claude's `defer` supports headless agent
 * sessions (e.g. background tasks, CI pipelines) where no human is available to respond
 * to `ask`. Codex omits `defer` because its CLI always has an interactive session.
 * Gemini omits `ask` entirely, using `block` instead of `deny` for a simpler model.
 *
 * @see CodexPreToolUsePermissionDecisionWireSchema — Codex equivalent (no `defer`)
 * @see GeminiHookStdoutDecisionSchema — Gemini equivalent (no `ask` or `defer`)
 */
export const PreToolPermissionDecisionSchema = z.enum(["allow", "deny", "ask", "defer"]);
export type PreToolPermissionDecision = z.infer<typeof PreToolPermissionDecisionSchema>;

/**
 * Hook events that exist in both Claude Code and OpenAI Codex hook protocols.
 * Claude adds many more events; Codex uses exactly this set.
 */
export const SharedHookEventNameSchema = z.enum([
  "SessionStart",
  "PreToolUse",
  "PostToolUse",
  "UserPromptSubmit",
  "Stop",
]);
export type SharedHookEventName = z.infer<typeof SharedHookEventNameSchema>;

/** Shared `tool_name` + `tool_input` on tool-shaped hook stdin (Claude + Codex). */
export const ToolCallCoreSchema = z.object({
  tool_name: ToolNameSchema,
  tool_input: JsonObjectSchema,
});
export type ToolCallCore = z.infer<typeof ToolCallCoreSchema>;

/**
 * PreToolUse `hookSpecificOutput` / stdout fields documented for both platforms.
 */
export const SharedHookSpecificPreToolUseOutputSchema = z
  .object({
    hookEventName: z.literal("PreToolUse"),
    permissionDecision: PreToolPermissionDecisionSchema,
    permissionDecisionReason: z.string().optional(),
    updatedInput: JsonObjectSchema.optional(),
    additionalContext: z.string().optional(),
  })
  .strict();
export type SharedHookSpecificPreToolUseOutput = z.infer<
  typeof SharedHookSpecificPreToolUseOutputSchema
>;

/** Shared events that use only `hookEventName` + optional `additionalContext` on stdout (not PreToolUse). */
export type SharedHookSpecificContextOnlyEventName = Exclude<SharedHookEventName, "PreToolUse">;

export const SharedHookSpecificSessionStartOutputSchema = z
  .object({
    hookEventName: z.literal("SessionStart"),
    additionalContext: z.string().optional(),
  })
  .strict();
export type SharedHookSpecificSessionStartOutput = z.infer<
  typeof SharedHookSpecificSessionStartOutputSchema
>;

/** PostToolUse `hookSpecificOutput`: Codex documents `additionalContext`; Claude may add MCP override. */
export const SharedHookSpecificPostToolUseOutputSchema = z
  .object({
    hookEventName: z.literal("PostToolUse"),
    additionalContext: z.string().optional(),
    updatedMCPToolOutput: z.unknown().optional(),
  })
  .strict();
export type SharedHookSpecificPostToolUseOutput = z.infer<
  typeof SharedHookSpecificPostToolUseOutputSchema
>;

export const SharedHookSpecificUserPromptSubmitOutputSchema = z
  .object({
    hookEventName: z.literal("UserPromptSubmit"),
    additionalContext: z.string().optional(),
  })
  .strict();
export type SharedHookSpecificUserPromptSubmitOutput = z.infer<
  typeof SharedHookSpecificUserPromptSubmitOutputSchema
>;

export const SharedHookSpecificStopOutputSchema = z
  .object({
    hookEventName: z.literal("Stop"),
    additionalContext: z.string().optional(),
  })
  .strict();
export type SharedHookSpecificStopOutput = z.infer<typeof SharedHookSpecificStopOutputSchema>;

/**
 * Strongly typed `hookSpecificOutput` for the Claude ∩ Codex event set (discriminated on `hookEventName`).
 */
export const SharedHookSpecificOutputSchema = z.discriminatedUnion("hookEventName", [
  SharedHookSpecificPreToolUseOutputSchema,
  SharedHookSpecificSessionStartOutputSchema,
  SharedHookSpecificPostToolUseOutputSchema,
  SharedHookSpecificUserPromptSubmitOutputSchema,
  SharedHookSpecificStopOutputSchema,
]);
export type SharedHookSpecificOutput = z.infer<typeof SharedHookSpecificOutputSchema>;

/**
 * Factory for Codex command output schemas with decision field and hookSpecificOutput.
 * Reduces duplication across PreToolUse, PostToolUse, and UserPromptSubmit outputs.
 *
 * @param decisionSchema - Zod schema for the `decision` field (e.g., CodexPreToolUseDecisionWireSchema)
 * @param hookSpecificOutputSchema - Zod schema for the `hookSpecificOutput` field
 * @returns Strict object schema with decision, hookSpecificOutput, reason, stopReason, suppressOutput, systemMessage, continue
 */
export function createCodexCommandOutputSchema<
  D extends z.ZodTypeAny,
  H extends z.ZodTypeAny,
>(decisionSchema: D, hookSpecificOutputSchema: H) {
  return z
    .object({
      continue: z.boolean().default(true),
      decision: z.union([decisionSchema, z.null()]).default(null),
      hookSpecificOutput: z.union([hookSpecificOutputSchema, z.null()]).default(null),
      reason: NullableStringDefaultSchema,
      stopReason: NullableStringDefaultSchema,
      suppressOutput: z.boolean().default(false),
      systemMessage: NullableStringDefaultSchema,
    })
    .strict();
}

/** @param hookEventName Must not be `PreToolUse` — use {@link SharedHookSpecificPreToolUseOutputSchema} instead. */
export function sharedHookSpecificAdditionalContextSchema<
  const N extends SharedHookSpecificContextOnlyEventName,
>(hookEventName: N) {
  switch (hookEventName) {
    case "SessionStart":
      return SharedHookSpecificSessionStartOutputSchema;
    case "PostToolUse":
      return SharedHookSpecificPostToolUseOutputSchema;
    case "UserPromptSubmit":
      return SharedHookSpecificUserPromptSubmitOutputSchema;
    case "Stop":
      return SharedHookSpecificStopOutputSchema;
    default: {
      const _x: never = hookEventName;
      return _x;
    }
  }
}

/**
 * Top-level hook stdout fields common to Claude and Codex JSON
 * (`continue`, `stopReason`, `systemMessage`, `suppressOutput`).
 */
export const SharedHookStdoutCommonFieldsSchema = z.object({
  continue: OptionalBooleanField,
  stopReason: z.string().optional(),
  systemMessage: z.string().optional(),
  suppressOutput: OptionalBooleanField,
});
export type SharedHookStdoutCommonFields = z.infer<typeof SharedHookStdoutCommonFieldsSchema>;

export const HookShellSchema = z.enum(["bash", "powershell"]);

export const HookHandlerCommonSchema = z.object({
  if: OptionalStringField,
  timeout: OptionalNumberField,
  statusMessage: OptionalStringField,
  once: OptionalBooleanField,
});

/** Command hook handler shape shared by Claude and Codex `hooks.json`. */
export const CommandHookHandlerSchema = HookHandlerCommonSchema.extend({
  type: z.literal("command"),
  command: z.string(),
  async: OptionalBooleanField,
  shell: HookShellSchema.optional(),
});
export type CommandHookHandler = z.infer<typeof CommandHookHandlerSchema>;

/**
 * Matcher group with command handlers only: the config overlap between Claude
 * (which also allows http / prompt / agent) and Codex (command-only).
 */
export const SharedCommandMatcherGroupSchema = z.object({
  matcher: z.string().optional(),
  hooks: z.array(CommandHookHandlerSchema),
});
export type SharedCommandMatcherGroup = z.infer<typeof SharedCommandMatcherGroupSchema>;
