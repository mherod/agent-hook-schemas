/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import {
  codexMatcherMatches,
  effectiveCodexHandlerTimeoutSec,
  mergeCodexHooksFiles,
  resolveMatchingCodexHandlers,
  resolveMatchingCodexHandlersFromInput,
} from "./codex.ts";
import { ParseCodexHookInput } from "./index.ts";

const cmd = (c: string, extra?: Partial<{ timeout: number; timeoutSec: number }>) =>
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
    const handlers = resolveMatchingCodexHandlers(config, "PreToolUse", "Bash");
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
    const handlers = resolveMatchingCodexHandlers(config, "PreToolUse", "Bash");
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
      "unused",
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
      resolveMatchingCodexHandlers(config, "Stop", "").map((h) => h.command),
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
      resolveMatchingCodexHandlers(config, "SessionStart", "startup").map(
        (h) => h.command,
      ),
    ).toEqual(["on-startup.sh"]);
    expect(
      resolveMatchingCodexHandlers(config, "SessionStart", "resume").map(
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
      resolveMatchingCodexHandlers(config, "PostToolUse", "Bash").map(
        (h) => h.command,
      ),
    ).toEqual(["review.sh"]);
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
      transcript_path: null as const,
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
});

describe("effectiveCodexHandlerTimeoutSec", () => {
  test("defaults to 600 when neither field set", () => {
    expect(effectiveCodexHandlerTimeoutSec(cmd("true"))).toBe(600);
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
    const handlers = resolveMatchingCodexHandlers(merged.config, "Stop", "");
    expect(effectiveCodexHandlerTimeoutSec(handlers[0]!)).toBe(5);
    expect(effectiveCodexHandlerTimeoutSec(handlers[1]!)).toBe(120);
  });
});
