/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { HookSpecificPreToolUseOutputSchema } from "./claude.ts";
import {
  appendHookEntriesByEvent,
  defaultedTimeoutSec,
  mergeHookConfigLayers,
  parseSchemaResult,
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

  test("parseSchemaResult returns keyed success and Zod errors", () => {
    const schema = z.object({ hooks: z.object({}).partial() });
    expect(parseSchemaResult(schema, { hooks: {} }, "settings")).toEqual({
      ok: true,
      settings: { hooks: {} },
    });

    const invalid = parseSchemaResult(schema, { hooks: "bad" }, "settings");
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.error).toBeInstanceOf(z.ZodError);
  });

  test("appendHookEntriesByEvent appends only known event entries", () => {
    type Event = "PreToolUse" | "Stop";
    type Entry = { command: string };
    const target: Partial<Record<Event, Entry[]>> = {
      PreToolUse: [{ command: "a" }],
    };

    appendHookEntriesByEvent(
      target,
      {
        PreToolUse: [{ command: "b" }],
        Stop: [{ command: "c" }],
      },
      ["PreToolUse", "Stop"],
    );

    expect(target).toEqual({
      PreToolUse: [{ command: "a" }, { command: "b" }],
      Stop: [{ command: "c" }],
    });
  });

  test("mergeHookConfigLayers validates files and supports reset/skip policies", () => {
    const layerSchema = z.object({
      reset: z.boolean().optional(),
      skip: z.boolean().optional(),
      hooks: z
        .object({
          Stop: z.array(z.object({ command: z.string() })).optional(),
        })
        .optional(),
    });

    const result = mergeHookConfigLayers<"Stop", { command: string }, typeof layerSchema>({
      files: [
        { hooks: { Stop: [{ command: "a" }] } },
        { reset: true, hooks: { Stop: [{ command: "b" }] } },
        { skip: true, hooks: { Stop: [{ command: "ignored" }] } },
        { hooks: { Stop: [{ command: "c" }] } },
      ],
      schema: layerSchema,
      events: ["Stop"],
      getHooks: (layer) => layer.hooks,
      shouldReset: (layer) => layer.reset === true,
      shouldSkip: (layer) => layer.skip === true,
    });

    expect(result).toEqual({
      ok: true,
      config: { Stop: [{ command: "b" }, { command: "c" }] },
    });

    const invalid = mergeHookConfigLayers<"Stop", { command: string }, typeof layerSchema>({
      files: [{ hooks: { Stop: "bad" } }],
      schema: layerSchema,
      events: ["Stop"],
      getHooks: (layer) => layer.hooks,
    });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.index).toBe(0);
  });
});
