/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import {
  AgentHookHandlerSchema,
  AgentToolInputSchema,
  AskUserQuestionToolInputSchema,
  ClaudeSettingsFragmentSchema,
  ClaudeSettingsHooksSchema,
  CodexCommandHookHandlerSchema,
  CodexHooksConfigSchema,
  CodexHooksFileSchema,
  CodexPostToolUseStdoutSchema,
  CodexPreToolUseLegacyBlockStdoutSchema,
  CodexPreToolUseStdoutSchema,
  CodexSessionStartStdoutSchema,
  CodexStopStdoutSchema,
  CodexUserPromptSubmitStdoutSchema,
  GlobToolInputSchema,
  GrepToolInputSchema,
  HookCommandOutputSchema,
  HookEventNameSchema,
  HookSpecificElicitationOutputSchema,
  HookSpecificElicitationResultOutputSchema,
  HookSpecificNotificationOutputSchema,
  HookSpecificPermissionDeniedOutputSchema,
  HookSpecificPreToolUseOutputSchema,
  HookSpecificSessionStartOutputSchema,
  HookSpecificSubagentStartOutputSchema,
  HookSpecificWorktreeCreateOutputSchema,
  HooksConfigSchema,
  HttpHookHandlerSchema,
  LooksLikeMcpToolName,
  ParseBashToolInput,
  ParseCodexHookInput,
  ParseEditToolInput,
  ParseHookInput,
  ParseWriteToolInput,
  PermissionRequestAllowAcceptEditsSessionStdoutSchema,
  PermissionRequestAllowStdoutSchema,
  PromptHookHandlerSchema,
  PromptHookModelResponseSchema,
  ReadToolInputSchema,
  StopHookGuardShouldSkip,
  ToolInputCommand,
  ToolInputFilePath,
  ParseGeminiHookInput,
  WebFetchToolInputSchema,
  WebSearchToolInputSchema,
} from "./index.ts";

const claudeBase = {
  session_id: "sess-1",
  cwd: "/tmp/project",
} as const;

