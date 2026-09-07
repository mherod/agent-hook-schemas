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

  test("agent schemas parse through the published root and subpath exports", async () => {
    const root = await import("agent-hook-schemas");
    const claude = await import("agent-hook-schemas/claude-agents");
    const codex = await import("agent-hook-schemas/codex-agents");
    const message = { to: "reviewer", notify_when_idle: true };
    expect(claude.ParseSendMessageToolInput(message)).toEqual({ success: true, data: message });
    expect(root.ParseSendMessageToolInput(message)).toEqual({ success: true, data: message });
    expect(claude.AgentToolInputSchema.parse({ prompt: "Review" })).toEqual({ prompt: "Review" });
    const call = { tool_name: "spawn_agent", tool_input: { task_name: "review", message: "Review" } };
    expect(codex.ParseCodexCollaborationV2ToolInput(call)).toEqual({ success: true, data: call });
    expect(root.ParseCodexCollaborationV2ToolInput(call)).toEqual({ success: true, data: call });
    expect(codex.ParseCodexCollaborationV1ToolResponse("spawn_agent", { agent_id: "agent-1", nickname: null }).success).toBe(true);
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

  test("AntigravityHookEventNameSchema.options is non-empty at bundle load", async () => {
    const { AntigravityHookEventNameSchema } = await import("./dist/antigravity.js");
    expect(AntigravityHookEventNameSchema.options.length).toBeGreaterThan(0);
  });
});
