import { z } from "zod";
import {
  CommandHookHandlerSchema,
  JsonObjectSchema,
  NullableStringSchema,
  OptionalStringField,
  OptionalToolNameField,
  SharedCommandMatcherGroupSchema,
  SharedHookStdoutCommonFieldsSchema,
  createCodexCommandOutputSchema,
} from "./common.ts";

// ---------------------------------------------------------------------------
// OpenAI Codex hooks (experimental; `.codex/hooks.json` wire format)
// Overlaps Claude Code hooks; differs in events, fields, and output rules.
// ---------------------------------------------------------------------------

export const CodexHookEventNameSchema = z.enum([
  "SessionStart",
  "PreToolUse",
  "PostToolUse",
  "UserPromptSubmit",
  "Stop",
]);
export type CodexHookEventName = z.infer<typeof CodexHookEventNameSchema>;

/** Codex SessionStart `source` (`session-start.command.input`). */
export const CodexSessionStartSourceSchema = z.enum(["startup", "resume", "clear"]);
export type CodexSessionStartSource = z.infer<typeof CodexSessionStartSourceSchema>;

/** Alias for {@link NullableStringSchema} for backward compatibility. */
export const CodexNullableStringSchema = NullableStringSchema;

const CodexTranscriptPathSchema = NullableStringSchema;

/** Shared Codex stdin fields (see Codex hooks "Common input fields"). All fields optional for resilient parsing. */
export const CodexHookInputBaseSchema = z.object({
  session_id: OptionalStringField,
  transcript_path: CodexTranscriptPathSchema.optional(),
  cwd: OptionalStringField,
  model: OptionalStringField,
});
export type CodexHookInputBase = z.infer<typeof CodexHookInputBaseSchema>;

/**
 * Bash `tool_input` on Codex PreToolUse stdin (`PreToolUseToolInput` in
 * `pre-tool-use.command.input`; `additionalProperties: false`).
 */
export const CodexPreToolUseBashToolInputSchema = z
  .object({
    command: z.string().optional(),
  })
  .loose();
export type CodexPreToolUseBashToolInput = z.infer<typeof CodexPreToolUseBashToolInputSchema>;

/**
 * `permission_mode` on Codex hook stdin (SessionStart, Stop, PreToolUse, UserPromptSubmit, …). Excludes Claude-only `auto`
 * (OpenAI Codex JSON Schema).
 */
export const CodexHookPermissionModeSchema = z.enum([
  "default",
  "acceptEdits",
  "plan",
  "dontAsk",
  "bypassPermissions",
]);
export type CodexHookPermissionMode = z.infer<typeof CodexHookPermissionModeSchema>;

/**
 * Codex SessionStart stdin (`session-start.command.input`): strict object, no extra keys
 * (`additionalProperties: false`).
 */
export const CodexSessionStartInputSchema = z
  .object({
    cwd: z.string().optional(),
    hook_event_name: z.literal("SessionStart"),
    model: z.string().optional(),
    permission_mode: CodexHookPermissionModeSchema.optional(),
    session_id: z.string().optional(),
    source: CodexSessionStartSourceSchema.optional(),
    transcript_path: CodexNullableStringSchema.optional(),
  })
  .loose();
export type CodexSessionStartInput = z.infer<typeof CodexSessionStartInputSchema>;

/**
 * Codex PreToolUse stdin for Bash (`pre-tool-use.command.input`): strict object, no extra keys.
 * Codex currently emits Bash only for this hook; matchers for other tools are forward-looking.
 */
export const CodexPreToolUseInputSchema = z
  .object({
    cwd: z.string().optional(),
    hook_event_name: z.literal("PreToolUse"),
    model: z.string().optional(),
    permission_mode: CodexHookPermissionModeSchema.optional(),
    session_id: z.string().optional(),
    tool_input: CodexPreToolUseBashToolInputSchema.optional(),
    tool_name: OptionalToolNameField,
    tool_use_id: z.string().optional(),
    transcript_path: CodexNullableStringSchema.optional(),
    turn_id: z.string().optional(),
  })
  .loose();
