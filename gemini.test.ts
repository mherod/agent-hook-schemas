/// <reference types="bun" />
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";
import {
  type GeminiHookEventName,
  GeminiHookSpecificOutputSchema,
  GeminiHooksConfigSchema,
  GeminiMatcherGroupSchema,
  GeminiNotificationInputSchema,
  ParseGeminiHookInput,
  ParseGeminiHookOutput,
  geminiMatcherPatternCompiles,
} from "./gemini.ts";
import {
  effectiveGeminiHandlerTimeoutMs,
  geminiMatcherMatches,
  mergeGeminiHooksFiles,
  resolveMatchingGeminiHandlers,
  resolveMatchingGeminiHandlersFromInput,
} from "./gemini-hooks-integration.ts";

const GEMINI_HOOK_TMP = "/private/tmp";

function readGeminiHookSample(
  name: string,
  event: GeminiHookEventName,
): unknown | null {
  const p = `${GEMINI_HOOK_TMP}/${name}`;
  if (!existsSync(p)) return null;
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  if ((data as { hook_event_name?: unknown }).hook_event_name !== event) return null;
  return data;
}

const baseStdin = {
  session_id: "s1",
  transcript_path: "/tmp/t.json",
  cwd: "/proj",
  timestamp: "2026-04-02T12:00:00.000Z",
} as const;

describe("Gemini hooks (settings)", () => {
  test("GeminiMatcherGroupSchema accepts sequential + command hooks", () => {
    const r = GeminiMatcherGroupSchema.safeParse({
      matcher: "write_file|replace",
      sequential: true,
      hooks: [
        {
          name: "security-check",
          type: "command",
          command: "$GEMINI_PROJECT_DIR/.gemini/hooks/security.sh",
          timeout: 5000,
        },
      ],
    });
    expect(r.success).toBe(true);
  });

  test("GeminiHooksConfigSchema accepts partial events", () => {
    const r = GeminiHooksConfigSchema.safeParse({
      BeforeTool: [
        {
          matcher: "read_.*",
          hooks: [{ type: "command", command: "echo ok" }],
        },
      ],
    });
    expect(r.success).toBe(true);
  });

  test("GeminiMatcherGroupSchema rejects invalid RegExp sources", () => {
    expect(
      GeminiMatcherGroupSchema.safeParse({
        matcher: "(",
        hooks: [{ type: "command", command: "echo x" }],
      }).success,
    ).toBe(false);
    expect(
      GeminiMatcherGroupSchema.safeParse({
        matcher: "*",
        hooks: [{ type: "command", command: "echo x" }],
      }).success,
    ).toBe(true);
    expect(
      GeminiMatcherGroupSchema.safeParse({
        matcher: "",
        hooks: [{ type: "command", command: "echo x" }],
      }).success,
    ).toBe(true);
  });

  test("geminiMatcherPatternCompiles mirrors matcher rules", () => {
    expect(geminiMatcherPatternCompiles(undefined)).toBe(true);
    expect(geminiMatcherPatternCompiles("")).toBe(true);
    expect(geminiMatcherPatternCompiles("*")).toBe(true);
    expect(geminiMatcherPatternCompiles("startup")).toBe(true);
    expect(geminiMatcherPatternCompiles("write_file|replace")).toBe(true);
    expect(geminiMatcherPatternCompiles("(")).toBe(false);
  });
});

