import { z } from "zod";
import {
  CommandHookHandlerSchema,
  JsonObjectSchema,
  NullableStringSchema,
  NullableStringDefaultSchema,
  OptionalBooleanField,
  OptionalNumberField,
  OptionalStringField,
  SharedCommandMatcherGroupSchema,
  SharedHookStdoutCommonFieldsSchema,
  createCodexCommandOutputSchema,
  OptionalToolNameField,
} from "./common.ts";

// ---------------------------------------------------------------------------
// OpenAI Codex hooks (experimental; `.codex/hooks.json` wire format)
// Overlaps Claude Code hooks; differs in events, fields, and output rules.
// ---------------------------------------------------------------------------

export const CodexHookEventNameSchema = z.enum([
  "SessionStart",
  "SubagentStart",
  "PreToolUse",
  "PermissionRequest",
  "PostToolUse",
  "PreCompact",
  "PostCompact",
  "UserPromptSubmit",
  "SubagentStop",
  "Stop",
]);
export type CodexHookEventName = z.infer<typeof CodexHookEventNameSchema>;

/** Codex SessionStart `source` (`session-start.command.input`). Includes `compact` (post-compaction restart). */
export const CodexSessionStartSourceSchema = z.enum(["startup", "resume", "clear", "compact"]);
export type CodexSessionStartSource = z.infer<typeof CodexSessionStartSourceSchema>;

/** Codex PreCompact / PostCompact `trigger` (`manual` or `auto`). */
export const CodexCompactTriggerSchema = z.enum(["manual", "auto"]);
export type CodexCompactTrigger = z.infer<typeof CodexCompactTriggerSchema>;

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
 * Also used for PermissionRequest (same shape).
 */
export const CodexPreToolUseBashToolInputSchema = z
  .object({
    command: z.string().optional(),
    description: z.string().optional(),
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
    turn_id: z.string().optional(),
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
 * `permission_input.description` on Codex hook stdin for PermissionRequest.
 * Human-readable approval reason, when Codex has one.
 */
export const CodexPermissionRequestDescriptionSchema = CodexNullableStringSchema;
export type CodexPermissionRequestDescription = z.infer<typeof CodexPermissionRequestDescriptionSchema>;

/**
 * PermissionRequest `tool_input` (same shape as PreToolUse Bash).
 * Contains the command that requires approval.
 */
export const CodexPermissionRequestBashToolInputSchema = CodexPreToolUseBashToolInputSchema;
export type CodexPermissionRequestBashToolInput = z.infer<typeof CodexPermissionRequestBashToolInputSchema>;

/**
 * Codex PermissionRequest stdin (`permission-request.command.input`): strict object, no extra keys.
 * Runs when Codex is about to ask for approval, such as a shell escalation or managed-network approval.
 * Can allow the request, deny the request, or decline to decide and let the normal approval prompt continue.
 * Does not run for commands that don't need approval.
 */
export const CodexPermissionRequestInputSchema = z
  .object({
    cwd: z.string().optional(),
    hook_event_name: z.literal("PermissionRequest"),
    model: z.string().optional(),
    permission_input: z
      .object({
        description: CodexNullableStringSchema.optional(),
      })
      .optional(),
    permission_mode: CodexHookPermissionModeSchema.optional(),
    session_id: z.string().optional(),
    tool_input: CodexPermissionRequestBashToolInputSchema.optional(),
    tool_name: OptionalToolNameField,
    transcript_path: CodexNullableStringSchema.optional(),
    turn_id: z.string().optional(),
  })
  .loose();
export type CodexPermissionRequestInput = z.infer<typeof CodexPermissionRequestInputSchema>;

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
    stop_hook_active: OptionalBooleanField,
    transcript_path: CodexNullableStringSchema.optional(),
    turn_id: z.string().optional(),
  })
  .loose();
export type CodexStopInput = z.infer<typeof CodexStopInputSchema>;

/**
 * Codex SubagentStart stdin (`subagent-start.command.input`). Runs at subagent-start
 * scope; matcher is `agent_type`. Modeled from the public Codex hooks reference
 * (developers.openai.com/codex/hooks).
 */
export const CodexSubagentStartInputSchema = z
  .object({
    agent_id: z.string().optional(),
    agent_type: z.string().optional(),
    cwd: z.string().optional(),
    hook_event_name: z.literal("SubagentStart"),
    model: z.string().optional(),
    permission_mode: CodexHookPermissionModeSchema.optional(),
    session_id: z.string().optional(),
    transcript_path: CodexNullableStringSchema.optional(),
    turn_id: z.string().optional(),
  })
  .loose();
export type CodexSubagentStartInput = z.infer<typeof CodexSubagentStartInputSchema>;

/**
 * Codex PreCompact stdin (`pre-compact.command.input`). Turn-scoped; matcher is
 * `trigger` (`manual` or `auto`). Modeled from the public Codex hooks reference.
 */