describe("ParseHookInput", () => {
  test("rejects null and non-objects", () => {
    expect(ParseHookInput(null).success).toBe(false);
    expect(ParseHookInput(undefined).success).toBe(false);
    expect(ParseHookInput("string").success).toBe(false);
    expect(ParseHookInput([]).success).toBe(false);
  });

  test("rejects empty object (no matching branch)", () => {
    expect(ParseHookInput({}).success).toBe(false);
  });

  test("accepts SessionStart with partial fields (resilient parsing)", () => {
    const r = ParseHookInput({
      ...claudeBase,
      hook_event_name: "SessionStart",
      source: "startup",
    });
    expect(r.success).toBe(true);
  });

  test("rejects SessionStart on invalid enum source", () => {
    const r = ParseHookInput({
      ...claudeBase,
      hook_event_name: "SessionStart",
      source: "not-a-valid-source",
      model: "opus",
    });
    expect(r.success).toBe(false);
  });

  test("accepts SessionStart and preserves extra keys (loose)", () => {
    const r = ParseHookInput({
      ...claudeBase,
      hook_event_name: "SessionStart",
      source: "startup",
      model: "opus",
      experimental_flag: true,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.hook_event_name).toBe("SessionStart");
      expect((r.data as Record<string, unknown>).experimental_flag).toBe(true);
    }
  });

  test("accepts PreToolUse with minimal tool payload", () => {
    const r = ParseHookInput({
      ...claudeBase,
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: { command: "ls" },
      tool_use_id: "tu-1",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.tool_name).toBe("Bash");
  });

  test("rejects PreToolUse when tool_input is not an object", () => {
    const r = ParseHookInput({
      ...claudeBase,
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: "oops",
      tool_use_id: "tu-1",
    });
    expect(r.success).toBe(false);
  });

  test("rejects unknown hook_event_name string", () => {
    const r = ParseHookInput({
      ...claudeBase,
      hook_event_name: "UnknownEvent",
      source: "startup",
      model: "x",
    });
    expect(r.success).toBe(false);
  });
});

describe("ParseCodexHookInput", () => {
  const codexBase = {
    session_id: "c1",
    cwd: "/tmp",
    model: "gpt-5",
  } as const;

  test("rejects null", () => {
    expect(ParseCodexHookInput(null).success).toBe(false);
  });

  test("accepts Codex SessionStart with partial fields (resilient parsing)", () => {
    const r = ParseCodexHookInput({
      ...codexBase,
      hook_event_name: "SessionStart",
    });
    expect(r.success).toBe(true);
  });

  test("accepts Codex SessionStart", () => {
    const r = ParseCodexHookInput({
      ...codexBase,
      hook_event_name: "SessionStart",
      source: "startup",
      permission_mode: "default",
      transcript_path: null,
    });
    expect(r.success).toBe(true);
  });

  test("accepts Codex SessionStart extra top-level key (loose passthrough)", () => {
    expect(
      ParseCodexHookInput({
        ...codexBase,
        hook_event_name: "SessionStart",
        source: "startup",
        permission_mode: "default",
        transcript_path: null,
        extra_field: true,
      }).success,
    ).toBe(true);
  });

  test("rejects Codex SessionStart permission_mode auto", () => {
    expect(
      ParseCodexHookInput({
        ...codexBase,
        hook_event_name: "SessionStart",
        source: "resume",
        permission_mode: "auto",
        transcript_path: "/t.jsonl",
      }).success,
    ).toBe(false);
  });

  test("accepts Codex SessionStart source clear", () => {
    expect(
      ParseCodexHookInput({
        ...codexBase,
        hook_event_name: "SessionStart",
        source: "clear",
        permission_mode: "default",
        transcript_path: null,
      }).success,
    ).toBe(true);
  });

  test("accepts Codex Stop with null last_assistant_message", () => {
    const r = ParseCodexHookInput({
      ...codexBase,
      hook_event_name: "Stop",
      turn_id: "t1",
      transcript_path: null,
      stop_hook_active: false,
      last_assistant_message: null,
      permission_mode: "default",
    });
    expect(r.success).toBe(true);
  });

  test("accepts Codex Stop with extra properties (loose passthrough)", () => {
    const r = ParseCodexHookInput({
      ...codexBase,
      hook_event_name: "Stop",
      turn_id: "t1",
      transcript_path: null,
      stop_hook_active: false,
      last_assistant_message: null,
      permission_mode: "default",
      extra_field: true,
    });
    expect(r.success).toBe(true);
  });

  test("rejects Codex Stop permission_mode auto (not in stop.command.input schema)", () => {
    const r = ParseCodexHookInput({
      ...codexBase,
      hook_event_name: "Stop",
      turn_id: "t1",
      transcript_path: null,
      stop_hook_active: false,
      last_assistant_message: null,
      permission_mode: "auto",
    });
    expect(r.success).toBe(false);
  });

  test("accepts Codex PreToolUse non-Bash tool_name (forward-compatible)", () => {
    expect(
      ParseCodexHookInput({
        ...codexBase,
        hook_event_name: "PreToolUse",
        turn_id: "t1",
        transcript_path: null,
        permission_mode: "default",
        tool_name: "Write",
        tool_use_id: "u1",
        tool_input: { command: "ignored" },
      }).success,
    ).toBe(true);
  });

  test("accepts Codex PreToolUse extra top-level key (loose passthrough)", () => {
    expect(
      ParseCodexHookInput({
        ...codexBase,
        hook_event_name: "PreToolUse",
        turn_id: "t1",
        transcript_path: null,
        permission_mode: "default",
        tool_name: "Bash",
        tool_use_id: "u1",
        tool_input: { command: "ls" },
        extra_field: true,
      }).success,
    ).toBe(true);
  });

  test("accepts Codex PreToolUse tool_input extra properties (resilient parsing)", () => {
    expect(
      ParseCodexHookInput({
        ...codexBase,
        hook_event_name: "PreToolUse",
        turn_id: "t1",
        transcript_path: null,
        permission_mode: "default",
        tool_name: "Bash",
        tool_use_id: "u1",
        tool_input: { command: "ls", description: "run" },
      }).success,
    ).toBe(true);
  });

  test("rejects Codex PreToolUse permission_mode auto", () => {
    expect(
      ParseCodexHookInput({
        ...codexBase,
        hook_event_name: "PreToolUse",
        turn_id: "t1",
        transcript_path: null,
        permission_mode: "auto",
        tool_name: "Bash",
        tool_use_id: "u1",
        tool_input: { command: "ls" },
      }).success,
    ).toBe(false);
  });

  test("accepts Codex PostToolUse non-Bash tool_name (forward-compatible)", () => {
    expect(
      ParseCodexHookInput({
        ...codexBase,
        hook_event_name: "PostToolUse",
        turn_id: "t1",
        transcript_path: null,
        permission_mode: "default",
        tool_name: "Write",
        tool_use_id: "u1",
        tool_input: { command: "ignored" },
        tool_response: {},
      }).success,
    ).toBe(true);
  });

  test("accepts Codex PostToolUse extra top-level key (loose passthrough)", () => {
    expect(
      ParseCodexHookInput({
        ...codexBase,
        hook_event_name: "PostToolUse",
        turn_id: "t1",
        transcript_path: null,
        permission_mode: "default",
        tool_name: "Bash",
        tool_use_id: "u1",
        tool_input: { command: "ls" },
        tool_response: "",
        extra_field: true,
      }).success,
    ).toBe(true);
  });

  test("accepts Codex PostToolUse tool_input extra properties (resilient parsing)", () => {
    expect(
      ParseCodexHookInput({
        ...codexBase,
        hook_event_name: "PostToolUse",
        turn_id: "t1",
        transcript_path: null,
        permission_mode: "default",
        tool_name: "Bash",
        tool_use_id: "u1",
        tool_input: { command: "ls", cwd: "/tmp" },
        tool_response: null,
      }).success,
    ).toBe(true);
  });

  test("rejects Codex PostToolUse permission_mode auto", () => {
    expect(
      ParseCodexHookInput({
        ...codexBase,
        hook_event_name: "PostToolUse",
        turn_id: "t1",
        transcript_path: null,
        permission_mode: "auto",
        tool_name: "Bash",
        tool_use_id: "u1",
        tool_input: { command: "ls" },
        tool_response: 0,
      }).success,
    ).toBe(false);
  });

  test("accepts Codex UserPromptSubmit extra top-level key (loose passthrough)", () => {
    expect(
      ParseCodexHookInput({
        ...codexBase,
        hook_event_name: "UserPromptSubmit",
        turn_id: "t1",
        transcript_path: null,
        permission_mode: "default",
        prompt: "hi",
        extra_field: true,
      }).success,
    ).toBe(true);
  });

  test("rejects Codex UserPromptSubmit permission_mode auto", () => {
    expect(
      ParseCodexHookInput({
        ...codexBase,
        hook_event_name: "UserPromptSubmit",
        turn_id: "t1",
        transcript_path: "/p.jsonl",
        permission_mode: "auto",
        prompt: "run tests",
      }).success,
    ).toBe(false);
  });

  test("rejects Codex event not in union", () => {
    const r = ParseCodexHookInput({
      ...codexBase,
      hook_event_name: "Notification",
      message: "hi",
      notification_type: "info",
    });
    expect(r.success).toBe(false);
  });
});

describe("tool input parsers", () => {
  test("ParseBashToolInput accepts valid command", () => {
    const r = ParseBashToolInput({ command: "pwd" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.command).toBe("pwd");
  });

  test("ParseBashToolInput rejects missing command", () => {
    expect(ParseBashToolInput({}).success).toBe(false);
  });

  test("ParseWriteToolInput accepts file_path + content", () => {
    const r = ParseWriteToolInput({ file_path: "a.ts", content: "x" });
    expect(r.success).toBe(true);
  });

  test("ParseWriteToolInput rejects partial shape", () => {
    expect(ParseWriteToolInput({ file_path: "a.ts" }).success).toBe(false);
  });

  test("ParseEditToolInput accepts required strings", () => {
    const r = ParseEditToolInput({
      file_path: "a.ts",
      old_string: "a",
      new_string: "b",
    });
    expect(r.success).toBe(true);
  });

  test("ParseEditToolInput rejects when old_string missing", () => {
    expect(
      ParseEditToolInput({ file_path: "a.ts", new_string: "b" }).success,
    ).toBe(false);
  });
});

describe("LooksLikeMcpToolName", () => {
  test("matches mcp__server__tool pattern", () => {
    expect(LooksLikeMcpToolName("mcp__github__search")).toBe(true);
  });

  test("rejects builtin-style names", () => {
    expect(LooksLikeMcpToolName("Bash")).toBe(false);
    expect(LooksLikeMcpToolName("Read")).toBe(false);
  });

  test("rejects incomplete prefix", () => {
    expect(LooksLikeMcpToolName("mcp__only")).toBe(false);
    expect(LooksLikeMcpToolName("")).toBe(false);
  });
});

describe("StopHookGuardShouldSkip", () => {
  test("returns true only for strict boolean true", () => {
    expect(StopHookGuardShouldSkip({ stop_hook_active: true })).toBe(true);
    expect(StopHookGuardShouldSkip({ stop_hook_active: false })).toBe(false);
  });

  test("does not treat truthy non-boolean as skip", () => {
    expect(
      StopHookGuardShouldSkip({ stop_hook_active: true as boolean }),
    ).toBe(true);
    expect(
      StopHookGuardShouldSkip({
        stop_hook_active: "yes" as unknown as boolean,
      }),
    ).toBe(false);
  });
});

describe("ToolInputFilePath / ToolInputCommand", () => {
  test("returns string fields when values are strings", () => {
    expect(ToolInputFilePath({ file_path: "/x" })).toBe("/x");
    expect(ToolInputCommand({ command: "ls" })).toBe("ls");
  });

  test("returns undefined when field missing or wrong type", () => {
    expect(ToolInputFilePath({})).toBeUndefined();
    expect(ToolInputFilePath({ file_path: 1 })).toBeUndefined();
    expect(ToolInputCommand({ command: ["ls"] })).toBeUndefined();
  });

  test("returns undefined when tool_input is not a generic object", () => {
    expect(ToolInputFilePath(null)).toBeUndefined();
    expect(ToolInputCommand("nope")).toBeUndefined();
  });
});

describe("HooksConfigSchema", () => {
  test("every HookEventName is accepted as a config key with an empty matcher list", () => {
    for (const event of HookEventNameSchema.options) {
      const r = HooksConfigSchema.safeParse({ [event]: [] });
      expect(r.success).toBe(true);
    }
  });

  test("accepts partial hooks with matcher groups", () => {
    const r = HooksConfigSchema.safeParse({
      SessionStart: [{ hooks: [{ type: "command", command: "echo" }] }],
    });
    expect(r.success).toBe(true);
  });

  test("rejects hooks when matcher group hooks is not an array", () => {
    const r = HooksConfigSchema.safeParse({
      Stop: "not-an-array",
    });
    expect(r.success).toBe(false);
  });
});

describe("PermissionRequestAllowStdoutSchema", () => {
  test("accepts minimal allow decision stdout", () => {
    const r = PermissionRequestAllowStdoutSchema.safeParse({
      hookSpecificOutput: {
        hookEventName: "PermissionRequest",
        decision: { behavior: "allow" },
      },
    });
    expect(r.success).toBe(true);
  });

  test("rejects wrong hookEventName in nested object", () => {
    const r = PermissionRequestAllowStdoutSchema.safeParse({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        decision: { behavior: "allow" },
      },
    });
    expect(r.success).toBe(false);
  });
});

/**
 * Shapes aligned with Claude Code “Automate workflows with hooks” + reference tables.
 * @see https://code.claude.com/docs/en/hooks (and llms.txt index)
 */
describe("docs: settings.json hook configurations", () => {
  test("Notification + command handler (desktop notify recipe)", () => {
    const r = ClaudeSettingsHooksSchema.safeParse({
      hooks: {
        Notification: [
          {
            matcher: "",
            hooks: [
              {
                type: "command",
                command:
                  "osascript -e 'display notification \"Claude Code needs your attention\" with title \"Claude Code\"'",
              },
            ],
          },
        ],
      },
    });
    expect(r.success).toBe(true);
  });

  test("PostToolUse matcher Edit|Write + formatter command", () => {
    const r = HooksConfigSchema.safeParse({
      PostToolUse: [
        {
          matcher: "Edit|Write",
          hooks: [
            {
              type: "command",
              command: "jq -r '.tool_input.file_path' | xargs npx prettier --write",
            },
          ],
        },
      ],
    });
    expect(r.success).toBe(true);
  });

  test("PreToolUse matcher Edit|Write + project script", () => {
    const r = HooksConfigSchema.safeParse({
      PreToolUse: [
        {
          matcher: "Edit|Write",
          hooks: [
            {
              type: "command",
              command: '"$CLAUDE_PROJECT_DIR"/.claude/hooks/protect-files.sh',
            },
          ],
        },
      ],
    });
    expect(r.success).toBe(true);
  });

  test("PreToolUse matcher Bash + if field (permission rule syntax)", () => {
    const r = HooksConfigSchema.safeParse({
      PreToolUse: [
        {
          matcher: "Bash",
          hooks: [
            {
              type: "command",
              if: "Bash(git *)",
              command: '"$CLAUDE_PROJECT_DIR"/.claude/hooks/check-git-policy.sh',
            },
          ],
        },
      ],
    });
    expect(r.success).toBe(true);
  });

  test("SessionStart matcher compact + context echo", () => {
    const r = HooksConfigSchema.safeParse({
      SessionStart: [
        {
          matcher: "compact",
          hooks: [
            {
              type: "command",
              command:
                "echo 'Reminder: use Bun, not npm. Run bun test before committing.'",
            },
          ],
        },
      ],
    });
    expect(r.success).toBe(true);
  });

  test("ConfigChange audit jq recipe", () => {
    const r = HooksConfigSchema.safeParse({
      ConfigChange: [
        {
          matcher: "",
          hooks: [
            {
              type: "command",
              command:
                "jq -c '{timestamp: now | todate, source: .source, file: .file_path}' >> ~/claude-config-audit.log",
            },
          ],
        },
      ],
    });
    expect(r.success).toBe(true);
  });

  test("CwdChanged without matcher (direnv recipe)", () => {
    const r = HooksConfigSchema.safeParse({
      CwdChanged: [
        {
          hooks: [
            {
              type: "command",
              command: 'direnv export bash >> "$CLAUDE_ENV_FILE"',
            },
          ],
        },
      ],
    });
    expect(r.success).toBe(true);
  });

  test("FileChanged matcher .envrc|.env", () => {
    const r = HooksConfigSchema.safeParse({
      FileChanged: [
        {
          matcher: ".envrc|.env",
          hooks: [
            {
              type: "command",
              command: 'direnv export bash >> "$CLAUDE_ENV_FILE"',
            },
          ],
        },
      ],
    });
    expect(r.success).toBe(true);
  });

  test("SessionEnd matcher clear", () => {
    const r = HooksConfigSchema.safeParse({
      SessionEnd: [
        {
          matcher: "clear",
          hooks: [
            {
              type: "command",
              command: "rm -f /tmp/claude-scratch-*.txt",
            },
          ],
        },
      ],
    });
    expect(r.success).toBe(true);
  });

  test("PostToolUse matcher Bash + command log", () => {
    const r = HooksConfigSchema.safeParse({
      PostToolUse: [
        {
          matcher: "Bash",
          hooks: [
            {
              type: "command",
              command: "jq -r '.tool_input.command' >> ~/.claude/command-log.txt",
            },
          ],
        },
      ],
    });
    expect(r.success).toBe(true);
  });

  test("PreToolUse MCP server regex matcher", () => {
    const r = HooksConfigSchema.safeParse({
      PreToolUse: [
        {
          matcher: "mcp__github__.*",
          hooks: [
            {
              type: "command",
              command: 'echo "GitHub tool called: $(jq -r \'.tool_name\')" >&2',
            },
          ],
        },
      ],
    });
    expect(r.success).toBe(true);
  });

  test("Stop prompt hook", () => {
    const r = HooksConfigSchema.safeParse({
      Stop: [
        {
          hooks: [
            {
              type: "prompt",
              prompt:
                'Check if all tasks are complete. If not, respond with {"ok": false, "reason": "what remains"}.',
            },
          ],
        },
      ],
    });
    expect(r.success).toBe(true);
  });

  test("Stop agent hook with timeout", () => {
    const r = HooksConfigSchema.safeParse({
      Stop: [
        {
          hooks: [
            {
              type: "agent",
              prompt:
                "Verify that all unit tests pass. Run the test suite and check the results. $ARGUMENTS",
              timeout: 120,
            },
          ],
        },
      ],
    });
    expect(r.success).toBe(true);
  });

  test("PostToolUse HTTP hook with headers and allowedEnvVars", () => {
    const r = HooksConfigSchema.safeParse({
      PostToolUse: [
        {
          hooks: [
            {
              type: "http",
              url: "http://localhost:8080/hooks/tool-use",
              headers: { Authorization: "Bearer $MY_TOKEN" },
              allowedEnvVars: ["MY_TOKEN"],
            },
          ],
        },
      ],
    });
    expect(r.success).toBe(true);
  });

  test("PermissionRequest ExitPlanMode auto-allow command (echo JSON)", () => {
    const r = HooksConfigSchema.safeParse({
      PermissionRequest: [
        {
          matcher: "ExitPlanMode",
          hooks: [
            {
              type: "command",
              command:
                'echo \'{"hookSpecificOutput": {"hookEventName": "PermissionRequest", "decision": {"behavior": "allow"}}}\'',
            },
          ],
        },
      ],
    });
    expect(r.success).toBe(true);
  });

  test("ClaudeSettingsFragment disableAllHooks", () => {
    const r = ClaudeSettingsFragmentSchema.safeParse({
      disableAllHooks: true,
    });
    expect(r.success).toBe(true);
  });
});

describe("docs: hook stdin JSON (ParseHookInput)", () => {
  test("PreToolUse Bash excerpt: docs omit tool_use_id; resilient parsing accepts it", () => {
    const docTeaser = {
      ...claudeBase,
      hook_event_name: "PreToolUse" as const,
      tool_name: "Bash",
      tool_input: { command: "npm test" },
    };
    // tool_use_id is now optional for resilient parsing — partial payloads accepted
    expect(ParseHookInput(docTeaser).success).toBe(true);

    const runtimeShape = { ...docTeaser, tool_use_id: "tu-doc-1" };
    const r = ParseHookInput(runtimeShape);
    expect(r.success).toBe(true);
    if (r.success && r.data.hook_event_name === "PreToolUse") {
      const bash = ParseBashToolInput(r.data.tool_input ?? {});
      expect(bash.success).toBe(true);
      if (bash.success) expect(bash.data.command).toBe("npm test");
    }
  });

  test("PostToolUse after Edit with file_path in tool_input", () => {
    const r = ParseHookInput({
      ...claudeBase,
      hook_event_name: "PostToolUse",
      tool_name: "Edit",
      tool_input: {
        file_path: "/Users/sarah/myproject/src/app.ts",
        old_string: "a",
        new_string: "b",
      },
      tool_response: {},
      tool_use_id: "tu-2",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(ToolInputFilePath(r.data.tool_input)).toBe(
        "/Users/sarah/myproject/src/app.ts",
      );
    }
  });

  test("UserPromptSubmit includes prompt text", () => {
    const r = ParseHookInput({
      ...claudeBase,
      hook_event_name: "UserPromptSubmit",
      prompt: "Refactor the auth module",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.prompt).toContain("auth");
  });

  test("Notification permission_prompt", () => {
    const r = ParseHookInput({
      ...claudeBase,
      hook_event_name: "Notification",
      message: "Waiting for approval",
      notification_type: "permission_prompt",
    });
    expect(r.success).toBe(true);
  });

  test("SessionStart source compact (re-inject context hook)", () => {
    const r = ParseHookInput({
      ...claudeBase,
      hook_event_name: "SessionStart",
      source: "compact",
      model: "opus",
    });
    expect(r.success).toBe(true);
  });

  test("ConfigChange project_settings + file_path", () => {
    const r = ParseHookInput({
      ...claudeBase,
      hook_event_name: "ConfigChange",
      source: "project_settings",
      file_path: ".claude/settings.json",
    });
    expect(r.success).toBe(true);
  });

  test("CwdChanged old_cwd and new_cwd", () => {
    const r = ParseHookInput({
      ...claudeBase,
      hook_event_name: "CwdChanged",
      old_cwd: "/tmp/a",
      new_cwd: "/tmp/b",
    });
    expect(r.success).toBe(true);
  });

  test("FileChanged basename-style path and change event", () => {
    const r = ParseHookInput({
      ...claudeBase,
      hook_event_name: "FileChanged",
      file_path: ".env",
      event: "change",
    });
    expect(r.success).toBe(true);
  });

  test("SessionEnd matcher reason clear", () => {
    const r = ParseHookInput({
      ...claudeBase,
      hook_event_name: "SessionEnd",
      reason: "clear",
    });
    expect(r.success).toBe(true);
  });

  test("Stop troubleshooting: stop_hook_active true skips continuation logic", () => {
    const r = ParseHookInput({
      ...claudeBase,
      hook_event_name: "Stop",
      stop_hook_active: true,
      last_assistant_message: "Done.",
    });
    expect(r.success).toBe(true);
    if (r.success && r.data.hook_event_name === "Stop") {
      const stop = r.data as { stop_hook_active: boolean };
      expect(stop.stop_hook_active).toBe(true);
      expect(StopHookGuardShouldSkip(stop)).toBe(true);
    }
  });

  test("StopFailure rate_limit", () => {
    const r = ParseHookInput({
      ...claudeBase,
      hook_event_name: "StopFailure",
      error: "rate_limit",
    });
    expect(r.success).toBe(true);
  });

  test("PreCompact manual trigger", () => {
    const r = ParseHookInput({
      ...claudeBase,
      hook_event_name: "PreCompact",
      trigger: "manual",
      custom_instructions: "Keep API contracts",
    });
    expect(r.success).toBe(true);
  });

  test("PostCompact after compaction", () => {
    const r = ParseHookInput({
      ...claudeBase,
      hook_event_name: "PostCompact",
      trigger: "auto",
      compact_summary: "Discussed hooks and tests.",
    });
    expect(r.success).toBe(true);
  });

  test("InstructionsLoaded session_start", () => {
    const r = ParseHookInput({
      ...claudeBase,
      hook_event_name: "InstructionsLoaded",
      file_path: "CLAUDE.md",
      memory_type: "Project",
      load_reason: "session_start",
    });
    expect(r.success).toBe(true);
  });

  test("PermissionDenied stdin (retry is stdout; see HookSpecificPermissionDeniedOutputSchema)", () => {
    const r = ParseHookInput({
      ...claudeBase,
      hook_event_name: "PermissionDenied",
      tool_name: "Bash",
      tool_input: { command: "ls" },
      tool_use_id: "tu-denied",
      reason: "classifier",
    });
    expect(r.success).toBe(true);
  });

  test("TaskCreated minimal task fields", () => {
    const r = ParseHookInput({
      ...claudeBase,
      hook_event_name: "TaskCreated",
      task_id: "t1",
      task_subject: "Write tests",
    });
    expect(r.success).toBe(true);
  });

  test("Elicitation and ElicitationResult MCP flows", () => {
    const elicitation = ParseHookInput({
      ...claudeBase,
      hook_event_name: "Elicitation",
      mcp_server_name: "my-server",
      message: "Pick an option",
      mode: "form",
    });
    expect(elicitation.success).toBe(true);

    const result = ParseHookInput({
      ...claudeBase,
      hook_event_name: "ElicitationResult",
      mcp_server_name: "my-server",
      action: "accept",
      content: { choice: "a" },
    });
    expect(result.success).toBe(true);
  });
});

describe("docs: structured JSON stdout (schemas)", () => {
  test("PreToolUse deny + permissionDecisionReason (grep vs rg example)", () => {
    const r = HookCommandOutputSchema.safeParse({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason:
          "Use rg instead of grep for better performance",
      },
    });
    expect(r.success).toBe(true);
  });

  test("HookSpecificPreToolUseOutputSchema allows defer", () => {
    const r = HookSpecificPreToolUseOutputSchema.safeParse({
      hookEventName: "PreToolUse",
      permissionDecision: "defer",
    });
    expect(r.success).toBe(true);
  });

  test("PermissionDenied stdout retry true", () => {
    const r = HookSpecificPermissionDeniedOutputSchema.safeParse({
      hookEventName: "PermissionDenied",
      retry: true,
    });
    expect(r.success).toBe(true);
  });

  test("PermissionRequest allow + setMode acceptEdits session (hooks guide recipe)", () => {
    const r = PermissionRequestAllowAcceptEditsSessionStdoutSchema.safeParse({
      hookSpecificOutput: {
        hookEventName: "PermissionRequest",
        decision: {
          behavior: "allow",
          updatedPermissions: [
            { type: "setMode", mode: "acceptEdits", destination: "session" },
          ],
        },
      },
    });
    expect(r.success).toBe(true);
  });

  test("PostToolUse / Stop style top-level decision block", () => {
    const r = HookCommandOutputSchema.safeParse({
      decision: "block",
      reason: "Not allowed",
    });
    expect(r.success).toBe(true);
  });

  test("Prompt / agent hook model response", () => {
    const fail = PromptHookModelResponseSchema.safeParse({
      ok: false,
      reason: "Tests still failing on CI",
    });
    expect(fail.success).toBe(true);

    const ok = PromptHookModelResponseSchema.safeParse({ ok: true });
    expect(ok.success).toBe(true);
  });
});

describe("docs: MCP tool name matcher convention", () => {
  test("mcp__github__search_repositories style names match LooksLikeMcpToolName", () => {
    expect(LooksLikeMcpToolName("mcp__github__search_repositories")).toBe(true);
    expect(LooksLikeMcpToolName("mcp__filesystem__read_file")).toBe(true);
  });

  test("write-oriented MCP pattern from docs", () => {
    expect(LooksLikeMcpToolName("mcp__acme__write_file")).toBe(true);
  });
});

describe("docs: handler discriminated unions", () => {
  test("PromptHookHandlerSchema requires prompt string", () => {
    expect(
      PromptHookHandlerSchema.safeParse({
        type: "prompt",
        prompt: "Decide",
      }).success,
    ).toBe(true);
    expect(
      PromptHookHandlerSchema.safeParse({ type: "prompt" }).success,
    ).toBe(false);
  });

  test("AgentHookHandlerSchema extends prompt fields", () => {
    expect(
      AgentHookHandlerSchema.safeParse({
        type: "agent",
        prompt: "Verify tests",
        timeout: 60,
      }).success,
    ).toBe(true);
  });

  test("HttpHookHandlerSchema requires url", () => {
    expect(
      HttpHookHandlerSchema.safeParse({
        type: "http",
        url: "https://example.com/hook",
      }).success,
    ).toBe(true);
    expect(HttpHookHandlerSchema.safeParse({ type: "http" }).success).toBe(
      false,
    );
  });
});

/** Hooks reference: configuration examples (https://code.claude.com/docs/en/hooks) */
describe("hooks reference: configuration JSON", () => {
  test("PreToolUse block-rm: matcher Bash + if Bash(rm *)", () => {
    const r = HooksConfigSchema.safeParse({
      PreToolUse: [
        {
          matcher: "Bash",
          hooks: [
            {
              type: "command",
              if: "Bash(rm *)",
              command: '"$CLAUDE_PROJECT_DIR"/.claude/hooks/block-rm.sh',
            },
          ],
        },
      ],
    });
    expect(r.success).toBe(true);
  });

  test("PreToolUse MCP memory + cross-server write matchers", () => {
    const r = HooksConfigSchema.safeParse({
      PreToolUse: [
        {
          matcher: "mcp__memory__.*",
          hooks: [
            {
              type: "command",
              command: "echo 'Memory operation initiated' >> ~/mcp-operations.log",
            },
          ],
        },
        {
          matcher: "mcp__.*__write.*",
          hooks: [
            {
              type: "command",
              command: "/home/user/scripts/validate-mcp-write.py",
            },
          ],
        },
      ],
    });
    expect(r.success).toBe(true);
  });

  test("PostToolUse Write|Edit + project check-style.sh", () => {
    const r = HooksConfigSchema.safeParse({
      PostToolUse: [
        {
          matcher: "Write|Edit",
          hooks: [
            {
              type: "command",
              command: '"$CLAUDE_PROJECT_DIR"/.claude/hooks/check-style.sh',
            },
          ],
        },
      ],
    });
    expect(r.success).toBe(true);
  });

  test("plugin hooks.json: description + CLAUDE_PLUGIN_ROOT format.sh", () => {
    const r = ClaudeSettingsHooksSchema.safeParse({
      description: "Automatic code formatting",
      hooks: {
        PostToolUse: [
          {
            matcher: "Write|Edit",
            hooks: [
              {
                type: "command",
                command: "${CLAUDE_PLUGIN_ROOT}/scripts/format.sh",
                timeout: 30,
              },
            ],
          },
        ],
      },
    });
    expect(r.success).toBe(true);
  });

  test("PreToolUse HTTP hook with per-handler timeout 30", () => {
    const r = HooksConfigSchema.safeParse({
      PreToolUse: [
        {
          matcher: "Bash",
          hooks: [
            {
              type: "http",
              url: "http://localhost:8080/hooks/pre-tool-use",
              timeout: 30,
              headers: { Authorization: "Bearer $MY_TOKEN" },
              allowedEnvVars: ["MY_TOKEN"],
            },
          ],
        },
      ],
    });
    expect(r.success).toBe(true);
  });

  test("Notification split matchers: permission_prompt vs idle_prompt", () => {
    const r = HooksConfigSchema.safeParse({
      Notification: [
        {
          matcher: "permission_prompt",
          hooks: [{ type: "command", command: "/path/to/permission-alert.sh" }],
        },
        {
          matcher: "idle_prompt",
          hooks: [{ type: "command", command: "/path/to/idle-notification.sh" }],
        },
      ],
    });
    expect(r.success).toBe(true);
  });

  test("WorktreeCreate + WorktreeRemove command recipes", () => {
    const create = HooksConfigSchema.safeParse({
      WorktreeCreate: [
        {
          hooks: [
            {
              type: "command",
              command:
                'bash -c \'NAME=$(jq -r .name); DIR="$HOME/.claude/worktrees/$NAME"; svn checkout https://svn.example.com/repo/trunk "$DIR" >&2 && echo "$DIR"\'',
            },
          ],
        },
      ],
    });
    const remove = HooksConfigSchema.safeParse({
      WorktreeRemove: [
        {
          hooks: [
            {
              type: "command",
              command: "bash -c 'jq -r .worktree_path | xargs rm -rf'",
            },
          ],
        },
      ],
    });
    expect(create.success).toBe(true);
    expect(remove.success).toBe(true);
  });

  test("PostToolUse async command + long timeout (background hooks)", () => {
    const r = HooksConfigSchema.safeParse({
      PostToolUse: [
        {
          matcher: "Write",
          hooks: [
            {
              type: "command",
              command: "/path/to/run-tests.sh",
              async: true,
              timeout: 120,
            },
          ],
        },
      ],
    });
    expect(r.success).toBe(true);
  });

  test("PostToolUse async run-tests-async recipe (Write|Edit, timeout 300)", () => {
    const r = HooksConfigSchema.safeParse({
      PostToolUse: [
        {
          matcher: "Write|Edit",
          hooks: [
            {
              type: "command",
              command:
                '"$CLAUDE_PROJECT_DIR"/.claude/hooks/run-tests-async.sh',
              async: true,
              timeout: 300,
            },
          ],
        },
      ],
    });
    expect(r.success).toBe(true);
  });

  test("PostToolUse command with shell powershell (Windows)", () => {
    const r = HooksConfigSchema.safeParse({
      PostToolUse: [
        {
          matcher: "Write",
          hooks: [
            {
              type: "command",
              shell: "powershell",
              command: "Write-Host 'File written'",
            },
          ],
        },
      ],
    });
    expect(r.success).toBe(true);
  });

  test("UserPromptSubmit prompt hook with $ARGUMENTS", () => {
    const r = HooksConfigSchema.safeParse({
      UserPromptSubmit: [
        {
          hooks: [
            {
              type: "prompt",
              prompt: "Evaluate if Claude should stop: $ARGUMENTS. Check if all tasks are complete.",
              timeout: 30,
            },
          ],
        },
      ],
    });
    expect(r.success).toBe(true);
  });

  test("TaskCreated supports prompt type (four-type events)", () => {
    const r = HooksConfigSchema.safeParse({
      TaskCreated: [
        {
          hooks: [
            {
              type: "prompt",
              prompt: "Validate task: $ARGUMENTS",
              model: "haiku",
            },
          ],
        },
      ],
    });
    expect(r.success).toBe(true);
  });

  test("common handler fields: statusMessage, once", () => {
    const r = HooksConfigSchema.safeParse({
      PreToolUse: [
        {
          matcher: "Bash",
          hooks: [
            {
              type: "command",
              command: "true",
              statusMessage: "Checking policy…",
              once: true,
            },
          ],
        },
      ],
    });
    expect(r.success).toBe(true);
  });
});

/** Hooks reference: stdin samples (event-specific fields + common fields) */
describe("hooks reference: stdin JSON (ParseHookInput)", () => {
  test("SessionStart reference sample (transcript_path, source, model)", () => {
    const r = ParseHookInput({
      session_id: "abc123",
      transcript_path:
        "/Users/x/.claude/projects/p/00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
      cwd: "/Users/x",
      hook_event_name: "SessionStart",
      source: "startup",
      model: "claude-sonnet-4-6",
    });
    expect(r.success).toBe(true);
  });

  test("PermissionRequest has no tool_use_id; accepts permission_suggestions", () => {
    const r = ParseHookInput({
      session_id: "abc123",
      transcript_path: "/Users/x/.claude/projects/p/t.jsonl",
      cwd: "/Users/x",
      permission_mode: "default",
      hook_event_name: "PermissionRequest",
      tool_name: "Bash",
      tool_input: {
        command: "rm -rf node_modules",
        description: "Remove node_modules directory",
      },
      permission_suggestions: [
        {
          type: "addRules",
          rules: [{ toolName: "Bash", ruleContent: "rm -rf node_modules" }],
          behavior: "allow",
          destination: "localSettings",
        },
      ],
    });
    expect(r.success).toBe(true);
    if (r.success && r.data.hook_event_name === "PermissionRequest") {
      expect("tool_use_id" in r.data).toBe(false);
    }
  });

  test("PreToolUse block-rm walkthrough: rm -rf /tmp/build", () => {
    const r = ParseHookInput({
      ...claudeBase,
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: { command: "rm -rf /tmp/build" },
      tool_use_id: "tu-rm",
    });
    expect(r.success).toBe(true);
  });

  test("PostToolUse Write reference sample (camelCase tool_response)", () => {
    const r = ParseHookInput({
      session_id: "abc123",
      transcript_path: "/Users/x/.claude/projects/p/t.jsonl",
      cwd: "/Users/x",
      permission_mode: "default",
      hook_event_name: "PostToolUse",
      tool_name: "Write",
      tool_input: {
        file_path: "/path/to/file.txt",
        content: "file content",
      },
      tool_response: {
        filePath: "/path/to/file.txt",
        success: true,
      },
      tool_use_id: "toolu_01ABC123",
    });
    expect(r.success).toBe(true);
  });

  test("PostToolUseFailure reference sample", () => {
    const r = ParseHookInput({
      session_id: "abc123",
      transcript_path: "/Users/x/.claude/projects/p/t.jsonl",
      cwd: "/Users/x",
      permission_mode: "default",
      hook_event_name: "PostToolUseFailure",
      tool_name: "Bash",
      tool_input: {
        command: "npm test",
        description: "Run test suite",
      },
      tool_use_id: "toolu_01ABC123",
      error: "Command exited with non-zero status code 1",
      is_interrupt: false,
    });
    expect(r.success).toBe(true);
  });

  test("PermissionDenied auto-mode denial sample", () => {
    const r = ParseHookInput({
      session_id: "abc123",
      transcript_path: "/Users/x/.claude/projects/p/t.jsonl",
      cwd: "/Users/x",
      permission_mode: "auto",
      hook_event_name: "PermissionDenied",
      tool_name: "Bash",
      tool_input: {
        command: "rm -rf /tmp/build",
        description: "Clean build directory",
      },
      tool_use_id: "toolu_01ABC123",
      reason: "Auto mode denied: command targets a path outside the project",
    });
    expect(r.success).toBe(true);
  });

  test("Notification reference sample with title", () => {
    const r = ParseHookInput({
      session_id: "abc123",
      transcript_path: "/Users/x/.claude/projects/p/t.jsonl",
      cwd: "/Users/x",
      hook_event_name: "Notification",
      message: "Claude needs your permission to use Bash",
      title: "Permission needed",
      notification_type: "permission_prompt",
    });
    expect(r.success).toBe(true);
  });

  test("SubagentStart + SubagentStop reference samples", () => {
    const start = ParseHookInput({
      session_id: "abc123",
      transcript_path: "/Users/x/.claude/projects/p/t.jsonl",
      cwd: "/Users/x",
      hook_event_name: "SubagentStart",
      agent_id: "agent-abc123",
      agent_type: "Explore",
    });
    expect(start.success).toBe(true);

    const stop = ParseHookInput({
      session_id: "abc123",
      transcript_path: "~/.claude/projects/p/abc123.jsonl",
      cwd: "/Users/x",
      permission_mode: "default",
      hook_event_name: "SubagentStop",
      stop_hook_active: false,
      agent_id: "def456",
      agent_type: "Explore",
      agent_transcript_path:
        "~/.claude/projects/p/abc123/subagents/agent-def456.jsonl",
      last_assistant_message:
        "Analysis complete. Found 3 potential issues...",
    });
    expect(stop.success).toBe(true);
  });

  test("TaskCreated + TaskCompleted with optional team fields", () => {
    const payload = {
      session_id: "abc123",
      transcript_path: "/Users/x/.claude/projects/p/t.jsonl",
      cwd: "/Users/x",
      permission_mode: "default" as const,
      task_id: "task-001",
      task_subject: "Implement user authentication",
      task_description: "Add login and signup endpoints",
      teammate_name: "implementer",
      team_name: "my-project",
    };
    expect(
      ParseHookInput({ ...payload, hook_event_name: "TaskCreated" }).success,
    ).toBe(true);
    expect(
      ParseHookInput({ ...payload, hook_event_name: "TaskCompleted" }).success,
    ).toBe(true);
  });

  test("Stop reference: stop_hook_active true on continued stop", () => {
    const r = ParseHookInput({
      session_id: "abc123",
      transcript_path: "~/.claude/projects/p/abc123.jsonl",
      cwd: "/Users/x",
      permission_mode: "default",
      hook_event_name: "Stop",
      stop_hook_active: true,
      last_assistant_message:
        "I've completed the refactoring. Here's a summary...",
    });
    expect(r.success).toBe(true);
  });

  test("StopFailure reference: error_details + last_assistant_message", () => {
    const r = ParseHookInput({
      session_id: "abc123",
      transcript_path: "/Users/x/.claude/projects/p/t.jsonl",
      cwd: "/Users/x",
      hook_event_name: "StopFailure",
      error: "rate_limit",
      error_details: "429 Too Many Requests",
      last_assistant_message: "API Error: Rate limit reached",
    });
    expect(r.success).toBe(true);
  });

  test("TeammateIdle reference sample", () => {
    const r = ParseHookInput({
      session_id: "abc123",
      transcript_path: "/Users/x/.claude/projects/p/t.jsonl",
      cwd: "/Users/x",
      permission_mode: "default",
      hook_event_name: "TeammateIdle",
      teammate_name: "researcher",
      team_name: "my-project",
    });
    expect(r.success).toBe(true);
  });

  test("UserPromptSubmit reference sample", () => {
    const r = ParseHookInput({
      session_id: "abc123",
      transcript_path: "/Users/x/.claude/projects/p/t.jsonl",
      cwd: "/Users/x",
      permission_mode: "default",
      hook_event_name: "UserPromptSubmit",
      prompt: "Write a function to calculate the factorial of a number",
    });
    expect(r.success).toBe(true);
  });

  test("InstructionsLoaded path_glob_match with globs", () => {
    const r = ParseHookInput({
      session_id: "abc123",
      transcript_path: "/Users/x/.claude/projects/p/t.jsonl",
      cwd: "/Users/my-project",
      hook_event_name: "InstructionsLoaded",
      file_path: "/Users/my-project/CLAUDE.md",
      memory_type: "Project",
      load_reason: "path_glob_match",
      globs: ["packages/**/CLAUDE.md"],
      trigger_file_path: "/Users/my-project/packages/foo/CLAUDE.md",
    });
    expect(r.success).toBe(true);
  });

  test("PreCompact manual with empty custom_instructions", () => {
    const r = ParseHookInput({
      session_id: "abc123",
      transcript_path: "/Users/x/.claude/projects/p/t.jsonl",
      cwd: "/Users/x",
      hook_event_name: "PreCompact",
      trigger: "manual",
      custom_instructions: "",
    });
    expect(r.success).toBe(true);
  });

  test("PostCompact reference compact_summary", () => {
    const r = ParseHookInput({
      session_id: "abc123",
      transcript_path: "/Users/x/.claude/projects/p/t.jsonl",
      cwd: "/Users/x",
      hook_event_name: "PostCompact",
      trigger: "manual",
      compact_summary: "Summary of the compacted conversation...",
    });
    expect(r.success).toBe(true);
  });

  test("SessionEnd reason other", () => {
    const r = ParseHookInput({
      session_id: "abc123",
      transcript_path: "/Users/x/.claude/projects/p/t.jsonl",
      cwd: "/Users/x",
      hook_event_name: "SessionEnd",
      reason: "other",
    });
    expect(r.success).toBe(true);
  });

  test("FileChanged add and unlink events", () => {
    expect(
      ParseHookInput({
        ...claudeBase,
        hook_event_name: "FileChanged",
        file_path: "/Users/my-project/new.txt",
        event: "add",
      }).success,
    ).toBe(true);
    expect(
      ParseHookInput({
        ...claudeBase,
        hook_event_name: "FileChanged",
        file_path: "/Users/my-project/gone.txt",
        event: "unlink",
      }).success,
    ).toBe(true);
  });

  test("CwdChanged reference paths", () => {
    const r = ParseHookInput({
      session_id: "abc123",
      transcript_path: "/Users/x/.claude/projects/p/transcript.jsonl",
      cwd: "/Users/my-project/src",
      hook_event_name: "CwdChanged",
      old_cwd: "/Users/my-project",
      new_cwd: "/Users/my-project/src",
    });
    expect(r.success).toBe(true);
  });

  test("WorktreeCreate + WorktreeRemove inputs", () => {
    expect(
      ParseHookInput({
        ...claudeBase,
        hook_event_name: "WorktreeCreate",
        name: "feature-auth",
      }).success,
    ).toBe(true);
    expect(
      ParseHookInput({
        ...claudeBase,
        hook_event_name: "WorktreeRemove",
        worktree_path:
          "/Users/x/my-project/.claude/worktrees/feature-auth",
      }).success,
    ).toBe(true);
  });

  test("Elicitation form + url modes", () => {
    const form = ParseHookInput({
      session_id: "abc123",
      transcript_path: "/Users/x/.claude/projects/p/t.jsonl",
      cwd: "/Users/x",
      permission_mode: "default",
      hook_event_name: "Elicitation",
      mcp_server_name: "my-mcp-server",
      message: "Please provide your credentials",
      mode: "form",
      requested_schema: {
        type: "object",
        properties: {
          username: { type: "string", title: "Username" },
        },
      },
    });
    expect(form.success).toBe(true);

    const url = ParseHookInput({
      session_id: "abc123",
      transcript_path: "/Users/x/.claude/projects/p/t.jsonl",
      cwd: "/Users/x",
      permission_mode: "default",
      hook_event_name: "Elicitation",
      mcp_server_name: "my-mcp-server",
      message: "Please authenticate",
      mode: "url",
      url: "https://auth.example.com/login",
    });
    expect(url.success).toBe(true);
  });

  test("ElicitationResult reference sample", () => {
    const r = ParseHookInput({
      session_id: "abc123",
      transcript_path: "/Users/x/.claude/projects/p/t.jsonl",
      cwd: "/Users/x",
      permission_mode: "default",
      hook_event_name: "ElicitationResult",
      mcp_server_name: "my-mcp-server",
      action: "accept",
      content: { username: "alice" },
      mode: "form",
      elicitation_id: "elicit-123",
    });
    expect(r.success).toBe(true);
  });

  test("common input: agent_id + agent_type on SessionStart", () => {
    const r = ParseHookInput({
      ...claudeBase,
      hook_event_name: "SessionStart",
      source: "startup",
      model: "opus",
      agent_type: "security-reviewer",
    });
    expect(r.success).toBe(true);
  });
});

/** Hooks reference: JSON stdout / hookSpecificOutput shapes */
describe("hooks reference: JSON output (schemas)", () => {
  test("universal continue false + stopReason", () => {
    const r = HookCommandOutputSchema.safeParse({
      continue: false,
      stopReason: "Build failed, fix errors before continuing",
    });
    expect(r.success).toBe(true);
  });

  test("UserPromptSubmit block + hookSpecificOutput additionalContext", () => {
    const r = HookCommandOutputSchema.safeParse({
      decision: "block",
      reason: "Explanation for decision",
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: "My additional context here",
      },
    });
    expect(r.success).toBe(true);
  });

  test("PreToolUse allow + updatedInput + additionalContext", () => {
    const r = HookCommandOutputSchema.safeParse({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "allow",
        permissionDecisionReason: "My reason here",
        updatedInput: { field_to_modify: "new value" },
        additionalContext: "Current environment: production. Proceed with caution.",
      },
    });
    expect(r.success).toBe(true);
  });

  test("destructive command deny (block-rm hook output)", () => {
    const r = HookCommandOutputSchema.safeParse({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: "Destructive command blocked by hook",
      },
    });
    expect(r.success).toBe(true);
  });

  test("PermissionRequest allow + updatedInput (npm run lint)", () => {
    const r = HookCommandOutputSchema.safeParse({
      hookSpecificOutput: {
        hookEventName: "PermissionRequest",
        decision: {
          behavior: "allow",
          updatedInput: { command: "npm run lint" },
        },
      },
    });
    expect(r.success).toBe(true);
  });

  test("PostToolUse block + additionalContext + updatedMCPToolOutput", () => {
    const r = HookCommandOutputSchema.safeParse({
      decision: "block",
      reason: "Explanation for decision",
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: "Additional information for Claude",
        updatedMCPToolOutput: { refined: true },
      },
    });
    expect(r.success).toBe(true);
  });

  test("PostToolUseFailure additionalContext", () => {
    const r = HookCommandOutputSchema.safeParse({
      hookSpecificOutput: {
        hookEventName: "PostToolUseFailure",
        additionalContext:
          "Additional information about the failure for Claude",
      },
    });
    expect(r.success).toBe(true);
  });

  test("ConfigChange top-level block decision", () => {
    const r = HookCommandOutputSchema.safeParse({
      decision: "block",
      reason: "Configuration changes to project settings require admin approval",
    });
    expect(r.success).toBe(true);
  });

  test("CwdChanged watchPaths output", () => {
    const r = HookCommandOutputSchema.safeParse({
      watchPaths: ["/abs/a", "/abs/b"],
    });
    expect(r.success).toBe(true);
  });

  test("WorktreeCreate HTTP-style hookSpecificOutput.worktreePath", () => {
    const r = HookSpecificWorktreeCreateOutputSchema.safeParse({
      hookEventName: "WorktreeCreate",
      worktreePath: "/absolute/path/to/worktree",
    });
    expect(r.success).toBe(true);
  });

  test("Elicitation programmatic accept", () => {
    const r = HookSpecificElicitationOutputSchema.safeParse({
      hookEventName: "Elicitation",
      action: "accept",
      content: { username: "alice" },
    });
    expect(r.success).toBe(true);
  });

  test("ElicitationResult override to decline", () => {
    const r = HookSpecificElicitationResultOutputSchema.safeParse({
      hookEventName: "ElicitationResult",
      action: "decline",
      content: {},
    });
    expect(r.success).toBe(true);
  });

  test("SessionStart additionalContext", () => {
    const r = HookSpecificSessionStartOutputSchema.safeParse({
      hookEventName: "SessionStart",
      additionalContext: "My additional context here",
    });
    expect(r.success).toBe(true);
  });

  test("SubagentStart additionalContext", () => {
    const r = HookSpecificSubagentStartOutputSchema.safeParse({
      hookEventName: "SubagentStart",
      additionalContext: "Follow security guidelines for this task",
    });
    expect(r.success).toBe(true);
  });

  test("Notification additionalContext", () => {
    const r = HookSpecificNotificationOutputSchema.safeParse({
      hookEventName: "Notification",
      additionalContext: "Observed permission notification",
    });
    expect(r.success).toBe(true);
  });

  test("async hook systemMessage delivery shape", () => {
    const r = HookCommandOutputSchema.safeParse({
      systemMessage: "Tests passed after editing /src/app.ts",
    });
    expect(r.success).toBe(true);
  });

  test("suppressOutput universal field", () => {
    const r = HookCommandOutputSchema.safeParse({
      suppressOutput: true,
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "allow",
      },
    });
    expect(r.success).toBe(true);
  });
});