export type CodexPreToolUseInput = z.infer<typeof CodexPreToolUseInputSchema>;

/**
 * Bash `tool_input` on Codex PostToolUse stdin (`PostToolUseToolInput` in
 * `post-tool-use.command.input`; same strict shape as {@link CodexPreToolUseBashToolInputSchema}).
 */
export const CodexPostToolUseBashToolInputSchema = CodexPreToolUseBashToolInputSchema;
export type CodexPostToolUseBashToolInput = z.infer<typeof CodexPostToolUseBashToolInputSchema>;

/**
 * Codex PostToolUse stdin for Bash (`post-tool-use.command.input`): strict object, no extra keys.
 * `tool_response` is required; the official JSON Schema uses `true` (accept any JSON value).
 */
export const CodexPostToolUseInputSchema = z
  .object({
    cwd: z.string().optional(),
    hook_event_name: z.literal("PostToolUse"),
    model: z.string().optional(),
    permission_mode: CodexHookPermissionModeSchema.optional(),
    session_id: z.string().optional(),
    tool_input: CodexPostToolUseBashToolInputSchema.optional(),
    tool_name: OptionalToolNameField,
    tool_response: z.unknown().optional(),
    tool_use_id: z.string().optional(),
    transcript_path: CodexNullableStringSchema.optional(),
    turn_id: z.string().optional(),
  })
  .loose();
export type CodexPostToolUseInput = z.infer<typeof CodexPostToolUseInputSchema>;

/**
 * Codex UserPromptSubmit stdin (`user-prompt-submit.command.input`): strict object, no extra keys
 * (`additionalProperties: false`).
 */
export const CodexUserPromptSubmitInputSchema = z
  .object({
    cwd: z.string().optional(),
    hook_event_name: z.literal("UserPromptSubmit"),
    model: z.string().optional(),
    permission_mode: CodexHookPermissionModeSchema.optional(),
    prompt: z.string().optional(),
    session_id: z.string().optional(),
    transcript_path: CodexNullableStringSchema.optional(),
    turn_id: z.string().optional(),
  })
  .loose();
export type CodexUserPromptSubmitInput = z.infer<typeof CodexUserPromptSubmitInputSchema>;

/** @deprecated Use {@link CodexHookPermissionModeSchema} (same schema). */
export const CodexStopPermissionModeSchema = CodexHookPermissionModeSchema;
export type CodexStopPermissionMode = CodexHookPermissionMode;

/**
 * Codex Stop hook stdin (`stop.command.input`): strict object, no extra keys
 * (`additionalProperties: false` in the official JSON Schema).
 */
export const CodexStopInputSchema = z
  .object({
    cwd: z.string().optional(),
    hook_event_name: z.literal("Stop"),
    last_assistant_message: CodexNullableStringSchema.optional(),
    model: z.string().optional(),
    permission_mode: CodexHookPermissionModeSchema.optional(),
    session_id: z.string().optional(),
    stop_hook_active: z.boolean().optional(),
    transcript_path: CodexNullableStringSchema.optional(),
    turn_id: z.string().optional(),
  })
  .loose();
export type CodexStopInput = z.infer<typeof CodexStopInputSchema>;

/** Discriminated union for Codex command-hook stdin. */
export const CodexHookEventInputSchema = z.discriminatedUnion("hook_event_name", [
  CodexSessionStartInputSchema,
  CodexPreToolUseInputSchema,
  CodexPostToolUseInputSchema,
  CodexUserPromptSubmitInputSchema,
  CodexStopInputSchema,
]);
export type CodexHookEventInput = z.infer<typeof CodexHookEventInputSchema>;

/**
 * Codex `hooks.json` only documents command handlers; reuse Claude command shape
 * plus `timeoutSec` alias.
 */
export const CodexCommandHookHandlerSchema = CommandHookHandlerSchema.extend({
  timeoutSec: z.number().optional(),
});
export type CodexCommandHookHandler = z.infer<typeof CodexCommandHookHandlerSchema>;

