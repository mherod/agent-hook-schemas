/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import {
  HooksConfigSchema,
  ParseHookInput,
  type CommandHookHandler,
  type HookHandler,
} from "./claude.ts";
import {
  claudeMatcherMatches,
  claudePermissionRuleMatches,
  claudeResolutionContextFromInput,
  claudeToolIfMatches,
  effectiveClaudeHandlerTimeoutSec,
  evaluateSettingsPermissions,
  mergeClaudeHooksFiles,
  mergeClaudeSettings,
  parseClaudeSettings,
  parsePermissionRule,
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
      expect((r.config.PreToolUse?.[0]?.hooks[0] as CommandHookHandler | undefined)?.command).toBe("user.sh");
      expect((r.config.PreToolUse?.[1]?.hooks[0] as CommandHookHandler | undefined)?.command).toBe("proj.sh");
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
    expect(handlers.map((h) => (h as CommandHookHandler).command)).toEqual(["a.sh", "b.sh", "always.sh"]);
  });

  test("if excludes handler when command does not match", () => {
    const ctx = {
      subject: "Bash",
      toolName: "Bash",
      toolInput: { command: "ls" },
    };
    const handlers = resolveMatchingClaudeHandlers(config, "PreToolUse", ctx);
    expect(handlers.map((h) => (h as CommandHookHandler).command)).toEqual(["a.sh", "always.sh"]);
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
    expect((handlers[0] as CommandHookHandler | undefined)?.command).toBe("fmt.sh");
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
    expect(effectiveClaudeHandlerTimeoutSec(cmd("x"))).toBe(600);
  });

  test("respects explicit timeout", () => {
    expect(effectiveClaudeHandlerTimeoutSec(cmd("x", { timeout: 30 }))).toBe(30);
  });
});

describe("mergeClaudeHooksFiles with disableAllHooks", () => {
  test("disableAllHooks clears prior hooks", () => {
    const user = {
      hooks: { PreToolUse: [{ hooks: [cmd("user.sh")] }] },
    };
    const project = { disableAllHooks: true };
    const r = mergeClaudeHooksFiles([user, project]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.config).toEqual({});
  });

  test("hooks after disableAllHooks layer are kept", () => {
    const user = {
      hooks: { PreToolUse: [{ hooks: [cmd("user.sh")] }] },
    };
    const project = { disableAllHooks: true };
    const local = {
      hooks: { Stop: [{ hooks: [cmd("local.sh")] }] },
    };
    const r = mergeClaudeHooksFiles([user, project, local]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.config.PreToolUse).toBeUndefined();
      expect(r.config.Stop).toHaveLength(1);
    }
  });
});

describe("parsePermissionRule", () => {
  test("bare tool name", () => {
    expect(parsePermissionRule("Read")).toEqual({ toolName: "Read", pattern: undefined });
  });

  test("tool with glob", () => {
    expect(parsePermissionRule("Bash(git *)")).toEqual({ toolName: "Bash", pattern: "git *" });
  });

  test("tool with wildcard-only glob", () => {
    expect(parsePermissionRule("Edit(*)")).toEqual({ toolName: "Edit", pattern: "*" });
  });

  test("colon-separated pattern", () => {
    expect(parsePermissionRule("Bash(git status:*)")).toEqual({
      toolName: "Bash",
      pattern: "git status:*",
    });
  });

  test("empty string returns undefined", () => {
    expect(parsePermissionRule("")).toBeUndefined();
  });

  test("malformed parens returns undefined", () => {
    expect(parsePermissionRule("Bash(")).toBeUndefined();
  });
});

describe("claudePermissionRuleMatches", () => {
  test("bare rule matches any invocation of that tool", () => {
    expect(claudePermissionRuleMatches("Read", "Read", { file_path: "/any" })).toBe(true);
    expect(claudePermissionRuleMatches("Read", "Write", { file_path: "/any" })).toBe(false);
  });

  test("glob rule matches command pattern", () => {
    expect(
      claudePermissionRuleMatches("Bash(git *)", "Bash", { command: "git status" }),
    ).toBe(true);
    expect(
      claudePermissionRuleMatches("Bash(git *)", "Bash", { command: "rm -rf /" }),
    ).toBe(false);
  });

  test("Edit glob matches file_path", () => {
    expect(
      claudePermissionRuleMatches("Edit(*.ts)", "Edit", {
        file_path: "src/foo.ts",
        old_string: "a",
        new_string: "b",
      }),
    ).toBe(true);
    expect(
      claudePermissionRuleMatches("Edit(*.ts)", "Edit", {
        file_path: "src/foo.js",
        old_string: "a",
        new_string: "b",
      }),
    ).toBe(false);
  });
});

