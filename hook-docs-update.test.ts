import { describe, expect, test } from "bun:test";
import * as claude from "./claude.ts";
import * as ci from "./claude-hooks-integration.ts";
import * as codex from "./codex.ts";
import * as co from "./copilot.ts";
import * as coi from "./copilot-hooks-integration.ts";
import * as cursor from "./cursor.ts";
import * as gemini from "./gemini.ts";
import * as anti from "./antigravity.ts";

const command = { type: "command" as const, command: "audit-hook" };
const mcp = { type: "mcp_tool" as const, server: "scanner", tool: "scan", input: { path: "${tool_input.file_path}" } };

describe("Claude reference updates", () => {
  test("model switches survive configuration merging and resolve against the target model", () => {
    const merged = ci.mergeClaudeHooksFiles([{ hooks: {
      PreModelSwitch: [{ matcher: "claude-opus-5", hooks: [command, mcp] }],
      PostModelSwitch: [{ hooks: [command] }],
    } }]);
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;
    expect(Object.keys(merged.config)).toEqual(["PreModelSwitch", "PostModelSwitch"]);
    const input = claude.ParseHookInput({ hook_event_name: "PreModelSwitch", from_model: "claude-sonnet-5", to_model: "claude-opus-5", requested_model: null, context_tokens: 100, source: "sdk" });
    expect(input.success).toBe(true);
    if (input.success) expect(ci.resolveMatchingClaudeHandlersFromInput(merged.config, input.data)).toEqual([command, mcp]);
    expect(claude.ParseHookInput({ hook_event_name: "PostModelSwitch", context_tokens: "bad" }).success).toBe(false);
  });

  test("model-switch decisions do not inherit defer or tool-rewrite behavior", () => {
    expect(claude.HookCommandOutputSchema.safeParse({ hookSpecificOutput: { hookEventName: "PreModelSwitch", permissionDecision: "ask" } }).success).toBe(true);
    for (const field of [{ permissionDecision: "defer" }, { updatedInput: {} }, { additionalContext: "wrong level" }]) {
      expect(claude.HookCommandOutputSchema.safeParse({ hookSpecificOutput: { hookEventName: "PreModelSwitch", ...field } }).success).toBe(false);
    }
    expect(claude.PostModelSwitchStdoutSchema.parse({ additionalContext: "Use project conventions" }).additionalContext).toBe("Use project conventions");
    expect(claude.SessionStartSourceSchema.parse("fork")).toBe("fork");
    expect(claude.HookHandlerSchema.safeParse({ ...mcp, server: undefined }).success).toBe(false);
  });

  test.each([
    ["Bash", "OtherBash", false], ["Edit, Write", "Edit", true],
    ["code-reviewer", "senior-code-reviewer", false], ["Edit.*", "NotebookEdit", true],
    ["[", "Bash", false], ["*", "anything", true],
  ])("matcher %s against %s", (matcher, subject, expected) => {
    expect(ci.claudeMatcherMatches(matcher, subject)).toBe(expected);
  });
  test("FileChanged/StopFailure keep narrower matcher rules", () => {
    expect(ci.claudeMatcherMatches("code-reviewer", "senior-code-reviewer", "FileChanged")).toBe(true);
    expect(ci.claudeMatcherMatches("error, unknown", "error", "StopFailure")).toBe(false);
  });
  test.each([
    ["FOO=bar git status", "Bash(git *)", true],
    ["FOO= git status", "Bash(git *)", true],
    ["FOO='hello world' BAR= git status", "Bash(git *)", true],
    ["FOO='hello world' BAR= date", "Bash(git *)", false],
    ["FOO=$(date) git status", "Bash(git *)", true],
    ["FOO=$(date) echo safe", "Bash(rm *)", false],
    ["'FOO=bar' git status", "Bash(git *)", false],
    ["FOO=bar ec${SUFFIX} safe", "Bash(rm *)", true],
    ["ec$(date)ho safe", "Bash(rm *)", true],
    ["npm test && git status", "Bash(git *)", true],
    ["echo $(rm -rf /tmp/demo)", "Bash(rm *)", true],
    ["echo `rm -rf /tmp/demo`", "Bash(rm *)", true],
    ["echo $(date)", "Bash(rm *)", false],
    ["echo before $(date) after", "Bash(cat *)", false],
    ["$TOOL git status", "Bash(git *)", true],
    ["echo $(date)", "Bash(git push *)", true],
    ["echo '$(rm -rf /tmp/demo)'", "Bash(rm *)", false],
    ["echo 'safe && rm -rf /tmp/demo'", "Bash(rm *)", false],
    ["echo safe # rm -rf /tmp/demo", "Bash(rm *)", false],
    ["echo $(echo $(rm -rf /tmp/demo))", "Bash(rm *)", true],
  ])("Bash selection %s", (input, rule, expected) => {
    expect(ci.claudeToolIfMatches("Bash", { command: input }, rule)).toBe(expected);
  });
  test("conservative hook selection never grants a settings permission", () => {
    expect(ci.evaluateSettingsPermissions({ allow: ["Bash(git *)"] }, "Bash", { command: "$TOOL git status" })).toBeUndefined();
    expect(ci.evaluateSettingsPermissions({ allow: ["Bash(git *)"] }, "Bash", { command: "npm test && git status" })).toBeUndefined();
  });
  test("timeouts account for handler, event, and asynchronous execution", () => {
    expect(ci.effectiveClaudeHandlerTimeoutSec({ type: "prompt" })).toBe(30);
    expect(ci.effectiveClaudeHandlerTimeoutSec({ type: "agent" })).toBe(60);
    expect(ci.effectiveClaudeHandlerTimeoutSec({}, "UserPromptSubmit")).toBe(30);
    expect(ci.effectiveClaudeHandlerTimeoutSec({}, "PreModelSwitch")).toBe(30);
    expect(ci.effectiveClaudeHandlerTimeoutSec({}, "MessageDisplay")).toBe(10);
    expect(ci.effectiveClaudeHandlerTimeoutSec({}, "SessionEnd")).toBe(1.5);
    expect(ci.effectiveClaudeHandlerTimeoutSec({ timeout: 80 }, "SessionEnd")).toBe(60);
    expect(ci.effectiveClaudeHandlerTimeoutSec({ timeout: 0.5 }, "SessionEnd")).toBe(0.5);
    const budget = ci.effectiveClaudeSessionEndBudgetSec([{ timeout: 8 }, { timeout: 0.5 }, {}]);
    expect(budget).toBe(8);
    expect(ci.effectiveClaudeHandlerTimeoutSec({}, "SessionEnd", budget)).toBe(8);
    expect(ci.effectiveClaudeHandlerTimeoutSec({ timeout: 0.5 }, "SessionEnd", budget)).toBe(0.5);
    expect(ci.effectiveClaudeHandlerTimeoutSec({}, "SessionEnd", 90)).toBe(90);
    expect(ci.effectiveClaudeHandlerTimeoutSec({ async: true, timeout: 2 })).toBe(Infinity);
    expect(ci.effectiveClaudeHandlerTimeoutSec({ asyncRewake: true, timeout: 2 })).toBe(2);
    expect(ci.effectiveClaudeHandlerTimeoutSec({ async: true, asyncRewake: true, timeout: 2 })).toBe(2);
    expect(ci.effectiveClaudeHandlerTimeoutSec({ type: "prompt", timeout: 9 })).toBe(9);
  });
});

