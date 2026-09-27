import { z } from "zod";
import {
  JsonObjectSchema,
  OptionalBooleanField,
  OptionalNumberField,
  OptionalStringField,
} from "./common.ts";

// ---------------------------------------------------------------------------
// Google Antigravity Built-in Tool Names
// ---------------------------------------------------------------------------

/**
 * Built-in tool names native to the Google Antigravity platform.
 * Excludes MCP server tools accessed via `call_mcp_tool`, `list_resources`, or `read_resource`.
 */
export const AntigravityBuiltinToolNameSchema = z.enum([
  "run_command",
  "view_file",
  "replace_file_content",
  "write_to_file",
  "manage_task",
  "schedule",
  "send_message",
  "invoke_subagent",
  "define_subagent",
  "manage_subagents",
  "read_url_content",
  "search_web",
  "generate_image",
  "ask_question",
]);
export type AntigravityBuiltinToolName = z.infer<typeof AntigravityBuiltinToolNameSchema>;

/** Generic Antigravity tool name accepting built-in tools or custom/MCP strings. */
export const AntigravityToolNameSchema = AntigravityBuiltinToolNameSchema.or(z.string());
export type AntigravityToolName = z.infer<typeof AntigravityToolNameSchema>;

// ---------------------------------------------------------------------------
// Shared Metadata Fields
// ---------------------------------------------------------------------------

/**
 * Common tool invocation metadata included on Antigravity tool calls.
 * - `toolAction`: Brief 2-5 word phrase in -ing form describing the specific action.
 * - `toolSummary`: Brief 2-5 word noun phrase describing the specific task.
 */
export const AntigravityToolMetaSchema = z
  .object({
    toolAction: OptionalStringField,
    toolSummary: OptionalStringField,
  })
  .loose();
export type AntigravityToolMeta = z.infer<typeof AntigravityToolMetaSchema>;

// ---------------------------------------------------------------------------
// 1. run_command
// ---------------------------------------------------------------------------

/** Arguments for `run_command` tool execution. */
export const AntigravityRunCommandToolInputSchema = z
  .object({
    CommandLine: z.string(),
    Cwd: z.string(),
    WaitMsBeforeAsync: OptionalNumberField,
    RunPersistent: OptionalBooleanField,
    RequestedTerminalID: OptionalStringField,
    IsDaemon: OptionalBooleanField,
    toolAction: OptionalStringField,
    toolSummary: OptionalStringField,
  })
  .loose();
export type AntigravityRunCommandToolInput = z.infer<
  typeof AntigravityRunCommandToolInputSchema
>;
export const AntigravityRunCommandArgsSchema = AntigravityRunCommandToolInputSchema;
export type AntigravityRunCommandArgs = AntigravityRunCommandToolInput;

/** Response from `run_command` execution or background task dispatch. */
export const AntigravityRunCommandToolResponseSchema = z
  .object({
    stdout: OptionalStringField,
    stderr: OptionalStringField,
    exitCode: OptionalNumberField,
    output: OptionalStringField,
    taskId: OptionalStringField,
  })
  .loose();
export type AntigravityRunCommandToolResponse = z.infer<
  typeof AntigravityRunCommandToolResponseSchema
>;

// ---------------------------------------------------------------------------
// 2. view_file
// ---------------------------------------------------------------------------

/** Arguments for `view_file` tool execution. */
export const AntigravityViewFileToolInputSchema = z
  .object({
    AbsolutePath: z.string(),
    StartLine: OptionalNumberField,
    EndLine: OptionalNumberField,
    ContentOffset: OptionalNumberField,
    toolAction: OptionalStringField,
    toolSummary: OptionalStringField,
  })
  .loose();
export type AntigravityViewFileToolInput = z.infer<
  typeof AntigravityViewFileToolInputSchema
>;
export const AntigravityViewFileArgsSchema = AntigravityViewFileToolInputSchema;
export type AntigravityViewFileArgs = AntigravityViewFileToolInput;

/** Response from `view_file`. */
export const AntigravityViewFileToolResponseSchema = z
  .object({
    content: OptionalStringField,
    totalLines: OptionalNumberField,
    totalBytes: OptionalNumberField,
    truncated: OptionalBooleanField,
    startLine: OptionalNumberField,
    endLine: OptionalNumberField,
  })
  .loose();
