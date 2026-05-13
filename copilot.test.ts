/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import {
  CopilotAgentStopStdoutSchema,
  CopilotCommandHookHandlerSchema,
  CopilotHooksConfigSchema,
  CopilotHooksFileSchema,
  CopilotNotificationStdoutSchema,
  CopilotPermissionRequestStdoutSchema,
  CopilotPreToolUseStdoutSchema,
  ParseCopilotHookInput,
  ParseCopilotHookOutput,
} from "./copilot.ts";
import {
  copilotMatcherMatches,
  effectiveCopilotHandlerTimeoutSec,
  mergeCopilotHooksFiles,
  parseCopilotHooksFile,
  resolveMatchingCopilotHandlers,
  resolveMatchingCopilotHandlersFromInput,
} from "./copilot-hooks-integration.ts";

const command = (bash: string, extra?: Partial<{ matcher: string; timeoutSec: number }>) =>
  ({
    type: "command" as const,
    bash,
    ...extra,
  });

describe("Copilot hooks (config)", () => {
  test("accepts repository-level command hooks from the docs", () => {
    const r = CopilotHooksFileSchema.safeParse({
      version: 1,
      hooks: {
        sessionStart: [
          {
            type: "command",
            bash: 'echo "Session started: $(date)" >> logs/session.log',
            powershell:
              'Add-Content -Path logs/session.log -Value "Session started: $(Get-Date)"',
            cwd: ".",
            timeoutSec: 10,
          },
        ],
        userPromptSubmitted: [
          {
            type: "command",
            bash: "./scripts/log-prompt.sh",
            powershell: "./scripts/log-prompt.ps1",
            cwd: "scripts",
            env: { LOG_LEVEL: "INFO" },
          },
        ],
      },
    });
    expect(r.success).toBe(true);
  });

  test("accepts HTTP hooks and prompt hooks on sessionStart", () => {
    const r = CopilotHooksFileSchema.safeParse({
      version: 1,
      hooks: {
        postToolUse: [
          {
            type: "http",
            url: "https://hooks.example.com/copilot",
            headers: { "X-Source": "copilot-cli" },
            allowedEnvVars: ["GITHUB_TOKEN"],
            timeoutSec: 30,
          },
        ],
        sessionStart: [{ type: "prompt", prompt: "/status" }],
      },
    });
    expect(r.success).toBe(true);
  });

  test("requires command hooks to include bash, powershell, or command", () => {
    expect(CopilotCommandHookHandlerSchema.safeParse({ type: "command" }).success).toBe(false);
    expect(
      CopilotCommandHookHandlerSchema.safeParse({
        type: "command",
        command: "echo ok",
      }).success,
    ).toBe(true);
  });

  test("enforces prompt hook and permission-sensitive HTTP placement rules", () => {
    expect(
      CopilotHooksConfigSchema.safeParse({
        postToolUse: [{ type: "prompt", prompt: "not supported here" }],
      }).success,
    ).toBe(false);

    expect(
      CopilotHooksConfigSchema.safeParse({
        preToolUse: [{ type: "http", url: "http://hooks.example.com/copilot" }],
      }).success,
    ).toBe(false);

    expect(
      CopilotHooksConfigSchema.safeParse({
        preToolUse: [{ type: "http", url: "https://hooks.example.com/copilot" }],
      }).success,
    ).toBe(true);
  });

  test("rejects missing version on hook files", () => {
    expect(
      CopilotHooksFileSchema.safeParse({
        hooks: { sessionStart: [command("echo ok")] },
      }).success,
    ).toBe(false);
  });
});

describe("Copilot hooks (stdin)", () => {
  test("parses camelCase sessionStart input", () => {
    const r = ParseCopilotHookInput({
      sessionId: "s1",
      timestamp: 1704614400000,
      cwd: "/workspace",
      source: "startup",
      initialPrompt: "Run the test suite",
    });
    expect(r.success).toBe(true);
    if (r.success && "source" in r.data) {
      expect(r.data.source).toBe("startup");
    }
  });

  test("parses VS Code compatible PreToolUse input", () => {
    const r = ParseCopilotHookInput({
      hook_event_name: "PreToolUse",
      session_id: "s1",
      timestamp: "2026-05-13T12:00:00.000Z",
      cwd: "/workspace",
      tool_name: "bash",
      tool_input: { command: "bun test" },
    });
    expect(r.success).toBe(true);
    if (r.success && r.data.hook_event_name === "PreToolUse") {
      expect(r.data.tool_name).toBe("bash");
    }
  });

  test("parses postToolUse success and Stop compatible payloads", () => {
    const post = ParseCopilotHookInput({
      sessionId: "s1",
      timestamp: 1704614400000,
      cwd: "/workspace",
      toolName: "bash",
      toolArgs: { command: "bun test" },
      toolResult: {
        resultType: "success",
        textResultForLlm: "ok",
      },
    });
    expect(post.success).toBe(true);

    const stop = ParseCopilotHookInput({
      hook_event_name: "Stop",
      session_id: "s1",
      timestamp: "2026-05-13T12:00:00.000Z",
      cwd: "/workspace",
      transcript_path: "/workspace/.copilot/transcript.jsonl",
      stop_reason: "end_turn",
    });
    expect(stop.success).toBe(true);
  });

  test("parses notification and preCompact payloads", () => {
    expect(
      ParseCopilotHookInput({
        sessionId: "s1",
        timestamp: 1704614400000,
        cwd: "/workspace",
        hook_event_name: "Notification",
        message: "Agent idle",
        notification_type: "agent_idle",
      }).success,
    ).toBe(true);

    expect(
      ParseCopilotHookInput({
        hook_event_name: "PreCompact",
        session_id: "s1",
        timestamp: "2026-05-13T12:00:00.000Z",
        cwd: "/workspace",
        transcript_path: "/workspace/.copilot/transcript.jsonl",
        trigger: "auto",
        custom_instructions: "Keep API contracts",
      }).success,
    ).toBe(true);
  });
});

