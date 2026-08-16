/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import {
  antigravityMatcherMatches,
  effectiveAntigravityHandlerTimeoutSec,
  mergeAntigravityHooksFiles,
  parseAntigravityHooksFile,
  resolveMatchingAntigravityHandlers,
} from "./antigravity-hooks-integration.ts";

describe("antigravityMatcherMatches", () => {
  test("wildcards match any tool", () => {
    expect(antigravityMatcherMatches(undefined, "run_command")).toBe(true);
    expect(antigravityMatcherMatches("", "run_command")).toBe(true);
    expect(antigravityMatcherMatches("*", "run_command")).toBe(true);
  });

  test("exact matches and regex alternation match expected tools", () => {
    expect(antigravityMatcherMatches("run_command", "run_command")).toBe(true);
    expect(antigravityMatcherMatches("run_command", "view_file")).toBe(false);
    expect(
      antigravityMatcherMatches("run_command|view_file", "run_command"),
    ).toBe(true);
    expect(
      antigravityMatcherMatches("run_command|view_file", "view_file"),
    ).toBe(true);
    expect(
      antigravityMatcherMatches("run_command|view_file", "edit_file"),
    ).toBe(false);
    expect(antigravityMatcherMatches("browser_.*", "browser_click")).toBe(true);
    expect(antigravityMatcherMatches("browser_.*", "run_command")).toBe(false);
  });
});

describe("mergeAntigravityHooksFiles and resolveMatchingAntigravityHandlers", () => {
  test("merges multiple hooks.json layers and preserves enabled states", () => {
    const workspaceHooks = {
      "security-checker": {
        PreToolUse: [
          {
            matcher: "run_command",
            hooks: [{ command: "./scripts/sec-check.sh" }],
          },
        ],
      },
      "stop-guard": {
        enabled: false,
        Stop: [{ command: "./scripts/stop.sh" }],
      },
    };

    const pluginHooks = {
      "security-checker": {
        PreToolUse: [
          {
            matcher: "run_command",
            hooks: [{ command: "./plugins/sec-plugin.sh", timeout: 45 }],
          },
        ],
      },
      "reminder-hook": {
        PreInvocation: [{ command: "./plugins/reminder.sh" }],
      },
    };

    const mergeResult = mergeAntigravityHooksFiles([
      workspaceHooks,
      pluginHooks,
    ]);
    expect(mergeResult.ok).toBe(true);
    if (!mergeResult.ok) return;

    // Resolve PreToolUse for run_command: should include both handlers from security-checker
    const toolHandlers = resolveMatchingAntigravityHandlers(
      mergeResult.hooks,
      "PreToolUse",
      "run_command",
    );
    expect(toolHandlers).toHaveLength(2);
    expect(toolHandlers[0]?.command).toBe("./scripts/sec-check.sh");
    expect(toolHandlers[1]?.command).toBe("./plugins/sec-plugin.sh");
    expect(effectiveAntigravityHandlerTimeoutSec(toolHandlers[1]!)).toBe(45);

    // Resolve PreToolUse for view_file: none match
    expect(
      resolveMatchingAntigravityHandlers(
        mergeResult.hooks,
        "PreToolUse",
        "view_file",
      ),
    ).toHaveLength(0);

    // Resolve PreInvocation: should find reminder-hook
    const invocationHandlers = resolveMatchingAntigravityHandlers(
      mergeResult.hooks,
      "PreInvocation",
    );
    expect(invocationHandlers).toHaveLength(1);
    expect(invocationHandlers[0]?.command).toBe("./plugins/reminder.sh");

    // Resolve Stop: stop-guard is disabled (enabled: false)
    const stopHandlers = resolveMatchingAntigravityHandlers(
      mergeResult.hooks,
      "Stop",
    );
    expect(stopHandlers).toHaveLength(0);
  });

  test("mergeAntigravityHooksFiles returns index and error for invalid layer", () => {
    const invalid = { bad: { PreToolUse: "not an array" } };
    const r = mergeAntigravityHooksFiles([{}, invalid]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.index).toBe(1);
    }
  });

  test("effectiveAntigravityHandlerTimeoutSec defaults to 30s", () => {
    expect(
      effectiveAntigravityHandlerTimeoutSec({ command: "./run.sh" }),
    ).toBe(30);
    expect(
      effectiveAntigravityHandlerTimeoutSec({
        command: "./run.sh",
        timeout: 10,
      }),
    ).toBe(10);
  });
});