export type AntigravityViewFileToolResponse = z.infer<
  typeof AntigravityViewFileToolResponseSchema
>;

// ---------------------------------------------------------------------------
// 3. replace_file_content
// ---------------------------------------------------------------------------

/** Arguments for `replace_file_content` tool execution. */
export const AntigravityReplaceFileContentToolInputSchema = z
  .object({
    TargetFile: z.string(),
    Instruction: z.string(),
    Description: z.string(),
    AllowMultiple: z.boolean(),
    TargetContent: z.string(),
    ReplacementContent: z.string(),
    StartLine: z.number().int(),
    EndLine: z.number().int(),
    TargetLintErrorIds: z.array(z.string()).optional(),
    toolAction: OptionalStringField,
    toolSummary: OptionalStringField,
  })
  .loose();
export type AntigravityReplaceFileContentToolInput = z.infer<
  typeof AntigravityReplaceFileContentToolInputSchema
>;
export const AntigravityReplaceFileContentArgsSchema =
  AntigravityReplaceFileContentToolInputSchema;
export type AntigravityReplaceFileContentArgs =
  AntigravityReplaceFileContentToolInput;

/** Response from `replace_file_content`. */
export const AntigravityReplaceFileContentToolResponseSchema = z
  .object({
    success: OptionalBooleanField,
    modifiedFile: OptionalStringField,
    replacementsCount: OptionalNumberField,
  })
  .loose();
export type AntigravityReplaceFileContentToolResponse = z.infer<
  typeof AntigravityReplaceFileContentToolResponseSchema
>;

// ---------------------------------------------------------------------------
// 4. write_to_file
// ---------------------------------------------------------------------------

/** Optional artifact metadata for `write_to_file` when saving to the artifact directory. */
export const AntigravityArtifactMetadataSchema = z
  .object({
    RequestFeedback: z.boolean(),
    Summary: z.string(),
    UserFacing: z.boolean(),
  })
  .loose();
export type AntigravityArtifactMetadata = z.infer<
  typeof AntigravityArtifactMetadataSchema
>;

/** Arguments for `write_to_file` tool execution. */
export const AntigravityWriteToFileToolInputSchema = z
  .object({
    TargetFile: z.string(),
    Overwrite: z.boolean(),
    CodeContent: z.string(),
    Description: z.string(),
    Append: OptionalBooleanField,
    ArtifactMetadata: AntigravityArtifactMetadataSchema.optional(),
    toolAction: OptionalStringField,
    toolSummary: OptionalStringField,
  })
  .loose();
export type AntigravityWriteToFileToolInput = z.infer<
  typeof AntigravityWriteToFileToolInputSchema
>;
export const AntigravityWriteToFileArgsSchema = AntigravityWriteToFileToolInputSchema;
export type AntigravityWriteToFileArgs = AntigravityWriteToFileToolInput;

/** Response from `write_to_file`. */
export const AntigravityWriteToFileToolResponseSchema = z
  .object({
    success: OptionalBooleanField,
    targetFile: OptionalStringField,
    bytesWritten: OptionalNumberField,
  })
  .loose();
export type AntigravityWriteToFileToolResponse = z.infer<
  typeof AntigravityWriteToFileToolResponseSchema
>;

// ---------------------------------------------------------------------------
// 5. manage_task
// ---------------------------------------------------------------------------

/** Action choices for `manage_task`. */
export const AntigravityTaskActionSchema = z.enum([
  "list",
  "kill",
  "status",
  "send_input",
]);
export type AntigravityTaskAction = z.infer<typeof AntigravityTaskActionSchema>;

/** Arguments for `manage_task` background task management. */
export const AntigravityManageTaskToolInputSchema = z
  .object({
    Action: AntigravityTaskActionSchema.or(z.string()),
    TaskId: OptionalStringField,
    Input: OptionalStringField,
    toolAction: OptionalStringField,
    toolSummary: OptionalStringField,
  })
  .loose();
export type AntigravityManageTaskToolInput = z.infer<
  typeof AntigravityManageTaskToolInputSchema
>;
export const AntigravityManageTaskArgsSchema = AntigravityManageTaskToolInputSchema;
export type AntigravityManageTaskArgs = AntigravityManageTaskToolInput;