describe("Copilot hooks (stdout)", () => {
  test("preToolUse accepts allow/modifiedArgs and requires deny reason", () => {
    expect(
      CopilotPreToolUseStdoutSchema.safeParse({
        permissionDecision: "allow",
        modifiedArgs: { command: "bun test --concurrent" },
      }).success,
    ).toBe(true);

    expect(
      CopilotPreToolUseStdoutSchema.safeParse({
        permissionDecision: "deny",
      }).success,
    ).toBe(false);

    expect(
      CopilotPreToolUseStdoutSchema.safeParse({
        permissionDecision: "deny",
        permissionDecisionReason: "Destructive command blocked.",
      }).success,
    ).toBe(true);
  });

  test("agentStop block requires a reason", () => {
    expect(CopilotAgentStopStdoutSchema.safeParse({ decision: "allow" }).success).toBe(true);
    expect(CopilotAgentStopStdoutSchema.safeParse({ decision: "block" }).success).toBe(false);
    expect(
      CopilotAgentStopStdoutSchema.safeParse({
        decision: "block",
        reason: "Run one more validation pass.",
      }).success,
    ).toBe(true);
  });

  test("permissionRequest and additionalContext outputs", () => {
    expect(
      CopilotPermissionRequestStdoutSchema.safeParse({
        behavior: "deny",
        message: "Tool call denied by policy.",
        interrupt: true,
      }).success,
    ).toBe(true);

    expect(
      CopilotNotificationStdoutSchema.safeParse({
        additionalContext: "The background agent finished.",
      }).success,
    ).toBe(true);

    expect(ParseCopilotHookOutput({ additionalContext: "ok" }).success).toBe(true);
  });
});

describe("Copilot hooks (merge + resolve)", () => {
  test("mergeCopilotHooksFiles appends handlers and skips disabled files", () => {
    const r = mergeCopilotHooksFiles([
      {
        version: 1,
        hooks: { preToolUse: [command("user.sh", { matcher: "bash" })] },
      },
      {
        version: 1,
        disableAllHooks: true,
        hooks: { preToolUse: [command("disabled.sh")] },
      },
      {
        version: 1,
        hooks: { preToolUse: [command("repo.sh", { matcher: "grep|bash" })] },
      },
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.config.preToolUse?.map((h) => h.type === "command" ? h.bash : "")).toEqual([
      "user.sh",
      "repo.sh",
    ]);
  });

  test("matcher regex is anchored and invalid patterns fail closed", () => {
    expect(copilotMatcherMatches("bash", "bash")).toBe(true);
    expect(copilotMatcherMatches("ash", "bash")).toBe(false);
    expect(copilotMatcherMatches("grep|bash", "bash")).toBe(true);
    expect(copilotMatcherMatches("(", "bash")).toBe(false);
  });

  test("resolves matching handlers from parsed input", () => {
    const parsedFile = parseCopilotHooksFile({
      version: 1,
      hooks: {
        preToolUse: [
          command("bash.sh", { matcher: "bash" }),
          command("edit.sh", { matcher: "edit" }),
        ],
      },
    });
    expect(parsedFile.ok).toBe(true);
    if (!parsedFile.ok) return;

    const input = ParseCopilotHookInput({
      sessionId: "s1",
      timestamp: 1704614400000,
      cwd: "/workspace",
      toolName: "bash",
      toolArgs: { command: "bun test" },
    });
    expect(input.success).toBe(true);
    if (!input.success) return;

    const handlers = resolveMatchingCopilotHandlersFromInput(parsedFile.config, input.data);
    expect(handlers.map((h) => h.type === "command" ? h.bash : "")).toEqual(["bash.sh"]);
    expect(effectiveCopilotHandlerTimeoutSec(handlers[0]!)).toBe(30);
  });

  test("resolveMatchingCopilotHandlers ignores matcher on non-matcher events", () => {
    const config = CopilotHooksConfigSchema.parse({
      sessionEnd: [
        command("always.sh", { matcher: "does-not-match" }),
      ],
    });
    const handlers = resolveMatchingCopilotHandlers(config, "sessionEnd", "complete");
    expect(handlers).toHaveLength(1);
  });
});