describe("Codex reference updates", () => {
  test("Interrupt merges and ignores its matcher", () => {
    const merged = codex.mergeCodexHooksFiles([{ hooks: { Interrupt: [{ matcher: "never", hooks: [command] }] } }]);
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;
    const input = codex.ParseCodexHookInput({ hook_event_name: "Interrupt", turn_id: "t", permission_mode: "default" });
    expect(input.success).toBe(true);
    if (input.success) expect(codex.resolveMatchingCodexHandlersFromInput(merged.config, input.data)).toEqual([command]);
    expect(codex.effectiveCodexHandlerTimeoutSec({}, "Interrupt")).toBe(1);
    expect(codex.effectiveCodexHandlerTimeoutSec({ timeout: 0 }, "Interrupt")).toBe(1);
    expect(codex.effectiveCodexHandlerTimeoutSec({ timeout: 8 }, "Interrupt")).toBe(3);
    expect(codex.CodexInterruptStdoutSchema.parse({ systemMessage: "Saved", future: 1 })).toEqual({ systemMessage: "Saved", future: 1 });
    expect(codex.CodexHookEventNameWireSchema.safeParse("Interrupt").success).toBe(false);
  });
  test("MCP handlers resolve once through apply_patch aliases", () => {
    const config = codex.CodexHooksConfigSchema.parse({ PreToolUse: [{ matcher: "Edit|Write", hooks: [mcp] }] });
    const input = codex.ParseCodexHookInput({ hook_event_name: "PreToolUse", tool_name: "apply_patch", tool_input: { command: "patch" } });
    if (!input.success) throw input.error;
    expect(codex.resolveMatchingCodexHandlersFromInput(config, input.data)).toEqual([mcp]);
    expect(codex.CodexHooksConfigSchema.safeParse({ SessionEnd: [{ hooks: [mcp] }] }).success).toBe(false);
  });
  test("tool inputs accept general JSON while captured approval fields survive", () => {
    for (const tool_input of [null, "text", [1], { command: "audit", description: null }]) {
      expect(codex.ParseCodexHookInput({ hook_event_name: "PermissionRequest", tool_input, permission_input: { description: "capture" } }).success).toBe(true);
    }
    const parsed = codex.CodexPermissionRequestInputSchema.parse({ hook_event_name: "PermissionRequest", tool_input: { description: null }, permission_input: { description: "capture" } });
    expect(parsed.permission_input?.description).toBe("capture");
    expect(codex.CodexPreToolUseBashToolInputSchema.safeParse({ command: 2 }).success).toBe(false);
    expect(codex.CodexToolInputSchema.safeParse({ value: undefined }).success).toBe(false);
  });
});