/** Task status descriptor returned by `manage_task`. */
export const AntigravityTaskInfoSchema = z
  .object({
    taskId: z.string(),
    status: OptionalStringField,
    command: OptionalStringField,
    logUri: OptionalStringField,
    exitCode: OptionalNumberField,
  })
  .loose();
export type AntigravityTaskInfo = z.infer<typeof AntigravityTaskInfoSchema>;

/** Response from `manage_task`. */
export const AntigravityManageTaskToolResponseSchema = z
  .object({
    tasks: z.array(AntigravityTaskInfoSchema).optional(),
    task: AntigravityTaskInfoSchema.optional(),
    output: OptionalStringField,
  })
  .loose();
export type AntigravityManageTaskToolResponse = z.infer<
  typeof AntigravityManageTaskToolResponseSchema
>;

// ---------------------------------------------------------------------------
// 6. schedule
// ---------------------------------------------------------------------------

/** Early termination condition for one-shot timers: 'never', 'any', or a specific sender ID. */
export const AntigravityTimerConditionSchema = z.enum(["never", "any"]).or(z.string());
export type AntigravityTimerCondition = z.infer<typeof AntigravityTimerConditionSchema>;

/** Arguments for `schedule` one-shot timer or recurring cron triggers. */
export const AntigravityScheduleToolInputSchema = z
  .object({
    Prompt: z.string(),
    DurationSeconds: OptionalNumberField,
    CronExpression: OptionalStringField,
    TimerCondition: AntigravityTimerConditionSchema.optional(),
    MaxIterations: OptionalNumberField,
    IsDaemon: OptionalBooleanField,
    toolAction: OptionalStringField,
    toolSummary: OptionalStringField,
  })
  .loose();
export type AntigravityScheduleToolInput = z.infer<
  typeof AntigravityScheduleToolInputSchema
>;
export const AntigravityScheduleArgsSchema = AntigravityScheduleToolInputSchema;
export type AntigravityScheduleArgs = AntigravityScheduleToolInput;

/** Response from `schedule`. */
export const AntigravityScheduleToolResponseSchema = z
  .object({
    taskId: OptionalStringField,
    scheduled: OptionalBooleanField,
  })
  .loose();
export type AntigravityScheduleToolResponse = z.infer<
  typeof AntigravityScheduleToolResponseSchema
>;

// ---------------------------------------------------------------------------
// 7. send_message
// ---------------------------------------------------------------------------

/** Arguments for `send_message` peer / subagent messaging. */
export const AntigravitySendMessageToolInputSchema = z
  .object({
    Recipient: z.string(),
    Message: z.string(),
    toolAction: OptionalStringField,
    toolSummary: OptionalStringField,
  })
  .loose();
export type AntigravitySendMessageToolInput = z.infer<
  typeof AntigravitySendMessageToolInputSchema
>;
export const AntigravitySendMessageArgsSchema = AntigravitySendMessageToolInputSchema;
export type AntigravitySendMessageArgs = AntigravitySendMessageToolInput;

/** Response from `send_message`. */
export const AntigravitySendMessageToolResponseSchema = z
  .object({
    success: OptionalBooleanField,
    deliveryStatus: OptionalStringField,
  })
  .loose();
export type AntigravitySendMessageToolResponse = z.infer<
  typeof AntigravitySendMessageToolResponseSchema
>;

// ---------------------------------------------------------------------------
// 8. invoke_subagent
// ---------------------------------------------------------------------------

/** Subagent model selection tier. */
export const AntigravitySubagentModelSchema = z.enum([
  "inherit",
  "flash_lite",
  "flash",
  "pro",
]);
export type AntigravitySubagentModel = z.infer<typeof AntigravitySubagentModelSchema>;

/** Subagent workspace isolation mode. */
export const AntigravitySubagentWorkspaceSchema = z.enum([
  "inherit",
  "branch",
  "share",
]);
export type AntigravitySubagentWorkspace = z.infer<
  typeof AntigravitySubagentWorkspaceSchema
>;

/** Single subagent definition to launch via `invoke_subagent`. */
export const AntigravitySubagentInvocationSchema = z
  .object({
    TypeName: z.string(),
    Role: z.string(),
    Prompt: z.string(),
    Model: AntigravitySubagentModelSchema.or(z.string()).optional(),
    Workspace: AntigravitySubagentWorkspaceSchema.or(z.string()).optional(),
  })
  .loose();
