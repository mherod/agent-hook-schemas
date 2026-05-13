/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { HookSpecificPreToolUseOutputSchema } from "./claude.ts";
import {
  defaultedTimeoutSec,
  regexMatcherMatches,
  SharedCommandMatcherGroupSchema,
  SharedHookEventNameSchema,
  SharedHookSpecificOutputSchema,
  SharedHookSpecificPreToolUseOutputSchema,
  simpleGlobToRegExp,
  ToolCallCoreSchema,
} from "./common.ts";

describe("agent-hook-schemas/common", () => {
  test("SharedHookEventNameSchema is intersection of Claude and Codex event sets", () => {
    expect(SharedHookEventNameSchema.safeParse("PreToolUse").success).toBe(true);
    expect(SharedHookEventNameSchema.safeParse("Stop").success).toBe(true);
    expect(SharedHookEventNameSchema.safeParse("PermissionRequest").success).toBe(false);
    expect(SharedHookEventNameSchema.safeParse("InstructionsLoaded").success).toBe(false);
  });

  test("ToolCallCoreSchema matches Claude and Codex tool-shaped stdin", () => {
    const ok = ToolCallCoreSchema.safeParse({
      tool_name: "Bash",
      tool_input: { command: "echo hi" },
    });
    expect(ok.success).toBe(true);
    expect(ToolCallCoreSchema.safeParse({ tool_name: "Bash", tool_input: [] }).success).toBe(false);
  });

  test("SharedHookSpecificPreToolUseOutputSchema is identical to HookSpecificPreToolUseOutputSchema", () => {
    expect(SharedHookSpecificPreToolUseOutputSchema).toBe(HookSpecificPreToolUseOutputSchema);
  });

  test("SharedCommandMatcherGroupSchema accepts command-only matcher groups", () => {
    const r = SharedCommandMatcherGroupSchema.safeParse({
      matcher: "Bash",
      hooks: [{ type: "command", command: "echo ok" }],
    });
    expect(r.success).toBe(true);
  });

  test("SharedHookSpecificOutputSchema discriminates on hookEventName", () => {
    const pre = SharedHookSpecificOutputSchema.safeParse({
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "nope",
    });
    expect(pre.success).toBe(true);
    const session = SharedHookSpecificOutputSchema.safeParse({
      hookEventName: "SessionStart",
      additionalContext: "ctx",
    });
    expect(session.success).toBe(true);
    expect(
      SharedHookSpecificOutputSchema.safeParse({
        hookEventName: "SessionStart",
        permissionDecision: "allow",
      }).success,
    ).toBe(false);
  });

  test("SharedHookSpecificPostToolUseOutputSchema allows optional updatedMCPToolOutput", () => {
    const r = SharedHookSpecificOutputSchema.safeParse({
      hookEventName: "PostToolUse",
      additionalContext: "after edit",
      updatedMCPToolOutput: { x: 1 },
    });
    expect(r.success).toBe(true);
  });

  test("regexMatcherMatches supports wildcard and invalid-regex fail-closed behavior", () => {
    expect(regexMatcherMatches(undefined, "Bash")).toBe(true);
    expect(regexMatcherMatches("", "Bash")).toBe(true);
    expect(regexMatcherMatches("*", "Bash")).toBe(true);
    expect(regexMatcherMatches("Bash|Read", "Read")).toBe(true);
    expect(regexMatcherMatches("[unclosed", "Read")).toBe(false);
  });

  test("regexMatcherMatches supports anchored non-wildcard semantics", () => {
    expect(regexMatcherMatches(undefined, "bash", { wildcard: false, anchored: true })).toBe(true);
    expect(regexMatcherMatches("bash", "bash", { wildcard: false, anchored: true })).toBe(true);
    expect(regexMatcherMatches("ash", "bash", { wildcard: false, anchored: true })).toBe(false);
    expect(regexMatcherMatches("*", "bash", { wildcard: false, anchored: true })).toBe(false);
  });

  test("simpleGlobToRegExp anchors glob matching and escapes regex metacharacters", () => {
    expect(simpleGlobToRegExp("git *").test("git status")).toBe(true);
    expect(simpleGlobToRegExp("*.ts").test("index.ts")).toBe(true);
    expect(simpleGlobToRegExp("*.ts").test("index.tsx")).toBe(false);
    expect(simpleGlobToRegExp("file?.ts").test("file1.ts")).toBe(true);
    expect(simpleGlobToRegExp("a+b.ts").test("a+b.ts")).toBe(true);
  });

  test("defaultedTimeoutSec returns explicit timeout or platform default", () => {
    expect(defaultedTimeoutSec(5, 600)).toBe(5);
    expect(defaultedTimeoutSec(undefined, 30)).toBe(30);
  });
});