/** Hooks reference: PreToolUse tool_input tables */
describe("hooks reference: tool_input schemas", () => {
  test("Read, Glob, Grep tool inputs", () => {
    expect(
      ReadToolInputSchema.safeParse({
        file_path: "/path/to/file.txt",
        offset: 10,
        limit: 50,
      }).success,
    ).toBe(true);
    expect(
      GlobToolInputSchema.safeParse({ pattern: "**/*.ts", path: "/path/to/dir" })
        .success,
    ).toBe(true);
    expect(
      GrepToolInputSchema.safeParse({
        pattern: "TODO.*fix",
        path: "/path/to/dir",
        glob: "*.ts",
        output_mode: "content",
        "-i": true,
        multiline: false,
      }).success,
    ).toBe(true);
  });

  test("WebFetch, WebSearch, Agent tool inputs", () => {
    expect(
      WebFetchToolInputSchema.safeParse({
        url: "https://example.com/api",
        prompt: "Extract the API endpoints",
      }).success,
    ).toBe(true);
    expect(
      WebSearchToolInputSchema.safeParse({
        query: "react hooks best practices",
        allowed_domains: ["docs.example.com"],
        blocked_domains: ["spam.example.com"],
      }).success,
    ).toBe(true);
    expect(
      AgentToolInputSchema.safeParse({
        prompt: "Find all API endpoints",
        description: "Find API endpoints",
        subagent_type: "Explore",
        model: "sonnet",
      }).success,
    ).toBe(true);
  });

  test("AskUserQuestion reference shape", () => {
    const r = AskUserQuestionToolInputSchema.safeParse({
      questions: [
        {
          question: "Which framework?",
          header: "Framework",
          options: [{ label: "React" }, { label: "Vue" }],
          multiSelect: false,
        },
      ],
      answers: { "Which framework?": "React" },
    });
    expect(r.success).toBe(true);
  });
});