describe("Copilot reference updates", () => {
  test("exec configuration is retained and shell forms remain valid", () => {
    expect(co.CopilotCommandHookHandlerSchema.parse({ exec: "checker", args: ["--check"] })).toEqual({ type: "command", exec: "checker", args: ["--check"] });
    expect(co.CopilotCommandHookHandlerSchema.parse({ bash: "audit" }).type).toBe("command");
    for (const field of ["bash", "powershell", "command"]) expect(co.CopilotCommandHookHandlerSchema.safeParse({ exec: "checker", [field]: "audit" }).success).toBe(false);
    expect(co.CopilotCommandHookHandlerSchema.safeParse({ command: "audit", args: [] }).success).toBe(false);
    const parsed = co.CopilotCommandHookHandlerSchema.parse({ command: "audit", timeout: 9 });
    expect(coi.effectiveCopilotHandlerTimeoutSec(parsed)).toBe(9);
    expect(coi.effectiveCopilotHandlerTimeoutSec({ timeout: 9, timeoutSec: 4 })).toBe(4);
  });
  test("successful replacement result passes without allowing malformed results", () => {
    const output = { modifiedResult: { resultType: "success", textResultForLlm: "redacted" }, additionalContext: "checked" };
    expect(co.ParseCopilotHookOutput(output).success).toBe(true);
    expect(co.CopilotPostToolUseStdoutSchema.safeParse({ modifiedResult: { resultType: "success" } }).success).toBe(false);
  });
  test("directory loading keeps valid siblings but inline settings stay strict", () => {
    const file = { version: 1, hooks: { preToolUse: [{ exec: "check" }, { type: "broken" }] } };
    const parsed = co.parseCopilotHooksDirectoryFile(file);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.file.hooks.preToolUse).toHaveLength(1);
      expect(parsed.diagnostics).toHaveLength(1);
    }
    expect(co.CopilotSettingsHooksFragmentSchema.safeParse({ hooks: file.hooks }).success).toBe(false);
    const merged = coi.mergeCopilotHooksDirectoryFiles([{ version: 1, hooks: { preToolUse: {} } }, file]);
    expect(merged.config.preToolUse).toHaveLength(1);
    expect(merged.diagnostics).toHaveLength(2);
  });
  test("progress lines are separate from the final multiline decision", () => {
    const parsed = co.parseCopilotHookStdout('{"type":"progress","message":"Checking","temporary":true}\n{\n"permissionDecision":"allow"\n}');
    expect(parsed.progress).toHaveLength(1);
    expect(parsed.result?.success).toBe(true);
    expect(co.parseCopilotHookStdout('{}\n{}').result).toBeUndefined();
    expect(co.ParseCopilotHookOutput({ type: "progress", message: "Checking" }).success).toBe(false);
  });
  test("HTTP syntax validation is separate from runtime transport policy", () => {
    expect(coi.copilotHttpHookUrlAllowed("https://hooks.example.com")).toBe(true);
    expect(coi.copilotHttpHookUrlAllowed("http://hooks.example.com", true)).toBe(false);
    expect(coi.copilotHttpHookUrlAllowed("http://localhost")).toBe(false);
    for (const host of ["localhost", "127.0.0.2", "[::1]"]) expect(coi.copilotHttpHookUrlAllowed(`http://${host}`, true)).toBe(true);
    expect(coi.copilotHttpHookUrlAllowed("http://localhost.example.com", true)).toBe(false);
  });
});