export const CodexMatcherGroupSchema = SharedCommandMatcherGroupSchema.extend({
  hooks: z.array(CodexCommandHookHandlerSchema),
});
export type CodexMatcherGroup = z.infer<typeof CodexMatcherGroupSchema>;

const CodexMatcherGroupListSchema = z.array(CodexMatcherGroupSchema);

/** Subset of hook events Codex loads from `hooks.json`. */
export const CodexHooksConfigSchema = z
  .object({
    SessionStart: CodexMatcherGroupListSchema,
    PreToolUse: CodexMatcherGroupListSchema,
    PostToolUse: CodexMatcherGroupListSchema,
    UserPromptSubmit: CodexMatcherGroupListSchema,
    Stop: CodexMatcherGroupListSchema,
  })
  .partial();
export type CodexHooksConfig = z.infer<typeof CodexHooksConfigSchema>;

/** Top-level shape next to Codex config layers (`~/.codex/hooks.json`, etc.). */
export const CodexHooksFileSchema = z
  .object({
    hooks: CodexHooksConfigSchema,
  })
  .loose();
export type CodexHooksFile = z.infer<typeof CodexHooksFileSchema>;

/** SessionStart / UserPromptSubmit / Stop shared stdout fields (alias of {@link SharedHookStdoutCommonFieldsSchema}). */
export const CodexCommonHookOutputFieldsSchema = SharedHookStdoutCommonFieldsSchema;
export type CodexCommonHookOutputFields = z.infer<typeof CodexCommonHookOutputFieldsSchema>;

/** Legacy PreToolUse block shape accepted by Codex alongside hookSpecificOutput. */
export const CodexPreToolUseLegacyBlockStdoutSchema = z.object({
  decision: z.literal("block"),
  reason: z.string(),
});
export type CodexPreToolUseLegacyBlockStdout = z.infer<typeof CodexPreToolUseLegacyBlockStdoutSchema>;

/**
 * `hookEventName` values allowed inside Codex command `hookSpecificOutput` on strict stdout wires
 * (OpenAI JSON Schema `HookEventNameWire`).
 */
export const CodexHookEventNameWireSchema = z.enum([
  "PreToolUse",
  "PostToolUse",
  "SessionStart",
  "UserPromptSubmit",
  "Stop",
]);
export type CodexHookEventNameWire = z.infer<typeof CodexHookEventNameWireSchema>;

/** `PreToolUsePermissionDecisionWire` on `pre-tool-use.command.output` (no `defer`). */
export const CodexPreToolUsePermissionDecisionWireSchema = z.enum(["allow", "deny", "ask"]);
export type CodexPreToolUsePermissionDecisionWire = z.infer<
  typeof CodexPreToolUsePermissionDecisionWireSchema
>;

/** Top-level `decision` on `pre-tool-use.command.output` (`PreToolUseDecisionWire`). */
export const CodexPreToolUseDecisionWireSchema = z.enum(["approve", "block"]);
export type CodexPreToolUseDecisionWire = z.infer<typeof CodexPreToolUseDecisionWireSchema>;

/**
 * Inner `hookSpecificOutput` for `pre-tool-use.command.output` (`PreToolUseHookSpecificOutputWire`;
 * `additionalProperties: false`).
 */
export const CodexPreToolUseHookSpecificOutputWireSchema = z
  .object({
    hookEventName: CodexHookEventNameWireSchema,
    additionalContext: z.union([z.string(), z.null()]).default(null),
    permissionDecision: z
      .union([CodexPreToolUsePermissionDecisionWireSchema, z.null()])
      .default(null),
    permissionDecisionReason: z.union([z.string(), z.null()]).default(null),
    updatedInput: z.union([JsonObjectSchema, z.null()]).default(null),
  })
  .strict();
export type CodexPreToolUseHookSpecificOutputWire = z.infer<
  typeof CodexPreToolUseHookSpecificOutputWireSchema
>;

/**
 * OpenAI Codex JSON Schema `pre-tool-use.command.output`: strict top-level object
 * (`additionalProperties: false`).
 */