describe("hooks reference: MCP naming", () => {
  test("mcp__memory__create_entities", () => {
    expect(LooksLikeMcpToolName("mcp__memory__create_entities")).toBe(true);
  });
});

/** OpenAI Codex hooks docs: `hooks.json`, stdin, stdout (experimental) */
const codexBaseIn = {
  session_id: "codex-sess-1",
  cwd: "/repo",
  model: "gpt-5",
} as const;

describe("codex docs: hooks.json (CodexHooksFileSchema)", () => {
  test("reference config: SessionStart, PreToolUse, PostToolUse, UserPromptSubmit, Stop", () => {
    const r = CodexHooksFileSchema.safeParse({
      hooks: {
        SessionStart: [
          {
            matcher: "startup|resume|clear",
            hooks: [
              {
                type: "command",
                command: "python3 ~/.codex/hooks/session_start.py",
                statusMessage: "Loading session notes",
              },
            ],
          },
        ],
        PreToolUse: [
          {
            matcher: "Bash",
            hooks: [
              {
                type: "command",
                command:
                  '/usr/bin/python3 "$(git rev-parse --show-toplevel)/.codex/hooks/pre_tool_use_policy.py"',
                statusMessage: "Checking Bash command",
              },
            ],
          },
        ],
        PostToolUse: [
          {
            matcher: "Bash",
            hooks: [
              {
                type: "command",
                command:
                  '/usr/bin/python3 "$(git rev-parse --show-toplevel)/.codex/hooks/post_tool_use_review.py"',
                statusMessage: "Reviewing Bash output",
              },
            ],
          },
        ],
        UserPromptSubmit: [
          {
            hooks: [
              {
                type: "command",
                command:
                  '/usr/bin/python3 "$(git rev-parse --show-toplevel)/.codex/hooks/user_prompt_submit_data_flywheel.py"',
              },
            ],
          },
        ],
        Stop: [
          {
            hooks: [
              {
                type: "command",
                command:
                  '/usr/bin/python3 "$(git rev-parse --show-toplevel)/.codex/hooks/stop_continue.py"',
                timeout: 30,
              },
            ],
          },
        ],
      },
    });
    expect(r.success).toBe(true);
  });

  test("command handler accepts timeoutSec alias (docs)", () => {
    const r = CodexCommandHookHandlerSchema.safeParse({
      type: "command",
      command: "true",
      timeoutSec: 600,
    });
    expect(r.success).toBe(true);
  });

  test("matcher on UserPromptSubmit is stored even when runtime ignores it", () => {
    const r = CodexHooksConfigSchema.safeParse({
      UserPromptSubmit: [
        {
          matcher: "should-be-ignored",
          hooks: [{ type: "command", command: "true" }],
        },
      ],
    });
    expect(r.success).toBe(true);
  });

  test("CodexHooksFileSchema.loose allows extra top-level keys", () => {
    const r = CodexHooksFileSchema.safeParse({
      hooks: { Stop: [] },
      _comment: "local only",
    });
    expect(r.success).toBe(true);
  });

  test("PreToolUse matcher Edit|Write is valid regex (Codex runtime may only emit Bash)", () => {
    const r = CodexHooksConfigSchema.safeParse({
      PreToolUse: [
        {
          matcher: "Edit|Write",
          hooks: [{ type: "command", command: "true" }],
        },
      ],
    });
    expect(r.success).toBe(true);
  });
});