export type AntigravitySubagentInvocation = z.infer<
  typeof AntigravitySubagentInvocationSchema
>;

/** Arguments for `invoke_subagent`. */
export const AntigravityInvokeSubagentToolInputSchema = z
  .object({
    Subagents: z.array(AntigravitySubagentInvocationSchema),
    toolAction: OptionalStringField,
    toolSummary: OptionalStringField,
  })
  .loose();
export type AntigravityInvokeSubagentToolInput = z.infer<
  typeof AntigravityInvokeSubagentToolInputSchema
>;
export const AntigravityInvokeSubagentArgsSchema =
  AntigravityInvokeSubagentToolInputSchema;
export type AntigravityInvokeSubagentArgs = AntigravityInvokeSubagentToolInput;

/** Individual launched subagent descriptor. */
export const AntigravitySubagentSpawnResultSchema = z
  .object({
    conversationId: z.string(),
    typeName: OptionalStringField,
    role: OptionalStringField,
  })
  .loose();
export type AntigravitySubagentSpawnResult = z.infer<
  typeof AntigravitySubagentSpawnResultSchema
>;

/** Response from `invoke_subagent`. */
export const AntigravityInvokeSubagentToolResponseSchema = z
  .object({
    subagents: z.array(AntigravitySubagentSpawnResultSchema).optional(),
  })
  .loose();
export type AntigravityInvokeSubagentToolResponse = z.infer<
  typeof AntigravityInvokeSubagentToolResponseSchema
>;

// ---------------------------------------------------------------------------
// 9. define_subagent
// ---------------------------------------------------------------------------

/** Arguments for `define_subagent` custom agent registration. */
export const AntigravityDefineSubagentToolInputSchema = z
  .object({
    name: z.string(),
    description: z.string(),
    system_prompt: z.string(),
    enable_write_tools: OptionalBooleanField,
    enable_subagent_tools: OptionalBooleanField,
    enable_mcp_tools: OptionalBooleanField,
    toolAction: OptionalStringField,
    toolSummary: OptionalStringField,
  })
  .loose();
export type AntigravityDefineSubagentToolInput = z.infer<
  typeof AntigravityDefineSubagentToolInputSchema
>;
export const AntigravityDefineSubagentArgsSchema =
  AntigravityDefineSubagentToolInputSchema;
export type AntigravityDefineSubagentArgs = AntigravityDefineSubagentToolInput;

/** Response from `define_subagent`. */
export const AntigravityDefineSubagentToolResponseSchema = z
  .object({
    success: OptionalBooleanField,
    name: OptionalStringField,
  })
  .loose();
export type AntigravityDefineSubagentToolResponse = z.infer<
  typeof AntigravityDefineSubagentToolResponseSchema
>;

// ---------------------------------------------------------------------------
// 10. manage_subagents
// ---------------------------------------------------------------------------

/** Action choices for `manage_subagents`. */
export const AntigravitySubagentsActionSchema = z.enum([
  "list",
  "kill",
  "kill_all",
]);
export type AntigravitySubagentsAction = z.infer<
  typeof AntigravitySubagentsActionSchema
>;

/** Subagent lifecycle execution states. */
export const AntigravitySubagentLifecycleStateSchema = z.enum([
  "running",
  "idle",
  "waiting_for_input",
  "waiting_for_dependents",
  "waiting_for_message",
  "canceling",
  "errored",
  "unspecified",
]);
export type AntigravitySubagentLifecycleState = z.infer<
  typeof AntigravitySubagentLifecycleStateSchema
>;

/** Subagent state detail descriptor returned by `manage_subagents`. */
export const AntigravitySubagentInfoSchema = z
  .object({
    role: OptionalStringField,
    type: OptionalStringField,
    conversationId: z.string(),
    transcript: OptionalStringField,
    state: AntigravitySubagentLifecycleStateSchema.or(z.string()).optional(),
    stateDetail: OptionalStringField,
  })
  .loose();
export type AntigravitySubagentInfo = z.infer<typeof AntigravitySubagentInfoSchema>;

/** Arguments for `manage_subagents`. */
export const AntigravityManageSubagentsToolInputSchema = z
  .object({
    Action: AntigravitySubagentsActionSchema.or(z.string()),
    ConversationIds: z.array(z.string()).optional(),
    toolAction: OptionalStringField,
    toolSummary: OptionalStringField,
  })
  .loose();