export const CodexPreCompactInputSchema = z
  .object({
    cwd: z.string().optional(),
    hook_event_name: z.literal("PreCompact"),
    model: z.string().optional(),
    permission_mode: CodexHookPermissionModeSchema.optional(),
    session_id: z.string().optional(),
    transcript_path: CodexNullableStringSchema.optional(),
    trigger: CodexCompactTriggerSchema.optional(),
    turn_id: z.string().optional(),
  })
  .loose();
export type CodexPreCompactInput = z.infer<typeof CodexPreCompactInputSchema>;

/**
 * Codex PostCompact stdin (`post-compact.command.input`). Turn-scoped; matcher is
 * `trigger` (`manual` or `auto`). Modeled from the public Codex hooks reference.
 */
export const CodexPostCompactInputSchema = z
  .object({
    cwd: z.string().optional(),
    hook_event_name: z.literal("PostCompact"),
    model: z.string().optional(),
    permission_mode: CodexHookPermissionModeSchema.optional(),
    session_id: z.string().optional(),
    transcript_path: CodexNullableStringSchema.optional(),
    trigger: CodexCompactTriggerSchema.optional(),
    turn_id: z.string().optional(),
  })
  .loose();
export type CodexPostCompactInput = z.infer<typeof CodexPostCompactInputSchema>;

/**
 * Codex SubagentStop stdin (`subagent-stop.command.input`). Turn-scoped; matcher is
 * `agent_type`. Carries the finishing subagent's transcript and last message, plus
 * `stop_hook_active` to guard against re-entrant stop loops. Modeled from the public
 * Codex hooks reference.
 */
export const CodexSubagentStopInputSchema = z
  .object({
    agent_id: z.string().optional(),
    agent_transcript_path: CodexNullableStringSchema.optional(),
    agent_type: z.string().optional(),
    cwd: z.string().optional(),
    hook_event_name: z.literal("SubagentStop"),
    last_assistant_message: CodexNullableStringSchema.optional(),
    model: z.string().optional(),
    permission_mode: CodexHookPermissionModeSchema.optional(),
    session_id: z.string().optional(),
    stop_hook_active: OptionalBooleanField,
    transcript_path: CodexNullableStringSchema.optional(),
    turn_id: z.string().optional(),
  })
  .loose();
export type CodexSubagentStopInput = z.infer<typeof CodexSubagentStopInputSchema>;

/** Discriminated union for Codex command-hook stdin (ten events). */
export const CodexHookEventInputSchema = z.discriminatedUnion("hook_event_name", [
  CodexSessionStartInputSchema,
  CodexSubagentStartInputSchema,
  CodexPreToolUseInputSchema,
  CodexPermissionRequestInputSchema,
  CodexPostToolUseInputSchema,
  CodexPreCompactInputSchema,
  CodexPostCompactInputSchema,
  CodexUserPromptSubmitInputSchema,
  CodexSubagentStopInputSchema,
  CodexStopInputSchema,
]);
export type CodexHookEventInput = z.infer<typeof CodexHookEventInputSchema>;

/**
 * Codex `hooks.json` only documents command handlers; reuse Claude command shape
 * plus `timeoutSec` alias.
 */
export const CodexCommandHookHandlerSchema = CommandHookHandlerSchema.extend({
  timeoutSec: OptionalNumberField,
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
    SubagentStart: CodexMatcherGroupListSchema,
    PreToolUse: CodexMatcherGroupListSchema,
    PermissionRequest: CodexMatcherGroupListSchema,
    PostToolUse: CodexMatcherGroupListSchema,
    PreCompact: CodexMatcherGroupListSchema,
    PostCompact: CodexMatcherGroupListSchema,
    UserPromptSubmit: CodexMatcherGroupListSchema,
    SubagentStop: CodexMatcherGroupListSchema,
    Stop: CodexMatcherGroupListSchema,
  })
  .partial()
  .extend({
    managed_dir: z.string().optional(),
    windows_managed_dir: z.string().optional(),
  });
export type CodexHooksConfig = z.infer<typeof CodexHooksConfigSchema>;

/** Top-level shape next to Codex config layers (`~/.codex/hooks.json`, etc.). */
export const CodexHooksFileSchema = z
  .object({
    description: z.string().optional(),
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
  "PermissionRequest",
  "PostToolUse",
  "SessionStart",
  "UserPromptSubmit",
  "Stop",
]);
export type CodexHookEventNameWire = z.infer<typeof CodexHookEventNameWireSchema>;

