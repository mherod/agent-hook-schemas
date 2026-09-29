import { z } from "zod";

/**
 * Core Codex tool contracts exposed in the 2026-09-29 desktop session.
 * See docs/codex-tools-audit-2026-09-29.md for provenance and coverage limits.
 * Inputs preserve host extensions and do not inject defaults or enforce runtime
 * permissions. Freeform source/patch strings are not parsed as JSON or executed.
 */
export const CodexExecCommandToolInputSchema = z.object({
  cmd: z.string(),
  justification: z.string().optional(),
  login: z.boolean().optional(),
  max_output_tokens: z.number().optional(),
  prefix_rule: z.array(z.string()).optional(),
  sandbox_permissions: z.enum(["use_default", "require_escalated"]).optional(),
  shell: z.string().optional(),
  tty: z.boolean().optional(),
  workdir: z.string().optional(),
  yield_time_ms: z.number().optional(),
}).loose();

export const CodexWriteStdinToolInputSchema = z.object({
  session_id: z.number(),
  chars: z.string().optional(),
  max_output_tokens: z.number().optional(),
  yield_time_ms: z.number().optional(),
}).loose();

export const CodexExecCommandToolResponseSchema = z.object({
  output: z.string(),
  wall_time_seconds: z.number(),
  chunk_id: z.string().optional(),
  exit_code: z.number().optional(),
  original_token_count: z.number().optional(),
  session_id: z.number().optional(),
}).loose();
export const CodexWriteStdinToolResponseSchema = CodexExecCommandToolResponseSchema;

export const CodexApplyPatchToolInputSchema = z.string();
export const CodexExecToolInputSchema = z.string();

export const CodexWaitToolInputSchema = z.object({
  cell_id: z.string(),
  max_tokens: z.number().optional(),
  terminate: z.boolean().optional(),
  yield_time_ms: z.number().optional(),
}).loose();

export const CodexViewImageToolInputSchema = z.object({
  path: z.string(),
  detail: z.enum(["high", "original"]).optional(),
}).loose();
export const CodexViewImageToolResponseSchema = z.object({
  detail: z.enum(["high", "original"]),
  image_url: z.string(),
}).loose();

export const CodexCreateGoalToolInputSchema = z.object({
  objective: z.string(),
  token_budget: z.number().positive().optional(),
}).loose();
export const CodexGetGoalToolInputSchema = z.object({}).loose();
export const CodexUpdateGoalToolInputSchema = z.object({
  status: z.enum(["complete", "blocked"]),
}).loose();

export const CodexRequestUserInputToolInputSchema = z.object({
  questions: z.array(z.object({
    header: z.string().max(12),
    id: z.string(),
    question: z.string(),
    options: z.array(z.object({
      label: z.string(),
      description: z.string(),
    }).loose()).min(2).max(3),
  }).loose()).min(1).max(3),
}).loose();
export const CodexRequestUserInputAsyncToolInputSchema = z.object({
  questions: z.array(z.object({
    title: z.string(),
    options: z.array(z.string()).min(1).optional(),
  }).loose()).min(1),
}).loose();

export const CodexListMcpResourcesToolInputSchema = z.object({
  cursor: z.string().optional(),
  server: z.string().optional(),
}).loose();
export const CodexListMcpResourceTemplatesToolInputSchema = CodexListMcpResourcesToolInputSchema;
export const CodexReadMcpResourceToolInputSchema = z.object({
  server: z.string(),
  uri: z.string(),
}).loose();
export const CodexRequestPluginInstallToolInputSchema = z.object({
  plugin_id: z.string(),
  suggest_reason: z.string(),
}).loose();

export const CodexCurrentTimeToolInputSchema = z.object({}).loose();
export const CodexCurrentTimeToolResponseSchema = z.object({
  current_time: z.string(),
}).loose();
export const CodexSleepToolInputSchema = z.object({
  duration_ms: z.number().min(1).max(43_200_000),
}).loose();

export const CodexImagegenToolInputSchema = z.object({
  prompt: z.string(),
  num_last_images_to_include: z.number().nullable().optional(),
  referenced_image_paths: z.array(z.string()).nullable().optional(),
}).loose();

