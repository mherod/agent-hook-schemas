import { z } from "zod";
import {
  JsonObjectSchema,
  OptionalBooleanField,
  OptionalNumberField,
  OptionalStringField,
} from "./common.ts";

// ---------------------------------------------------------------------------
// GitHub Copilot hooks — CLI + cloud agent config, stdin, and stdout.
// ---------------------------------------------------------------------------

export const CopilotCamelHookEventNames = [
  "agentStop",
  "errorOccurred",
  "notification",
  "permissionRequest",
  "postToolUse",
  "postToolUseFailure",
  "preCompact",
  "preToolUse",
  "sessionEnd",
  "sessionStart",
  "subagentStart",
  "subagentStop",
  "userPromptSubmitted",
] as const;

export const CopilotCamelHookEventNameSchema = z.enum(CopilotCamelHookEventNames);
export type CopilotCamelHookEventName = z.infer<typeof CopilotCamelHookEventNameSchema>;

export const CopilotVSCodeHookEventNames = [
  "ErrorOccurred",
  "Notification",
  "PermissionRequest",
  "PostToolUse",
  "PostToolUseFailure",
  "PreCompact",
  "PreToolUse",
  "SessionEnd",
  "SessionStart",
  "Stop",
  "SubagentStart",
  "SubagentStop",
  "UserPromptSubmit",
] as const;

export const CopilotVSCodeHookEventNameSchema = z.enum(CopilotVSCodeHookEventNames);
export type CopilotVSCodeHookEventName = z.infer<typeof CopilotVSCodeHookEventNameSchema>;

/** Hook event names accepted in Copilot hook configuration files. */
export const CopilotHookEventNames = [
  ...CopilotCamelHookEventNames,
  ...CopilotVSCodeHookEventNames,
] as const;

export const CopilotHookEventNameSchema = z.enum(CopilotHookEventNames);
export type CopilotHookEventName = z.infer<typeof CopilotHookEventNameSchema>;

export const CopilotSessionStartSourceSchema = z.enum(["startup", "resume", "new"]);
export type CopilotSessionStartSource = z.infer<typeof CopilotSessionStartSourceSchema>;

export const CopilotSessionEndReasonSchema = z.enum([
  "complete",
  "error",
  "abort",
  "timeout",
  "user_exit",
]);
export type CopilotSessionEndReason = z.infer<typeof CopilotSessionEndReasonSchema>;

export const CopilotCompactTriggerSchema = z.enum(["manual", "auto"]);
export type CopilotCompactTrigger = z.infer<typeof CopilotCompactTriggerSchema>;

export const CopilotErrorContextSchema = z.enum([
  "model_call",
  "tool_execution",
  "system",
  "user_input",
]);
export type CopilotErrorContext = z.infer<typeof CopilotErrorContextSchema>;

export const CopilotNotificationTypeSchema = z.enum([
  "shell_completed",
  "shell_detached_completed",
  "agent_completed",
  "agent_idle",
  "permission_prompt",
  "elicitation_dialog",
]);
export type CopilotNotificationType = z.infer<typeof CopilotNotificationTypeSchema>;

const CopilotSessionStartSourceInputSchema = CopilotSessionStartSourceSchema.or(z.string());
const CopilotSessionEndReasonInputSchema = CopilotSessionEndReasonSchema.or(z.string());
const CopilotCompactTriggerInputSchema = CopilotCompactTriggerSchema.or(z.string());
const CopilotErrorContextInputSchema = CopilotErrorContextSchema.or(z.string());
const CopilotNotificationTypeInputSchema = CopilotNotificationTypeSchema.or(z.string());
const CopilotStopReasonInputSchema = z.literal("end_turn").or(z.string());

// ---------------------------------------------------------------------------
// Hook configuration
// ---------------------------------------------------------------------------

const CopilotMatcherEvents = new Set<string>([
  "Notification",
  "PermissionRequest",
  "PreCompact",
  "PreToolUse",
  "SubagentStart",
  "notification",
  "permissionRequest",
  "preCompact",
  "preToolUse",
  "subagentStart",
]);

