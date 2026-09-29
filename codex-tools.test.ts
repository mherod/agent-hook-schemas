import { describe, expect, expectTypeOf, test } from "bun:test";
import {
  CodexBuiltinToolInputSchema,
  CodexBuiltinToolInputSchemas,
  CodexBuiltinToolNameSchema,
  CodexBuiltinToolResponseSchemas,
  ParseCodexBuiltinToolArgs,
  ParseCodexBuiltinToolInput,
  ParseCodexBuiltinToolResponse,
  type CodexBuiltinToolName,
  type CodexExecCommandToolInput,
} from "./codex-tools.ts";
import { CodexPreToolUseInputSchema } from "./codex-schemas.ts";

const question = {
  header: "Scope", id: "scope", question: "Which scope?",
  options: [{ label: "Core", description: "Core tools" }, { label: "App", description: "App tools" }],
};
const patch = "*** Begin Patch\n*** Add File: note.txt\n+hello\n*** End Patch";
const source = '// @exec: {"max_output_tokens": 100}\ntext(await tools.get_goal({}));';
const cases = {
  exec_command: { valid: { cmd: "pwd", login: false, max_output_tokens: 1000,
    prefix_rule: ["git", "status"], sandbox_permissions: "use_default", shell: "/bin/zsh",
    tty: false, workdir: "/workspace", yield_time_ms: 1000, justification: "Inspect workspace" },
    invalid: { command: "pwd" } },
  write_stdin: { valid: { session_id: 42, chars: "", yield_time_ms: 1000, max_output_tokens: 100 },
    invalid: { session_id: "42" } },
  apply_patch: { valid: patch, invalid: { patch } },
  exec: { valid: source, invalid: { code: source } },
  wait: { valid: { cell_id: "3", yield_time_ms: 1000, max_tokens: 100, terminate: false },
    invalid: { session_id: 3 } },
  view_image: { valid: { path: "/tmp/chart.png", detail: "original" }, invalid: { path: 3 } },
  create_goal: { valid: { objective: "Add schemas", token_budget: 1000 }, invalid: { objective: "Add", token_budget: 0 } },
  get_goal: { valid: {}, invalid: null },
  update_goal: { valid: { status: "complete" }, invalid: { status: "active" } },
  request_user_input: { valid: { questions: [question] }, invalid: { questions: [] } },
  request_user_input_async: { valid: { questions: [{ title: "Which scope?", options: ["Core", "App"] }] },
    invalid: { questions: [{ question: "Which scope?" }] } },
  list_mcp_resources: { valid: { server: "example", cursor: "next" }, invalid: { server: 1 } },
  list_mcp_resource_templates: { valid: { server: "example", cursor: "next" }, invalid: { cursor: null } },
  read_mcp_resource: { valid: { server: "example", uri: "resource://sample" }, invalid: { uri: "resource://sample" } },
  request_plugin_install: { valid: { plugin_id: "example@registry", suggest_reason: "Requested plugin" },
    invalid: { plugin_id: "example@registry" } },
  "clock.curr_time": { valid: {}, invalid: [] },
  "clock.sleep": { valid: { duration_ms: 1000 }, invalid: { duration_ms: 0 } },
  "image_gen.imagegen": { valid: { prompt: "A chart", num_last_images_to_include: null, referenced_image_paths: ["/tmp/chart.png"] },
    invalid: { prompt: "A chart", referenced_image_paths: "/tmp/chart.png" } },
  "web.run": { valid: {
    click: [{ id: 1, ref_id: "page" }],
    finance: [{ market: "USA", ticker: "EXAMPLE", type: "equity" }],
    find: [{ pattern: "schema", ref_id: "page" }],
    image_query: [{ domains: ["example.com"], q: "image", recency: 1 }],
    open: [{ lineno: 12, ref_id: "page" }], response_length: "short",
    screenshot: [{ pageno: 0, ref_id: "page" }],
    search_query: [{ domains: ["example.com"], q: "query", recency: 1 }],
    sports: [{ date_from: "2026-09-29", date_to: "2026-09-30", fn: "schedule", league: "nba",
      locale: "en", num_games: 1, opponent: "LAL", team: "GSW", tool: "sports" }],
    time: [{ utc_offset: "+01:00" }],
    weather: [{ duration: 1, location: "London", start: "2026-09-29" }],
  }, invalid: { search_query: [{ query: "wrong field" }] } },
} satisfies Record<CodexBuiltinToolName, { valid: unknown; invalid: unknown }>;

