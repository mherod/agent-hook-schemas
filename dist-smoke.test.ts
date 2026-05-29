/// <reference types="bun" />
import { describe, expect, test } from "bun:test";

// Smoke test: import from the built dist bundle (not source) to catch
// module initialization order regressions like issues #4/#5/#13 where
// schema values were undefined at bundle load time.
describe("dist bundle smoke test", () => {
  test("all named exports from dist/index are defined", async () => {
    const dist = await import("./dist/index.js");
    for (const [key, value] of Object.entries(dist)) {
      expect(value, `dist/index.js export "${key}" is undefined`).toBeDefined();
    }
  });

  test("HookEventNameSchema.options is non-empty at bundle load", async () => {
    const { HookEventNameSchema } = await import("./dist/claude.js");
    expect(HookEventNameSchema.options.length).toBeGreaterThan(0);
  });

  test("CodexHookEventNameSchema.options is non-empty at bundle load", async () => {
    const { CodexHookEventNameSchema } = await import("./dist/codex.js");
    expect(CodexHookEventNameSchema.options.length).toBeGreaterThan(0);
  });

  test("GeminiHookEventNameSchema.options is non-empty at bundle load", async () => {
    const { GeminiHookEventNameSchema } = await import("./dist/gemini.js");
    expect(GeminiHookEventNameSchema.options.length).toBeGreaterThan(0);
  });

  test("CopilotHookEventNameSchema.options is non-empty at bundle load", async () => {
    const { CopilotHookEventNameSchema } = await import("./dist/copilot.js");
    expect(CopilotHookEventNameSchema.options.length).toBeGreaterThan(0);
  });
});