describe("codex docs: stdin (ParseCodexHookInput)", () => {
  test("transcript_path may be null", () => {
    const r = ParseCodexHookInput({
      ...codexBaseIn,
      transcript_path: null,
      hook_event_name: "SessionStart",
      source: "startup",
      permission_mode: "default",
    });
    expect(r.success).toBe(true);
  });

  test("SessionStart source resume", () => {
    const r = ParseCodexHookInput({
      ...codexBaseIn,
      hook_event_name: "SessionStart",
      source: "resume",
      permission_mode: "plan",
      transcript_path: "/tmp/codex.jsonl",
    });
    expect(r.success).toBe(true);
  });

  test("PreToolUse turn-scoped Bash payload", () => {
    const r = ParseCodexHookInput({
      ...codexBaseIn,
      hook_event_name: "PreToolUse",
      turn_id: "turn-1",
      transcript_path: "/tmp/transcript.jsonl",
      permission_mode: "default",
      tool_name: "Bash",
      tool_use_id: "call_abc",
      tool_input: { command: "npm test" },
    });
    expect(r.success).toBe(true);
    if (r.success && r.data.hook_event_name === "PreToolUse") {
      expect(r.data.tool_input?.command).toBe("npm test");
    }
  });

  test("PostToolUse tool_response may be a JSON string (wire format)", () => {
    const r = ParseCodexHookInput({
      ...codexBaseIn,
      hook_event_name: "PostToolUse",
      turn_id: "turn-1",
      transcript_path: "/tmp/transcript.jsonl",
      permission_mode: "default",
      tool_name: "Bash",
      tool_use_id: "call_abc",
      tool_input: { command: "npm test" },
      tool_response: '{"stdout":"ok","exitCode":0}',
    });
    expect(r.success).toBe(true);
  });

  test("UserPromptSubmit prompt + turn_id", () => {
    const r = ParseCodexHookInput({
      ...codexBaseIn,
      hook_event_name: "UserPromptSubmit",
      turn_id: "turn-1",
      transcript_path: null,
      permission_mode: "default",
      prompt: "Refactor the auth module",
    });
    expect(r.success).toBe(true);
  });

  test("Stop continuation guard: stop_hook_active false", () => {
    const r = ParseCodexHookInput({
      ...codexBaseIn,
      hook_event_name: "Stop",
      turn_id: "turn-1",
      transcript_path: "/tmp/t.json",
      stop_hook_active: false,
      last_assistant_message: "Done.",
      permission_mode: "default",
    });
    expect(r.success).toBe(true);
  });
});