export type AntigravityManageSubagentsToolInput = z.infer<
  typeof AntigravityManageSubagentsToolInputSchema
>;
export const AntigravityManageSubagentsArgsSchema =
  AntigravityManageSubagentsToolInputSchema;
export type AntigravityManageSubagentsArgs = AntigravityManageSubagentsToolInput;

/** Response from `manage_subagents`. */
export const AntigravityManageSubagentsToolResponseSchema = z
  .object({
    subagents: z.array(AntigravitySubagentInfoSchema).optional(),
    killedIds: z.array(z.string()).optional(),
  })
  .loose();
export type AntigravityManageSubagentsToolResponse = z.infer<
  typeof AntigravityManageSubagentsToolResponseSchema
>;

// ---------------------------------------------------------------------------
// 11. read_url_content
// ---------------------------------------------------------------------------

/** Arguments for `read_url_content` HTTP content extraction. */
export const AntigravityReadUrlContentToolInputSchema = z
  .object({
    Url: z.string(),
    toolAction: OptionalStringField,
    toolSummary: OptionalStringField,
  })
  .loose();
export type AntigravityReadUrlContentToolInput = z.infer<
  typeof AntigravityReadUrlContentToolInputSchema
>;
export const AntigravityReadUrlContentArgsSchema =
  AntigravityReadUrlContentToolInputSchema;
export type AntigravityReadUrlContentArgs = AntigravityReadUrlContentToolInput;

/** Response from `read_url_content`. */
export const AntigravityReadUrlContentToolResponseSchema = z
  .object({
    content: OptionalStringField,
    title: OptionalStringField,
    url: OptionalStringField,
  })
  .loose();
export type AntigravityReadUrlContentToolResponse = z.infer<
  typeof AntigravityReadUrlContentToolResponseSchema
>;

// ---------------------------------------------------------------------------
// 12. search_web
// ---------------------------------------------------------------------------

/** Arguments for `search_web`. */
export const AntigravitySearchWebToolInputSchema = z
  .object({
    query: z.string(),
    domain: OptionalStringField,
    toolAction: OptionalStringField,
    toolSummary: OptionalStringField,
  })
  .loose();
export type AntigravitySearchWebToolInput = z.infer<
  typeof AntigravitySearchWebToolInputSchema
>;
export const AntigravitySearchWebArgsSchema = AntigravitySearchWebToolInputSchema;
export type AntigravitySearchWebArgs = AntigravitySearchWebToolInput;

/** Individual web search result entry. */
export const AntigravityWebSearchResultSchema = z
  .object({
    title: OptionalStringField,
    url: OptionalStringField,
    snippet: OptionalStringField,
  })
  .loose();
export type AntigravityWebSearchResult = z.infer<
  typeof AntigravityWebSearchResultSchema
>;

/** Response from `search_web`. */
export const AntigravitySearchWebToolResponseSchema = z
  .object({
    summary: OptionalStringField,
    results: z.array(AntigravityWebSearchResultSchema).optional(),
  })
  .loose();
export type AntigravitySearchWebToolResponse = z.infer<
  typeof AntigravitySearchWebToolResponseSchema
>;

// ---------------------------------------------------------------------------
// 13. generate_image
// ---------------------------------------------------------------------------

/** Supported aspect ratios for image generation. */
export const AntigravityImageAspectRatioSchema = z.enum([
  "1:1",
  "2:3",
  "3:2",
  "3:4",
  "4:3",
  "9:16",
  "16:9",
]);
export type AntigravityImageAspectRatio = z.infer<
  typeof AntigravityImageAspectRatioSchema
>;

/** Arguments for `generate_image`. */
export const AntigravityGenerateImageToolInputSchema = z
  .object({
    Prompt: z.string(),
    ImageName: z.string(),
    AspectRatio: AntigravityImageAspectRatioSchema.or(z.string()).optional(),
    ImagePaths: z.array(z.string()).optional(),
    toolAction: OptionalStringField,
    toolSummary: OptionalStringField,
  })
  .loose();
export type AntigravityGenerateImageToolInput = z.infer<
  typeof AntigravityGenerateImageToolInputSchema
>;
export const AntigravityGenerateImageArgsSchema =
  AntigravityGenerateImageToolInputSchema;