const CopilotPromptEvents = new Set<string>(["SessionStart", "sessionStart"]);
const CopilotPermissionSensitiveHttpEvents = new Set<string>([
  "PermissionRequest",
  "PreToolUse",
  "permissionRequest",
  "preToolUse",
]);

export const CopilotHookHandlerCommonSchema = z.object({
  matcher: OptionalStringField,
  timeoutSec: OptionalNumberField,
});
export type CopilotHookHandlerCommon = z.infer<typeof CopilotHookHandlerCommonSchema>;

/**
 * Command hook entry. Copilot accepts `bash`, `powershell`, or cross-platform
 * `command`; at least one must be present.
 */
export const CopilotCommandHookHandlerSchema = CopilotHookHandlerCommonSchema.extend({
  type: z.literal("command"),
  bash: OptionalStringField,
  command: OptionalStringField,
  cwd: OptionalStringField,
  env: z.record(z.string(), z.string()).optional(),
  powershell: OptionalStringField,
}).superRefine((data, ctx) => {
  if (!data.bash && !data.powershell && !data.command) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "one of bash, powershell, or command is required",
      path: ["command"],
    });
  }
});
export type CopilotCommandHookHandler = z.infer<typeof CopilotCommandHookHandlerSchema>;

const CopilotHttpUrlSchema = z.string().url().refine(
  (url) => {
    const protocol = new URL(url).protocol;
    return protocol === "http:" || protocol === "https:";
  },
  { message: "url must use http: or https:" },
);

export const CopilotHttpHookHandlerSchema = CopilotHookHandlerCommonSchema.extend({
  type: z.literal("http"),
  allowedEnvVars: z.array(z.string()).optional(),
  headers: z.record(z.string(), z.string()).optional(),
  url: CopilotHttpUrlSchema,
}).superRefine((data, ctx) => {
  if (data.allowedEnvVars !== undefined && !data.url.startsWith("https://")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "url must use https:// when allowedEnvVars is set",
      path: ["url"],
    });
  }
});
export type CopilotHttpHookHandler = z.infer<typeof CopilotHttpHookHandlerSchema>;

/** Prompt hook entry; Copilot only supports this on `sessionStart`. */
export const CopilotPromptHookHandlerSchema = CopilotHookHandlerCommonSchema.extend({
  type: z.literal("prompt"),
  prompt: z.string(),
});
export type CopilotPromptHookHandler = z.infer<typeof CopilotPromptHookHandlerSchema>;

export const CopilotHookHandlerSchema = z.union([
  CopilotCommandHookHandlerSchema,
  CopilotHttpHookHandlerSchema,
  CopilotPromptHookHandlerSchema,
]);
export type CopilotHookHandler = z.infer<typeof CopilotHookHandlerSchema>;

const CopilotHookHandlerListSchema = z.array(CopilotHookHandlerSchema);

export const CopilotHooksConfigSchema = z
  .object({
    ErrorOccurred: CopilotHookHandlerListSchema,
    Notification: CopilotHookHandlerListSchema,
    PermissionRequest: CopilotHookHandlerListSchema,
    PostToolUse: CopilotHookHandlerListSchema,
    PostToolUseFailure: CopilotHookHandlerListSchema,
    PreCompact: CopilotHookHandlerListSchema,
    PreToolUse: CopilotHookHandlerListSchema,
    SessionEnd: CopilotHookHandlerListSchema,
    SessionStart: CopilotHookHandlerListSchema,
    Stop: CopilotHookHandlerListSchema,
    SubagentStart: CopilotHookHandlerListSchema,
    SubagentStop: CopilotHookHandlerListSchema,
    UserPromptSubmit: CopilotHookHandlerListSchema,
    agentStop: CopilotHookHandlerListSchema,
    errorOccurred: CopilotHookHandlerListSchema,
    notification: CopilotHookHandlerListSchema,
    permissionRequest: CopilotHookHandlerListSchema,
    postToolUse: CopilotHookHandlerListSchema,
    postToolUseFailure: CopilotHookHandlerListSchema,
    preCompact: CopilotHookHandlerListSchema,
    preToolUse: CopilotHookHandlerListSchema,
    sessionEnd: CopilotHookHandlerListSchema,
    sessionStart: CopilotHookHandlerListSchema,
    subagentStart: CopilotHookHandlerListSchema,
    subagentStop: CopilotHookHandlerListSchema,
    userPromptSubmitted: CopilotHookHandlerListSchema,
  })
  .partial()
  .superRefine((config, ctx) => {
    for (const [event, handlers] of Object.entries(config)) {
      if (!handlers) continue;
      for (let i = 0; i < handlers.length; i++) {
        const handler = handlers[i]!;
        if (handler.type === "prompt" && !CopilotPromptEvents.has(event)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "prompt hooks are only supported on sessionStart",
            path: [event, i, "type"],
          });
        }
        if (
          handler.type === "http" &&
          CopilotPermissionSensitiveHttpEvents.has(event) &&
          !handler.url.startsWith("https://")
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "http hooks on preToolUse and permissionRequest must use https://",
            path: [event, i, "url"],
          });
        }
        if (handler.matcher !== undefined && !CopilotMatcherEvents.has(event)) {
          // Copilot ignores matcher outside the documented matcher events; this
          // schema keeps the field for round-tripping instead of rejecting it.
          continue;
        }
      }
    }
  });
