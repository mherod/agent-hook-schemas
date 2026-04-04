/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import {
  CodexTaskToolInputSchema,
  ParseUpdatePlanArguments,
  ParseUpdatePlanFunctionCall,
  ParseUpdatePlanFunctionCallOutput,
  ParseUpdatePlanToolInput,
  UpdatePlanArgumentsSchema,
  UpdatePlanFunctionCallSchema,
  UpdatePlanFunctionCallOutputSchema,
  UpdatePlanStepSchema,
} from "./codex-tasks.ts";

describe("codex-tasks", () => {
  test("validates the captured update_plan argument payload", () => {
    const payload = {
      explanation: "Creating the required five-task plan before analysis work, per the report-issue skill.",
      plan: [
        { step: "Analyze raw input", status: "in_progress" },
        { step: "Research technical context", status: "pending" },
        { step: "Investigate codebase", status: "pending" },
        { step: "Draft issue title and body", status: "pending" },
        { step: "Create GitHub issue", status: "pending" },
      ],
    };

    expect(UpdatePlanArgumentsSchema.safeParse(payload).success).toBe(true);
    expect(CodexTaskToolInputSchema.safeParse(payload).success).toBe(true);
    expect(ParseUpdatePlanToolInput(payload).success).toBe(true);
  });

  test("validates the captured update_plan function-call envelope", () => {
    const payload = {
      type: "function_call",
      name: "update_plan",
      arguments: JSON.stringify({
        plan: [{ step: "Stage current changes", status: "in_progress" }],
      }),
      call_id: "call_123",
    };

    expect(UpdatePlanFunctionCallSchema.safeParse(payload).success).toBe(true);
    expect(ParseUpdatePlanFunctionCall(payload).success).toBe(true);
  });

  test("validates the captured update_plan function-call output", () => {
    const payload = {
      type: "function_call_output",
      call_id: "call_123",
      output: "Plan updated",
    };

    expect(UpdatePlanFunctionCallOutputSchema.safeParse(payload).success).toBe(true);
    expect(ParseUpdatePlanFunctionCallOutput(payload).success).toBe(true);
  });

  test("parses update_plan arguments from captured JSON text", () => {
    const result = ParseUpdatePlanArguments(
      JSON.stringify({
        explanation: "Fell back to a local reproducible issue.",
        plan: [{ step: "Commit current changes", status: "completed" }],
      }),
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.plan[0]?.status).toBe("completed");
    }
  });

  test("rejects plan steps with unknown status", () => {
    expect(
      UpdatePlanStepSchema.safeParse({
        step: "Inspect",
        status: "blocked",
      }).success,
    ).toBe(false);
  });
});