describe("Cursor reference updates", () => {
  test("nullable email and session-free workspace opening are accepted", () => {
    expect(cursor.ParseCursorHookInput({ hook_event_name: "sessionStart", user_email: null }).success).toBe(true);
    const payload = { hook_event_name: "workspaceOpen", workspace_roots: ["/workspace"], cursor_version: "audit", user_email: null };
    expect(cursor.ParseCursorHookInput(payload).success).toBe(true);
    expect(cursor.ParseCursorHookInput({ ...payload, workspace_roots: 3 }).success).toBe(false);
  });
  test("model metadata has real validation and preserves future fields", () => {
    expect(cursor.ParseCursorHookInput({ hook_event_name: "stop", model_id: "m", model_params: [{ id: "effort", value: "high", future: true }] }).success).toBe(true);
    expect(cursor.ParseCursorHookInput({ hook_event_name: "stop", model_params: [{ id: "effort", value: 9 }] }).success).toBe(false);
  });
  test("config supports command/prompt handlers and null loop limits", () => {
    const input = { version: 1, hooks: { stop: [{ command: "check", loop_limit: null, failClosed: true }], beforeShellExecution: [{ type: "prompt", prompt: "Check arguments", matcher: "curl|wget" }], workspaceOpen: [{ command: "load-plugins" }] } };
    const parsed = cursor.ParseCursorHooksFile(input);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.hooks.stop?.[0]?.loop_limit).toBeNull();
    expect(cursor.CursorCloudHooksFileSchema.safeParse(input).success).toBe(false);
    expect(cursor.CursorCloudHooksFileSchema.safeParse({ hooks: { stop: [{ command: "check" }] } }).success).toBe(true);
    expect(cursor.ParseCursorHooksFile({ hooks: { stop: [{ command: "check", matcher: {} }] } }).success).toBe(false);
  });
  test("stdout validation uses the event and cannot fall through to an empty schema", () => {
    expect(cursor.ParseCursorHookOutput("preToolUse", { permission: "allow", updated_input: { command: "audit" } }).success).toBe(true);
    expect(cursor.ParseCursorHookOutput("preToolUse", { permission: "invalid" }).success).toBe(false);
    expect(cursor.ParseCursorHookOutput("subagentStart", { permission: "ask" }).success).toBe(false);
    expect(cursor.ParseCursorHookOutput("postToolUse", { additional_context: "checked", updated_mcp_tool_output: {} }).success).toBe(true);
    expect(cursor.ParseCursorHookOutput("workspaceOpen", { pluginPaths: ["/plugins/checker"] }).success).toBe(true);
    expect(cursor.ParseCursorHookOutput("sessionEnd", { permission: "deny" }).success).toBe(false);
    expect(Object.keys(cursor.CursorHookOutputSchemas).sort()).toEqual([...cursor.CursorHookEventNameSchema.options].sort());
  });
});

describe("Antigravity and Gemini typing", () => {
  test("Antigravity validates post-tool metadata instead of accepting any toolCall", () => {
    expect(anti.AntigravityPostToolUseInputSchema.parse({ toolCall: { name: "run_command", args: {} }, future: true }).toolCall?.name).toBe("run_command");
    expect(anti.AntigravityPostToolUseInputSchema.safeParse({ toolCall: "bad" }).success).toBe(false);
  });
  test("Gemini model schemas retain extensions and validate stable fields", () => {
    const llm_request = { model: "gemini", messages: [{ role: "user", content: "hello" }], config: { temperature: 0.5, future: true } };
    expect(gemini.GeminiBeforeModelInputSchema.parse({ hook_event_name: "BeforeModel", llm_request }).llm_request?.messages?.[0]?.content).toBe("hello");
    expect(gemini.GeminiLlmRequestSchema.safeParse({ messages: [{ role: "user", content: 4 }] }).success).toBe(false);
    expect(gemini.GeminiLlmRequestSchema.parse({ toolConfig: { mode: "FUTURE" } }).toolConfig?.mode).toBe("FUTURE");
    expect(gemini.GeminiLlmResponseSchema.parse({ candidates: [{ content: { role: "model", parts: ["hello"] }, finishReason: "STOP" }], usageMetadata: { totalTokenCount: 20 } }).usageMetadata?.totalTokenCount).toBe(20);
    expect(gemini.GeminiHookCommandOutputSchema.safeParse({ hookSpecificOutput: { llm_request: { config: { temperature: 0 } }, clearContext: true } }).success).toBe(true);
  });
});
