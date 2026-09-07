import { describe, expect, test } from "bun:test";
import {
  CopilotHookEventNameSchema, CopilotHookEventInputSchema, CopilotHooksConfigSchema,
  CopilotHttpHookHandlerSchema, ParseCopilotHookOutput,
} from "./copilot.ts";
import {
  mergeCopilotHooksFiles, mergeCopilotHooksDirectoryFiles, parseCopilotHooksFile,
  copilotEventNameFromInput, copilotResolutionSubjectFromInput,
  resolveMatchingCopilotHandlersFromInput, copilotHttpHookUrlAllowed,
} from "./copilot-hooks-integration.ts";

const cmd = (command: string) => ({ type: "command" as const, command });

describe("Copilot config loading", () => {
  test("valid layers append in order; disabled layers do not clear earlier hooks", () => {
    const layers = [
      { version: 1, hooks: { sessionStart: [cmd("first")] } },
      { version: 1, disableAllHooks: true, hooks: { sessionStart: [cmd("skip")] } },
      { version: 1, hooks: { sessionStart: [cmd("last")] } },
    ];
    const snapshot = structuredClone(layers);
    expect(mergeCopilotHooksFiles(layers)).toEqual({ ok: true, config: { sessionStart: [cmd("first"), cmd("last")] } });
    expect(layers).toEqual(snapshot);
    expect(parseCopilotHooksFile(layers[1])).toEqual({ ok: true, config: {} });
    expect(parseCopilotHooksFile(null).ok).toBe(false);
  });

  test("directory loading retains valid files and pinpoints malformed files and entries", () => {
    const result = mergeCopilotHooksDirectoryFiles([
      { version: 2, hooks: {} },
      { version: 1, hooks: { sessionStart: [cmd("valid"), { type: "command" }] } },
      { version: 1, hooks: { sessionStart: [cmd("last")] } },
    ]);
    expect(result.config).toEqual({ sessionStart: [cmd("valid"), cmd("last")] });
    expect(result.diagnostics).toHaveLength(2);
    expect(result.diagnostics[0]).toMatchObject({ fileIndex: 0 });
    expect(result.diagnostics[1]).toMatchObject({ fileIndex: 1, event: "sessionStart", index: 1 });
  });

  test("rejects insecure permission hooks and environment forwarding", () => {
    expect(CopilotHttpHookHandlerSchema.safeParse({ type: "http", url: "http://localhost/hook", allowedEnvVars: ["TOKEN"] }).success).toBe(false);
    for (const event of ["PreToolUse", "preToolUse", "PermissionRequest", "permissionRequest"]) {
      expect(CopilotHooksConfigSchema.safeParse({ [event]: [{ type: "http", url: "http://localhost/hook" }] }).success).toBe(false);
    }
    expect(CopilotHooksConfigSchema.safeParse({ sessionStart: [{ ...cmd("run"), matcher: "ignored" }] }).success).toBe(true);
    expect(ParseCopilotHookOutput({ additionalContext: "Loaded" }).success).toBe(true);
    expect(ParseCopilotHookOutput(null).success).toBe(false);
  });

  test.each([
    ["https://example.com/hook", false, true], ["http://example.com/hook", true, false],
    ["http://localhost/hook", false, false], ["http://localhost/hook", true, true],
    ["http://127.0.0.2/hook", true, true], ["http://[::1]/hook", true, true],
    ["http://localhost.example.com/hook", true, false], ["file:///tmp/hook", true, false],
    ["not a URL", true, false],
  ])("applies transport policy to %s (localhost opt-in: %s)", (url, allow, expected) => {
    expect(copilotHttpHookUrlAllowed(url, allow)).toBe(expected);
  });
});

describe("Copilot stdin event resolution", () => {
  const base = { sessionId: "session-1", timestamp: 1, cwd: "/repo" };
  const cases = [
    ["sessionStart", { source: "startup", initialPrompt: "hello" }],
    ["sessionEnd", { reason: "complete" }],
    ["userPromptSubmitted", { prompt: "hello" }],
    ["preToolUse", { toolName: "bash", toolArgs: {} }],
    ["postToolUse", { toolName: "bash", toolArgs: {}, toolResult: { resultType: "success", textResultForLlm: "done" } }],
    ["postToolUseFailure", { toolName: "bash", toolArgs: {}, error: "failed" }],
    ["agentStop", { transcriptPath: "/log", stopReason: "complete" }],
    ["subagentStart", { transcriptPath: "/log", agentName: "reviewer" }],
    ["subagentStop", { transcriptPath: "/log", agentName: "reviewer", stopReason: "complete" }],
    ["preCompact", { transcriptPath: "/log", trigger: "auto", customInstructions: "summarize" }],
    ["errorOccurred", { error: { message: "failed", name: "Error" }, errorContext: "model_call", recoverable: true }],
  ] as const;

  test.each(cases)("infers %s and resolves its handlers", (event, fields) => {
    const input = CopilotHookEventInputSchema.parse({ ...base, ...fields });
    expect(copilotEventNameFromInput(input)).toBe(event);
    expect(resolveMatchingCopilotHandlersFromInput({ [event]: [cmd("run")] }, input)).toEqual([cmd("run")]);
  });

  test("explicit event names take precedence over structural inference", () => {
    for (const event of CopilotHookEventNameSchema.options) {
      const input = CopilotHookEventInputSchema.parse({ ...base, hook_event_name: event, toolName: "bash" });
      expect(copilotEventNameFromInput(input)).toBe(event);
    }
    const future = CopilotHookEventInputSchema.parse({ ...base, hook_event_name: "FutureEvent", toolName: "bash" });
    expect(copilotEventNameFromInput(future)).toBe("preToolUse");
    // Exercise the defensive fallback for an untyped caller's future event.
    // @ts-expect-error Unknown events are outside the supported input union.
    expect(copilotEventNameFromInput({ hook_event_name: "FutureEvent" })).toBeUndefined();
    // @ts-expect-error Unknown events are outside the supported input union.
    expect(resolveMatchingCopilotHandlersFromInput({}, { hook_event_name: "FutureEvent" })).toEqual([]);
  });

  test.each([
    ["Notification", { notification_type: "permission_prompt" }, "permission_prompt"],
    ["notification", { notification_type: "idle" }, "idle"],
    ["PermissionRequest", { tool_name: "Bash" }, "Bash"],
    ["permissionRequest", { toolName: "bash", tool_name: "ignored" }, "bash"],
    ["PreCompact", { trigger: "auto" }, "auto"],
    ["preCompact", {}, ""],
    ["SubagentStart", { agent_name: "reviewer" }, "reviewer"],
    ["subagentStart", { agentName: "reviewer" }, "reviewer"],
    ["Stop", {}, ""],
  ] as const)("extracts the matcher subject for %s", (event, fields, expected) => {
    const input = { ...base, source: "startup", hook_event_name: event, ...fields };
    expect(copilotResolutionSubjectFromInput(event, input)).toBe(expected);
  });

  test("permission request override resolves ambiguous tool-shaped input", () => {
    const input = CopilotHookEventInputSchema.parse({ ...base, toolName: "bash", toolArgs: {} });
    const config = { preToolUse: [cmd("pre")], permissionRequest: [{ ...cmd("permission"), matcher: "bash" }] };
    expect(resolveMatchingCopilotHandlersFromInput(config, input, "permissionRequest")).toEqual(config.permissionRequest);
  });
});
