/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import {
  AntigravityHookEventNameSchema,
  AntigravityHooksFileSchema,
  AntigravityPreToolUseDecisionSchema,
  AntigravityPreToolUseStdoutSchema,
  AntigravityStopDecisionSchema,
  ParseAntigravityHookInput,
  ParseAntigravityHookOutput,
} from "./antigravity.ts";

describe("Antigravity hooks.json schema", () => {
  test("parses official example hooks.json structure", () => {
    const hooksJson = {
      "lint-checker": {
        PostToolUse: [
          {
            matcher: "run_command",
            hooks: [
              {
                type: "command",
                command: "./scripts/lint.sh",
                timeout: 10,
              },
            ],
          },
        ],
      },
      "safety-gate": {
        enabled: false,
        PreToolUse: [
          {
            matcher: "run_command",
            hooks: [
              {
                command: "./scripts/safety-check.sh",
              },
            ],
          },
        ],
      },
      reminder: {
        PreInvocation: [
          {
            type: "command",
            command: "./scripts/reminder.sh",
          },
        ],
      },
      postCheck: {
        PostInvocation: [
          {
            command: "./scripts/check-output.sh",
          },
        ],
      },
      stopGate: {
        Stop: [
          {
            command: "./scripts/guard-stop.sh",
            timeout: 15,
          },
        ],
      },
    };

    const parsed = AntigravityHooksFileSchema.safeParse(hooksJson);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data["lint-checker"]?.PostToolUse).toHaveLength(1);
    expect(parsed.data["safety-gate"]?.enabled).toBe(false);
    expect(parsed.data.reminder?.PreInvocation).toHaveLength(1);
    expect(parsed.data.stopGate?.Stop?.[0]?.timeout).toBe(15);
  });

  test("rejects flat array for PreToolUse (requires matcher group)", () => {
    const invalid = {
      badHook: {
        PreToolUse: [
          {
            command: "./scripts/bad.sh",
          },
        ],
      },
    };
    expect(AntigravityHooksFileSchema.safeParse(invalid).success).toBe(false);
  });

  test("rejects missing command in handler", () => {
    const invalid = {
      badHook: {
        Stop: [
          {
            timeout: 10,
          },
        ],
      },
    };
    expect(AntigravityHooksFileSchema.safeParse(invalid).success).toBe(false);
  });
});

describe("Antigravity hook stdin parsing", () => {
  const common = {
    conversationId: "ec33ebf9-0cba-4100-8142-c61503f6c587",
    workspacePaths: ["/workspace/project"],
    transcriptPath: "/workspace/project/.gemini/antigravity/transcript.jsonl",
    artifactDirectoryPath: "/workspace/project/.gemini/antigravity/artifacts",
    modelName: "auto",
  };

  test("PreToolUse stdin parses with toolCall and stepIdx", () => {
    const input = {
      ...common,
      toolCall: {
        name: "run_command",
        args: {
          CommandLine: "npm test",
        },
      },
      stepIdx: 19,
    };
    const parsed = ParseAntigravityHookInput("PreToolUse", input);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.toolCall?.name).toBe("run_command");
    expect(parsed.data.toolCall?.args?.CommandLine).toBe("npm test");
    expect(parsed.data.stepIdx).toBe(19);
    expect(parsed.data.conversationId).toBe(common.conversationId);
  });

  test("PostToolUse stdin parses with stepIdx and optional error", () => {
    const input = {
      ...common,
      stepIdx: 5,
      error: "exit status 1",
    };
    const parsed = ParseAntigravityHookInput("PostToolUse", input);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.stepIdx).toBe(5);
    expect(parsed.data.error).toBe("exit status 1");
  });

  test("PreInvocation and PostInvocation stdin parse with invocationNum and initialNumSteps", () => {
    const input = {
      ...common,
      invocationNum: 3,
      initialNumSteps: 10,
    };
    const pre = ParseAntigravityHookInput("PreInvocation", input);
    expect(pre.success).toBe(true);
    if (pre.success) {
      expect(pre.data.invocationNum).toBe(3);
      expect(pre.data.initialNumSteps).toBe(10);
    }

    const post = ParseAntigravityHookInput("PostInvocation", input);
    expect(post.success).toBe(true);
    if (post.success) {
      expect(post.data.invocationNum).toBe(3);
      expect(post.data.initialNumSteps).toBe(10);
    }
  });

  test("Stop stdin parses with executionNum, terminationReason, and fullyIdle", () => {
    const input = {
      ...common,
      executionNum: 1,
      terminationReason: "model_stop",
      error: "",
      fullyIdle: true,
    };
    const parsed = ParseAntigravityHookInput("Stop", input);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.executionNum).toBe(1);
    expect(parsed.data.terminationReason).toBe("model_stop");
    expect(parsed.data.fullyIdle).toBe(true);
  });

  test("preserves unknown keys in stdin for forward compatibility (.loose())", () => {
    const input = {
      ...common,
      futureField: "preserved",
      experimentalContext: { custom: 123 },
    };
    const parsed = ParseAntigravityHookInput("PreToolUse", input);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect((parsed.data as Record<string, unknown>).futureField).toBe("preserved");
    expect((parsed.data as Record<string, unknown>).experimentalContext).toEqual({
      custom: 123,
    });
  });
});

