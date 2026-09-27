/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import {
  AntigravityAskQuestionArgsSchema,
  AntigravityAskQuestionToolInputSchema,
  AntigravityAskQuestionToolResponseSchema,
  AntigravityBuiltinToolNameSchema,
  AntigravityDefineSubagentArgsSchema,
  AntigravityDefineSubagentToolInputSchema,
  AntigravityDefineSubagentToolResponseSchema,
  AntigravityGenerateImageArgsSchema,
  AntigravityGenerateImageToolInputSchema,
  AntigravityGenerateImageToolResponseSchema,
  AntigravityImageAspectRatioSchema,
  AntigravityInvokeSubagentArgsSchema,
  AntigravityInvokeSubagentToolInputSchema,
  AntigravityInvokeSubagentToolResponseSchema,
  AntigravityManageSubagentsArgsSchema,
  AntigravityManageSubagentsToolInputSchema,
  AntigravityManageSubagentsToolResponseSchema,
  AntigravityManageTaskArgsSchema,
  AntigravityManageTaskToolInputSchema,
  AntigravityManageTaskToolResponseSchema,
  AntigravityPreToolUseInputSchema,
  AntigravityReadUrlContentArgsSchema,
  AntigravityReadUrlContentToolInputSchema,
  AntigravityReadUrlContentToolResponseSchema,
  AntigravityReplaceFileContentArgsSchema,
  AntigravityReplaceFileContentToolInputSchema,
  AntigravityReplaceFileContentToolResponseSchema,
  AntigravityRunCommandArgsSchema,
  AntigravityRunCommandToolInputSchema,
  AntigravityRunCommandToolResponseSchema,
  AntigravityScheduleArgsSchema,
  AntigravityScheduleToolInputSchema,
  AntigravityScheduleToolResponseSchema,
  AntigravitySendMessageArgsSchema,
  AntigravitySendMessageToolInputSchema,
  AntigravitySendMessageToolResponseSchema,
  AntigravitySearchWebArgsSchema,
  AntigravitySearchWebToolInputSchema,
  AntigravitySearchWebToolResponseSchema,
  AntigravitySubagentLifecycleStateSchema,
  AntigravitySubagentModelSchema,
  AntigravitySubagentWorkspaceSchema,
  AntigravityTaskActionSchema,
  AntigravityTimerConditionSchema,
  AntigravityToolNameSchema,
  AntigravityTypedToolCallSchema,
  AntigravityViewFileArgsSchema,
  AntigravityViewFileToolInputSchema,
  AntigravityViewFileToolResponseSchema,
  AntigravityWriteToFileArgsSchema,
  AntigravityWriteToFileToolInputSchema,
  AntigravityWriteToFileToolResponseSchema,
  ParseAntigravityAskQuestionArgs,
  ParseAntigravityDefineSubagentArgs,
  ParseAntigravityGenerateImageArgs,
  ParseAntigravityInvokeSubagentArgs,
  ParseAntigravityManageSubagentsArgs,
  ParseAntigravityManageTaskArgs,
  ParseAntigravityReadUrlContentArgs,
  ParseAntigravityReplaceFileContentArgs,
  ParseAntigravityRunCommandArgs,
  ParseAntigravityScheduleArgs,
  ParseAntigravitySearchWebArgs,
  ParseAntigravitySendMessageArgs,
  ParseAntigravityToolArgs,
  ParseAntigravityToolCall,
  ParseAntigravityViewFileArgs,
  ParseAntigravityWriteToFileArgs,
} from "./antigravity.ts";