/** Web query types follow the exposed API; usage guidance is not a permission check. */
export const CodexWebRunToolInputSchema = z.object({
  click: z.array(z.object({ id: z.number(), ref_id: z.string() }).loose()).optional(),
  finance: z.array(z.object({
    market: z.string().optional(),
    ticker: z.string(),
    type: z.enum(["equity", "fund", "crypto", "index"]),
  }).loose()).optional(),
  find: z.array(z.object({ pattern: z.string(), ref_id: z.string() }).loose()).optional(),
  image_query: z.array(z.object({
    domains: z.array(z.string()).optional(), q: z.string(), recency: z.number().optional(),
  }).loose()).optional(),
  open: z.array(z.object({ lineno: z.number().optional(), ref_id: z.string() }).loose()).optional(),
  response_length: z.enum(["short", "medium", "long"]).optional(),
  screenshot: z.array(z.object({ pageno: z.number(), ref_id: z.string() }).loose()).optional(),
  search_query: z.array(z.object({
    domains: z.array(z.string()).optional(), q: z.string(), recency: z.number().optional(),
  }).loose()).optional(),
  sports: z.array(z.object({
    date_from: z.string().optional(), date_to: z.string().optional(),
    fn: z.enum(["schedule", "standings"]),
    league: z.enum(["nba", "wnba", "nfl", "nhl", "mlb", "epl", "ncaamb", "ncaawb", "ipl"]),
    locale: z.string().optional(), num_games: z.number().optional(),
    opponent: z.string().optional(), team: z.string().optional(), tool: z.literal("sports").optional(),
  }).loose()).optional(),
  time: z.array(z.object({ utc_offset: z.string() }).loose()).optional(),
  weather: z.array(z.object({
    duration: z.number().optional(), location: z.string(), start: z.string().optional(),
  }).loose()).optional(),
}).loose();

export type CodexExecCommandToolInput = z.infer<typeof CodexExecCommandToolInputSchema>;
export type CodexWriteStdinToolInput = z.infer<typeof CodexWriteStdinToolInputSchema>;
export type CodexApplyPatchToolInput = z.infer<typeof CodexApplyPatchToolInputSchema>;
export type CodexExecToolInput = z.infer<typeof CodexExecToolInputSchema>;
export type CodexWaitToolInput = z.infer<typeof CodexWaitToolInputSchema>;
export type CodexViewImageToolInput = z.infer<typeof CodexViewImageToolInputSchema>;
export type CodexCreateGoalToolInput = z.infer<typeof CodexCreateGoalToolInputSchema>;
export type CodexGetGoalToolInput = z.infer<typeof CodexGetGoalToolInputSchema>;
export type CodexUpdateGoalToolInput = z.infer<typeof CodexUpdateGoalToolInputSchema>;
export type CodexRequestUserInputToolInput = z.infer<typeof CodexRequestUserInputToolInputSchema>;
export type CodexRequestUserInputAsyncToolInput = z.infer<typeof CodexRequestUserInputAsyncToolInputSchema>;
export type CodexListMcpResourcesToolInput = z.infer<typeof CodexListMcpResourcesToolInputSchema>;
export type CodexListMcpResourceTemplatesToolInput = z.infer<typeof CodexListMcpResourceTemplatesToolInputSchema>;
export type CodexReadMcpResourceToolInput = z.infer<typeof CodexReadMcpResourceToolInputSchema>;
export type CodexRequestPluginInstallToolInput = z.infer<typeof CodexRequestPluginInstallToolInputSchema>;
export type CodexCurrentTimeToolInput = z.infer<typeof CodexCurrentTimeToolInputSchema>;
export type CodexSleepToolInput = z.infer<typeof CodexSleepToolInputSchema>;
export type CodexImagegenToolInput = z.infer<typeof CodexImagegenToolInputSchema>;
export type CodexWebRunToolInput = z.infer<typeof CodexWebRunToolInputSchema>;

export const CodexBuiltinToolNameSchema = z.enum([
  "exec_command",
  "write_stdin",
  "apply_patch",
  "exec",
  "wait",
  "view_image",
  "create_goal",
  "get_goal",
  "update_goal",
  "request_user_input",
  "request_user_input_async",
  "list_mcp_resources",
  "list_mcp_resource_templates",
  "read_mcp_resource",
  "request_plugin_install",
  "clock.curr_time",
  "clock.sleep",
  "image_gen.imagegen",
  "web.run"
]);
export type CodexBuiltinToolName = z.infer<typeof CodexBuiltinToolNameSchema>;

