/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import {
  codexMatcherMatches,
  codexToolIfMatches,
  effectiveCodexHandlerTimeoutSec,
  mergeCodexHooksFiles,
  parseCodexHooksFile,
  resolveMatchingCodexHandlers,
  resolveMatchingCodexHandlersFromInput,
} from "./codex-hooks-integration.ts";
import {
  CodexCommandHookHandlerSchema,
  CodexSessionEndStdoutSchema,
  ParseCodexHookInput,
} from "./index.ts";

const cmd = (c: string, extra?: Partial<{ timeout: number; timeoutSec: number; if: string }>) =>
  ({
    type: "command" as const,
    command: c,
    ...extra,
  });

describe("mergeCodexHooksFiles", () => {
  test("empty file list yields empty merged config", () => {
    const r = mergeCodexHooksFiles([]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.config).toEqual({});
  });

  test("merges ~/.codex and repo .codex layers: groups append per event", () => {
    const user = {
      hooks: {
        PreToolUse: [
          { matcher: "Bash", hooks: [cmd("user-pre.sh")] },
        ],
        Stop: [{ hooks: [cmd("user-stop.sh", { timeout: 10 })] }],
      },
    };
    const project = {
      hooks: {
        PreToolUse: [
          { matcher: "Bash", hooks: [cmd("project-pre.sh")] },
        ],
        SessionStart: [
          {
            matcher: "startup|resume",
            hooks: [cmd("project-session.sh")],
          },
        ],
      },
    };
    const r = mergeCodexHooksFiles([user, project]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.config.PreToolUse?.length).toBe(2);
    expect(r.config.Stop?.length).toBe(1);
    expect(r.config.SessionStart?.length).toBe(1);
    expect(r.config.PreToolUse?.[0]?.hooks[0]?.command).toBe("user-pre.sh");
    expect(r.config.PreToolUse?.[1]?.hooks[0]?.command).toBe("project-pre.sh");
  });

  test("third layer continues appending (multi-file discovery)", () => {
    const a = { hooks: { PostToolUse: [{ matcher: "Bash", hooks: [cmd("a")] }] } };
    const b = { hooks: { PostToolUse: [{ matcher: "Bash", hooks: [cmd("b")] }] } };
    const c = { hooks: { PostToolUse: [{ hooks: [cmd("c")] }] } };
    const r = mergeCodexHooksFiles([a, b, c]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.config.PostToolUse?.length).toBe(3);
    expect(r.config.PostToolUse?.map((g) => g.hooks[0]?.command)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  test("rejects invalid hooks.json with file index", () => {
    const r = mergeCodexHooksFiles([
      { hooks: { Stop: [] } },
      { hooks: { PreToolUse: "not-array" } },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.index).toBe(1);
  });
});

describe("codexMatcherMatches", () => {
  test("omit, empty string, and * match any subject", () => {
    expect(codexMatcherMatches(undefined, "Bash")).toBe(true);
    expect(codexMatcherMatches("", "Bash")).toBe(true);
    expect(codexMatcherMatches("*", "anything")).toBe(true);
  });

  test("regex alternation startup|resume", () => {
    expect(codexMatcherMatches("startup|resume", "startup")).toBe(true);
    expect(codexMatcherMatches("startup|resume", "resume")).toBe(true);
    expect(codexMatcherMatches("startup|resume", "clear")).toBe(false);
  });

  test("tool name Bash exact", () => {
    expect(codexMatcherMatches("Bash", "Bash")).toBe(true);
    expect(codexMatcherMatches("Bash", "Write")).toBe(false);
  });

  test("Edit|Write does not match Bash (doc: valid regex, no runtime match today)", () => {
    expect(codexMatcherMatches("Edit|Write", "Bash")).toBe(false);
    expect(codexMatcherMatches("Edit|Write", "Edit")).toBe(true);
  });

  test("invalid regex string fails closed (no handlers from that pattern)", () => {
    expect(codexMatcherMatches("[unclosed", "Bash")).toBe(false);
  });
});

describe("resolveMatchingCodexHandlers (matching + concurrency list)", () => {
  test("PreToolUse: multiple groups matching Bash return multiple handlers (concurrent launch set)", () => {
    const config = {
      PreToolUse: [
        { matcher: "Bash", hooks: [cmd("policy-a.sh"), cmd("policy-b.sh")] },
        { matcher: "Bash", hooks: [cmd("policy-c.sh")] },
      ],
    };
    const handlers = resolveMatchingCodexHandlers(config, "PreToolUse", {
      subject: "Bash",
      toolName: "Bash",
      toolInput: { command: "ls" },
    });
    expect(handlers.map((h) => h.command)).toEqual([
      "policy-a.sh",
      "policy-b.sh",
      "policy-c.sh",
    ]);
  });

  test("PreToolUse: same command string twice still listed twice (no dedup; both would spawn)", () => {
    const config = {
      PreToolUse: [
        { matcher: "Bash", hooks: [cmd("dup.sh")] },
        { matcher: "Bash", hooks: [cmd("dup.sh")] },
      ],
    };
    const handlers = resolveMatchingCodexHandlers(config, "PreToolUse", {
      subject: "Bash",
      toolName: "Bash",
      toolInput: { command: "ls" },
    });
    expect(handlers).toHaveLength(2);
    expect(handlers[0]?.command).toBe("dup.sh");
    expect(handlers[1]?.command).toBe("dup.sh");
  });

  test("UserPromptSubmit: matcher ignored — all handlers from all groups", () => {
    const config = {
      UserPromptSubmit: [
        {
          matcher: "this-is-ignored",
          hooks: [cmd("a.sh")],
        },
        {
          matcher: "",
          hooks: [cmd("b.sh"), cmd("c.sh")],
        },
      ],
    };
    const handlers = resolveMatchingCodexHandlers(
      config,
      "UserPromptSubmit",
      { subject: "" },
    );
    expect(handlers.map((h) => h.command)).toEqual(["a.sh", "b.sh", "c.sh"]);
  });

  test("Stop: matcher ignored — every group runs", () => {
    const config = {
      Stop: [
        { matcher: ".*", hooks: [cmd("stop-a.sh")] },
        { hooks: [cmd("stop-b.sh")] },
      ],
    };
    expect(
      resolveMatchingCodexHandlers(config, "Stop", { subject: "" }).map((h) => h.command),
    ).toEqual(["stop-a.sh", "stop-b.sh"]);
  });

  test("SessionStart: matcher filters on source", () => {
    const config = {
      SessionStart: [
        { matcher: "startup", hooks: [cmd("on-startup.sh")] },
        { matcher: "resume", hooks: [cmd("on-resume.sh")] },
      ],
    };
    expect(
      resolveMatchingCodexHandlers(config, "SessionStart", { subject: "startup" }).map(
        (h) => h.command,
      ),
    ).toEqual(["on-startup.sh"]);
    expect(
      resolveMatchingCodexHandlers(config, "SessionStart", { subject: "resume" }).map(
        (h) => h.command,
      ),
    ).toEqual(["on-resume.sh"]);
  });

  test("PostToolUse: non-matching matcher yields no handlers from that group", () => {
    const config = {
      PostToolUse: [
        { matcher: "Write", hooks: [cmd("never.sh")] },
        { matcher: "Bash", hooks: [cmd("review.sh")] },
      ],
    };
    expect(
      resolveMatchingCodexHandlers(config, "PostToolUse", {
        subject: "Bash",
        toolName: "Bash",
        toolInput: { command: "ls" },
      }).map((h) => h.command),
    ).toEqual(["review.sh"]);
  });

  test("if guard filters handlers within matched groups", () => {
    const config = {
      PreToolUse: [
        {
          matcher: "Bash",
          hooks: [
            cmd("always.sh"),
            cmd("git-only.sh", { if: "Bash(git *)" }),
          ],
        },
      ],
    };
    const gitHandlers = resolveMatchingCodexHandlers(config, "PreToolUse", {
      subject: "Bash",
      toolName: "Bash",
      toolInput: { command: "git status" },
    });
    expect(gitHandlers.map((h) => h.command)).toEqual(["always.sh", "git-only.sh"]);

    const lsHandlers = resolveMatchingCodexHandlers(config, "PreToolUse", {
      subject: "Bash",
      toolName: "Bash",
      toolInput: { command: "ls -la" },
    });
    expect(lsHandlers.map((h) => h.command)).toEqual(["always.sh"]);
  });
});

describe("resolveMatchingCodexHandlersFromInput", () => {
  test("end-to-end: merged files + ParseCodexHookInput stdin", () => {
    const globalFile = {
      hooks: {
        PreToolUse: [{ matcher: "Bash", hooks: [cmd("global-pre.sh")] }],
      },
    };
    const repoFile = {
      hooks: {
        PreToolUse: [{ matcher: "Bash", hooks: [cmd("repo-pre.sh")] }],
      },
    };
    const merged = mergeCodexHooksFiles([globalFile, repoFile]);
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;

    const stdin = {
      session_id: "s1",
      cwd: "/repo",
      model: "gpt-5",
      hook_event_name: "PreToolUse" as const,
      turn_id: "t1",
      transcript_path: null,
      permission_mode: "default" as const,
      tool_name: "Bash" as const,
      tool_use_id: "c1",
      tool_input: { command: "ls" },
    };
    const parsed = ParseCodexHookInput(stdin);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    const handlers = resolveMatchingCodexHandlersFromInput(
      merged.config,
      parsed.data,
    );
    expect(handlers.map((h) => h.command)).toEqual([
      "global-pre.sh",
      "repo-pre.sh",
    ]);
  });

  test("SessionStart uses source as matcher subject", () => {
    const merged = mergeCodexHooksFiles([
      {
        hooks: {
          SessionStart: [
            { matcher: "resume", hooks: [cmd("resume.sh")] },
            { matcher: "startup", hooks: [cmd("startup.sh")] },
          ],
        },
      },
    ]);
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;

    const resume = ParseCodexHookInput({
      session_id: "s",
      cwd: "/",
      model: "m",
      hook_event_name: "SessionStart",
      source: "resume",
      permission_mode: "default",
      transcript_path: null,
    });
    expect(resume.success).toBe(true);
    if (!resume.success) return;
    expect(
      resolveMatchingCodexHandlersFromInput(merged.config, resume.data).map(
        (h) => h.command,
      ),
    ).toEqual(["resume.sh"]);
  });

  test("SubagentStop uses agent_type as matcher subject", () => {
    const merged = mergeCodexHooksFiles([
      {
        hooks: {
          SubagentStop: [
            { matcher: "Explore", hooks: [cmd("explore-stop.sh")] },
            { matcher: "Plan", hooks: [cmd("plan-stop.sh")] },
          ],
        },
      },
    ]);
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;

    const stop = ParseCodexHookInput({
      session_id: "s",
      cwd: "/",
      model: "m",
      hook_event_name: "SubagentStop",
      agent_type: "Explore",
      agent_id: "a1",
      stop_hook_active: false,
      last_assistant_message: null,
      permission_mode: "default",
      transcript_path: null,
    });
    expect(stop.success).toBe(true);
    if (!stop.success) return;
    expect(
      resolveMatchingCodexHandlersFromInput(merged.config, stop.data).map(
        (h) => h.command,
      ),
    ).toEqual(["explore-stop.sh"]);
  });

  test("PreCompact uses trigger as matcher subject", () => {
    const merged = mergeCodexHooksFiles([
      {
        hooks: {
          PreCompact: [
            { matcher: "manual", hooks: [cmd("manual-precompact.sh")] },
            { matcher: "auto", hooks: [cmd("auto-precompact.sh")] },
          ],
        },
      },
    ]);
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;

    const pre = ParseCodexHookInput({
      session_id: "s",
      cwd: "/",
      model: "m",
      hook_event_name: "PreCompact",
      trigger: "auto",
      transcript_path: null,
    });
    expect(pre.success).toBe(true);
    if (!pre.success) return;
    expect(
      resolveMatchingCodexHandlersFromInput(merged.config, pre.data).map(
        (h) => h.command,
      ),
    ).toEqual(["auto-precompact.sh"]);
  });

  test("SessionEnd uses reason as matcher subject", () => {
    const merged = mergeCodexHooksFiles([
      {
        hooks: {
          SessionEnd: [
            { matcher: "other", hooks: [cmd("other-sessionend.sh")] },
            { matcher: "manual", hooks: [cmd("manual-sessionend.sh")] },
          ],
        },
      },
    ]);
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;

    const end = ParseCodexHookInput({
      session_id: "s",
      cwd: "/",
      model: "m",
      hook_event_name: "SessionEnd",
      reason: "other",
      transcript_path: null,
      last_assistant_message: "bye",
    });
    expect(end.success).toBe(true);
    if (!end.success) return;
    expect(
      resolveMatchingCodexHandlersFromInput(merged.config, end.data).map(
        (h) => h.command,
      ),
    ).toEqual(["other-sessionend.sh"]);
  });
});

describe("effectiveCodexHandlerTimeoutSec", () => {
  test("defaults to 600 when neither field set for default events", () => {
    expect(effectiveCodexHandlerTimeoutSec(cmd("true"))).toBe(600);
    expect(effectiveCodexHandlerTimeoutSec(cmd("true"), "SessionStart")).toBe(600);
    expect(effectiveCodexHandlerTimeoutSec(cmd("true"), "PreToolUse")).toBe(600);
  });

  test("SessionEnd defaults to 1s timeout and caps at 3s max", () => {
    expect(effectiveCodexHandlerTimeoutSec(cmd("true"), "SessionEnd")).toBe(1);
    expect(
      effectiveCodexHandlerTimeoutSec(cmd("true", { timeout: 2 }), "SessionEnd"),
    ).toBe(2);
    expect(
      effectiveCodexHandlerTimeoutSec(cmd("true", { timeout: 5 }), "SessionEnd"),
    ).toBe(3);
    expect(
      effectiveCodexHandlerTimeoutSec(
        cmd("true", { timeoutSec: 10 }),
        "SessionEnd",
      ),
    ).toBe(3);
  });

  test("uses timeoutSec when timeout omitted", () => {
    expect(effectiveCodexHandlerTimeoutSec(cmd("true", { timeoutSec: 30 }))).toBe(
      30,
    );
  });

  test("timeout wins when both provided", () => {
    expect(
      effectiveCodexHandlerTimeoutSec(
        cmd("true", { timeout: 45, timeoutSec: 30 }),
      ),
    ).toBe(45);
  });

  test("merged Stop handlers can carry different timeouts per handler", () => {
    const merged = mergeCodexHooksFiles([
      {
        hooks: {
          Stop: [
            {
              hooks: [
                cmd("fast.sh", { timeout: 5 }),
                cmd("slow.sh", { timeoutSec: 120 }),
              ],
            },
          ],
        },
      },
    ]);
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;
    const handlers = resolveMatchingCodexHandlers(merged.config, "Stop", { subject: "" });
    expect(effectiveCodexHandlerTimeoutSec(handlers[0]!)).toBe(5);
    expect(effectiveCodexHandlerTimeoutSec(handlers[1]!)).toBe(120);
  });
});

describe("codexToolIfMatches", () => {
  test("omitted if passes", () => {
    expect(codexToolIfMatches("Bash", { command: "ls" }, undefined)).toBe(true);
  });

  test("Bash(git *) matches git commands", () => {
    expect(codexToolIfMatches("Bash", { command: "git pull" }, "Bash(git *)")).toBe(true);
    expect(codexToolIfMatches("Bash", { command: "rm -rf /" }, "Bash(git *)")).toBe(false);
  });

  test("wrong tool name fails", () => {
    expect(codexToolIfMatches("Write", { file_path: "/x" }, "Bash(*)")).toBe(false);
  });

  test("malformed rule fails closed", () => {
    expect(codexToolIfMatches("Bash", { command: "ls" }, "Bash(")).toBe(false);
    expect(codexToolIfMatches("Bash", { command: "ls" }, "no-parens")).toBe(false);
  });
});

describe("parseCodexHooksFile", () => {
  test("validates a real-world hooks.json", () => {
    const r = parseCodexHooksFile({
      hooks: {
        Stop: [{ hooks: [cmd("stop.sh", { timeout: 180 })] }],
        PreToolUse: [{ hooks: [cmd("pre.sh", { timeout: 15 })] }],
        SessionStart: [{ hooks: [cmd("start.sh", { timeout: 20 })] }],
      },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.config.Stop).toHaveLength(1);
    expect(r.config.PreToolUse).toHaveLength(1);
    expect(r.config.SessionStart).toHaveLength(1);
  });

  test("rejects invalid hooks structure", () => {
    const r = parseCodexHooksFile({ hooks: { Stop: "bad" } });
    expect(r.ok).toBe(false);
  });

  test("allows unknown top-level keys via .loose()", () => {
    const r = parseCodexHooksFile({ hooks: {}, customField: true });
    expect(r.ok).toBe(true);
  });
});

describe("CodexCommandHookHandlerSchema & OpenAI contract alignment (#23)", () => {
  test("parses full official OpenAI command handler fields", () => {
    const handler = {
      type: "command" as const,
      command: "bash check.sh",
      commandWindows: "powershell.exe -File check.ps1",
      timeout: 30,
      async: true,
      statusMessage: "Running security checks...",
      additionalContextLimit: 4000,
    };
    const r = CodexCommandHookHandlerSchema.safeParse(handler);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.command).toBe("bash check.sh");
    expect(r.data.commandWindows).toBe("powershell.exe -File check.ps1");
    expect(r.data.timeout).toBe(30);
    expect(r.data.async).toBe(true);
    expect(r.data.statusMessage).toBe("Running security checks...");
    expect(r.data.additionalContextLimit).toBe(4000);
  });

  test("additionalContextLimit accepts 0 and positive integers", () => {
    expect(
      CodexCommandHookHandlerSchema.safeParse({
        type: "command",
        command: "true",
        additionalContextLimit: 0,
      }).success,
    ).toBe(true);

    expect(
      CodexCommandHookHandlerSchema.safeParse({
        type: "command",
        command: "true",
        additionalContextLimit: 500,
      }).success,
    ).toBe(true);
  });

  test("additionalContextLimit rejects negative numbers and non-integers", () => {
    expect(
      CodexCommandHookHandlerSchema.safeParse({
        type: "command",
        command: "true",
        additionalContextLimit: -1,
      }).success,
    ).toBe(false);

    expect(
      CodexCommandHookHandlerSchema.safeParse({
        type: "command",
        command: "true",
        additionalContextLimit: 12.5,
      }).success,
    ).toBe(false);
  });

  test("retains compatibility extensions: timeoutSec, if, once, args, asyncRewake, shell", () => {
    const r = CodexCommandHookHandlerSchema.safeParse({
      type: "command",
      command: "true",
      timeoutSec: 15,
      if: "Bash(git *)",
      once: true,
      args: ["--quiet"],
      asyncRewake: false,
      shell: "bash",
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.timeoutSec).toBe(15);
    expect(r.data.if).toBe("Bash(git *)");
    expect(r.data.once).toBe(true);
    expect(r.data.args).toEqual(["--quiet"]);
    expect(r.data.asyncRewake).toBe(false);
    expect(r.data.shell).toBe("bash");
  });

  test("parseCodexHooksFile and mergeCodexHooksFiles preserve commandWindows and additionalContextLimit", () => {
    const file = {
      hooks: {
        PreToolUse: [
          {
            matcher: "Bash",
            hooks: [
              {
                type: "command",
                command: "./gate.sh",
                commandWindows: ".\\gate.ps1",
                timeout: 20,
                async: false,
                statusMessage: "Verifying tool call",
                additionalContextLimit: 2000,
              },
            ],
          },
        ],
      },
    };
    const parsed = parseCodexHooksFile(file);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const h = parsed.config.PreToolUse?.[0]?.hooks[0];
    expect(h?.commandWindows).toBe(".\\gate.ps1");
    expect(h?.additionalContextLimit).toBe(2000);
    expect(h?.statusMessage).toBe("Verifying tool call");

    const merged = mergeCodexHooksFiles([file]);
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;
    const resolved = resolveMatchingCodexHandlers(merged.config, "PreToolUse", {
      subject: "Bash",
    });
    expect(resolved).toHaveLength(1);
    expect(resolved[0]?.commandWindows).toBe(".\\gate.ps1");
    expect(resolved[0]?.additionalContextLimit).toBe(2000);
    expect(resolved[0]?.statusMessage).toBe("Verifying tool call");
  });
});

describe("Codex SessionEnd hook support (#24)", () => {
  test("ParseCodexHookInput accepts documented SessionEnd payload and preserves unknown fields", () => {
    const payload = {
      hook_event_name: "SessionEnd",
      session_id: "sess-123",
      transcript_path: "/tmp/session.jsonl",
      cwd: "/workspace",
      model: "o3-mini",
      permission_mode: "default",
      reason: "other",
      last_assistant_message: "Goodbye!",
      turn_id: "turn-456",
      extra_future_field: "pass-through",
    };
    const r = ParseCodexHookInput(payload);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.hook_event_name).toBe("SessionEnd");
    if (r.data.hook_event_name === "SessionEnd") {
      expect(r.data.session_id).toBe("sess-123");
      expect(r.data.reason).toBe("other");
      expect(r.data.last_assistant_message).toBe("Goodbye!");
      expect((r.data as Record<string, unknown>).extra_future_field).toBe(
        "pass-through",
      );
    }
  });

  test("SessionEnd stdout schema parses advisory fields and permits loose extensions", () => {
    const valid = {
      continue: true,
      stopReason: "completed",
      systemMessage: "session cleanup done",
      suppressOutput: false,
      extraAdvisoryField: "ignored",
    };
    const r = CodexSessionEndStdoutSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.continue).toBe(true);
    expect(r.data.systemMessage).toBe("session cleanup done");
  });

  test("CodexHooksConfigSchema validates and retains SessionEnd matcher groups", () => {
    const config = {
      hooks: {
        SessionEnd: [
          {
            matcher: "other",
            hooks: [
              {
                type: "command" as const,
                command: "./cleanup.sh",
                timeout: 2,
              },
            ],
          },
        ],
      },
    };
    const parsed = parseCodexHooksFile(config);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.config.SessionEnd).toHaveLength(1);
    expect(parsed.config.SessionEnd?.[0]?.hooks[0]?.command).toBe("./cleanup.sh");
  });
});