describe("evaluateSettingsPermissions", () => {
  test("undefined permissions returns undefined", () => {
    expect(evaluateSettingsPermissions(undefined, "Bash", { command: "ls" })).toBeUndefined();
  });

  test("deny takes precedence over allow", () => {
    const perms = {
      allow: ["Bash(git *)"],
      deny: ["Bash(git push *)"],
    };
    expect(evaluateSettingsPermissions(perms, "Bash", { command: "git push origin main" })).toBe(
      "deny",
    );
    expect(evaluateSettingsPermissions(perms, "Bash", { command: "git status" })).toBe("allow");
  });

  test("unmatched tool returns undefined", () => {
    const perms = { allow: ["Read"] };
    expect(evaluateSettingsPermissions(perms, "Write", { file_path: "/x" })).toBeUndefined();
  });
});

describe("mergeClaudeSettings", () => {
  test("merges hooks, permissions, and env across layers", () => {
    const user = {
      hooks: { PreToolUse: [{ hooks: [cmd("user.sh")] }] },
      permissions: { allow: ["Read"], deny: ["Bash(rm:*)"] },
      env: { FOO: "1" },
    };
    const project = {
      hooks: { PreToolUse: [{ hooks: [cmd("proj.sh")] }] },
      permissions: { allow: ["Edit(*.ts)"] },
      env: { FOO: "2", BAR: "3" },
    };
    const r = mergeClaudeSettings([user, project]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.settings.hooks.PreToolUse).toHaveLength(2);
    expect(r.settings.permissions.allow).toEqual(["Read", "Edit(*.ts)"]);
    expect(r.settings.permissions.deny).toEqual(["Bash(rm:*)"]);
    expect(r.settings.env).toEqual({ FOO: "2", BAR: "3" });
    expect(r.settings.disableAllHooks).toBe(false);
  });

  test("disableAllHooks in middle layer clears hooks", () => {
    const user = {
      hooks: { Stop: [{ hooks: [cmd("stop.sh")] }] },
    };
    const project = { disableAllHooks: true };
    const local = {
      hooks: { SessionStart: [{ hooks: [cmd("start.sh")] }] },
    };
    const r = mergeClaudeSettings([user, project, local]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.settings.hooks.Stop).toBeUndefined();
    expect(r.settings.hooks.SessionStart).toHaveLength(1);
    expect(r.settings.disableAllHooks).toBe(true);
  });

  test("rejects invalid layer with index", () => {
    const r = mergeClaudeSettings([{ hooks: { PreToolUse: "bad" } }]);
    expect(r.ok).toBe(false);
  });
});

describe("parseClaudeSettings", () => {
  test("validates a real-world settings.json shape", () => {
    const r = parseClaudeSettings({
      env: { ENABLE_EXPERIMENTAL_MCP_CLI: "true" },
      attribution: { commit: "", pr: "" },
      permissions: {
        allow: ["Read", "Bash(git status:*)"],
        deny: ["Bash(rm:*)"],
      },
      hooks: {
        Stop: [{ hooks: [cmd("hero.sh")] }],
      },
      defaultMode: "default",
      enabledPlugins: { "my-plugin": true },
      teammateMode: "tmux",
      voiceEnabled: true,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.settings.defaultMode).toBe("default");
    expect(r.settings.permissions?.allow).toEqual(["Read", "Bash(git status:*)"]);
    expect(r.settings.hooks?.Stop).toHaveLength(1);
    expect(r.settings.enabledPlugins?.["my-plugin"]).toBe(true);
  });

  test("rejects invalid permission mode", () => {
    const r = parseClaudeSettings({ defaultMode: "invalid_mode" });
    expect(r.ok).toBe(false);
  });

  test("allows unknown top-level keys via .loose()", () => {
    const r = parseClaudeSettings({ customKey: "value" });
    expect(r.ok).toBe(true);
  });
});
