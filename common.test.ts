/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { HookSpecificPreToolUseOutputSchema } from "./claude.ts";
import {
  appendHookEntriesByEvent,
  CommandHookHandlerSchema,
  createCodexCommandOutputSchema,
  defaultedTimeoutSec,
  HookHandlerCommonSchema,
  HookShellSchema,
  JsonObjectSchema,
  mergeHookConfigLayers,
  NullableStringDefaultSchema,
  NullableStringSchema,
  OptionalBooleanField,
  OptionalNumberField,
  OptionalStringField,
  OptionalToolNameField,
  parseSchemaResult,
  PreToolPermissionDecisionSchema,
  regexMatcherMatches,
  SharedCommandMatcherGroupSchema,
  SharedHookEventNameSchema,
  SharedHookSpecificOutputSchema,
  SharedHookSpecificPostToolUseOutputSchema,
  SharedHookSpecificPreToolUseOutputSchema,
  SharedHookSpecificSessionStartOutputSchema,
  SharedHookSpecificStopOutputSchema,
  SharedHookSpecificUserPromptSubmitOutputSchema,
  sharedHookSpecificAdditionalContextSchema,
  SharedHookStdoutCommonFieldsSchema,
  simpleGlobToRegExp,
  toCrossAgentInputSchema,
  ToolCallCoreSchema,
  ToolNameSchema,
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

  test("primitives and convenience schemas validate expected types", () => {
    expect(JsonObjectSchema.safeParse({ key: "value", num: 123 }).success).toBe(true);
    expect(JsonObjectSchema.safeParse("not an object").success).toBe(false);

    expect(NullableStringSchema.safeParse("hello").success).toBe(true);
    expect(NullableStringSchema.safeParse(null).success).toBe(true);
    expect(NullableStringSchema.safeParse(123).success).toBe(false);

    const nullDef = NullableStringDefaultSchema.safeParse(undefined);
    expect(nullDef.success).toBe(true);
    if (nullDef.success) expect(nullDef.data).toBeNull();

    expect(OptionalStringField.safeParse("test").success).toBe(true);
    expect(OptionalStringField.safeParse(undefined).success).toBe(true);
    expect(OptionalStringField.safeParse(123).success).toBe(false);

    expect(OptionalNumberField.safeParse(42).success).toBe(true);
    expect(OptionalNumberField.safeParse(undefined).success).toBe(true);
    expect(OptionalNumberField.safeParse("42").success).toBe(false);

    expect(OptionalBooleanField.safeParse(true).success).toBe(true);
    expect(OptionalBooleanField.safeParse(undefined).success).toBe(true);
    expect(OptionalBooleanField.safeParse("true").success).toBe(false);

    expect(ToolNameSchema.safeParse("Bash").success).toBe(true);
    expect(ToolNameSchema.safeParse(123).success).toBe(false);

    expect(OptionalToolNameField.safeParse("Read").success).toBe(true);
    expect(OptionalToolNameField.safeParse(undefined).success).toBe(true);
  });

  test("toCrossAgentInputSchema accepts cross-agent event names and unknown fields", () => {
    const base = z.object({
      hook_event_name: z.literal("PreCompact"),
      custom_instructions: z.string().optional(),
    });
    const crossAgent = toCrossAgentInputSchema(base);
    const parsed = crossAgent.safeParse({
      hook_event_name: "PreCompress", // Gemini equivalent
      custom_instructions: "compact summary",
      unknown_future_field: true,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.hook_event_name).toBe("PreCompress");
      expect(parsed.data.custom_instructions).toBe("compact summary");
      expect((parsed.data as Record<string, unknown>).unknown_future_field).toBe(true);
    }
  });

  test("PreToolPermissionDecisionSchema validates allow, deny, ask, defer", () => {
    const validDecisions = ["allow", "deny", "ask", "defer"] as const;
    for (const d of validDecisions) {
      expect(PreToolPermissionDecisionSchema.safeParse(d).success).toBe(true);
    }
    expect(PreToolPermissionDecisionSchema.safeParse("invalid").success).toBe(false);
  });

  test("createCodexCommandOutputSchema creates strict schema with defaults", () => {
    const schema = createCodexCommandOutputSchema(
      z.enum(["allow", "deny"]),
      SharedHookSpecificSessionStartOutputSchema,
    );
    const parsed = schema.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.continue).toBe(true);
      expect(parsed.data.suppressOutput).toBe(false);
      expect(parsed.data.decision).toBeNull();
      expect(parsed.data.hookSpecificOutput).toBeNull();
      expect(parsed.data.reason).toBeNull();
      expect(parsed.data.stopReason).toBeNull();
      expect(parsed.data.systemMessage).toBeNull();
    }
    // Rejects unknown keys due to strict wire format
    expect(schema.safeParse({ unknownKey: true }).success).toBe(false);
  });

  test("sharedHookSpecificAdditionalContextSchema returns context-only event schemas", () => {
    const sessionStart = sharedHookSpecificAdditionalContextSchema("SessionStart");
    expect(sessionStart).toBe(SharedHookSpecificSessionStartOutputSchema);

    const postTool = sharedHookSpecificAdditionalContextSchema("PostToolUse");
    expect(postTool).toBe(SharedHookSpecificPostToolUseOutputSchema);

    const userPrompt = sharedHookSpecificAdditionalContextSchema("UserPromptSubmit");
    expect(userPrompt).toBe(SharedHookSpecificUserPromptSubmitOutputSchema);

    const stop = sharedHookSpecificAdditionalContextSchema("Stop");
    expect(stop).toBe(SharedHookSpecificStopOutputSchema);
  });

  test("SharedHookStdoutCommonFieldsSchema validates common fields", () => {
    const parsed = SharedHookStdoutCommonFieldsSchema.safeParse({
      continue: false,
      stopReason: "user cancelled",
      systemMessage: "Task stopped",
      suppressOutput: true,
    });
    expect(parsed.success).toBe(true);
  });

  test("HookShellSchema, HookHandlerCommonSchema, and CommandHookHandlerSchema", () => {
    expect(HookShellSchema.safeParse("bash").success).toBe(true);
    expect(HookShellSchema.safeParse("powershell").success).toBe(true);
    expect(HookShellSchema.safeParse("sh").success).toBe(false);

    expect(
      HookHandlerCommonSchema.safeParse({
        if: "Bash(*)",
        timeout: 30,
        statusMessage: "Running guard",
        once: true,
      }).success,
    ).toBe(true);

    expect(
      CommandHookHandlerSchema.safeParse({
        type: "command",
        command: "./run.sh",
        args: ["--flag"],
        async: true,
        asyncRewake: false,
        shell: "bash",
        timeout: 60,
      }).success,
    ).toBe(true);
  });
});