/**
 * Codex permission decision values for PreToolUse `hookSpecificOutput`.
 *
 * - `"allow"` — permit the tool call
 * - `"deny"` — block the tool call
 * - `"ask"` — prompt the user for approval
 *
 * **Why 3 values (vs. Claude 4):** Codex omits `defer` because the Codex CLI always
 * runs in an interactive terminal session — there is no headless/background mode where
 * `defer` would be needed. Permission decisions are also separated from blocking
 * decisions: PreToolUse uses this enum, while PostToolUse/UserPromptSubmit use
 * {@link CodexBlockDecisionWireSchema} (`"block"` only).
 *
 * @see PreToolPermissionDecisionSchema — Claude equivalent (adds `defer`)
 * @see GeminiHookStdoutDecisionSchema — Gemini equivalent (replaces `ask` with `block`)
 */
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
    additionalContext: NullableStringDefaultSchema,
    permissionDecision: z
      .union([CodexPreToolUsePermissionDecisionWireSchema, z.null()])
      .default(null),
    permissionDecisionReason: NullableStringDefaultSchema,
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
 * Inner `hookSpecificOutput` for `permission-request.command.output` (`PermissionRequestHookSpecificOutputWire`;
 * `additionalProperties: false`).
 */
export const CodexPermissionRequestHookSpecificOutputWireSchema = z
  .object({
    hookEventName: CodexHookEventNameWireSchema,
    decision: z
      .object({
        behavior: z.enum(["allow", "deny"]),
        message: CodexNullableStringSchema.optional(),
      })
      .strict(),
  })
  .strict();
export type CodexPermissionRequestHookSpecificOutputWire = z.infer<
  typeof CodexPermissionRequestHookSpecificOutputWireSchema
>;

/**
 * OpenAI Codex JSON Schema `permission-request.command.output`: strict top-level object
 * (`additionalProperties: false`).
 */
export const CodexPermissionRequestCommandOutputWireSchema = createCodexCommandOutputSchema(
  z.enum(["block"]).optional(),
  CodexPermissionRequestHookSpecificOutputWireSchema,
);
export type CodexPermissionRequestCommandOutputWire = z.infer<
  typeof CodexPermissionRequestCommandOutputWireSchema
>;

export const CodexPermissionRequestStdoutSchema = CodexPermissionRequestCommandOutputWireSchema;
export type CodexPermissionRequestStdout = z.infer<typeof CodexPermissionRequestStdoutSchema>;

/**
 * Inner `hookSpecificOutput` for `post-tool-use.command.output` (`PostToolUseHookSpecificOutputWire`;
 * `additionalProperties: false`).
 */
export const CodexPostToolUseHookSpecificOutputWireSchema = z
  .object({
    hookEventName: CodexHookEventNameWireSchema,
    additionalContext: NullableStringDefaultSchema,
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
    additionalContext: NullableStringDefaultSchema,
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
    stopReason: NullableStringDefaultSchema,
    suppressOutput: z.boolean().default(false),
    systemMessage: NullableStringDefaultSchema,
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
    reason: NullableStringDefaultSchema,
    stopReason: NullableStringDefaultSchema,
    suppressOutput: z.boolean().default(false),
    systemMessage: NullableStringDefaultSchema,
  })
  .strict();
export type CodexStopCommandOutputWire = z.infer<typeof CodexStopCommandOutputWireSchema>;

export const CodexStopStdoutSchema = CodexStopCommandOutputWireSchema;
export type CodexStopStdout = z.infer<typeof CodexStopStdoutSchema>;

// ---------------------------------------------------------------------------
// Reference-derived stdout for events new in the public Codex hooks reference
// (SubagentStart, PreCompact, PostCompact, SubagentStop). These follow the
// documented release behavior (developers.openai.com/codex/hooks) rather than a
// generated `additionalProperties: false` wire schema, so they stay `.loose()`
// pending transcript-capture verification.
// ---------------------------------------------------------------------------

/** `subagent-start.command.output`: plain text or `hookSpecificOutput.additionalContext` injects developer context. */
export const CodexSubagentStartStdoutSchema = SharedHookStdoutCommonFieldsSchema.extend({
  hookSpecificOutput: z
    .object({
      hookEventName: z.literal("SubagentStart"),
      additionalContext: OptionalStringField,
    })
    .loose()
    .optional(),
}).loose();
export type CodexSubagentStartStdout = z.infer<typeof CodexSubagentStartStdoutSchema>;

/** `pre-compact.command.output`: common output fields (`continue` / `stopReason` / `systemMessage` / `suppressOutput`). */
export const CodexPreCompactStdoutSchema = SharedHookStdoutCommonFieldsSchema.loose();
export type CodexPreCompactStdout = z.infer<typeof CodexPreCompactStdoutSchema>;

/** `post-compact.command.output`: informational; common output fields only. */
export const CodexPostCompactStdoutSchema = SharedHookStdoutCommonFieldsSchema.loose();
export type CodexPostCompactStdout = z.infer<typeof CodexPostCompactStdoutSchema>;

/** `subagent-stop.command.output`: top-level `decision: "block"` + `reason` keeps the subagent running. */
export const CodexSubagentStopStdoutSchema = SharedHookStdoutCommonFieldsSchema.extend({
  decision: z.union([CodexBlockDecisionWireSchema, z.null()]).optional(),
  reason: OptionalStringField,
}).loose();
export type CodexSubagentStopStdout = z.infer<typeof CodexSubagentStopStdoutSchema>;

/** Parse Codex command-hook stdin (ten events). */
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
