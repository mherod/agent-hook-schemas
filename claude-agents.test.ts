import { describe, expect, test } from "bun:test";
import { ClaudeCodeBuiltinToolNameSchema, ParseHookInput } from "./claude.ts";
import {
  AgentToolInputSchema,
  ParseAgentToolInput,
  ParseClaudeAgentToolInput,
  ParseListAgentsToolInput,
  ParseSendMessageToolInput,
} from "./claude-agents.ts";

describe("Claude agent tool reference updates", () => {
  test("recognizes the newly documented canonical tool names", () => {
    const additions = [
      "Artifact", "CronCreate", "CronDelete", "CronList", "EndConversation",
      "EnterPlanMode", "EnterWorktree", "ExitWorktree", "ListAgents",
      "ListMcpResourcesTool", "LSP", "Monitor", "NotebookEdit", "PowerShell",
      "PushNotification", "ReadMcpResourceTool", "RemoteTrigger", "ReportFindings",
      "ScheduleWakeup", "SendFeedback", "SendMessage", "SendUserFile",
      "ShareOnboardingGuide", "Skill", "TodoWrite", "WaitForMcpServers", "Workflow",
    ];
    for (const name of additions) {
      expect(ClaudeCodeBuiltinToolNameSchema.safeParse(name).success, name).toBe(true);
    }
    expect(ClaudeCodeBuiltinToolNameSchema.options).toHaveLength(45);
    for (const name of ["Bash", "Agent", "Read", "TaskCreate", "TaskStop", "WebSearch"]) {
      expect(ClaudeCodeBuiltinToolNameSchema.safeParse(name).success).toBe(true);
    }
  });

  test("generic hook parsing remains open to future tool names", () => {
    const payload = {
      hook_event_name: "PreToolUse",
      tool_name: "FutureTool",
      tool_input: { future_option: true },
    };
    expect(ParseHookInput(payload)).toMatchObject({ success: true, data: payload });
    expect(ClaudeCodeBuiltinToolNameSchema.safeParse("FutureTool").success).toBe(false);
  });

  test("Agent accepts omitted subagent_type and retains new SDK metadata", () => {
    const payload = {
      prompt: "Review the parser",
      description: "Review parser",
      name: "reviewer",
      run_in_background: true,
      isolation: "remote",
      model: "fable",
      future_option: { preserve: true },
    };
    expect(ParseAgentToolInput(payload)).toEqual({ success: true, data: payload });
  });

  test("Agent preserves old payloads and future model, mode and isolation names", () => {
    for (const payload of [
      { prompt: "Review", subagent_type: "general-purpose" },
      { prompt: "Review", team_name: "legacy", mode: "future-mode", model: "future-model", isolation: "future-isolation" },
    ]) {
      expect(AgentToolInputSchema.parse(payload)).toEqual(payload);
    }
  });

  test.each([
    { prompt: "Review", run_in_background: "true" },
    { prompt: "Review", isolation: 1 },
    { prompt: "Review", name: false },
    { description: "Missing prompt" },
  ])("Agent rejects malformed known fields: %j", (payload) => {
    expect(ParseAgentToolInput(payload).success).toBe(false);
  });

  test("ListAgents retains undocumented filters without inventing required fields", () => {
    expect(ParseListAgentsToolInput({})).toEqual({ success: true, data: {} });
    const payload = { future_filter: { active: true } };
    expect(ParseListAgentsToolInput(payload)).toEqual({ success: true, data: payload });
    expect(ParseListAgentsToolInput([]).success).toBe(false);
  });

  test("SendMessage retains plain text and does not truncate a summary", () => {
    const payload = { to: "reviewer", message: "Review complete", summary: "x".repeat(250), future_option: 1 };
    expect(ParseSendMessageToolInput(payload)).toEqual({ success: true, data: payload });
  });

  test("SendMessage accepts an idle subscription with or without a message", () => {
    for (const payload of [
      { to: "migration", notify_when_idle: true },
      { to: "migration", message: "Report when finished", notify_when_idle: true },
      { to: "migration", message: "Progress update", notify_when_idle: false },
    ]) {
      expect(ParseSendMessageToolInput(payload)).toEqual({ success: true, data: payload });
    }
  });

  test("SendMessage preserves opaque JSON objects without interpreting a protocol", () => {
    const payload = { to: "reviewer", message: { type: "future_protocol", extra: { value: null } } };
    expect(ParseSendMessageToolInput(payload)).toEqual({ success: true, data: payload });
  });

  test.each([
    { to: "reviewer" },
    { to: "reviewer", notify_when_idle: false },
    { to: "reviewer", notify_when_idle: "true" },
    { to: 1, message: "Review" },
    { to: "reviewer", message: 1 },
    { to: "reviewer", message: null },
    { to: "reviewer", message: [] },
    { to: "reviewer", message: "Review", summary: 1 },
  ])("SendMessage rejects malformed or empty requests: %j", (payload) => {
    expect(ParseSendMessageToolInput(payload).success).toBe(false);
  });

  test("agent envelopes accept the legacy Task alias and preserve hook metadata", () => {
    for (const tool_name of ["Agent", "Task"] as const) {
      const payload = { tool_name, tool_input: { prompt: "Review" }, tool_use_id: "tool-1" };
      expect(ParseClaudeAgentToolInput(payload)).toEqual({ success: true, data: payload });
    }
    for (const [tool_name, tool_input] of [
      ["ListAgents", {}], ["SendMessage", { to: "reviewer", message: "Review" }],
    ]) {
      expect(ParseClaudeAgentToolInput({ tool_name, tool_input }).success).toBe(true);
    }
    expect(ParseClaudeAgentToolInput({ tool_name: "SendMessage", tool_input: { message: "Missing recipient" } }).success).toBe(false);
    expect(ParseClaudeAgentToolInput({ tool_name: "FutureTool", tool_input: {} }).success).toBe(false);
  });
});
