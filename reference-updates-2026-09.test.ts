import { describe, expect, expectTypeOf, test } from "bun:test";
import * as claude from "./claude.ts";
import * as codex from "./codex.ts";
import * as copilot from "./copilot.ts";

describe("Claude September 21 reference contracts", () => {
  test("new stop output types keep their exact event discriminants", () => {
    expectTypeOf<claude.HookSpecificStopOutput["hookEventName"]>().toEqualTypeOf<"Stop">();
    expectTypeOf<claude.HookSpecificSubagentStopOutput["hookEventName"]>().toEqualTypeOf<"SubagentStop">();
  });

  test("accepts nullable compaction instructions and keeps future effort fields", () => {
    const input = {
      hook_event_name: "PreCompact", trigger: "manual", custom_instructions: null,
      prompt_id: "prompt-1", scratchpad_dir: "/tmp/scratch",
      effort: { level: "future-level", budget: 123 },
    };
    expect(claude.ParseHookInput(input)).toEqual({ success: true, data: input });
    expect(claude.PreCompactInputCrossAgentSchema.parse({ ...input, hook_event_name: "PreCompress" })).toMatchObject({ custom_instructions: null });
    expect(claude.ParseHookInput({ ...input, effort: { level: 1 } }).success).toBe(false);
  });

  test.each(["PreToolUse", "PermissionRequest", "PostToolUse", "PostToolUseFailure", "PermissionDenied"])(
    "%s preserves and validates MCP provenance", (event) => {
      const input = {
        hook_event_name: event, tool_name: "mcp__db__query", tool_input: { query: "SELECT 1" },
        mcp_server: { name: "db", source: "future-source", extension: true },
      };
      expect(claude.ParseHookInput(input)).toEqual({ success: true, data: input });
      expect(claude.ParseHookInput({ ...input, mcp_server: { name: "db", source: 1 } }).success).toBe(false);
    },
  );

  test("retains and validates session and prompt metadata", () => {
    const input = {
      hook_event_name: "SessionStart", source: "resume", session_title: "Review",
      seconds_since_last_response: 60, context_tokens: 100,
      prompt_cache_likely_expired: true, estimated_cache_write_usd: 0.01,
    };
    expect(claude.ParseHookInput(input)).toEqual({ success: true, data: input });
    expect(claude.ParseHookInput({ ...input, prompt_cache_likely_expired: "true" }).success).toBe(false);
    const prompt = { hook_event_name: "UserPromptSubmit", prompt: "Review", source: "poll_event", session_title: "Review" };
    expect(claude.ParseHookInput(prompt)).toEqual({ success: true, data: prompt });
    expect(claude.ParseHookInput({ ...prompt, source: 1 }).success).toBe(false);
  });

  test("types streamed display chunks without losing the old message field", () => {
    const input = {
      hook_event_name: "MessageDisplay", turn_id: "turn-1", message_id: "msg-1",
      index: 0, final: false, delta: "Hello", message_text: "Hello",
    };
    expect(claude.ParseHookInput(input)).toEqual({ success: true, data: input });
    expect(claude.ParseHookInput({ ...input, delta: [] }).success).toBe(false);
  });

  test.each(["Stop", "SubagentStop"])("%s carries background work and continuation context", (event) => {
    const input = {
      hook_event_name: event, stop_hook_active: false,
      background_tasks: [{ id: "task-1", type: "future-task", status: "running", description: "Review", extra: 1 }],
      session_crons: [{ id: "cron-1", schedule: "*/5 * * * *", recurring: true, prompt: "Check progress" }],
    };
    expect(claude.ParseHookInput(input)).toEqual({ success: true, data: input });
    expect(claude.ParseHookInput({ ...input, session_crons: [{ ...input.session_crons[0], recurring: "yes" }] }).success).toBe(false);
    const output = { hookSpecificOutput: { hookEventName: event, additionalContext: "Finish the review" } };
    expect(claude.HookCommandOutputSchema.parse(output)).toEqual(output);
    expect(claude.HookCommandOutputSchema.safeParse({ hookSpecificOutput: { hookEventName: event, additionalContext: 1 } }).success).toBe(false);
  });

  test("accepts batch responses as objects, strings, null, or absent", () => {
    for (const fields of [{}, { tool_response: null }, { tool_response: "done" }, { tool_response: { content: [] } }]) {
      const input = { hook_event_name: "PostToolBatch", tool_calls: [{ tool_name: "MCP", tool_use_id: "call-1", tool_input: {}, ...fields }] };
      expect(claude.ParseHookInput(input)).toEqual({ success: true, data: input });
    }
    const input = { hook_event_name: "PostToolUseFailure", error: "failed", duration_ms: 12 };
    expect(claude.ParseHookInput(input)).toEqual({ success: true, data: input });
    expect(claude.ParseHookInput({ ...input, duration_ms: "12" }).success).toBe(false);
  });

  test.each(["UserPromptSubmit", "UserPromptExpansion"])("%s preserves prompt suppression", (event) => {
    const output = { hookSpecificOutput: { hookEventName: event, suppressOriginalPrompt: true, additionalContext: "Review" } };
    expect(claude.HookCommandOutputSchema.parse(output)).toEqual(output);
  });

  test("accepts the documented prompt title and classifier output examples", () => {
    for (const specific of [
      { hookEventName: "UserPromptSubmit", sessionTitle: "Review" },
      { hookEventName: "PreToolUse", updatedInput: { command: "git status" } },
      { hookEventName: "PostToolUse", classifierContext: "Staging data", updatedToolOutput: { stdout: "redacted", stderr: "" } },
      { hookEventName: "PostToolUse", updatedToolOutput: ["MCP replacement"] },
    ] as const) {
      const output = { hookSpecificOutput: specific };
      expect(claude.HookCommandOutputSchema.parse(output)).toEqual(output);
    }
    expect(claude.HookSpecificPostToolUseOutputSchema.safeParse({ hookEventName: "PostToolUse", classifierContext: 1 }).success).toBe(false);
    // Claude additions must not weaken capture-backed Codex wire contracts.
    expect(codex.CodexPostToolUseCommandOutputWireSchema.safeParse({ hookSpecificOutput: { hookEventName: "PostToolUse", classifierContext: "Staging data" } }).success).toBe(false);
  });
});

