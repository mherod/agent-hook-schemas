import { describe, expect, test } from "bun:test";
import { ParseGeminiHookInput, type GeminiHookEventName } from "./gemini.ts";
import {
  mergeGeminiHooksFiles, parseGeminiSettings, geminiMatcherMatches,
  resolveMatchingGeminiHandlers, resolveMatchingGeminiHandlersFromInput,
  resolveMatchingGeminiHandlerGroups, effectiveGeminiHandlerTimeoutMs,
} from "./gemini-hooks-integration.ts";

const command = (name: string) => ({ type: "command" as const, command: name });

describe("Gemini settings integration", () => {
  test("merges layers in order without changing the input and reports invalid layer indexes", () => {
    const layers = [{ hooks: { BeforeTool: [{ hooks: [command("first")] }] } }, {},
      { hooks: { BeforeTool: [{ matcher: "read_file", hooks: [command("last")] }] } }];
    const snapshot = structuredClone(layers);
    const result = mergeGeminiHooksFiles(layers);
    expect(result.ok).toBe(true);
    if (!result.ok) throw result.error;
    expect(resolveMatchingGeminiHandlers(result.config, "BeforeTool", "read_file")).toEqual([command("first"), command("last")]);
    expect(layers).toEqual(snapshot);
    expect(mergeGeminiHooksFiles([])).toEqual({ ok: true, config: {} });
    expect(mergeGeminiHooksFiles([{}, { hooks: { BeforeTool: "bad" } }])).toMatchObject({ ok: false, index: 1 });
  });

  test("sequential groups retain order and skip non-matching groups", () => {
    const config = { BeforeTool: [
      { matcher: "write_file", hooks: [command("skip")] },
      { matcher: "read_file", sequential: true, hooks: [command("a"), command("b")] },
      { hooks: [command("c")] },
    ] };
    expect(resolveMatchingGeminiHandlerGroups(config, "BeforeTool", "read_file")).toEqual([
      { sequential: true, handlers: [command("a"), command("b")] },
      { sequential: false, handlers: [command("c")] },
    ]);
    expect(resolveMatchingGeminiHandlerGroups({}, "BeforeTool", "read_file")).toEqual([]);
  });

  const subjects: [GeminiHookEventName, Record<string, string>, string][] = [
    ["SessionStart", { source: "startup" }, "startup"],
    ["SessionEnd", { reason: "exit" }, "exit"],
    ["BeforeAgent", { prompt: "Review" }, "Review"],
    ["AfterAgent", { prompt: "Review" }, "Review"],
    ["BeforeTool", { tool_name: "read_file" }, "read_file"],
    ["AfterTool", { tool_name: "read_file" }, "read_file"],
    ["PreCompress", { trigger: "auto" }, "auto"],
    ["Notification", { notification_type: "permission_prompt" }, "permission_prompt"],
    ["BeforeModel", {}, ""], ["AfterModel", {}, ""], ["BeforeToolSelection", {}, ""],
  ];
  test.each(subjects)("resolves %s from parsed stdin", (event, fields, subject) => {
    const parsed = ParseGeminiHookInput({ hook_event_name: event, ...fields });
    expect(parsed.success).toBe(true);
    if (!parsed.success) throw parsed.error;
    expect(resolveMatchingGeminiHandlersFromInput({ [event]: [{ matcher: subject, hooks: [command("run")] }] }, parsed.data)).toEqual([command("run")]);
    expect(resolveMatchingGeminiHandlersFromInput({ [event]: [{ matcher: "never-match", hooks: [command("skip")] }] }, parsed.data)).toEqual([]);
  });

  test("unknown events resolve safely and malformed settings return errors", () => {
    const parsed = ParseGeminiHookInput({ hook_event_name: "FutureEvent" });
    if (!parsed.success) throw parsed.error;
    expect(resolveMatchingGeminiHandlersFromInput({}, parsed.data)).toEqual([]);
    expect(parseGeminiSettings({ future: true })).toEqual({ ok: true, settings: { future: true } });
    expect(parseGeminiSettings({ hooks: [] }).ok).toBe(false);
  });

  test("lifecycle matchers are literal, tool matchers are regexes, and timeouts use milliseconds", () => {
    expect(geminiMatcherMatches("SessionStart", "startup|resume", "startup")).toBe(false);
    expect(geminiMatcherMatches("BeforeTool", "^read_", "read_file")).toBe(true);
    expect(geminiMatcherMatches("BeforeTool", "[", "read_file")).toBe(false);
    for (const matcher of [undefined, "", "*"]) expect(geminiMatcherMatches("BeforeTool", matcher, "read_file")).toBe(true);
    expect(effectiveGeminiHandlerTimeoutMs({})).toBe(60_000);
    expect(effectiveGeminiHandlerTimeoutMs({ timeout: 0 })).toBe(0);
    expect(effectiveGeminiHandlerTimeoutMs({ timeout: 1234 })).toBe(1234);
  });
});