export type AntigravityGenerateImageArgs = AntigravityGenerateImageToolInput;

/** Response from `generate_image`. */
export const AntigravityGenerateImageToolResponseSchema = z
  .object({
    imagePath: OptionalStringField,
    imageName: OptionalStringField,
  })
  .loose();
export type AntigravityGenerateImageToolResponse = z.infer<
  typeof AntigravityGenerateImageToolResponseSchema
>;

// ---------------------------------------------------------------------------
// 14. ask_question
// ---------------------------------------------------------------------------

/** Individual interactive prompt item in `ask_question`. */
export const AntigravityQuestionItemSchema = z
  .object({
    question: z.string(),
    options: z.array(z.string()),
    is_multi_select: OptionalBooleanField,
  })
  .loose();
export type AntigravityQuestionItem = z.infer<
  typeof AntigravityQuestionItemSchema
>;

/** Arguments for `ask_question`. */
export const AntigravityAskQuestionToolInputSchema = z
  .object({
    questions: z.array(AntigravityQuestionItemSchema),
    toolAction: OptionalStringField,
    toolSummary: OptionalStringField,
  })
  .loose();
export type AntigravityAskQuestionToolInput = z.infer<
  typeof AntigravityAskQuestionToolInputSchema
>;
export const AntigravityAskQuestionArgsSchema =
  AntigravityAskQuestionToolInputSchema;
export type AntigravityAskQuestionArgs = AntigravityAskQuestionToolInput;

/** Response from `ask_question`. */
export const AntigravityAskQuestionToolResponseSchema = z
  .object({
    answers: z.array(z.union([z.string(), z.array(z.string())])).optional(),
  })
  .loose();
export type AntigravityAskQuestionToolResponse = z.infer<
  typeof AntigravityAskQuestionToolResponseSchema
>;

// ---------------------------------------------------------------------------
// Discriminated Union & Parse Helpers
// ---------------------------------------------------------------------------

/**
 * Discriminated union of all 14 built-in Antigravity tool calls keyed on `name`.
 */
export const AntigravityTypedToolCallSchema = z.discriminatedUnion("name", [
  z.object({
    name: z.literal("run_command"),
    args: AntigravityRunCommandToolInputSchema.optional(),
  }),
  z.object({
    name: z.literal("view_file"),
    args: AntigravityViewFileToolInputSchema.optional(),
  }),
  z.object({
    name: z.literal("replace_file_content"),
    args: AntigravityReplaceFileContentToolInputSchema.optional(),
  }),
  z.object({
    name: z.literal("write_to_file"),
    args: AntigravityWriteToFileToolInputSchema.optional(),
  }),
  z.object({
    name: z.literal("manage_task"),
    args: AntigravityManageTaskToolInputSchema.optional(),
  }),
  z.object({
    name: z.literal("schedule"),
    args: AntigravityScheduleToolInputSchema.optional(),
  }),
  z.object({
    name: z.literal("send_message"),
    args: AntigravitySendMessageToolInputSchema.optional(),
  }),
  z.object({
    name: z.literal("invoke_subagent"),
    args: AntigravityInvokeSubagentToolInputSchema.optional(),
  }),
  z.object({
    name: z.literal("define_subagent"),
    args: AntigravityDefineSubagentToolInputSchema.optional(),
  }),
  z.object({
    name: z.literal("manage_subagents"),
    args: AntigravityManageSubagentsToolInputSchema.optional(),
  }),
  z.object({
    name: z.literal("read_url_content"),
    args: AntigravityReadUrlContentToolInputSchema.optional(),
  }),
  z.object({
    name: z.literal("search_web"),
    args: AntigravitySearchWebToolInputSchema.optional(),
  }),
  z.object({
    name: z.literal("generate_image"),
    args: AntigravityGenerateImageToolInputSchema.optional(),
  }),
  z.object({
    name: z.literal("ask_question"),
    args: AntigravityAskQuestionToolInputSchema.optional(),
  }),
]);
export type AntigravityTypedToolCall = z.infer<typeof AntigravityTypedToolCallSchema>;

/** Parse `run_command` arguments. */
export function ParseAntigravityRunCommandArgs(args: unknown) {
  return AntigravityRunCommandToolInputSchema.safeParse(args);
}