describe("AntigravityBuiltinToolNameSchema", () => {
  test("contains exactly the 14 native built-in tools", () => {
    expect(AntigravityBuiltinToolNameSchema.options).toHaveLength(14);
    const expected = [
      "run_command",
      "view_file",
      "replace_file_content",
      "write_to_file",
      "manage_task",
      "schedule",
      "send_message",
      "invoke_subagent",
      "define_subagent",
      "manage_subagents",
      "read_url_content",
      "search_web",
      "generate_image",
      "ask_question",
    ];
    for (const name of expected) {
      expect(AntigravityBuiltinToolNameSchema.safeParse(name).success).toBe(true);
    }
  });

  test("rejects unknown tool names in strict enum", () => {
    expect(AntigravityBuiltinToolNameSchema.safeParse("unknown_tool").success).toBe(false);
    expect(AntigravityBuiltinToolNameSchema.safeParse("call_mcp_tool").success).toBe(false);
  });

  test("AntigravityToolNameSchema accepts built-in tools and arbitrary custom/MCP strings", () => {
    expect(AntigravityToolNameSchema.safeParse("run_command").success).toBe(true);
    expect(AntigravityToolNameSchema.safeParse("custom_tool").success).toBe(true);
    expect(AntigravityToolNameSchema.safeParse("mcp_proxyman_get_flows").success).toBe(true);
  });
});

describe("1. run_command schemas", () => {
  test("parses full run_command tool input", () => {
    const input = {
      CommandLine: "bun test --concurrent",
      Cwd: "/Users/dev/workspace",
      WaitMsBeforeAsync: 5000,
      RunPersistent: true,
      RequestedTerminalID: "term-1",
      IsDaemon: false,
      toolAction: "Running test suite",
      toolSummary: "Run tests",
    };
    const parsed = AntigravityRunCommandToolInputSchema.safeParse(input);
    expect(parsed.success).toBe(true);
    expect(AntigravityRunCommandArgsSchema.safeParse(input).success).toBe(true);
    expect(ParseAntigravityRunCommandArgs(input).success).toBe(true);
  });

  test("parses run_command tool response", () => {
    const response = {
      stdout: "717 pass\n0 fail",
      stderr: "",
      exitCode: 0,
      output: "Done",
      taskId: "task-42",
    };
    expect(AntigravityRunCommandToolResponseSchema.safeParse(response).success).toBe(true);
  });
});

describe("2. view_file schemas", () => {
  test("parses full view_file tool input", () => {
    const input = {
      AbsolutePath: "/Users/dev/workspace/index.ts",
      StartLine: 1,
      EndLine: 50,
      ContentOffset: 0,
      toolAction: "Viewing index file",
      toolSummary: "Read index",
    };
    expect(AntigravityViewFileToolInputSchema.safeParse(input).success).toBe(true);
    expect(AntigravityViewFileArgsSchema.safeParse(input).success).toBe(true);
    expect(ParseAntigravityViewFileArgs(input).success).toBe(true);
  });

  test("parses view_file response", () => {
    const response = {
      content: "console.log('hello');",
      totalLines: 100,
      totalBytes: 2048,
      truncated: false,
      startLine: 1,
      endLine: 50,
    };
    expect(AntigravityViewFileToolResponseSchema.safeParse(response).success).toBe(true);
  });
});

describe("3. replace_file_content schemas", () => {
  test("parses replace_file_content tool input", () => {
    const input = {
      TargetFile: "/Users/dev/workspace/app.ts",
      Instruction: "Fix error handling",
      Description: "Add try/catch around async call",
      AllowMultiple: false,
      TargetContent: "await fetchData();",
      ReplacementContent: "try { await fetchData(); } catch (e) { handleError(e); }",
      StartLine: 10,
      EndLine: 12,
      TargetLintErrorIds: ["lint-101"],
      toolAction: "Replacing error handling",
      toolSummary: "Fix error handling",
    };
    expect(AntigravityReplaceFileContentToolInputSchema.safeParse(input).success).toBe(true);
    expect(AntigravityReplaceFileContentArgsSchema.safeParse(input).success).toBe(true);
    expect(ParseAntigravityReplaceFileContentArgs(input).success).toBe(true);
  });

  test("parses replace_file_content response", () => {
    const response = {
      success: true,
      modifiedFile: "/Users/dev/workspace/app.ts",
      replacementsCount: 1,
    };
    expect(AntigravityReplaceFileContentToolResponseSchema.safeParse(response).success).toBe(true);
  });
});