describe("Codex core tool contracts", () => {
  test("every exposed core name has a schema and an independently specified fixture", () => {
    expect<readonly string[]>(CodexBuiltinToolNameSchema.options.toSorted()).toEqual(Object.keys(cases).toSorted());
    expect(Object.keys(CodexBuiltinToolInputSchemas).toSorted()).toEqual(Object.keys(cases).toSorted());
    expect(Object.keys(cases)).toHaveLength(19);
  });

  for (const name of CodexBuiltinToolNameSchema.options) {
    test(name + " validates its payload without losing extensions", () => {
      const { valid, invalid } = cases[name];
      const input = typeof valid === "string" ? valid : { ...valid, future_host_field: { value: 1 } };
      const call = { tool_name: name, tool_input: input, call_id: "example" };
      expect(ParseCodexBuiltinToolArgs(name, input)).toEqual({ success: true, data: input });
      expect<unknown>(ParseCodexBuiltinToolInput(call)).toEqual({ success: true, data: call });
      expect(ParseCodexBuiltinToolArgs(name, invalid).success).toBe(false);
      expect(ParseCodexBuiltinToolInput({ tool_name: name, tool_input: invalid }).success).toBe(false);
      expect(ParseCodexBuiltinToolInput({ tool_name: name }).success).toBe(false);
    });
  }

  test("execution wrappers, shell sessions and patch text have distinct contracts", () => {
    expect(ParseCodexBuiltinToolArgs("exec_command", { cmd: "pwd" })).toEqual({ success: true, data: { cmd: "pwd" } });
    expect(ParseCodexBuiltinToolArgs("write_stdin", { cell_id: "1" }).success).toBe(false);
    expect(ParseCodexBuiltinToolArgs("wait", { cell_id: 1 }).success).toBe(false);
    expect(ParseCodexBuiltinToolArgs("apply_patch", patch)).toEqual({ success: true, data: patch });
    expect(ParseCodexBuiltinToolArgs("exec", source)).toEqual({ success: true, data: source });
    expect(ParseCodexBuiltinToolArgs("exec_command", { cmd: "pwd", sandbox_permissions: "bypass" }).success).toBe(false);
    expect(ParseCodexBuiltinToolArgs("exec_command", { cmd: "pwd", sandbox_permissions: "require_escalated" }).success).toBe(true);
    expect(ParseCodexBuiltinToolArgs("view_image", { path: "/tmp/a", detail: "low" }).success).toBe(false);
    expect(ParseCodexBuiltinToolArgs("update_goal", { status: "blocked" }).success).toBe(true);
    expect(ParseCodexBuiltinToolArgs("create_goal", { objective: "Add schemas" }).success).toBe(true);
    expect(ParseCodexBuiltinToolArgs("clock.sleep", { duration_ms: 43_200_001 }).success).toBe(false);
    expect(ParseCodexBuiltinToolArgs("clock.sleep", { duration_ms: 43_200_000 }).success).toBe(true);
  });

  test("question formats preserve nested metadata and distinguish optional choices", () => {
    expect(ParseCodexBuiltinToolArgs("request_user_input", {
      questions: [{ ...question, future: true, options: question.options.map((o) => ({ ...o, future: true })) }],
    }).success).toBe(true);
    for (const questions of [
      [question, question, question, question],
      [{ ...question, header: "Longer than twelve" }],
      [{ ...question, options: [question.options[0]] }],
      [{ ...question, options: [...question.options, ...question.options] }],
      [{ ...question, options: [{ label: "Missing description" }, question.options[1]] }],
    ]) expect(ParseCodexBuiltinToolArgs("request_user_input", { questions }).success).toBe(false);
    expect(ParseCodexBuiltinToolArgs("request_user_input_async", { questions: [{ title: "Free text?" }] }).success).toBe(true);
    expect(ParseCodexBuiltinToolArgs("request_user_input_async", { questions: [{ title: "Pick", options: [] }] }).success).toBe(false);
    expect(ParseCodexBuiltinToolArgs("request_user_input_async", { questions: [] }).success).toBe(false);
  });

  test("nullable image references and nested web contracts retain declared types", () => {
    expect(ParseCodexBuiltinToolArgs("image_gen.imagegen", { prompt: "Image" }).success).toBe(true);
    expect(ParseCodexBuiltinToolArgs("image_gen.imagegen", {
      prompt: "Image", referenced_image_paths: null, num_last_images_to_include: 1,
    }).success).toBe(true);
    expect(ParseCodexBuiltinToolArgs("web.run", { sports: [{ fn: "unknown", league: "nba" }] }).success).toBe(false);
    expect(ParseCodexBuiltinToolArgs("web.run", { finance: [{ ticker: "EXAMPLE", type: "unknown" }] }).success).toBe(false);
    expect(ParseCodexBuiltinToolArgs("web.run", {
      search_query: [{ q: "schema", future: true }], future: true,
    })).toEqual({ success: true, data: { search_query: [{ q: "schema", future: true }], future: true } });
  });

  test("typed dispatch rejects unknown names while generic hooks retain compatibility", () => {
    for (const tool_name of ["unknown", "functions.exec", "mcp__custom__exec_command"]) {
      expect(CodexBuiltinToolInputSchema.safeParse({ tool_name, tool_input: {} }).success).toBe(false);
    }
    const hook = { hook_event_name: "PreToolUse", tool_name: "exec_command", tool_input: { cmd: 42 } };
    expect(CodexPreToolUseInputSchema.safeParse(hook).success).toBe(true);
    expect(ParseCodexBuiltinToolInput(hook).success).toBe(false);
    const result = ParseCodexBuiltinToolInput({ tool_name: "exec_command", tool_input: { cmd: "pwd" } });
    if (!result.success || result.data.tool_name !== "exec_command") throw new Error("Expected shell input");
    expectTypeOf(result.data.tool_input).toEqualTypeOf<CodexExecCommandToolInput>();
    expectTypeOf(ParseCodexBuiltinToolArgs("view_image", {}).data?.path).toEqualTypeOf<string | undefined>();
  });
});