export type CopilotHooksConfig = z.infer<typeof CopilotHooksConfigSchema>;

/** `.github/hooks/*.json`, `~/.copilot/hooks/*.json`, or plugin hooks file. */
export const CopilotHooksFileSchema = z
  .object({
    version: z.literal(1),
    disableAllHooks: OptionalBooleanField,
    hooks: CopilotHooksConfigSchema,
  })
  .loose();
export type CopilotHooksFile = z.infer<typeof CopilotHooksFileSchema>;

/** Inline `hooks` block in Copilot repository/user settings. */
export const CopilotSettingsHooksFragmentSchema = z
  .object({
    disableAllHooks: OptionalBooleanField,
    hooks: CopilotHooksConfigSchema.optional(),
  })
  .loose();
export type CopilotSettingsHooksFragment = z.infer<
  typeof CopilotSettingsHooksFragmentSchema
>;

export const CopilotSettingsSchema = CopilotSettingsHooksFragmentSchema;
export type CopilotSettings = CopilotSettingsHooksFragment;

// ---------------------------------------------------------------------------
// Hook stdin: camelCase format
// ---------------------------------------------------------------------------

export const CopilotCamelHookInputBaseSchema = z
  .object({
    sessionId: z.string(),
    timestamp: z.number(),
    cwd: z.string(),
  })
  .loose();
export type CopilotCamelHookInputBase = z.infer<typeof CopilotCamelHookInputBaseSchema>;

export const CopilotCamelSessionStartInputSchema = CopilotCamelHookInputBaseSchema.extend({
  source: CopilotSessionStartSourceInputSchema,
  initialPrompt: OptionalStringField,
}).loose();
export type CopilotCamelSessionStartInput = z.infer<
  typeof CopilotCamelSessionStartInputSchema
>;

export const CopilotCamelSessionEndInputSchema = CopilotCamelHookInputBaseSchema.extend({
  reason: CopilotSessionEndReasonInputSchema,
}).loose();
export type CopilotCamelSessionEndInput = z.infer<typeof CopilotCamelSessionEndInputSchema>;

export const CopilotCamelUserPromptSubmittedInputSchema =
  CopilotCamelHookInputBaseSchema.extend({
    prompt: z.string(),
  }).loose();
export type CopilotCamelUserPromptSubmittedInput = z.infer<
  typeof CopilotCamelUserPromptSubmittedInputSchema
>;

export const CopilotCamelPreToolUseInputSchema = CopilotCamelHookInputBaseSchema.extend({
  toolName: z.string(),
  toolArgs: z.unknown().optional(),
}).loose();
export type CopilotCamelPreToolUseInput = z.infer<typeof CopilotCamelPreToolUseInputSchema>;

/** PermissionRequest input is not separately documented; it follows tool-call matcher fields. */
export const CopilotCamelPermissionRequestInputSchema = CopilotCamelPreToolUseInputSchema;
export type CopilotCamelPermissionRequestInput = CopilotCamelPreToolUseInput;