describe("4. write_to_file schemas", () => {
  test("parses write_to_file with ArtifactMetadata", () => {
    const input = {
      TargetFile: "/Users/dev/workspace/report.md",
      Overwrite: true,
      CodeContent: "# Report\nSummary content",
      Description: "Create summary report artifact",
      Append: false,
      ArtifactMetadata: {
        RequestFeedback: true,
        Summary: "Report summary",
        UserFacing: true,
      },
      toolAction: "Creating artifact",
      toolSummary: "Write report",
    };
    expect(AntigravityWriteToFileToolInputSchema.safeParse(input).success).toBe(true);
    expect(AntigravityWriteToFileArgsSchema.safeParse(input).success).toBe(true);
    expect(ParseAntigravityWriteToFileArgs(input).success).toBe(true);
  });

  test("parses write_to_file response", () => {
    const response = {
      success: true,
      targetFile: "/Users/dev/workspace/report.md",
      bytesWritten: 128,
    };
    expect(AntigravityWriteToFileToolResponseSchema.safeParse(response).success).toBe(true);
  });
});

describe("5. manage_task schemas", () => {
  test("accepts all valid task actions", () => {
    const actions = ["list", "kill", "status", "send_input"] as const;
    for (const a of actions) {
      expect(AntigravityTaskActionSchema.safeParse(a).success).toBe(true);
      const input = {
        Action: a,
        TaskId: "task-99",
        Input: "stdin line",
        toolAction: "Managing task",
        toolSummary: "Task action",
      };
      expect(AntigravityManageTaskToolInputSchema.safeParse(input).success).toBe(true);
      expect(AntigravityManageTaskArgsSchema.safeParse(input).success).toBe(true);
      expect(ParseAntigravityManageTaskArgs(input).success).toBe(true);
    }
  });

  test("parses manage_task response", () => {
    const response = {
      tasks: [
        {
          taskId: "task-1",
          status: "running",
          command: "bun run dev",
          logUri: "/tmp/task-1.log",
        },
      ],
      output: "Task killed",
    };
    expect(AntigravityManageTaskToolResponseSchema.safeParse(response).success).toBe(true);
  });
});

describe("6. schedule schemas", () => {
  test("parses one-shot timer schedule input", () => {
    const timerInput = {
      Prompt: "Check on build status",
      DurationSeconds: 300,
      TimerCondition: "task-123",
      toolAction: "Scheduling timer",
      toolSummary: "Check timer",
    };
    expect(AntigravityScheduleToolInputSchema.safeParse(timerInput).success).toBe(true);
    expect(AntigravityScheduleArgsSchema.safeParse(timerInput).success).toBe(true);
    expect(ParseAntigravityScheduleArgs(timerInput).success).toBe(true);
  });

  test("parses recurring cron schedule input", () => {
    const cronInput = {
      Prompt: "Daily report check",
      CronExpression: "0 9 * * *",
      MaxIterations: 5,
      IsDaemon: true,
      toolAction: "Setting daily cron",
      toolSummary: "Schedule daily report",
    };
    expect(AntigravityScheduleToolInputSchema.safeParse(cronInput).success).toBe(true);
  });

  test("TimerCondition accepts 'never', 'any', and sender-id strings", () => {
    expect(AntigravityTimerConditionSchema.safeParse("never").success).toBe(true);
    expect(AntigravityTimerConditionSchema.safeParse("any").success).toBe(true);
    expect(AntigravityTimerConditionSchema.safeParse("agent-conversation-id-123").success).toBe(true);
  });

  test("parses schedule response", () => {
    const response = { taskId: "cron-1", scheduled: true };
    expect(AntigravityScheduleToolResponseSchema.safeParse(response).success).toBe(true);
  });
});

