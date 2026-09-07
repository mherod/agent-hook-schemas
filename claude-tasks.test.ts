import { describe, expect, test } from "bun:test";
import {
  ParseTaskCreateToolInput, ParseTaskUpdateToolInput, ParseTaskUpdateToolResponse,
  ParseTaskListToolResponse, ParseTaskGetToolResponse, TaskToolInputSchema,
} from "./claude-tasks.ts";

describe("Claude task parser contracts", () => {
  const cases = [
    ["create", ParseTaskCreateToolInput, { subject: "Test hooks", description: "Cover invalid payloads", metadata: { priority: 1 } }, { subject: "Missing description" }],
    ["update", ParseTaskUpdateToolInput, { taskId: "1", status: "deleted", addBlockedBy: ["2"] }, { taskId: "1", status: "unknown" }],
    ["update success", ParseTaskUpdateToolResponse, { success: true, taskId: "1", updatedFields: ["status"], statusChange: { from: "pending", to: "completed" } }, { success: true, taskId: "1" }],
    ["update error", ParseTaskUpdateToolResponse, { success: false, taskId: "1", updatedFields: [], error: "Not found" }, { success: false, taskId: "1", updatedFields: [] }],
    ["list", ParseTaskListToolResponse, { tasks: [{ id: "1", subject: "Test hooks", status: "pending", blockedBy: ["2"] }] }, { tasks: [{ id: "1", subject: "Invalid status", status: "deleted" }] }],
    ["get", ParseTaskGetToolResponse, { id: "1", subject: "Test hooks", status: "completed", blocks: [], metadata: { checked: true } }, { id: "1", subject: "Missing status" }],
  ] as const;

  for (const [name, parse, valid, invalid] of cases) {
    test(`${name} preserves future fields on valid payloads`, () => {
      const payload = { ...valid, future: { version: 2 } };
      const result = parse(payload);
      expect(result.success).toBe(true);
      if (!result.success) throw result.error;
      expect<unknown>(result.data).toEqual(payload);
    });
    test(`${name} reports malformed required fields without throwing`, () => {
      expect(parse(invalid).success).toBe(false);
      for (const value of [null, undefined, [], "invalid", 42]) {
        expect(parse(value).success).toBe(false);
      }
    });
  }

  test.each([
    ["TaskCreate", { subject: "Test", description: "Run suite" }],
    ["TaskUpdate", { taskId: "1", owner: "tester" }],
    ["TaskList", {}],
    ["TaskGet", { taskId: "1" }],
    ["TaskOutput", { task_id: "job-1", block: false, timeout: 0 }],
    ["TaskStop", { shell_id: "shell-1" }],
  ])("dispatches %s and rejects a non-object input", (tool_name, tool_input) => {
    expect({ tool_name, tool_input }).toEqual(TaskToolInputSchema.parse({ tool_name, tool_input }));
    expect(TaskToolInputSchema.safeParse({ tool_name, tool_input: null }).success).toBe(false);
  });
  test("rejects an unknown task tool", () => {
    expect(TaskToolInputSchema.safeParse({ tool_name: "TaskInvented", tool_input: {} }).success).toBe(false);
  });
});