export const CopilotCamelToolResultSuccessSchema = z
  .object({
    resultType: z.literal("success"),
    textResultForLlm: z.string(),
  })
  .loose();
export type CopilotCamelToolResultSuccess = z.infer<
  typeof CopilotCamelToolResultSuccessSchema
>;

export const CopilotCamelPostToolUseInputSchema = CopilotCamelHookInputBaseSchema.extend({
  toolName: z.string(),
  toolArgs: z.unknown().optional(),
  toolResult: CopilotCamelToolResultSuccessSchema,
}).loose();
export type CopilotCamelPostToolUseInput = z.infer<typeof CopilotCamelPostToolUseInputSchema>;

export const CopilotCamelPostToolUseFailureInputSchema =
  CopilotCamelHookInputBaseSchema.extend({
    toolName: z.string(),
    toolArgs: z.unknown().optional(),
    error: z.string(),
  }).loose();
export type CopilotCamelPostToolUseFailureInput = z.infer<
  typeof CopilotCamelPostToolUseFailureInputSchema
>;

export const CopilotCamelAgentStopInputSchema = CopilotCamelHookInputBaseSchema.extend({
  transcriptPath: z.string(),
  stopReason: CopilotStopReasonInputSchema,
}).loose();
export type CopilotCamelAgentStopInput = z.infer<typeof CopilotCamelAgentStopInputSchema>;

export const CopilotCamelSubagentStartInputSchema = CopilotCamelHookInputBaseSchema.extend({
  transcriptPath: z.string(),
  agentName: z.string(),
  agentDisplayName: OptionalStringField,
  agentDescription: OptionalStringField,
}).loose();
export type CopilotCamelSubagentStartInput = z.infer<
  typeof CopilotCamelSubagentStartInputSchema
>;

export const CopilotCamelSubagentStopInputSchema = CopilotCamelHookInputBaseSchema.extend({
  transcriptPath: z.string(),
  agentName: z.string(),
  agentDisplayName: OptionalStringField,
  stopReason: CopilotStopReasonInputSchema,
}).loose();
export type CopilotCamelSubagentStopInput = z.infer<
  typeof CopilotCamelSubagentStopInputSchema
>;

export const CopilotErrorObjectSchema = z
  .object({
    message: z.string(),
    name: z.string(),
    stack: OptionalStringField,
  })
  .loose();
export type CopilotErrorObject = z.infer<typeof CopilotErrorObjectSchema>;

export const CopilotCamelErrorOccurredInputSchema = CopilotCamelHookInputBaseSchema.extend({
  error: CopilotErrorObjectSchema,
  errorContext: CopilotErrorContextInputSchema,
  recoverable: z.boolean(),
}).loose();
export type CopilotCamelErrorOccurredInput = z.infer<
  typeof CopilotCamelErrorOccurredInputSchema
>;

export const CopilotCamelPreCompactInputSchema = CopilotCamelHookInputBaseSchema.extend({
  transcriptPath: z.string(),
  trigger: CopilotCompactTriggerInputSchema,
  customInstructions: z.string(),
}).loose();
export type CopilotCamelPreCompactInput = z.infer<typeof CopilotCamelPreCompactInputSchema>;

export const CopilotCamelHookEventInputSchema = z.union([
  CopilotCamelSessionStartInputSchema,
  CopilotCamelSessionEndInputSchema,
  CopilotCamelUserPromptSubmittedInputSchema,
  CopilotCamelPostToolUseInputSchema,
  CopilotCamelPostToolUseFailureInputSchema,
  CopilotCamelAgentStopInputSchema,
  CopilotCamelSubagentStartInputSchema,
  CopilotCamelSubagentStopInputSchema,
  CopilotCamelErrorOccurredInputSchema,
  CopilotCamelPreCompactInputSchema,
  CopilotCamelPreToolUseInputSchema,
]);
export type CopilotCamelHookEventInput = z.infer<typeof CopilotCamelHookEventInputSchema>;

// ---------------------------------------------------------------------------
// Hook stdin: VS Code compatible format (`hook_event_name` + snake_case)
// ---------------------------------------------------------------------------