export const CodexPreToolUseCommandOutputWireSchema = createCodexCommandOutputSchema(
  CodexPreToolUseDecisionWireSchema,
  CodexPreToolUseHookSpecificOutputWireSchema,
);
export type CodexPreToolUseCommandOutputWire = z.infer<typeof CodexPreToolUseCommandOutputWireSchema>;

export const CodexPreToolUseStdoutSchema = CodexPreToolUseCommandOutputWireSchema;
export type CodexPreToolUseStdout = z.infer<typeof CodexPreToolUseStdoutSchema>;

/** Alias of {@link CodexPreToolUseHookSpecificOutputWireSchema} for backward compatibility. */
export const CodexPreToolUseHookSpecificStdoutSchema = CodexPreToolUseHookSpecificOutputWireSchema;
export type CodexPreToolUseHookSpecificStdout = CodexPreToolUseHookSpecificOutputWire;

/** OpenAI JSON Schema `BlockDecisionWire` (top-level `decision` on PostToolUse / UserPromptSubmit-style outputs). */
export const CodexBlockDecisionWireSchema = z.literal("block");
export type CodexBlockDecisionWire = z.infer<typeof CodexBlockDecisionWireSchema>;

/**
 * Inner `hookSpecificOutput` for `post-tool-use.command.output` (`PostToolUseHookSpecificOutputWire`;
 * `additionalProperties: false`).
 */
export const CodexPostToolUseHookSpecificOutputWireSchema = z
  .object({
    hookEventName: CodexHookEventNameWireSchema,
    additionalContext: z.union([z.string(), z.null()]).default(null),
    updatedMCPToolOutput: z.union([JsonObjectSchema, z.null()]).default(null),
  })
  .strict();
export type CodexPostToolUseHookSpecificOutputWire = z.infer<
  typeof CodexPostToolUseHookSpecificOutputWireSchema
>;

/**
 * OpenAI Codex JSON Schema `post-tool-use.command.output`: strict top-level object
 * (`additionalProperties: false`).
 */
export const CodexPostToolUseCommandOutputWireSchema = createCodexCommandOutputSchema(
  CodexBlockDecisionWireSchema,
  CodexPostToolUseHookSpecificOutputWireSchema,
);
export type CodexPostToolUseCommandOutputWire = z.infer<
  typeof CodexPostToolUseCommandOutputWireSchema
>;

export const CodexPostToolUseStdoutSchema = CodexPostToolUseCommandOutputWireSchema;
export type CodexPostToolUseStdout = z.infer<typeof CodexPostToolUseStdoutSchema>;

/** Alias of {@link CodexPostToolUseHookSpecificOutputWireSchema} for backward compatibility. */
export const CodexPostToolUseHookSpecificStdoutSchema = CodexPostToolUseHookSpecificOutputWireSchema;
export type CodexPostToolUseHookSpecificStdout = CodexPostToolUseHookSpecificOutputWire;

/**
 * Inner `hookSpecificOutput` for `session-start.command.output` (`SessionStartHookSpecificOutputWire`;
 * `additionalProperties: false`). Same inner shape is used on Stop stdout.
 */
export const CodexSessionStartHookSpecificOutputWireSchema = z
  .object({
    hookEventName: CodexHookEventNameWireSchema,
    additionalContext: z.union([z.string(), z.null()]).default(null),
  })
  .strict();
export type CodexSessionStartHookSpecificOutputWire = z.infer<
  typeof CodexSessionStartHookSpecificOutputWireSchema
>;

/** Alias of {@link CodexSessionStartHookSpecificOutputWireSchema}. */
export const CodexHookSpecificOutputWireSchema = CodexSessionStartHookSpecificOutputWireSchema;
export type CodexHookSpecificOutputWire = CodexSessionStartHookSpecificOutputWire;

/**
 * Inner `hookSpecificOutput` for `user-prompt-submit.command.output` (`UserPromptSubmitHookSpecificOutputWire`;
 * same field set as {@link CodexSessionStartHookSpecificOutputWireSchema}).
 */