describe("Gemini hooks (merge + resolve)", () => {
  const cmd = (c: string, extra?: Partial<{ timeout: number }>) => ({
    type: "command" as const,
    command: c,
    ...extra,
  });

  test("mergeGeminiHooksFiles empty yields empty config", () => {
    const r = mergeGeminiHooksFiles([]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.config).toEqual({});
  });

  test("mergeGeminiHooksFiles appends matcher groups per event across layers", () => {
    const user = { hooks: { BeforeTool: [{ matcher: "read_.*", hooks: [cmd("a.sh")] }] } };
    const repo = { hooks: { BeforeTool: [{ hooks: [cmd("b.sh")] }] } };
    const r = mergeGeminiHooksFiles([user, repo]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.config.BeforeTool).toHaveLength(2);
      expect(r.config.BeforeTool?.[0]?.hooks[0]?.command).toBe("a.sh");
      expect(r.config.BeforeTool?.[1]?.hooks[0]?.command).toBe("b.sh");
    }
  });

  test("mergeGeminiHooksFiles rejects invalid layer", () => {
    const r = mergeGeminiHooksFiles([{ hooks: { BeforeTool: "bad" } }]);
    expect(r.ok).toBe(false);
  });

  test("geminiMatcherMatches: BeforeTool uses regex on tool name", () => {
    expect(geminiMatcherMatches("BeforeTool", "run_.*", "run_shell_command")).toBe(true);
    expect(geminiMatcherMatches("BeforeTool", "^read$", "read_file")).toBe(false);
  });

  test("geminiMatcherMatches: SessionStart uses exact string on source", () => {
    expect(geminiMatcherMatches("SessionStart", "startup", "startup")).toBe(true);
    expect(geminiMatcherMatches("SessionStart", "resume", "startup")).toBe(false);
    expect(geminiMatcherMatches("SessionStart", undefined, "anything")).toBe(true);
  });

  test("resolveMatchingGeminiHandlers preserves group order", () => {
    const config = GeminiHooksConfigSchema.parse({
      BeforeTool: [
        { matcher: "x", hooks: [cmd("first.sh")] },
        { hooks: [cmd("wildcard.sh")] },
      ],
    });
    const handlers = resolveMatchingGeminiHandlers(config, "BeforeTool", "x");
    expect(handlers.map((h) => h.command)).toEqual(["first.sh", "wildcard.sh"]);
  });

  test("resolveMatchingGeminiHandlersFromInput uses stdin-derived subject", () => {
    const parsed = ParseGeminiHookInput({
      ...baseStdin,
      hook_event_name: "BeforeTool",
      tool_name: "write_file",
      tool_input: {},
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const config = GeminiHooksConfigSchema.parse({
      BeforeTool: [{ matcher: "write_.*", hooks: [cmd("guard.sh")] }],
    });
    const handlers = resolveMatchingGeminiHandlersFromInput(config, parsed.data);
    expect(handlers).toHaveLength(1);
    expect(handlers[0]?.command).toBe("guard.sh");
  });

  test("effectiveGeminiHandlerTimeoutMs defaults to 60000", () => {
    expect(effectiveGeminiHandlerTimeoutMs({ type: "command", command: "x" })).toBe(60_000);
    expect(effectiveGeminiHandlerTimeoutMs({ type: "command", command: "x", timeout: 5000 })).toBe(5000);
  });
});

describe("Gemini hooks (stdin)", () => {
  test("SessionStart requires source", () => {
    const bad = ParseGeminiHookInput({ ...baseStdin, hook_event_name: "SessionStart" });
    expect(bad.success).toBe(false);
    const ok = ParseGeminiHookInput({
      ...baseStdin,
      hook_event_name: "SessionStart",
      source: "startup",
    });
    expect(ok.success).toBe(true);
  });

  test("SessionStart accepts Gemini CLI sample (paths + ISO timestamp)", () => {
    const r = ParseGeminiHookInput({
      session_id: "88888888-8888-4888-a888-888888888888",
      transcript_path:
        "/home/user/.gemini/tmp/example/chats/session-2026-04-03T05-59-88888888.json",
      cwd: "/home/user/workspace",
      hook_event_name: "SessionStart",
      timestamp: "2026-04-03T05:59:19.264Z",
      source: "startup",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.source).toBe("startup");
      expect(r.data.transcript_path).toContain(".gemini/tmp/");
    }
  });

  test("BeforeTool requires tool_name and tool_input object", () => {
    const ok = ParseGeminiHookInput({
      ...baseStdin,
      hook_event_name: "BeforeTool",
      tool_name: "run_shell_command",
      tool_input: { command: "ls" },
    });
    expect(ok.success).toBe(true);
    expect(
      ParseGeminiHookInput({
        ...baseStdin,
        hook_event_name: "BeforeTool",
        tool_name: "x",
        tool_input: [],
      }).success,
    ).toBe(false);
  });

  test("Notification allows ToolPermission and details object", () => {
    const r = GeminiNotificationInputSchema.safeParse({
      ...baseStdin,
      hook_event_name: "Notification",
      notification_type: "ToolPermission",
      message: "permission needed",
      details: { tool: "write_file" },
    });
    expect(r.success).toBe(true);
  });
});

describe("Gemini hooks (optional /private/tmp capture files)", () => {
  const samples: { file: string; event: GeminiHookEventName }[] = [
    { file: "hook-AfterAgent.json", event: "AfterAgent" },
    { file: "hook-BeforeAgent.json", event: "BeforeAgent" },
    { file: "hook-AfterTool.json", event: "AfterTool" },
    { file: "hook-BeforeTool.json", event: "BeforeTool" },
    { file: "hook-PreCompress.json", event: "PreCompress" },
    { file: "hook-sessionEnd.json", event: "SessionEnd" },
    { file: "hook-sessionStart.json", event: "SessionStart" },
  ];

  for (const { file, event } of samples) {
    const payload = readGeminiHookSample(file, event);
    test.skipIf(payload === null)(`parses ${file}`, () => {
      const r = ParseGeminiHookInput(payload);
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.hook_event_name).toBe(event);
    });
  }
});

describe("Gemini hooks (stdout)", () => {
  test("ParseGeminiHookOutput accepts decision + hookSpecificOutput", () => {
    const r = ParseGeminiHookOutput({
      decision: "deny",
      reason: "blocked",
      hookSpecificOutput: { tool_input: { command: "safe" } },
    });
    expect(r.success).toBe(true);
  });

  test("GeminiHookSpecificOutputSchema accepts shared PreToolUse branch", () => {
    const r = GeminiHookSpecificOutputSchema.safeParse({
      hookEventName: "PreToolUse",
      permissionDecision: "allow",
    });
    expect(r.success).toBe(true);
  });

  test("GeminiHookSpecificOutputSchema accepts extension-only tool_input", () => {
    const r = GeminiHookSpecificOutputSchema.safeParse({
      tool_input: { path: "/tmp/x" },
    });
    expect(r.success).toBe(true);
  });
});