export const CopilotVSCodeHookInputBaseSchema = z
  .object({
    session_id: OptionalStringField,
    timestamp: OptionalStringField,
    cwd: OptionalStringField,
  })
  .loose();
export type CopilotVSCodeHookInputBase = z.infer<typeof CopilotVSCodeHookInputBaseSchema>;

export const CopilotVSCodeSessionStartInputSchema = CopilotVSCodeHookInputBaseSchema.extend({
  hook_event_name: z.literal("SessionStart"),
  source: CopilotSessionStartSourceInputSchema.optional(),
  initial_prompt: OptionalStringField,
}).loose();
export type CopilotVSCodeSessionStartInput = z.infer<
  typeof CopilotVSCodeSessionStartInputSchema
>;

export const CopilotVSCodeSessionEndInputSchema = CopilotVSCodeHookInputBaseSchema.extend({
  hook_event_name: z.literal("SessionEnd"),
  reason: CopilotSessionEndReasonInputSchema.optional(),
}).loose();
export type CopilotVSCodeSessionEndInput = z.infer<typeof CopilotVSCodeSessionEndInputSchema>;

export const CopilotVSCodeUserPromptSubmitInputSchema =
  CopilotVSCodeHookInputBaseSchema.extend({
    hook_event_name: z.literal("UserPromptSubmit"),
    prompt: OptionalStringField,
  }).loose();
export type CopilotVSCodeUserPromptSubmitInput = z.infer<
  typeof CopilotVSCodeUserPromptSubmitInputSchema
>;

export const CopilotVSCodePreToolUseInputSchema = CopilotVSCodeHookInputBaseSchema.extend({
  hook_event_name: z.literal("PreToolUse"),
  tool_name: OptionalStringField,
  tool_input: z.unknown().optional(),
}).loose();
export type CopilotVSCodePreToolUseInput = z.infer<
  typeof CopilotVSCodePreToolUseInputSchema
>;

export const CopilotVSCodePermissionRequestInputSchema =
  CopilotVSCodeHookInputBaseSchema.extend({
    hook_event_name: z.literal("PermissionRequest"),
    tool_name: OptionalStringField,
    tool_input: z.unknown().optional(),
  }).loose();
export type CopilotVSCodePermissionRequestInput = z.infer<
  typeof CopilotVSCodePermissionRequestInputSchema
>;

export const CopilotVSCodeToolResultSuccessSchema = z
  .object({
    result_type: z.literal("success"),
    text_result_for_llm: z.string(),
  })
  .loose();
export type CopilotVSCodeToolResultSuccess = z.infer<
  typeof CopilotVSCodeToolResultSuccessSchema
>;

export const CopilotVSCodePostToolUseInputSchema = CopilotVSCodeHookInputBaseSchema.extend({
  hook_event_name: z.literal("PostToolUse"),
  tool_name: OptionalStringField,
  tool_input: z.unknown().optional(),
  tool_result: CopilotVSCodeToolResultSuccessSchema.optional(),
}).loose();
export type CopilotVSCodePostToolUseInput = z.infer<
  typeof CopilotVSCodePostToolUseInputSchema
>;

export const CopilotVSCodePostToolUseFailureInputSchema =
  CopilotVSCodeHookInputBaseSchema.extend({
    hook_event_name: z.literal("PostToolUseFailure"),
    tool_name: OptionalStringField,
    tool_input: z.unknown().optional(),
    error: OptionalStringField,
  }).loose();
export type CopilotVSCodePostToolUseFailureInput = z.infer<
  typeof CopilotVSCodePostToolUseFailureInputSchema
>;

export const CopilotVSCodeStopInputSchema = CopilotVSCodeHookInputBaseSchema.extend({
  hook_event_name: z.literal("Stop"),
  transcript_path: OptionalStringField,
  stop_reason: CopilotStopReasonInputSchema.optional(),
}).loose();
export type CopilotVSCodeStopInput = z.infer<typeof CopilotVSCodeStopInputSchema>;

