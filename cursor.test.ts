/// <reference types="bun" />
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";
import {
  type CursorHookEventName,
  ParseCursorHookInput,
} from "./cursor.ts";

const HOOK_TMP = "/private/tmp";

/** Read `/private/tmp` capture only if `hook_event_name` matches (avoids stale wrong-format files). */
function readCursorHookSample(
  name: string,
  event: CursorHookEventName,
): unknown | null {
  const p = `${HOOK_TMP}/${name}`;
  if (!existsSync(p)) return null;
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  const nameField = (data as { hook_event_name?: unknown }).hook_event_name;
  if (nameField !== event) return null;
  return data;
}

describe("Cursor hooks (stdin)", () => {
  test("stop: real sample shape", () => {
    const r = ParseCursorHookInput({
      conversation_id: "11111111-1111-4111-8111-111111111111",
      generation_id: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
      model: "default",
      status: "completed",
      loop_count: 0,
      input_tokens: 897274,
      output_tokens: 1639,
      cache_read_tokens: 893952,
      cache_write_tokens: 3322,
      session_id: "11111111-1111-4111-8111-111111111111",
      hook_event_name: "stop",
      cursor_version: "3.0.4",
      workspace_roots: ["/workspace/example-repo"],
      user_email: "user@example.com",
      transcript_path:
        "/home/cursor/.cursor/projects/ws/agent-transcripts/11111111-1111-4111-8111-111111111111/11111111-1111-4111-8111-111111111111.jsonl",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.hook_event_name).toBe("stop");
      expect(r.data.status).toBe("completed");
      expect(r.data.input_tokens).toBe(897274);
    }
  });

  test("afterAgentResponse: sample shape (text + token usage)", () => {
    const r = ParseCursorHookInput({
      conversation_id: "11111111-1111-4111-8111-111111111111",
      generation_id: "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb",
      model: "default",
      text: "\nHere’s what changed:\n\n### `cursor.ts`\n- Added **`preCompact`**\n",
      input_tokens: 355816,
      output_tokens: 4110,
      cache_read_tokens: 342784,
      cache_write_tokens: 13032,
      session_id: "11111111-1111-4111-8111-111111111111",
      hook_event_name: "afterAgentResponse",
      cursor_version: "3.0.4",
      workspace_roots: ["/workspace/example-repo"],
      user_email: "user@example.com",
      transcript_path:
        "/home/cursor/.cursor/projects/ws/agent-transcripts/11111111-1111-4111-8111-111111111111/11111111-1111-4111-8111-111111111111.jsonl",
    });
    expect(r.success).toBe(true);
    if (r.success && r.data.hook_event_name === "afterAgentResponse") {
      expect(r.data.input_tokens).toBe(355816);
      expect(r.data.text).toContain("cursor.ts");
    }
  });

  test("postToolUse: real sample shape (tool_output JSON string)", () => {
    const r = ParseCursorHookInput({
      conversation_id: "11111111-1111-4111-8111-111111111111",
      generation_id: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
      model: "default",
      tool_name: "Grep",
      tool_input: {
        pattern: "^export function Parse",
        file_path: "/workspace/example-repo",
        glob: "*.ts",
      },
      tool_output:
        '{"pattern":"^export function Parse","success":true}',
      duration: 8.971,
      tool_use_id: "tool_11111111-1111-4111-8111-111111111113",
      session_id: "11111111-1111-4111-8111-111111111111",
      hook_event_name: "postToolUse",
      cursor_version: "3.0.4",
      workspace_roots: ["/workspace/example-repo"],
      user_email: "user@example.com",
      transcript_path:
        "/home/cursor/.cursor/projects/ws/agent-transcripts/11111111-1111-4111-8111-111111111111/11111111-1111-4111-8111-111111111111.jsonl",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.hook_event_name).toBe("postToolUse");
      expect(r.data.tool_name).toBe("Grep");
      expect(typeof r.data.tool_output).toBe("string");
    }
  });

  test("preToolUse: sample shape (Read)", () => {
    const r = ParseCursorHookInput({
      conversation_id: "11111111-1111-4111-8111-111111111111",
      generation_id: "cccccccc-cccc-4ccc-cccc-cccccccccccc",
      model: "default",
      tool_name: "Read",
      tool_input: { file_path: "/tmp/hook-fixtures/session-start.json" },
      tool_use_id: "tool_11111111-1111-4111-8111-111111111112",
      session_id: "11111111-1111-4111-8111-111111111111",
      hook_event_name: "preToolUse",
      cursor_version: "3.0.4",
      workspace_roots: ["/workspace/example-repo"],
      user_email: "user@example.com",
      transcript_path:
        "/home/cursor/.cursor/projects/ws/agent-transcripts/11111111-1111-4111-8111-111111111111/11111111-1111-4111-8111-111111111111.jsonl",
    });
    expect(r.success).toBe(true);
  });

  test("postToolUse: Read sample (content_length tool_output)", () => {
    const r = ParseCursorHookInput({
      conversation_id: "11111111-1111-4111-8111-111111111111",
      generation_id: "cccccccc-cccc-4ccc-cccc-cccccccccccc",
      model: "default",
      tool_name: "Read",
      tool_input: { file_path: "/tmp/hook-fixtures/prompt.json" },
      tool_output:
        '{"file_path":"/tmp/hook-fixtures/prompt.json","content_length":677}',
      duration: 0.874,
      tool_use_id: "tool_11111111-1111-4111-8111-111111111114",
      session_id: "11111111-1111-4111-8111-111111111111",
      hook_event_name: "postToolUse",
      cursor_version: "3.0.4",
      workspace_roots: ["/workspace/example-repo"],
      user_email: "user@example.com",
      transcript_path:
        "/home/cursor/.cursor/projects/ws/agent-transcripts/11111111-1111-4111-8111-111111111111/11111111-1111-4111-8111-111111111111.jsonl",
    });
    expect(r.success).toBe(true);
  });

  test("beforeShellExecution: sample shape", () => {
    const r = ParseCursorHookInput({
      conversation_id: "11111111-1111-4111-8111-111111111111",
      generation_id: "cccccccc-cccc-4ccc-cccc-cccccccccccc",
      model: "default",
      command: "cd /repo && bun test",
      cwd: "",
      sandbox: false,
      session_id: "11111111-1111-4111-8111-111111111111",
      hook_event_name: "beforeShellExecution",
      cursor_version: "3.0.4",
      workspace_roots: ["/workspace/example-repo"],
      user_email: "user@example.com",
      transcript_path:
        "/home/cursor/.cursor/projects/ws/agent-transcripts/11111111-1111-4111-8111-111111111111/11111111-1111-4111-8111-111111111111.jsonl",
    });
    expect(r.success).toBe(true);
  });

  test("afterShellExecution: sample shape", () => {
    const r = ParseCursorHookInput({
      conversation_id: "11111111-1111-4111-8111-111111111111",
      generation_id: "cccccccc-cccc-4ccc-cccc-cccccccccccc",
      model: "default",
      command: "echo ok",
      output: "ok\n",
      duration: 12.5,
      sandbox: false,
      session_id: "11111111-1111-4111-8111-111111111111",
      hook_event_name: "afterShellExecution",
      cursor_version: "3.0.4",
      workspace_roots: ["/workspace/example-repo"],
      user_email: "user@example.com",
      transcript_path:
        "/home/cursor/.cursor/projects/ws/agent-transcripts/11111111-1111-4111-8111-111111111111/11111111-1111-4111-8111-111111111111.jsonl",
    });
    expect(r.success).toBe(true);
  });

  test("beforeSubmitPrompt: sample shape (attachments)", () => {
    const r = ParseCursorHookInput({
      conversation_id: "11111111-1111-4111-8111-111111111111",
      generation_id: "cccccccc-cccc-4ccc-cccc-cccccccccccc",
      model: "default",
      composer_mode: "agent",
      prompt: "Update @package.json ",
      attachments: [{ type: "rule", file_path: "CLAUDE.md" }],
      session_id: "11111111-1111-4111-8111-111111111111",
      hook_event_name: "beforeSubmitPrompt",
      cursor_version: "3.0.4",
      workspace_roots: ["/workspace/example-repo"],
      user_email: "user@example.com",
      transcript_path:
        "/home/cursor/.cursor/projects/ws/agent-transcripts/11111111-1111-4111-8111-111111111111/11111111-1111-4111-8111-111111111111.jsonl",
    });
    expect(r.success).toBe(true);
    if (r.success && r.data.hook_event_name === "beforeSubmitPrompt") {
      expect(r.data.attachments[0]?.type).toBe("rule");
    }
  });

  test("sessionStart: null transcript_path, empty generation_id", () => {
    const r = ParseCursorHookInput({
      conversation_id: "22222222-2222-4222-8222-222222222222",
      generation_id: "",
      model: "default",
      is_background_agent: false,
      composer_mode: "agent",
      session_id: "22222222-2222-4222-8222-222222222222",
      hook_event_name: "sessionStart",
      cursor_version: "3.0.4",
      workspace_roots: ["/workspace/example-repo"],
      user_email: "user@example.com",
      transcript_path: null,
    });
    expect(r.success).toBe(true);
  });

  test("preCompact: sample shape (context compaction)", () => {
    const r = ParseCursorHookInput({
      conversation_id: "11111111-1111-4111-8111-111111111111",
      generation_id: "cccccccc-cccc-4ccc-cccc-cccccccccccc",
      model: "accounts/acme/models/k2-preview#acme/subscription-0001",
      trigger: "auto",
      context_usage_percent: 91.1465,
      context_tokens: 182293,
      context_window_size: 200000,
      message_count: 306,
      messages_to_compact: 304,
      is_first_compaction: false,
      session_id: "11111111-1111-4111-8111-111111111111",
      hook_event_name: "preCompact",
      cursor_version: "3.0.4",
      workspace_roots: ["/workspace/example-repo"],
      user_email: "user@example.com",
      transcript_path:
        "/home/cursor/.cursor/projects/ws/agent-transcripts/11111111-1111-4111-8111-111111111111/11111111-1111-4111-8111-111111111111.jsonl",
    });
    expect(r.success).toBe(true);
    if (r.success && r.data.hook_event_name === "preCompact") {
      expect(r.data.trigger).toBe("auto");
      expect(r.data.context_usage_percent).toBeCloseTo(91.1465);
      expect(r.data.messages_to_compact).toBe(304);
    }
  });

  test("sessionEnd: null transcript_path, empty generation_id", () => {
    const r = ParseCursorHookInput({
      conversation_id: "33333333-3333-4333-8333-333333333333",
      generation_id: "",
      model: "default",
      reason: "user_close",
      duration_ms: 108,
      is_background_agent: false,
      final_status: "none",
      session_id: "33333333-3333-4333-8333-333333333333",
      hook_event_name: "sessionEnd",
      cursor_version: "3.0.4",
      workspace_roots: ["/workspace/example-repo"],
      user_email: "user@example.com",
      transcript_path: null,
    });
    expect(r.success).toBe(true);
  });

  test("rejects unknown hook_event_name", () => {
    expect(
      ParseCursorHookInput({
        conversation_id: "x",
        generation_id: "y",
        model: "default",
        session_id: "x",
        cursor_version: "1",
        workspace_roots: [],
        user_email: "a@b.co",
        transcript_path: "/t",
        hook_event_name: "unknownEvent",
      }).success,
    ).toBe(false);
  });
});

describe("Cursor hooks (optional /private/tmp capture files)", () => {
  const samples: { file: string; event: CursorHookEventName }[] = [
    { file: "hook-afterAgentResponse.json", event: "afterAgentResponse" },
    { file: "hook-afterShellExecution.json", event: "afterShellExecution" },
    { file: "hook-beforeShellExecution.json", event: "beforeShellExecution" },
    { file: "hook-beforeSubmitPrompt.json", event: "beforeSubmitPrompt" },
    { file: "hook-postToolUse.json", event: "postToolUse" },
    { file: "hook-preCompact.json", event: "preCompact" },
    { file: "hook-preToolUse.json", event: "preToolUse" },
    { file: "hook-sessionEnd.json", event: "sessionEnd" },
    { file: "hook-sessionStart.json", event: "sessionStart" },
    { file: "hook-stop.json", event: "stop" },
  ];

  for (const { file, event } of samples) {
    const payload = readCursorHookSample(file, event);
    test.skipIf(payload === null)(`parses ${file}`, () => {
      const r = ParseCursorHookInput(payload);
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.hook_event_name).toBe(event);
    });
  }
});