export const CodexUserPromptSubmitHookSpecificOutputWireSchema =
  CodexSessionStartHookSpecificOutputWireSchema;
export type CodexUserPromptSubmitHookSpecificOutputWire = CodexSessionStartHookSpecificOutputWire;

/**
 * OpenAI Codex JSON Schema `user-prompt-submit.command.output`: strict top-level object
 * (`additionalProperties: false`).
 */
export const CodexUserPromptSubmitCommandOutputWireSchema = createCodexCommandOutputSchema(
  CodexBlockDecisionWireSchema,
  CodexUserPromptSubmitHookSpecificOutputWireSchema,
);
export type CodexUserPromptSubmitCommandOutputWire = z.infer<
  typeof CodexUserPromptSubmitCommandOutputWireSchema
>;

export const CodexUserPromptSubmitStdoutSchema = CodexUserPromptSubmitCommandOutputWireSchema;
export type CodexUserPromptSubmitStdout = z.infer<typeof CodexUserPromptSubmitStdoutSchema>;

/** Alias of {@link CodexUserPromptSubmitHookSpecificOutputWireSchema} for backward compatibility. */
export const CodexUserPromptSubmitHookSpecificStdoutSchema =
  CodexUserPromptSubmitHookSpecificOutputWireSchema;
export type CodexUserPromptSubmitHookSpecificStdout = CodexUserPromptSubmitHookSpecificOutputWire;

/**
 * OpenAI Codex JSON Schema `session-start.command.output`: strict top-level object
 * (`additionalProperties: false`).
 */
export const CodexSessionStartCommandOutputWireSchema = z
  .object({
    continue: z.boolean().default(true),
    hookSpecificOutput: z
      .union([CodexSessionStartHookSpecificOutputWireSchema, z.null()])
      .default(null),
    stopReason: z.union([z.string(), z.null()]).default(null),
    suppressOutput: z.boolean().default(false),
    systemMessage: z.union([z.string(), z.null()]).default(null),
  })
  .strict();
export type CodexSessionStartCommandOutputWire = z.infer<
  typeof CodexSessionStartCommandOutputWireSchema
>;

export const CodexSessionStartStdoutSchema = CodexSessionStartCommandOutputWireSchema;
export type CodexSessionStartStdout = z.infer<typeof CodexSessionStartStdoutSchema>;

/**
 * OpenAI Codex JSON Schema `stop.command.output`: strict top-level object
 * (`additionalProperties: false`). Stop uses top-level block fields rather than
 * `hookSpecificOutput`.
 */
export const CodexStopCommandOutputWireSchema = z
  .object({
    continue: z.boolean().default(true),
    decision: z.union([CodexBlockDecisionWireSchema, z.null()]).default(null),
    reason: z.union([z.string(), z.null()]).default(null),
    stopReason: z.union([z.string(), z.null()]).default(null),
    suppressOutput: z.boolean().default(false),
    systemMessage: z.union([z.string(), z.null()]).default(null),
  })
  .strict();
export type CodexStopCommandOutputWire = z.infer<typeof CodexStopCommandOutputWireSchema>;

export const CodexStopStdoutSchema = CodexStopCommandOutputWireSchema;
export type CodexStopStdout = z.infer<typeof CodexStopStdoutSchema>;

/** Parse Codex command-hook stdin (five events). */
export function ParseCodexHookInput(json: unknown) {
  return CodexHookEventInputSchema.safeParse(json);
}

// ---------------------------------------------------------------------------
// Config merge + handler resolution -- see codex-hooks-integration.ts
// Re-exported here for backward compatibility.
// ---------------------------------------------------------------------------

export {
  codexMatcherMatches,
  codexResolutionContextFromInput,
  codexToolIfMatches,
  effectiveCodexHandlerTimeoutSec,
  mergeCodexHooksFiles,
  parseCodexHooksFile,
  resolveMatchingCodexHandlers,
  resolveMatchingCodexHandlersFromInput,
  type CodexHookResolutionContext,
} from "./codex-hooks-integration.ts";
