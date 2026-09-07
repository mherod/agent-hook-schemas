import { describe, expect, test } from "bun:test";
import * as codex from "./codex-agents.ts";

describe("Codex collaboration V1", () => {
  test("spawns with a plain message or structured items and preserves extensions", () => {
    for (const payload of [
      { message: " Review parser ", fork_context: true, model: "future-model", reasoning_effort: "future-effort" },
      { items: [{ type: "text", text: "Review", text_elements: [] }, { type: "mention", name: "Docs", path: "app://docs" }], agent_type: "explorer", future_option: 1 },
    ]) {
      expect(codex.CodexSpawnAgentV1ToolInputSchema.parse(payload)).toEqual(payload);
    }
  });

  test.each([
    {}, { message: "" }, { message: " \n " }, { items: [] },
    { message: "Review", items: [{ type: "text", text: "Review" }] },
    { message: "Review", fork_context: "true" },
    { items: [{ type: "text", text: 1 }] },
  ])("rejects missing, conflicting or malformed spawn inputs: %j", (payload) => {
    expect(codex.CodexSpawnAgentV1ToolInputSchema.safeParse(payload).success).toBe(false);
  });

  test("send_input validates target and the mutually exclusive input sources", () => {
    const payload = { target: "agent-1", items: [{ type: "future_item", content: { value: 1 } }], interrupt: true };
    expect(codex.CodexSendInputV1ToolInputSchema.parse(payload)).toEqual(payload);
    for (const invalid of [
      { message: "Review" }, { target: "agent-1" },
      { target: "agent-1", message: "Review", items: [{ type: "text", text: "Review" }] },
      { target: "agent-1", message: "Review", interrupt: 1 },
    ]) {
      expect(codex.CodexSendInputV1ToolInputSchema.safeParse(invalid).success).toBe(false);
    }
  });

  test("resume uses id while close uses target", () => {
    expect(codex.ParseCodexCollaborationV1ToolInput({ tool_name: "resume_agent", tool_input: { id: "agent-1" } }).success).toBe(true);
    expect(codex.ParseCodexCollaborationV1ToolInput({ tool_name: "close_agent", tool_input: { target: "agent-1" } }).success).toBe(true);
    expect(codex.CodexResumeAgentV1ToolInputSchema.safeParse({ target: "agent-1" }).success).toBe(false);
    expect(codex.CodexCloseAgentV1ToolInputSchema.safeParse({ id: "agent-1" }).success).toBe(false);
  });

  test("wait requires a target list and preserves timeouts for the host to adjust", () => {
    const payload = { targets: ["agent-1", "agent-2"], timeout_ms: 1 };
    expect(codex.CodexWaitAgentV1ToolInputSchema.parse(payload)).toEqual(payload);
    expect(codex.CodexWaitAgentV1ToolInputSchema.safeParse({ timeout_ms: 10_000 }).success).toBe(false);
    expect(codex.CodexWaitAgentV1ToolInputSchema.safeParse({ targets: "agent-1" }).success).toBe(false);
  });

  test("responses retain ids, nullable nicknames and per-agent results", () => {
    expect(codex.ParseCodexCollaborationV1ToolResponse("spawn_agent", { agent_id: "agent-1", nickname: null }).success).toBe(true);
    expect(codex.ParseCodexCollaborationV1ToolResponse("spawn_agent", { agent_id: "agent-1" }).success).toBe(false);
    expect(codex.ParseCodexCollaborationV1ToolResponse("send_input", { submission_id: "submission-1" }).success).toBe(true);
    const payload = { status: { "agent-1": { completed: null }, "agent-2": { errored: "Stopped" } }, timed_out: false, future: true };
    expect(codex.ParseCodexCollaborationV1ToolResponse("wait_agent", payload)).toEqual({ success: true, data: payload });
    expect(codex.ParseCodexCollaborationV1ToolResponse("resume_agent", { status: "running" }).success).toBe(true);
    expect(codex.ParseCodexCollaborationV1ToolResponse("close_agent", { previous_status: "interrupted" }).success).toBe(true);
  });
});

