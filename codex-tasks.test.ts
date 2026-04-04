/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import {
  CodexTaskToolInputSchema,
  ParseCodexTaskUpdateToolInput,
  ParseUpdatePlanToolInput,
} from "./codex-tasks.ts";

describe("codex-tasks", () => {
  test("accepts update_plan as a task update alias", () => {
    const payload = {
      tool_name: "update_plan",
      tool_input: {
        taskId: "task-001",
        status: "in_progress",
        subject: "Refine hook schemas",
      },
    };

    expect(CodexTaskToolInputSchema.safeParse(payload).success).toBe(true);
    expect(
      ParseCodexTaskUpdateToolInput({
        taskId: "task-001",
        status: "in_progress",
      }).success,
    ).toBe(true);
    expect(
      ParseUpdatePlanToolInput({
        taskId: "task-001",
        status: "in_progress",
      }).success,
    ).toBe(true);
  });
});