describe("Antigravity hook stdout parsing", () => {
  test("PreToolUse accepts all 5 documented decisions", () => {
    const decisions = [
      "allow",
      "deny",
      "ask",
      "force_ask",
      "deny_unless_prior_grant",
    ] as const;

    for (const d of decisions) {
      expect(AntigravityPreToolUseDecisionSchema.safeParse(d).success).toBe(true);
      const parsed = ParseAntigravityHookOutput("PreToolUse", {
        decision: d,
        reason: `Testing decision ${d}`,
        permissionOverrides: ["command(npm test)"],
        overwrite: { CommandLine: "ls -la" },
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.decision).toBe(d);
        expect(parsed.data.overwrite).toEqual({ CommandLine: "ls -la" });
      }
    }
  });

  test("PreToolUse rejects invalid decision values (e.g. Gemini/Codex decisions)", () => {
    expect(
      ParseAntigravityHookOutput("PreToolUse", { decision: "block" }).success,
    ).toBe(false);
    expect(
      ParseAntigravityHookOutput("PreToolUse", { decision: "approve" }).success,
    ).toBe(false);
  });

  test("PostToolUse accepts empty object output", () => {
    const parsed = ParseAntigravityHookOutput("PostToolUse", {});
    expect(parsed.success).toBe(true);
  });

  test("PreInvocation accepts injectSteps with ephemeralMessage and userMessage", () => {
    const parsed = ParseAntigravityHookOutput("PreInvocation", {
      injectSteps: [
        { ephemeralMessage: "Remember to check for lint errors." },
        { userMessage: "Please also test edge cases." },
        {
          toolCall: {
            name: "run_command",
            args: { CommandLine: "echo pre" },
          },
        },
      ],
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.injectSteps).toHaveLength(3);
    expect(parsed.data.injectSteps?.[0]?.ephemeralMessage).toBe(
      "Remember to check for lint errors.",
    );
  });

  test("PostInvocation accepts injectSteps and terminationBehavior", () => {
    const parsed = ParseAntigravityHookOutput("PostInvocation", {
      injectSteps: [],
      terminationBehavior: "force_continue",
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.terminationBehavior).toBe("force_continue");
  });

  test("Stop accepts continue decision and reason", () => {
    expect(AntigravityStopDecisionSchema.safeParse("continue").success).toBe(true);
    const parsed = ParseAntigravityHookOutput("Stop", {
      decision: "continue",
      reason: "The tests are still running in the background.",
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.decision).toBe("continue");
    expect(parsed.data.reason).toBe(
      "The tests are still running in the background.",
    );
  });
});