describe("Codex collaboration V2", () => {
  test.each(["all", "none", "1", "3"])("spawns with fork_turns=%s without injecting defaults", (fork_turns) => {
    const payload = { task_name: "review_2", message: "Review parser", fork_turns, future_option: true };
    expect(codex.CodexSpawnAgentV2ToolInputSchema.parse(payload)).toEqual(payload);
    expect(codex.CodexSpawnAgentV2ToolInputSchema.parse({ task_name: "review", message: "Review" })).toEqual({ task_name: "review", message: "Review" });
  });

  test.each([
    { message: "Review" },
    { task_name: "bad-name", message: "Review" },
    { task_name: "/root/review", message: "Review" },
    { task_name: "Review", message: "Review" },
    { task_name: "review", message: " \n " },
    { task_name: "review", message: "Review", fork_turns: 3 },
    { task_name: "review", message: "Review", fork_turns: "0" },
    { task_name: "review", message: "Review", fork_turns: "-1" },
    { task_name: "review", message: "Review", fork_turns: "1.5" },
  ])("rejects malformed V2 spawn inputs: %j", (payload) => {
    expect(codex.CodexSpawnAgentV2ToolInputSchema.safeParse(payload).success).toBe(false);
  });

  test("messages and follow-up tasks have separate tool names and shared arguments", () => {
    for (const tool_name of ["send_message", "followup_task"] as const) {
      const payload = { tool_name, tool_input: { target: "/root/review", message: "Please continue", future_option: 1 }, call_id: "call-1" };
      expect(codex.ParseCodexCollaborationV2ToolInput(payload)).toEqual({ success: true, data: payload });
      expect(codex.ParseCodexCollaborationV2ToolInput({ tool_name, tool_input: { target: "review", message: "" } }).success).toBe(false);
      expect(codex.ParseCodexCollaborationV2ToolInput({ tool_name, tool_input: { message: "Review" } }).success).toBe(false);
    }
  });

  test("discovery, mailbox waiting and interruption use their V2 inputs", () => {
    expect(codex.CodexListAgentsV2ToolInputSchema.parse({})).toEqual({});
    expect(codex.CodexListAgentsV2ToolInputSchema.parse({ path_prefix: "/root/review" })).toEqual({ path_prefix: "/root/review" });
    expect(codex.CodexListAgentsV2ToolInputSchema.safeParse({ path_prefix: 1 }).success).toBe(false);
    expect(codex.CodexWaitAgentV2ToolInputSchema.parse({})).toEqual({});
    expect(codex.CodexWaitAgentV2ToolInputSchema.parse({ timeout_ms: 1 })).toEqual({ timeout_ms: 1 });
    expect(codex.CodexWaitAgentV2ToolInputSchema.safeParse({ timeout_ms: "10000" }).success).toBe(false);
    expect(codex.ParseCodexCollaborationV2ToolInput({ tool_name: "interrupt_agent", tool_input: { target: "review" } }).success).toBe(true);
  });

  test("versioned dispatch never translates tool names or wait response shapes", () => {
    expect(codex.ParseCodexCollaborationV1ToolInput({ tool_name: "send_message", tool_input: { target: "review", message: "Review" } }).success).toBe(false);
    expect(codex.ParseCodexCollaborationV2ToolInput({ tool_name: "send_input", tool_input: { target: "review", message: "Review" } }).success).toBe(false);
    expect(codex.ParseCodexCollaborationV2ToolInput({ tool_name: "multi_agent_v2.spawn_agent", tool_input: { task_name: "review", message: "Review" } }).success).toBe(false);
    const v1 = { status: {}, timed_out: true };
    const v2 = { message: "No mailbox updates", timed_out: true };
    expect(codex.ParseCodexCollaborationV1ToolResponse("wait_agent", v1).success).toBe(true);
    expect(codex.ParseCodexCollaborationV2ToolResponse("wait_agent", v2).success).toBe(true);
    expect(codex.ParseCodexCollaborationV1ToolResponse("wait_agent", v2).success).toBe(false);
    expect(codex.ParseCodexCollaborationV2ToolResponse("wait_agent", v1).success).toBe(false);
  });

  test("spawn supports hosts with and without nickname metadata", () => {
    for (const response of [{ task_name: "/root/review" }, { task_name: "/root/review", nickname: null }, { task_name: "/root/review", nickname: "Reviewer" }]) {
      expect(codex.ParseCodexCollaborationV2ToolResponse("spawn_agent", response)).toEqual({ success: true, data: response });
    }
  });

  test("list and interrupt responses retain structured status while message responses are text", () => {
    const response = { agents: [{ agent_name: "/root/review", agent_status: { completed: "Looks good" }, future: 1 }] };
    expect(codex.ParseCodexCollaborationV2ToolResponse("list_agents", response)).toEqual({ success: true, data: response });
    expect(codex.ParseCodexCollaborationV2ToolResponse("interrupt_agent", { previous_status: "running" }).success).toBe(true);
    for (const tool_name of ["send_message", "followup_task"] as const) {
      expect(codex.ParseCodexCollaborationV2ToolResponse(tool_name, "")).toEqual({ success: true, data: "" });
      expect(codex.ParseCodexCollaborationV2ToolResponse(tool_name, { success: true }).success).toBe(false);
    }
  });
});

describe("Codex agent status", () => {
  test("accepts each tagged status without dropping host extensions", () => {
    for (const status of ["pending_init", "running", "interrupted", "shutdown", "not_found", { completed: "Finished" }, { completed: null }, { errored: "Failed", future: true }] as const) {
      expect(codex.CodexAgentStatusSchema.parse(status)).toEqual(status);
    }
  });

  test.each(["completed", "errored", null, {}, { completed: 1 }, { errored: null }, { completed: "Done", errored: "Failed" }])("rejects malformed or ambiguous status: %j", (status) => {
    expect(codex.CodexAgentStatusSchema.safeParse(status).success).toBe(false);
  });
});
