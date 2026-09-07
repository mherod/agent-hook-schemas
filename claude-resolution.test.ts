import { describe, expect, test } from "bun:test";
import { HookEventNameSchema, HookSpecificAdditionalContextSchema, ParseHookInput } from "./claude.ts";
import {
  claudeResolutionContextFromInput, claudeToolIfMatches, mergeClaudeSettings,
  parseClaudeSettings, resolveMatchingClaudeHandlersFromInput,
} from "./claude-hooks-integration.ts";
import { bashHookIfMatches } from "./claude-bash-if.ts";

const cmd = (command: string) => ({ type: "command" as const, command });

describe("Claude event routing", () => {
  // Explicit fixtures make newly added events fail this inventory check until
  // their matcher subject is verified and included here.
  const subjects = {
    SessionStart: ["source", "startup"], Setup: ["trigger", "init"],
    InstructionsLoaded: ["load_reason", "session_start"], UserPromptSubmit: ["prompt", "Review"],
    UserPromptExpansion: ["command_name", "review"],
    PreToolUse: ["tool_name", "Bash"], PermissionRequest: ["tool_name", "Bash"],
    PostToolUse: ["tool_name", "Bash"], PostToolUseFailure: ["tool_name", "Bash"],
    PermissionDenied: ["tool_name", "Bash"], PostToolBatch: ["", ""],
    Notification: ["notification_type", "idle_prompt"], MessageDisplay: ["message_text", "Hello"],
    SubagentStart: ["agent_type", "reviewer"], SubagentStop: ["agent_type", "reviewer"],
    TaskCreated: ["task_subject", "Test"], TaskCompleted: ["task_subject", "Test"],
    Stop: ["last_assistant_message", "Done"], StopFailure: ["error", "rate_limit"],
    TeammateIdle: ["teammate_name", "reviewer"], ConfigChange: ["source", "user_settings"],
    CwdChanged: ["new_cwd", "/repo"], FileChanged: ["file_path", "/repo/file.ts"],
    WorktreeCreate: ["name", "review"], WorktreeRemove: ["worktree_path", "/repo/tree"],
    DirectoryAdded: ["source", "cli"], PreCompact: ["trigger", "auto"], PostCompact: ["trigger", "auto"],
    PreModelSwitch: ["to_model", "opus"], PostModelSwitch: ["to_model", "opus"],
    SessionEnd: ["reason", "other"], Elicitation: ["mcp_server_name", "docs"],
    ElicitationResult: ["mcp_server_name", "docs"],
  } as const;
  test("has a subject fixture for every supported event", () => {
    expect(Object.keys(subjects).sort()).toEqual([...HookEventNameSchema.options].sort());
  });
  for (const [event, [field, subject]] of Object.entries(subjects)) {
    test(`routes ${event} from parsed stdin`, () => {
      const toolEvent = field === "tool_name";
      const input = ParseHookInput({ hook_event_name: event,
        ...(field ? { [field]: subject } : {}),
        ...(toolEvent ? { tool_input: { command: "git status" } } : {}),
      });
      if (!input.success) throw input.error;
      expect(claudeResolutionContextFromInput(input.data)).toEqual({ subject,
        ...(toolEvent ? { toolName: "Bash", toolInput: { command: "git status" } } : {}),
      });
      expect(resolveMatchingClaudeHandlersFromInput({ [event]: [{ hooks: [cmd("run")] }] }, input.data)).toEqual([cmd("run")]);
    });
  }

  test("unknown parsed events safely produce no handlers", () => {
    const input = ParseHookInput({ hook_event_name: "FutureEvent", future: true });
    if (!input.success) throw input.error;
    expect(resolveMatchingClaudeHandlersFromInput({}, input.data)).toEqual([]);
  });

  test.each(["PreToolUse", "SessionStart", "PostToolUse", "UserPromptSubmit", "Stop", "Notification"] as const)(
    "context output factory validates the %s discriminator", (event) => {
      const schema = HookSpecificAdditionalContextSchema(event);
      expect(schema.safeParse({ hookEventName: event, ...(event === "PreToolUse" ? { permissionDecision: "allow" } : {}) }).success).toBe(true);
      expect(schema.safeParse({ hookEventName: "FutureEvent" }).success).toBe(false);
    },
  );
});

describe("Claude complete settings merge", () => {
  test("combines hooks and permissions in order with later environment overrides", () => {
    const layers = [
      { hooks: { Stop: [{ hooks: [cmd("old")] }] }, permissions: { allow: ["Read"], deny: ["Bash(rm *)"] }, env: { MODE: "old", KEEP: "yes" } },
      { disableAllHooks: true, env: { MODE: "new" } },
      { hooks: { Stop: [{ hooks: [cmd("new")] }] }, permissions: { allow: ["Write"], deny: ["Bash(sudo *)"] } },
    ];
    const snapshot = structuredClone(layers);
    expect(mergeClaudeSettings(layers)).toEqual({ ok: true, settings: {
      hooks: { Stop: [{ hooks: [cmd("new")] }] },
      permissions: { allow: ["Read", "Write"], deny: ["Bash(rm *)", "Bash(sudo *)"] },
      env: { MODE: "new", KEEP: "yes" }, disableAllHooks: true,
    } });
    expect(layers).toEqual(snapshot);
  });
  test("empty layers produce defaults and invalid layers identify their index", () => {
    expect(mergeClaudeSettings([{}])).toEqual({ ok: true, settings: { hooks: {}, permissions: {}, env: {}, disableAllHooks: false } });
    expect(mergeClaudeSettings([{}, { env: { INVALID: 42 } }])).toMatchObject({ ok: false, index: 1 });
    expect(parseClaudeSettings({ future: true })).toEqual({ ok: true, settings: { future: true } });
    expect(parseClaudeSettings(null).ok).toBe(false);
  });
});

describe("Claude tool guards", () => {
  test.each([
    ["Read", { file_path: "src/index.ts" }, "Read(*.ts)", true],
    ["Write", { file_path: "src/index.js" }, "Write(*.ts)", false],
    ["Glob", { pattern: "src/*.ts" }, "Glob(src/*)", true],
    ["Grep", { pattern: "TODO" }, "Grep(TODO)", true],
    ["Grep", { pattern: "FIXME" }, "Grep(TODO)", false],
    ["mcp__docs__search", { query: "hooks" }, "mcp__docs__search(*hooks*)", true],
    ["mcp__docs__search", { query: "other" }, "mcp__docs__search(*hooks*)", false],
    ["Bash", {}, "Bash(git *)", false],
    ["Unknown", {}, "Unknown(value)", false],
    ["Read", { file_path: 42 }, "Read(*.ts)", false],
  ] as const)("checks %s tool guard", (tool, input, rule, expected) => {
    expect(claudeToolIfMatches(tool, input, rule)).toBe(expected);
  });

  test.each([
    ["git sta\\tus", "git status", true],
    ["git \\\nstatus", "git status", true],
    ['echo "a\\qb"', 'echo a\\qb', true],
    ['echo "a\\\"b"', 'echo a"b', true],
    ["echo trailing\\", "git *", true],
    ["echo 'unterminated", "git *", true],
    ["echo $(".repeat(34) + "date" + ")".repeat(34), "git *", true],
    ["echo simple", "git *", false],
  ])("handles shell quoting and uncertainty: %s", (command, pattern, expected) => {
    expect(bashHookIfMatches(command, pattern)).toBe(expected);
  });
});