export const CopilotVSCodeSubagentStartInputSchema = CopilotVSCodeHookInputBaseSchema.extend({
  hook_event_name: z.literal("SubagentStart"),
  transcript_path: OptionalStringField,
  agent_name: OptionalStringField,
  agent_display_name: OptionalStringField,
  agent_description: OptionalStringField,
}).loose();
export type CopilotVSCodeSubagentStartInput = z.infer<
  typeof CopilotVSCodeSubagentStartInputSchema
>;

export const CopilotVSCodeSubagentStopInputSchema = CopilotVSCodeHookInputBaseSchema.extend({
  hook_event_name: z.literal("SubagentStop"),
  transcript_path: OptionalStringField,
  agent_name: OptionalStringField,
  agent_display_name: OptionalStringField,
  stop_reason: CopilotStopReasonInputSchema.optional(),
}).loose();
export type CopilotVSCodeSubagentStopInput = z.infer<
  typeof CopilotVSCodeSubagentStopInputSchema
>;

export const CopilotVSCodeErrorOccurredInputSchema = CopilotVSCodeHookInputBaseSchema.extend({
  hook_event_name: z.literal("ErrorOccurred"),
  error: CopilotErrorObjectSchema.optional(),
  error_context: CopilotErrorContextInputSchema.optional(),
  recoverable: OptionalBooleanField,
}).loose();
export type CopilotVSCodeErrorOccurredInput = z.infer<
  typeof CopilotVSCodeErrorOccurredInputSchema
>;

export const CopilotVSCodePreCompactInputSchema = CopilotVSCodeHookInputBaseSchema.extend({
  hook_event_name: z.literal("PreCompact"),
  transcript_path: OptionalStringField,
  trigger: CopilotCompactTriggerInputSchema.optional(),
  custom_instructions: OptionalStringField,
}).loose();
export type CopilotVSCodePreCompactInput = z.infer<
  typeof CopilotVSCodePreCompactInputSchema
>;

/**
 * Notification input is documented as camelCase base fields plus
 * `hook_event_name` and `notification_type`.
 */
export const CopilotNotificationInputSchema = z
  .object({
    sessionId: OptionalStringField,
    timestamp: OptionalNumberField,
    cwd: OptionalStringField,
    hook_event_name: z.literal("Notification"),
    message: OptionalStringField,
    title: OptionalStringField,
    notification_type: CopilotNotificationTypeInputSchema.optional(),
  })
  .loose();
export type CopilotNotificationInput = z.infer<typeof CopilotNotificationInputSchema>;

export const CopilotVSCodeHookEventInputSchema = z.discriminatedUnion("hook_event_name", [
  CopilotVSCodeErrorOccurredInputSchema,
  CopilotNotificationInputSchema,
  CopilotVSCodePermissionRequestInputSchema,
  CopilotVSCodePostToolUseInputSchema,
  CopilotVSCodePostToolUseFailureInputSchema,
  CopilotVSCodePreCompactInputSchema,
  CopilotVSCodePreToolUseInputSchema,
  CopilotVSCodeSessionEndInputSchema,
  CopilotVSCodeSessionStartInputSchema,
  CopilotVSCodeStopInputSchema,
  CopilotVSCodeSubagentStartInputSchema,
  CopilotVSCodeSubagentStopInputSchema,
  CopilotVSCodeUserPromptSubmitInputSchema,
]);
export type CopilotVSCodeHookEventInput = z.infer<typeof CopilotVSCodeHookEventInputSchema>;

export const CopilotHookEventInputSchema = z.union([
  CopilotVSCodeHookEventInputSchema,
  CopilotCamelHookEventInputSchema,
]);
export type CopilotHookEventInput = z.infer<typeof CopilotHookEventInputSchema>;

// ---------------------------------------------------------------------------
// Hook stdout
// ---------------------------------------------------------------------------

export const CopilotPreToolUsePermissionDecisionSchema = z.enum([
  "allow",
  "deny",
  "ask",
]);
export type CopilotPreToolUsePermissionDecision = z.infer<
  typeof CopilotPreToolUsePermissionDecisionSchema
>;