describe("Copilot transformed prompts and matchers", () => {
  const base = { sessionId: "session-1", timestamp: 1789980000000, cwd: "/repo" };
  const command = { type: "command" as const, command: "review-prompt" };

  test("merges and resolves transformed prompt hooks separately from submitted prompts", () => {
    const input = { ...base, prompt: "Review", transformedPrompt: "Review with expanded context", future: true };
    const parsed = copilot.ParseCopilotHookInput(input);
    expect(parsed).toEqual({ success: true, data: input });
    if (!parsed.success) throw parsed.error;
    const merged = copilot.mergeCopilotHooksFiles([
      { version: 1, hooks: { userPromptTransformed: [command], userPromptSubmitted: [{ ...command, command: "submitted" }] } },
      { version: 1, hooks: { userPromptTransformed: [{ ...command, command: "second", matcher: "ignored" }] } },
    ]);
    if (!merged.ok) throw merged.error;
    expect(copilot.copilotEventNameFromInput(parsed.data)).toBe("userPromptTransformed");
    expect(copilot.resolveMatchingCopilotHandlersFromInput(merged.config, parsed.data)).toEqual([
      command, { ...command, command: "second", matcher: "ignored" },
    ]);
    expect(copilot.CopilotHookEventNameSchema.safeParse("UserPromptTransformed").success).toBe(false);
    expect(copilot.ParseCopilotHookInput({ ...input, transformedPrompt: 1 }).success).toBe(false);
    expect(copilot.ParseCopilotHookInput({ ...base, toolName: "bash", transformedPrompt: "missing prompt" }).success).toBe(false);
    expect(copilot.copilotEventNameFromInput({ ...base, toolName: "bash", transformedPrompt: 1 })).toBe("preToolUse");
  });

  test("validates nonempty prompt replacements without granting turn-control fields", () => {
    for (const [schema, field] of [
      [copilot.CopilotUserPromptSubmittedStdoutSchema, "modifiedPrompt"],
      [copilot.CopilotUserPromptTransformedStdoutSchema, "modifiedTransformedPrompt"],
    ] as const) {
      const output = { [field]: "Expanded context" };
      expect(schema.parse(output)).toEqual(output);
      expect(copilot.ParseCopilotHookOutput(output)).toEqual({ success: true, data: output });
      for (const value of ["", 1, null]) expect(copilot.ParseCopilotHookOutput({ [field]: value }).success).toBe(false);
      expect(schema.safeParse({ ...output, decision: "block" }).success).toBe(false);
      expect(schema.parse({})).toEqual({});
    }
  });

  test.each([
    [undefined, "bash", true], ["", "bash", true], ["*", "bash", true], ["**", "bash", true],
    ["Bash", "powershell", true], ["bash", "bash", true], ["Edit|Write", "apply_patch", true],
    ["Task", "task", true], ["Task", "Agent", true], ["Agent", "task", true],
    ["B.*", "powershell", true], ["b.*", "bash", false], ["Bash", "OtherBash", false],
    ["my_tool", "my_tool", true], ["[", "bash", false],
  ])("PascalCase PreToolUse matcher %s on %s: %s", (matcher, subject, matches) => {
    const handler = { ...command, matcher };
    expect(copilot.resolveMatchingCopilotHandlers({ PreToolUse: [handler] }, "PreToolUse", subject)).toEqual(matches ? [handler] : []);
  });

  test("native preToolUse keeps anchored regex semantics and postToolUse now filters", () => {
    expect(copilot.resolveMatchingCopilotHandlers({ preToolUse: [{ ...command, matcher: "*" }] }, "preToolUse", "bash")).toEqual([]);
    expect(copilot.resolveMatchingCopilotHandlers({ preToolUse: [{ ...command, matcher: "Bash" }] }, "preToolUse", "bash")).toEqual([]);
    for (const event of ["postToolUse", "PostToolUse"] as const) {
      const config = { [event]: [{ ...command, matcher: "bash" }] };
      const input = copilot.ParseCopilotHookInput({ ...base, toolName: "bash", toolResult: { resultType: "success", textResultForLlm: "done" } });
      if (!input.success) throw input.error;
      expect(copilot.resolveMatchingCopilotHandlersFromInput(config, input.data, event)).toHaveLength(1);
      expect(copilot.resolveMatchingCopilotHandlers(config, event, "otherbash")).toEqual([]);
    }
  });
});