describe("7. send_message schemas", () => {
  test("parses send_message tool input", () => {
    const input = {
      Recipient: "subagent-conv-123",
      Message: "Proceed with step 2",
      toolAction: "Messaging subagent",
      toolSummary: "Send instructions",
    };
    expect(AntigravitySendMessageToolInputSchema.safeParse(input).success).toBe(true);
    expect(AntigravitySendMessageArgsSchema.safeParse(input).success).toBe(true);
    expect(ParseAntigravitySendMessageArgs(input).success).toBe(true);
  });

  test("parses send_message response", () => {
    const response = { success: true, deliveryStatus: "delivered" };
    expect(AntigravitySendMessageToolResponseSchema.safeParse(response).success).toBe(true);
  });
});

describe("8. invoke_subagent schemas", () => {
  test("parses invoke_subagent with subagents array", () => {
    const input = {
      Subagents: [
        {
          TypeName: "research",
          Role: "Codebase Researcher",
          Prompt: "Explore auth logic",
          Model: "flash" as const,
          Workspace: "inherit" as const,
        },
        {
          TypeName: "self",
          Role: "Refactor Agent",
          Prompt: "Apply changes",
          Model: "pro" as const,
          Workspace: "branch" as const,
        },
      ],
      toolAction: "Invoking subagents",
      toolSummary: "Spawn research and refactor agents",
    };
    expect(AntigravityInvokeSubagentToolInputSchema.safeParse(input).success).toBe(true);
    expect(AntigravityInvokeSubagentArgsSchema.safeParse(input).success).toBe(true);
    expect(ParseAntigravityInvokeSubagentArgs(input).success).toBe(true);
  });

  test("validates model and workspace enums", () => {
    for (const m of ["inherit", "flash_lite", "flash", "pro"] as const) {
      expect(AntigravitySubagentModelSchema.safeParse(m).success).toBe(true);
    }
    for (const w of ["inherit", "branch", "share"] as const) {
      expect(AntigravitySubagentWorkspaceSchema.safeParse(w).success).toBe(true);
    }
  });

  test("parses invoke_subagent response", () => {
    const response = {
      subagents: [
        {
          conversationId: "conv-1",
          typeName: "research",
          role: "Codebase Researcher",
        },
      ],
    };
    expect(AntigravityInvokeSubagentToolResponseSchema.safeParse(response).success).toBe(true);
  });
});

describe("9. define_subagent schemas", () => {
  test("parses define_subagent tool input", () => {
    const input = {
      name: "security_auditor",
      description: "Audits security vulnerabilities",
      system_prompt: "You are an automated security auditor...",
      enable_write_tools: false,
      enable_subagent_tools: false,
      enable_mcp_tools: true,
      toolAction: "Registering auditor",
      toolSummary: "Define security agent",
    };
    expect(AntigravityDefineSubagentToolInputSchema.safeParse(input).success).toBe(true);
    expect(AntigravityDefineSubagentArgsSchema.safeParse(input).success).toBe(true);
    expect(ParseAntigravityDefineSubagentArgs(input).success).toBe(true);
  });

  test("parses define_subagent response", () => {
    const response = { success: true, name: "security_auditor" };
    expect(AntigravityDefineSubagentToolResponseSchema.safeParse(response).success).toBe(true);
  });
});