export const CopilotPreToolUseStdoutSchema = z
  .object({
    permissionDecision: CopilotPreToolUsePermissionDecisionSchema.optional(),
    permissionDecisionReason: OptionalStringField,
    modifiedArgs: JsonObjectSchema.optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.permissionDecision === "deny" && !data.permissionDecisionReason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'permissionDecisionReason is required when permissionDecision is "deny"',
        path: ["permissionDecisionReason"],
      });
    }
  });
export type CopilotPreToolUseStdout = z.infer<typeof CopilotPreToolUseStdoutSchema>;

export const CopilotStopDecisionSchema = z.enum(["block", "allow"]);
export type CopilotStopDecision = z.infer<typeof CopilotStopDecisionSchema>;

const CopilotStopLikeStdoutSchema = z
  .object({
    decision: CopilotStopDecisionSchema.optional(),
    reason: OptionalStringField,
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.decision === "block" && !data.reason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'reason is required when decision is "block"',
        path: ["reason"],
      });
    }
  });

export const CopilotAgentStopStdoutSchema = CopilotStopLikeStdoutSchema;
export type CopilotAgentStopStdout = z.infer<typeof CopilotAgentStopStdoutSchema>;

export const CopilotSubagentStopStdoutSchema = CopilotStopLikeStdoutSchema;
export type CopilotSubagentStopStdout = z.infer<typeof CopilotSubagentStopStdoutSchema>;

export const CopilotPermissionRequestBehaviorSchema = z.enum(["allow", "deny"]);
export type CopilotPermissionRequestBehavior = z.infer<
  typeof CopilotPermissionRequestBehaviorSchema
>;

export const CopilotPermissionRequestStdoutSchema = z
  .object({
    behavior: CopilotPermissionRequestBehaviorSchema.optional(),
    message: OptionalStringField,
    interrupt: OptionalBooleanField,
  })
  .strict();
export type CopilotPermissionRequestStdout = z.infer<
  typeof CopilotPermissionRequestStdoutSchema
>;

export const CopilotAdditionalContextStdoutSchema = z
  .object({
    additionalContext: OptionalStringField,
  })
  .strict();
export type CopilotAdditionalContextStdout = z.infer<
  typeof CopilotAdditionalContextStdoutSchema
>;

export const CopilotSessionStartStdoutSchema = CopilotAdditionalContextStdoutSchema;
export type CopilotSessionStartStdout = CopilotAdditionalContextStdout;

export const CopilotNotificationStdoutSchema = CopilotAdditionalContextStdoutSchema;
export type CopilotNotificationStdout = CopilotAdditionalContextStdout;

export const CopilotPostToolUseFailureStdoutSchema = CopilotAdditionalContextStdoutSchema;
export type CopilotPostToolUseFailureStdout = CopilotAdditionalContextStdout;

export const CopilotSubagentStartStdoutSchema = CopilotAdditionalContextStdoutSchema;
export type CopilotSubagentStartStdout = CopilotAdditionalContextStdout;

export const CopilotHookOutputSchema = z.union([
  CopilotPreToolUseStdoutSchema,
  CopilotAgentStopStdoutSchema,
  CopilotPermissionRequestStdoutSchema,
  CopilotAdditionalContextStdoutSchema,
]);
export type CopilotHookOutput = z.infer<typeof CopilotHookOutputSchema>;

/** Parse Copilot hook stdin JSON in either camelCase or VS Code compatible format. */
export function ParseCopilotHookInput(json: unknown) {
  return CopilotHookEventInputSchema.safeParse(json);
}

/** Parse Copilot hook stdout JSON. Use event-specific schemas for stricter intent checks. */
export function ParseCopilotHookOutput(json: unknown) {
  return CopilotHookOutputSchema.safeParse(json);
}

// ---------------------------------------------------------------------------
// Config merge + handler resolution -- see copilot-hooks-integration.ts
// Re-exported here for convenience.
// ---------------------------------------------------------------------------

export {
  copilotEventNameFromInput,
  copilotMatcherMatches,
  copilotResolutionSubjectFromInput,
  effectiveCopilotHandlerTimeoutSec,
  mergeCopilotHooksFiles,
  parseCopilotHooksFile,
  resolveMatchingCopilotHandlers,
  resolveMatchingCopilotHandlersFromInput,
} from "./copilot-hooks-integration.ts";