export const CodexBuiltinToolInputSchemas = {
  "exec_command": CodexExecCommandToolInputSchema,
  "write_stdin": CodexWriteStdinToolInputSchema,
  "apply_patch": CodexApplyPatchToolInputSchema,
  "exec": CodexExecToolInputSchema,
  "wait": CodexWaitToolInputSchema,
  "view_image": CodexViewImageToolInputSchema,
  "create_goal": CodexCreateGoalToolInputSchema,
  "get_goal": CodexGetGoalToolInputSchema,
  "update_goal": CodexUpdateGoalToolInputSchema,
  "request_user_input": CodexRequestUserInputToolInputSchema,
  "request_user_input_async": CodexRequestUserInputAsyncToolInputSchema,
  "list_mcp_resources": CodexListMcpResourcesToolInputSchema,
  "list_mcp_resource_templates": CodexListMcpResourceTemplatesToolInputSchema,
  "read_mcp_resource": CodexReadMcpResourceToolInputSchema,
  "request_plugin_install": CodexRequestPluginInstallToolInputSchema,
  "clock.curr_time": CodexCurrentTimeToolInputSchema,
  "clock.sleep": CodexSleepToolInputSchema,
  "image_gen.imagegen": CodexImagegenToolInputSchema,
  "web.run": CodexWebRunToolInputSchema,
} satisfies Record<CodexBuiltinToolName, z.ZodType>;
export type CodexBuiltinToolArgs<N extends CodexBuiltinToolName = CodexBuiltinToolName> =
  z.infer<(typeof CodexBuiltinToolInputSchemas)[N]>;

/** Decoded inputs use function basenames; other namespaces remain explicit. */
export const CodexBuiltinToolInputSchema = z.discriminatedUnion("tool_name", [
  z.object({ tool_name: z.literal("exec_command"), tool_input: CodexExecCommandToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("write_stdin"), tool_input: CodexWriteStdinToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("apply_patch"), tool_input: CodexApplyPatchToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("exec"), tool_input: CodexExecToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("wait"), tool_input: CodexWaitToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("view_image"), tool_input: CodexViewImageToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("create_goal"), tool_input: CodexCreateGoalToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("get_goal"), tool_input: CodexGetGoalToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("update_goal"), tool_input: CodexUpdateGoalToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("request_user_input"), tool_input: CodexRequestUserInputToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("request_user_input_async"), tool_input: CodexRequestUserInputAsyncToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("list_mcp_resources"), tool_input: CodexListMcpResourcesToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("list_mcp_resource_templates"), tool_input: CodexListMcpResourceTemplatesToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("read_mcp_resource"), tool_input: CodexReadMcpResourceToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("request_plugin_install"), tool_input: CodexRequestPluginInstallToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("clock.curr_time"), tool_input: CodexCurrentTimeToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("clock.sleep"), tool_input: CodexSleepToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("image_gen.imagegen"), tool_input: CodexImagegenToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("web.run"), tool_input: CodexWebRunToolInputSchema }).loose(),
]);
export type CodexBuiltinToolInput = z.infer<typeof CodexBuiltinToolInputSchema>;

export function ParseCodexBuiltinToolInput(input: unknown) {
  return CodexBuiltinToolInputSchema.safeParse(input);
}

export function ParseCodexBuiltinToolArgs<N extends CodexBuiltinToolName>(name: N, input: unknown) {
  return CodexBuiltinToolInputSchemas[name].safeParse(input) as z.ZodSafeParseResult<CodexBuiltinToolArgs<N>>;
}

/** Only tools whose exposed declarations specify response fields are included. */
export const CodexBuiltinToolResponseSchemas = {
  exec_command: CodexExecCommandToolResponseSchema,
  write_stdin: CodexWriteStdinToolResponseSchema,
  view_image: CodexViewImageToolResponseSchema,
  "clock.curr_time": CodexCurrentTimeToolResponseSchema,
};
export type CodexBuiltinToolResponseName = keyof typeof CodexBuiltinToolResponseSchemas;
export type CodexBuiltinToolResponse<N extends CodexBuiltinToolResponseName = CodexBuiltinToolResponseName> =
  z.infer<(typeof CodexBuiltinToolResponseSchemas)[N]>;
export type CodexExecCommandToolResponse = z.infer<typeof CodexExecCommandToolResponseSchema>;
export type CodexWriteStdinToolResponse = z.infer<typeof CodexWriteStdinToolResponseSchema>;
export type CodexViewImageToolResponse = z.infer<typeof CodexViewImageToolResponseSchema>;
export type CodexCurrentTimeToolResponse = z.infer<typeof CodexCurrentTimeToolResponseSchema>;

export function ParseCodexBuiltinToolResponse<N extends CodexBuiltinToolResponseName>(name: N, response: unknown) {
  return CodexBuiltinToolResponseSchemas[name].safeParse(response) as z.ZodSafeParseResult<CodexBuiltinToolResponse<N>>;
}
