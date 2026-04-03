/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import {
  HooksConfigSchema,
  ParseHookInput,
  type HookHandler,
} from "./claude.ts";
import {
  claudeMatcherMatches,
  claudeResolutionContextFromInput,
  claudeToolIfMatches,
  effectiveClaudeHandlerTimeoutSec,
  mergeClaudeHooksFiles,
  resolveMatchingClaudeHandlers,
  resolveMatchingClaudeHandlersFromInput,
} from "./claude-hooks-integration.ts";

const cmd = (command: string, extra?: Partial<HookHandler>): HookHandler =>
  ({
    type: "command",
    command,
    ...extra,
  }) as HookHandler;

describe("mergeClaudeHooksFiles", () => {
  test("empty list yields empty config", () => {
    const r = mergeClaudeHooksFiles([]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.config).toEqual({});
  });

  test("appends matcher groups per event across settings layers", () => {
    const user = {
      hooks: {
        PreToolUse: [{ matcher: "Bash", hooks: [cmd("user.sh")] }],
      },
    };
    const project = {
      hooks: {
        PreToolUse: [{ hooks: [cmd("proj.sh")] }],
      },
    };
    const r = mergeClaudeHooksFiles([user, project]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.config.PreToolUse).toHaveLength(2);
      expect(r.config.PreToolUse?.[0]?.hooks[0]?.command).toBe("user.sh");
      expect(r.config.PreToolUse?.[1]?.hooks[0]?.command).toBe("proj.sh");
    }
  });

  test("rejects invalid fragment with index", () => {
    const r = mergeClaudeHooksFiles([{ hooks: { PreToolUse: "nope" } }]);
    expect(r.ok).toBe(false);
  });
});

describe("claudeMatcherMatches", () => {
  test("wildcards", () => {
    expect(claudeMatcherMatches(undefined, "x")).toBe(true);
    expect(claudeMatcherMatches("", "x")).toBe(true);
    expect(claudeMatcherMatches("*", "x")).toBe(true);
  });

  test("regex on subject", () => {
    expect(claudeMatcherMatches("Bash|Read", "Bash")).toBe(true);
    expect(claudeMatcherMatches("^Bash$", "Bash")).toBe(true);
    expect(claudeMatcherMatches("Edit", "Bash")).toBe(false);
  });
});

describe("claudeToolIfMatches", () => {
  test("omitted if passes", () => {
    expect(claudeToolIfMatches("Bash", { command: "ls" }, undefined)).toBe(true);
  });

  test("Bash(git *) matches command glob", () => {
    expect(claudeToolIfMatches("Bash", { command: "git pull" }, "Bash(git *)")).toBe(true);
    expect(claudeToolIfMatches("Bash", { command: "rm -rf /" }, "Bash(git *)")).toBe(false);
  });

  test("wrong tool name fails", () => {
    expect(claudeToolIfMatches("Read", { file_path: "/x" }, "Bash(*)")).toBe(false);
  });

  test("Edit file_path glob", () => {
    expect(
      claudeToolIfMatches(
        "Edit",
        { file_path: "src/foo.ts", old_string: "a", new_string: "b" },
        "Edit(*.ts)",
      ),
    ).toBe(true);
    expect(
      claudeToolIfMatches(
        "Edit",
        { file_path: "src/foo.js", old_string: "a", new_string: "b" },
        "Edit(*.ts)",
      ),
    ).toBe(false);
  });
});

describe("resolveMatchingClaudeHandlers", () => {
  const config = HooksConfigSchema.parse({
    PreToolUse: [
      {
        matcher: "Bash",
        hooks: [cmd("a.sh"), cmd("b.sh", { if: "Bash(git *)" })],
      },
      { hooks: [cmd("always.sh")] },
    ],
  });

  test("matcher + if filter command handlers", () => {
    const ctx = {
      subject: "Bash",
      toolName: "Bash",
      toolInput: { command: "git status" },
    };
    const handlers = resolveMatchingClaudeHandlers(config, "PreToolUse", ctx);
    expect(handlers.map((h) => h.command)).toEqual(["a.sh", "b.sh", "always.sh"]);
  });

  test("if excludes handler when command does not match", () => {
    const ctx = {
      subject: "Bash",
      toolName: "Bash",
      toolInput: { command: "ls" },
    };
    const handlers = resolveMatchingClaudeHandlers(config, "PreToolUse", ctx);
    expect(handlers.map((h) => h.command)).toEqual(["a.sh", "always.sh"]);
  });

  test("if on handler without tool context fails closed", () => {
    const narrow = HooksConfigSchema.parse({
      SessionStart: [{ hooks: [cmd("bad.sh", { if: "Bash(*)" })] }],
    });
    const handlers = resolveMatchingClaudeHandlers(narrow, "SessionStart", {
      subject: "startup",
    });
    expect(handlers).toHaveLength(0);
  });
});

describe("resolveMatchingClaudeHandlersFromInput", () => {
  test("end-to-end with ParseHookInput", () => {
    const hooks = {
      PreToolUse: [{ matcher: "Write", hooks: [cmd("fmt.sh")] }],
    };
    const merged = mergeClaudeHooksFiles([{ hooks }]);
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;

    const stdin = ParseHookInput({
      session_id: "s",
      cwd: "/p",
      hook_event_name: "PreToolUse",
      tool_use_id: "t1",
      tool_name: "Write",
      tool_input: { file_path: "/tmp/x", content: "y" },
    });
    expect(stdin.success).toBe(true);
    if (!stdin.success) return;

    const handlers = resolveMatchingClaudeHandlersFromInput(merged.config, stdin.data);
    expect(handlers).toHaveLength(1);
    expect(handlers[0]?.command).toBe("fmt.sh");
  });
});

describe("claudeResolutionContextFromInput", () => {
  test("SessionStart uses source as subject", () => {
    const parsed = ParseHookInput({
      session_id: "s",
      cwd: "/",
      hook_event_name: "SessionStart",
      source: "resume",
      model: "opus",
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const ctx = claudeResolutionContextFromInput(parsed.data);
    expect(ctx.subject).toBe("resume");
    expect(ctx.toolName).toBeUndefined();
  });
});

describe("effectiveClaudeHandlerTimeoutSec", () => {
  test("defaults to 600", () => {
    expect(effectiveClaudeHandlerTimeoutSec({ type: "command", command: "x" })).toBe(600);
  });

  test("respects explicit timeout", () => {
    expect(effectiveClaudeHandlerTimeoutSec({ type: "http", url: "http://x", timeout: 30 })).toBe(
      30,
    );
  });
});