describe("10. manage_subagents schemas", () => {
  test("parses manage_subagents tool input for all actions", () => {
    for (const action of ["list", "kill", "kill_all"] as const) {
      const input = {
        Action: action,
        ConversationIds: action === "kill" ? ["conv-1"] : undefined,
        toolAction: "Managing subagents",
        toolSummary: "Subagents action",
      };
      expect(AntigravityManageSubagentsToolInputSchema.safeParse(input).success).toBe(true);
      expect(AntigravityManageSubagentsArgsSchema.safeParse(input).success).toBe(true);
      expect(ParseAntigravityManageSubagentsArgs(input).success).toBe(true);
    }
  });

  test("validates subagent lifecycle states", () => {
    const states = [
      "running",
      "idle",
      "waiting_for_input",
      "waiting_for_dependents",
      "waiting_for_message",
      "canceling",
      "errored",
      "unspecified",
    ] as const;
    for (const s of states) {
      expect(AntigravitySubagentLifecycleStateSchema.safeParse(s).success).toBe(true);
    }
  });

  test("parses manage_subagents response", () => {
    const response = {
      subagents: [
        {
          conversationId: "conv-1",
          role: "Researcher",
          type: "research",
          state: "idle",
          transcript: "file:///logs/transcript.jsonl",
        },
      ],
      killedIds: ["conv-2"],
    };
    expect(AntigravityManageSubagentsToolResponseSchema.safeParse(response).success).toBe(true);
  });
});

describe("11. read_url_content schemas", () => {
  test("parses read_url_content tool input", () => {
    const input = {
      Url: "https://example.com/docs",
      toolAction: "Reading documentation",
      toolSummary: "Fetch docs",
    };
    expect(AntigravityReadUrlContentToolInputSchema.safeParse(input).success).toBe(true);
    expect(AntigravityReadUrlContentArgsSchema.safeParse(input).success).toBe(true);
    expect(ParseAntigravityReadUrlContentArgs(input).success).toBe(true);
  });

  test("parses read_url_content response", () => {
    const response = {
      content: "# Documentation\nSome markdown text",
      title: "Docs",
      url: "https://example.com/docs",
    };
    expect(AntigravityReadUrlContentToolResponseSchema.safeParse(response).success).toBe(true);
  });
});

describe("12. search_web schemas", () => {
  test("parses search_web tool input", () => {
    const input = {
      query: "Antigravity agents hooks protocol",
      domain: "antigravity.google",
      toolAction: "Searching web",
      toolSummary: "Web search",
    };
    expect(AntigravitySearchWebToolInputSchema.safeParse(input).success).toBe(true);
    expect(AntigravitySearchWebArgsSchema.safeParse(input).success).toBe(true);
    expect(ParseAntigravitySearchWebArgs(input).success).toBe(true);
  });

  test("parses search_web response", () => {
    const response = {
      summary: "Found documentation on hooks protocol",
      results: [
        {
          title: "Hooks Reference",
          url: "https://antigravity.google/docs/hooks",
          snippet: "External lifecycle hooks guide",
        },
      ],
    };
    expect(AntigravitySearchWebToolResponseSchema.safeParse(response).success).toBe(true);
  });
});

describe("13. generate_image schemas", () => {
  test("parses generate_image tool input", () => {
    const input = {
      Prompt: "Modern dark mode dashboard UI mockup",
      ImageName: "dashboard_ui",
      AspectRatio: "16:9" as const,
      ImagePaths: ["/Users/dev/ref.png"],
      toolAction: "Generating UI mockup",
      toolSummary: "Create dashboard image",
    };
    expect(AntigravityGenerateImageToolInputSchema.safeParse(input).success).toBe(true);
    expect(AntigravityGenerateImageArgsSchema.safeParse(input).success).toBe(true);
    expect(ParseAntigravityGenerateImageArgs(input).success).toBe(true);
  });

  test("validates aspect ratio enum", () => {
    for (const r of ["1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9"] as const) {
      expect(AntigravityImageAspectRatioSchema.safeParse(r).success).toBe(true);
    }
  });

  test("parses generate_image response", () => {
    const response = {
      imagePath: "/artifacts/dashboard_ui.png",
      imageName: "dashboard_ui",
    };
    expect(AntigravityGenerateImageToolResponseSchema.safeParse(response).success).toBe(true);
  });
});