/** Parse `view_file` arguments. */
export function ParseAntigravityViewFileArgs(args: unknown) {
  return AntigravityViewFileToolInputSchema.safeParse(args);
}

/** Parse `replace_file_content` arguments. */
export function ParseAntigravityReplaceFileContentArgs(args: unknown) {
  return AntigravityReplaceFileContentToolInputSchema.safeParse(args);
}

/** Parse `write_to_file` arguments. */
export function ParseAntigravityWriteToFileArgs(args: unknown) {
  return AntigravityWriteToFileToolInputSchema.safeParse(args);
}

/** Parse `manage_task` arguments. */
export function ParseAntigravityManageTaskArgs(args: unknown) {
  return AntigravityManageTaskToolInputSchema.safeParse(args);
}

/** Parse `schedule` arguments. */
export function ParseAntigravityScheduleArgs(args: unknown) {
  return AntigravityScheduleToolInputSchema.safeParse(args);
}

/** Parse `send_message` arguments. */
export function ParseAntigravitySendMessageArgs(args: unknown) {
  return AntigravitySendMessageToolInputSchema.safeParse(args);
}

/** Parse `invoke_subagent` arguments. */
export function ParseAntigravityInvokeSubagentArgs(args: unknown) {
  return AntigravityInvokeSubagentToolInputSchema.safeParse(args);
}

/** Parse `define_subagent` arguments. */
export function ParseAntigravityDefineSubagentArgs(args: unknown) {
  return AntigravityDefineSubagentToolInputSchema.safeParse(args);
}

/** Parse `manage_subagents` arguments. */
export function ParseAntigravityManageSubagentsArgs(args: unknown) {
  return AntigravityManageSubagentsToolInputSchema.safeParse(args);
}

/** Parse `read_url_content` arguments. */
export function ParseAntigravityReadUrlContentArgs(args: unknown) {
  return AntigravityReadUrlContentToolInputSchema.safeParse(args);
}

/** Parse `search_web` arguments. */
export function ParseAntigravitySearchWebArgs(args: unknown) {
  return AntigravitySearchWebToolInputSchema.safeParse(args);
}

/** Parse `generate_image` arguments. */
export function ParseAntigravityGenerateImageArgs(args: unknown) {
  return AntigravityGenerateImageToolInputSchema.safeParse(args);
}

/** Parse `ask_question` arguments. */
export function ParseAntigravityAskQuestionArgs(args: unknown) {
  return AntigravityAskQuestionToolInputSchema.safeParse(args);
}

/** Parse a structured Antigravity tool call with type narrowing on `name`. */
export function ParseAntigravityToolCall(toolCall: unknown) {
  return AntigravityTypedToolCallSchema.safeParse(toolCall);
}

/** Parse arbitrary tool arguments given an Antigravity tool name. */
export function ParseAntigravityToolArgs(toolName: string, args: unknown) {
  switch (toolName) {
    case "run_command":
      return AntigravityRunCommandToolInputSchema.safeParse(args);
    case "view_file":
      return AntigravityViewFileToolInputSchema.safeParse(args);
    case "replace_file_content":
      return AntigravityReplaceFileContentToolInputSchema.safeParse(args);
    case "write_to_file":
      return AntigravityWriteToFileToolInputSchema.safeParse(args);
    case "manage_task":
      return AntigravityManageTaskToolInputSchema.safeParse(args);
    case "schedule":
      return AntigravityScheduleToolInputSchema.safeParse(args);
    case "send_message":
      return AntigravitySendMessageToolInputSchema.safeParse(args);
    case "invoke_subagent":
      return AntigravityInvokeSubagentToolInputSchema.safeParse(args);
    case "define_subagent":
      return AntigravityDefineSubagentToolInputSchema.safeParse(args);
    case "manage_subagents":
      return AntigravityManageSubagentsToolInputSchema.safeParse(args);
    case "read_url_content":
      return AntigravityReadUrlContentToolInputSchema.safeParse(args);
    case "search_web":
      return AntigravitySearchWebToolInputSchema.safeParse(args);
    case "generate_image":
      return AntigravityGenerateImageToolInputSchema.safeParse(args);
    case "ask_question":
      return AntigravityAskQuestionToolInputSchema.safeParse(args);
    default:
      return JsonObjectSchema.safeParse(args);
  }
}