describe("Codex declared responses", () => {
  test("shell responses distinguish running sessions from completed commands without requiring both", () => {
    for (const name of ["exec_command", "write_stdin"] as const) {
      for (const response of [
        { output: "running", wall_time_seconds: 1, session_id: 42 },
        { output: "done", wall_time_seconds: 0.2, exit_code: 0, original_token_count: 4, chunk_id: "abc", future: true },
      ]) expect(ParseCodexBuiltinToolResponse(name, response)).toEqual({ success: true, data: response });
      for (const response of [{ output: "missing time" }, { output: [], wall_time_seconds: 1 },
        { output: "done", wall_time_seconds: 1, session_id: "42" }]) {
        expect(ParseCodexBuiltinToolResponse(name, response).success).toBe(false);
      }
    }
  });

  test("image and time responses validate declared fields, with no invented unknown outputs", () => {
    expect(ParseCodexBuiltinToolResponse("view_image", { detail: "high", image_url: "data:image/png;base64,eA==" }).success).toBe(true);
    expect(ParseCodexBuiltinToolResponse("view_image", { detail: "low", image_url: "image" }).success).toBe(false);
    expect(ParseCodexBuiltinToolResponse("clock.curr_time", { current_time: "2026-09-29 10:00:00 UTC" }).success).toBe(true);
    expect(ParseCodexBuiltinToolResponse("clock.curr_time", { current_time: 42 }).success).toBe(false);
    expect(Object.keys(CodexBuiltinToolResponseSchemas)).toEqual(["exec_command", "write_stdin", "view_image", "clock.curr_time"]);
  });
});