describe("14. ask_question schemas", () => {
  test("parses ask_question tool input", () => {
    const input = {
      questions: [
        {
          question: "Which database would you prefer?",
          options: ["PostgreSQL", "SQLite", "Firestore"],
          is_multi_select: false,
        },
      ],
      toolAction: "Prompting user for database choice",
      toolSummary: "Select database",
    };
    expect(AntigravityAskQuestionToolInputSchema.safeParse(input).success).toBe(true);
    expect(AntigravityAskQuestionArgsSchema.safeParse(input).success).toBe(true);
    expect(ParseAntigravityAskQuestionArgs(input).success).toBe(true);
  });

  test("parses ask_question response", () => {
    const response = {
      answers: ["PostgreSQL"],
    };
    expect(AntigravityAskQuestionToolResponseSchema.safeParse(response).success).toBe(true);
  });
});

describe("AntigravityTypedToolCall & ParseAntigravityToolCall", () => {
  const calls = [
      { name: "run_command", args: { CommandLine: "ls", Cwd: "/tmp" } },
      { name: "view_file", args: { AbsolutePath: "/tmp/f.txt" } },
      {
        name: "replace_file_content",
        args: {
          TargetFile: "/f.ts",
          Instruction: "edit",
          Description: "edit",
          AllowMultiple: false,
          TargetContent: "a",
          ReplacementContent: "b",
          StartLine: 1,
          EndLine: 1,
        },
      },
      {
        name: "write_to_file",
        args: {
          TargetFile: "/f.txt",
          Overwrite: true,
          CodeContent: "test",
          Description: "write",
        },
      },
      { name: "manage_task", args: { Action: "list" } },
      { name: "schedule", args: { Prompt: "ping", DurationSeconds: 60 } },
      { name: "send_message", args: { Recipient: "sub-1", Message: "hello" } },
      {
        name: "invoke_subagent",
        args: {
          Subagents: [{ TypeName: "research", Role: "Dev", Prompt: "do work" }],
        },
      },
      {
        name: "define_subagent",
        args: { name: "bot", description: "desc", system_prompt: "sys" },
      },
      { name: "manage_subagents", args: { Action: "list" } },
      { name: "read_url_content", args: { Url: "https://example.com" } },
      { name: "search_web", args: { query: "bun test" } },
      { name: "generate_image", args: { Prompt: "cat", ImageName: "cat_pic" } },
      {
        name: "ask_question",
        args: {
          questions: [{ question: "Proceed?", options: ["Yes", "No"] }],
        },
      },
    ] as const;

  test("discriminates and parses each of the 14 tool calls", () => {
    for (const call of calls) {
      const parsed = ParseAntigravityToolCall(call);
      expect(parsed.success, `Failed to parse tool call for ${call.name}`).toBe(true);
      if (parsed.success) {
        expect(parsed.data.name).toBe(call.name);
      }
    }
  });

  test("ParseAntigravityToolArgs parses matching args for all 14 tools and falls back to JsonObjectSchema", () => {
    for (const call of calls) {
      const result = ParseAntigravityToolArgs(call.name, call.args);
      expect(result.success, `Failed to parse tool args for ${call.name}`).toBe(true);
    }

    const unknownResult = ParseAntigravityToolArgs("custom_tool", { customParam: 123 });
    expect(unknownResult.success).toBe(true);
  });

  test("AntigravityPreToolUseInputSchema validates hook stdin containing toolCall", () => {
    const hookStdin = {
      conversationId: "conv-42",
      stepIdx: 3,
      toolCall: {
        name: "run_command",
        args: {
          CommandLine: "bun run build",
          Cwd: "/workspace",
          WaitMsBeforeAsync: 10000,
          toolAction: "Building project",
          toolSummary: "Run build",
        },
      },
    };
    const parsed = AntigravityPreToolUseInputSchema.safeParse(hookStdin);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.toolCall?.name).toBe("run_command");
    const typedCall = ParseAntigravityToolCall(parsed.data.toolCall);
    expect(typedCall.success).toBe(true);
  });
});