describe("codex docs: stdout JSON schemas", () => {
  test("SessionStart: common output + hookSpecificOutput.additionalContext", () => {
    const r = CodexSessionStartStdoutSchema.safeParse({
      continue: true,
      stopReason: "optional",
      systemMessage: "optional",
      suppressOutput: false,
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: "Load the workspace conventions before editing.",
      },
    });
    expect(r.success).toBe(true);
  });

  test("SessionStart stdout rejects unknown top-level keys (strict wire)", () => {
    const r = CodexSessionStartStdoutSchema.safeParse({
      continue: true,
      extraField: true,
    });
    expect(r.success).toBe(false);
  });

  test("SessionStart hookSpecificOutput rejects extra inner keys (strict wire)", () => {
    const r = CodexSessionStartStdoutSchema.safeParse({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: "ok",
        unknown: 1,
      },
    });
    expect(r.success).toBe(false);
  });

  test("SessionStart hookSpecificOutput defaults additionalContext to null", () => {
    const r = CodexSessionStartStdoutSchema.safeParse({
      hookSpecificOutput: { hookEventName: "SessionStart" },
    });
    expect(r.success).toBe(true);
    if (r.success && r.data.hookSpecificOutput) {
      expect(r.data.hookSpecificOutput.additionalContext).toBeNull();
    }
  });

  test("PreToolUse: hookSpecificOutput deny (doc shape)", () => {
    const r = CodexPreToolUseStdoutSchema.safeParse({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: "Destructive command blocked by hook.",
      },
    });
    expect(r.success).toBe(true);
  });

  test("PreToolUse: legacy top-level decision block", () => {
    const r = CodexPreToolUseStdoutSchema.safeParse({
      decision: "block",
      reason: "Destructive command blocked by hook.",
    });
    expect(r.success).toBe(true);
  });

  test("PreToolUse: systemMessage only", () => {
    const r = CodexPreToolUseStdoutSchema.safeParse({
      systemMessage: "Policy check skipped (dry run).",
    });
    expect(r.success).toBe(true);
  });

  test("PreToolUse: top-level decision approve + defaults", () => {
    const r = CodexPreToolUseStdoutSchema.safeParse({ decision: "approve" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.decision).toBe("approve");
      expect(r.data.continue).toBe(true);
      expect(r.data.hookSpecificOutput).toBeNull();
    }
  });

  test("PreToolUse stdout rejects unknown top-level keys (strict wire)", () => {
    const r = CodexPreToolUseStdoutSchema.safeParse({
      systemMessage: "x",
      extraField: true,
    });
    expect(r.success).toBe(false);
  });

  test("PreToolUseLegacyBlockStdoutSchema standalone", () => {
    const r = CodexPreToolUseLegacyBlockStdoutSchema.safeParse({
      decision: "block",
      reason: "No.",
    });
    expect(r.success).toBe(true);
  });

  test("PostToolUse: decision block + hookSpecificOutput (doc shape)", () => {
    const r = CodexPostToolUseStdoutSchema.safeParse({
      decision: "block",
      reason: "The Bash output needs review before continuing.",
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: "The command updated generated files.",
      },
    });
    expect(r.success).toBe(true);
  });

  test("PostToolUse: continue false + stopReason", () => {
    const r = CodexPostToolUseStdoutSchema.safeParse({
      continue: false,
      stopReason: "Replace tool result and stop normal processing",
      systemMessage: "Tests failed",
    });
    expect(r.success).toBe(true);
  });

  test("PostToolUse stdout rejects unknown top-level keys (strict wire)", () => {
    const r = CodexPostToolUseStdoutSchema.safeParse({
      continue: true,
      extraField: true,
    });
    expect(r.success).toBe(false);
  });

  test("PostToolUse stdout rejects top-level decision approve (BlockDecisionWire is block only)", () => {
    const r = CodexPostToolUseStdoutSchema.safeParse({
      decision: "approve",
    });
    expect(r.success).toBe(false);
  });

  test("PostToolUse hookSpecificOutput rejects extra inner keys (strict wire)", () => {
    const r = CodexPostToolUseStdoutSchema.safeParse({
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: "ok",
        unknown: 1,
      },
    });
    expect(r.success).toBe(false);
  });

  test("UserPromptSubmit: hookSpecificOutput additionalContext", () => {
    const r = CodexUserPromptSubmitStdoutSchema.safeParse({
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext:
          "Ask for a clearer reproduction before editing files.",
      },
    });
    expect(r.success).toBe(true);
  });

  test("UserPromptSubmit: decision block + reason", () => {
    const r = CodexUserPromptSubmitStdoutSchema.safeParse({
      decision: "block",
      reason: "Ask for confirmation before doing that.",
    });
    expect(r.success).toBe(true);
  });

  test("UserPromptSubmit stdout rejects unknown top-level keys (strict wire)", () => {
    const r = CodexUserPromptSubmitStdoutSchema.safeParse({
      continue: true,
      extraField: true,
    });
    expect(r.success).toBe(false);
  });

  test("UserPromptSubmit stdout rejects top-level decision approve (BlockDecisionWire is block only)", () => {
    const r = CodexUserPromptSubmitStdoutSchema.safeParse({
      decision: "approve",
    });
    expect(r.success).toBe(false);
  });

  test("UserPromptSubmit hookSpecificOutput rejects extra inner keys (strict wire)", () => {
    const r = CodexUserPromptSubmitStdoutSchema.safeParse({
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: "ok",
        unknown: 1,
      },
    });
    expect(r.success).toBe(false);
  });

  test("Stop: decision block + reason (strict wire)", () => {
    const r = CodexStopStdoutSchema.safeParse({
      decision: "block",
      reason: "Run one more pass over the failing tests.",
    });
    expect(r.success).toBe(true);
  });

  test("Stop: continue false + stopReason (strict wire)", () => {
    const r = CodexStopStdoutSchema.safeParse({
      continue: false,
      stopReason: "User aborted review loop",
    });
    expect(r.success).toBe(true);
  });

  test("Stop: common fields without hookSpecificOutput", () => {
    const r = CodexStopStdoutSchema.safeParse({
      continue: true,
      systemMessage: "optional",
      suppressOutput: false,
    });
    expect(r.success).toBe(true);
  });

  test("Stop: rejects hookSpecificOutput (not on Stop stdout wire)", () => {
    expect(
      CodexStopStdoutSchema.safeParse({
        hookSpecificOutput: {
          hookEventName: "Stop",
          additionalContext: "Not on Stop stdout wire",
        },
      }).success,
    ).toBe(false);
  });

  test("Stop: rejects unknown top-level keys", () => {
    expect(
      CodexStopStdoutSchema.safeParse({
        continue: true,
        extra: 1,
      }).success,
    ).toBe(false);
  });

  test("SessionStart + Stop wire: empty object gets JSON Schema defaults", () => {
    const r = CodexStopStdoutSchema.safeParse({});
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.continue).toBe(true);
    expect(r.data.decision).toBeNull();
    expect(r.data.reason).toBeNull();
    expect(r.data.suppressOutput).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Issue #1: Resilient parsing — passthrough, optional fields, forward-compatible enums
// ---------------------------------------------------------------------------

describe("issue #1: loose input schemas allow unknown field passthrough", () => {
  test("Claude: enriched payload with injected fields survives parse", () => {
    const r = ParseHookInput({
      hook_event_name: "Stop",
      session_id: "s1",
      cwd: "/tmp",
      stop_hook_active: true,
      last_assistant_message: "done",
      _effectiveSettings: { theme: "dark" },
      _terminal: { cols: 120 },
      _envKeys: ["PATH", "HOME"],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      // Unknown fields preserved via .loose()
      expect((r.data as Record<string, unknown>)._effectiveSettings).toEqual({ theme: "dark" });
      expect((r.data as Record<string, unknown>)._envKeys).toEqual(["PATH", "HOME"]);
    }
  });

  test("Codex: enriched payload with injected fields survives parse", () => {
    const r = ParseCodexHookInput({
      session_id: "s1",
      cwd: "/tmp",
      model: "gpt-4",
      hook_event_name: "Stop",
      stop_hook_active: false,
      last_assistant_message: null,
      transcript_path: null,
      _customContext: { foo: "bar" },
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect((r.data as Record<string, unknown>)._customContext).toEqual({ foo: "bar" });
    }
  });

  test("Gemini: enriched payload with injected fields survives parse", () => {
    const r = ParseGeminiHookInput({
      hook_event_name: "SessionStart",
      session_id: "g1",
      cwd: "/tmp",
      timestamp: "2026-01-01T00:00:00Z",
      source: "startup",
      _injectedConfig: true,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect((r.data as Record<string, unknown>)._injectedConfig).toBe(true);
    }
  });
});

describe("issue #1: optional fields allow partial/best-effort payloads", () => {
  test("Claude: minimal Stop payload (only hook_event_name)", () => {
    const r = ParseHookInput({ hook_event_name: "Stop" });
    expect(r.success).toBe(true);
  });

  test("Claude: minimal PreToolUse payload (no tool_use_id, no tool_input)", () => {
    const r = ParseHookInput({ hook_event_name: "PreToolUse" });
    expect(r.success).toBe(true);
  });

  test("Codex: minimal SessionStart payload (only hook_event_name + base)", () => {
    const r = ParseCodexHookInput({
      hook_event_name: "SessionStart",
      session_id: "s1",
      cwd: "/tmp",
      model: "gpt-4",
    });
    expect(r.success).toBe(true);
  });

  test("Gemini: minimal BeforeTool payload (no tool_name, no tool_input)", () => {
    const r = ParseGeminiHookInput({ hook_event_name: "BeforeTool" });
    expect(r.success).toBe(true);
  });
});

describe("issue #1: Gemini notification_type accepts arbitrary strings", () => {
  test("ToolPermission (original enum value) still accepted", () => {
    const r = ParseGeminiHookInput({
      hook_event_name: "Notification",
      session_id: "g1",
      cwd: "/tmp",
      timestamp: "2026-01-01T00:00:00Z",
      notification_type: "ToolPermission",
      message: "Allow?",
      details: {},
    });
    expect(r.success).toBe(true);
  });

  test("info notification_type accepted (forward-compatible)", () => {
    const r = ParseGeminiHookInput({
      hook_event_name: "Notification",
      notification_type: "info",
      message: "FYI",
      details: {},
    });
    expect(r.success).toBe(true);
  });

  test("warning notification_type accepted (forward-compatible)", () => {
    const r = ParseGeminiHookInput({
      hook_event_name: "Notification",
      notification_type: "warning",
      message: "Watch out",
    });
    expect(r.success).toBe(true);
  });
});
