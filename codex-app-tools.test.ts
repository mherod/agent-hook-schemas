import { describe, expect, expectTypeOf, test } from "bun:test";
import {
  CodexAppKnownAutomationUpdateToolInputSchema,
  CodexAppToolInputSchemas,
  CodexAppToolNameSchema,
  ParseCodexAppToolArgs,
  ParseCodexAppToolInput,
  ParseCodexAppToolResponse,
  type CodexAppToolName,
  type CodexAppReadPageToolInput,
} from "./codex-app-tools.ts";

const cases = {
  automation_update: { valid: { mode: "view", id: "automation" }, invalid: { mode: "view" } },
  capture_heap_snapshots: { valid: {}, invalid: null },
  capture_screen_context: { valid: {}, invalid: [] },
  consume_usage_reset: { valid: { idempotencyKey: "unique-attempt" }, invalid: { idempotencyKey: 1 } },
  create_page: { valid: { title: "Page", markdown: "Text", parent_page_id: "parent", space_id: "space" }, invalid: { title: 1 } },
  create_page_visualization: { valid: { page_id: "page", title: "Chart", html: "<html></html>", base_sequence: 1, request_id: "request" }, invalid: { page_id: "page", title: "Chart" } },
  create_sidebar_section: { valid: { name: "Work" }, invalid: {} },
  create_space: { valid: { name: "Work", existing_space: { root_page_id: "root", space_id: "space" } }, invalid: { name: "Work", existing_space: {} } },
  create_thread: { valid: { prompt: "Review", target: { type: "projectless", directoryName: "review" }, title: "Review", thinking: "high", model: "host-model" }, invalid: { prompt: "Review", target: { type: "project" } } },
  delete_sidebar_section: { valid: { sectionId: "section" }, invalid: {} },
  edit_page: { valid: { page_id: "page", base_sequence: 1, operations: [{ op: "set_title", title: "New title" }] }, invalid: { page_id: "page", operations: [{ op: "unknown" }] } },
  end_realtime_voice_call: { valid: {}, invalid: "end" },
  find_pages: { valid: { query: "Search", cursor: "cursor", limit: 10, space_id: "space" }, invalid: {} },
  fire_confetti: { valid: { emojis: ["🎉"] }, invalid: { emojis: "🎉" } },
  fork_thread: { valid: { threadId: "thread", environment: { type: "worktree" } }, invalid: { environment: { type: "cloud" } } },
  get_handoff_status: { valid: { operationId: "operation", afterRevision: 1, waitMs: 30000 }, invalid: { operationId: 1 } },
  get_page_sharing: { valid: { page_id: "page" }, invalid: {} },
  get_space_sharing: { valid: { space_id: "space" }, invalid: {} },
  get_usage_limits: { valid: {}, invalid: false },
  handoff_thread: { valid: { threadId: "thread", destinationHostId: "local", followUpPrompt: "Continue" }, invalid: { threadId: 42 } },
  list_archived_threads: { valid: { hostId: "local", cursor: "cursor", limit: 10 }, invalid: { limit: "10" } },
  list_page_comments: { valid: { page_id: "page", block_id: "block", state: "open", limit: 10 }, invalid: { page_id: "page", state: "closed" } },
  list_pages: { valid: { parent_page_id: "page", space_id: "space", cursor: "cursor", limit: 10 }, invalid: { parent_page_id: null } },
  list_projects: { valid: {}, invalid: 1 },
  list_spaces: { valid: { cursor: "cursor", limit: 10 }, invalid: { cursor: 1 } },
  list_threads: { valid: { limit: 10 }, invalid: { limit: false } },
  load_workspace_dependencies: { valid: {}, invalid: [] },
  manage_page_comment: { valid: { action: "react", page_id: "page", thread_id: "discussion", message_id: "message", emoji: "👍", active: true }, invalid: { action: "react", page_id: "page", emoji: "unknown" } },
  move_page: { valid: { page_id: "page", parent_page_id: "parent" }, invalid: { page_id: "page" } },
  move_project_to_sidebar_section: { valid: { projectId: "project", sectionId: null }, invalid: { projectId: "project" } },
  move_thread_to_sidebar_section: { valid: { threadId: "thread", hostId: "local", sectionId: "pinned" }, invalid: { threadId: "thread" } },
  navigate_to_codex_page: { valid: { threadId: "thread" }, invalid: {} },
  open_in_codex: { valid: { target: { type: "page", pageId: "page" }, placement: "right", threadId: "thread" }, invalid: { target: { type: "file" } } },
  read_page: { valid: { page_id: "page", block_ids: ["block"], include_metadata: true, max_chars: 1000 }, invalid: { page_id: "page", block_ids: "block" } },
  read_page_changes: { valid: { page_id: "page", after_sequence: 1, include_comments: true, max_chars: 1000 }, invalid: { page_id: "page", after_sequence: "1" } },
  read_thread: { valid: { threadId: "thread", hostId: "local", cursor: "cursor", includeOutputs: true, maxOutputCharsPerItem: 1000, turnLimit: 10 }, invalid: {} },
  read_thread_terminal: { valid: {}, invalid: "terminal" },
  rename_sidebar_section: { valid: { sectionId: "section", name: "Work" }, invalid: { sectionId: "section" } },
  reorder_section: { valid: { sectionId: "section", threadIds: ["thread"] }, invalid: { sectionId: "section", threadIds: "thread" } },
  reorder_sidebar_projects: { valid: { projectIds: ["project"] }, invalid: {} },
  reorder_sidebar_sections: { valid: { sectionIds: ["section"] }, invalid: {} },
  search_sharing_recipients: { valid: { page_id: "page", query: "User", limit: 10 }, invalid: { query: 1 } },
  send_message_to_thread: { valid: { threadId: "thread", hostId: "local", prompt: "Continue", model: "host-model", thinking: "medium" }, invalid: { threadId: "thread", prompt: "Continue", thinking: "unknown" } },
  set_thread_archived: { valid: { archived: true, hostId: "local", threadId: "thread" }, invalid: { archived: "true" } },
  set_thread_title: { valid: { title: "New title", threadId: "thread" }, invalid: { title: null } },
  share_thread: { valid: { threadId: "thread", hostId: "local" }, invalid: { threadId: 1 } },
  uninstall_plugin: { valid: { plugin: "plugin-name" }, invalid: {} },
  update_page_sharing: { valid: { page_id: "page", expected_policy_revision: 1, add_or_replace: [{ id: "user", role: "viewer", type: "user" }], remove: [{ id: "group", type: "workspace_group" }] }, invalid: { page_id: "page", expected_policy_revision: 1, add_or_replace: [{ id: "user", role: "owner", type: "user" }] } },
  update_space_sharing: { valid: { space_id: "space", add_or_replace: [{ id: "group", role: "editor", type: "workspace_group" }] }, invalid: { space_id: "space", remove: [{ id: "user", type: "everyone" }] } },
  wait_for_page_updates: { valid: { page_id: "page", after_sequence: 1, timeout_ms: 1000 }, invalid: { page_id: "page" } },
  wait_threads: { valid: { targets: [{ threadId: "thread", hostId: "local", afterCursor: "cursor" }], timeoutMs: 0 }, invalid: { targets: [] } },
} satisfies Record<CodexAppToolName, { valid: object; invalid: unknown }>;

describe("Codex desktop tool input contracts", () => {
  test("the entire exposed app inventory has fixtures and typed dispatch", () => {
    expect<readonly string[]>(CodexAppToolNameSchema.options.toSorted()).toEqual(Object.keys(cases).toSorted());
    expect(Object.keys(CodexAppToolInputSchemas).toSorted()).toEqual(Object.keys(cases).toSorted());
    expect(Object.keys(cases)).toHaveLength(51);
  });

  for (const name of CodexAppToolNameSchema.options) {
    test(name + " accepts the known fields and rejects malformed payloads", () => {
      const { valid, invalid } = cases[name];
      const input = { ...valid, future_host_field: { value: true } };
      const call = { tool_name: name, tool_input: input, call_id: "example" };
      expect(ParseCodexAppToolArgs(name, input)).toEqual({ success: true, data: input });
      expect<unknown>(ParseCodexAppToolInput(call)).toEqual({ success: true, data: call });
      expect(ParseCodexAppToolArgs(name, invalid).success).toBe(false);
      expect(ParseCodexAppToolInput({ tool_name: name, tool_input: invalid }).success).toBe(false);
      expect(ParseCodexAppToolInput({ tool_name: name }).success).toBe(false);
    });
  }

  test("automation known modes cannot fall through to the opaque extension mode", () => {
    const cron = { mode: "create", kind: "cron", destination: "local", executionEnvironment: "local",
      model: "host-model", name: "Reminder", notificationPolicy: null, projectId: null,
      prompt: "Remind me", reasoningEffort: "low", rrule: "FREQ=DAILY", status: "ACTIVE" };
    const heartbeat = { mode: "suggested_create", kind: "heartbeat", destination: "thread",
      name: "Follow up", prompt: "Check completion", rrule: { opaque: true }, status: "ACTIVE", targetThreadId: "thread" };
    for (const input of [cron, heartbeat, { ...cron, mode: "suggested_create", status: "PAUSED" }]) {
      expect(ParseCodexAppToolArgs("automation_update", input)).toEqual({ success: true, data: input });
      expect(CodexAppKnownAutomationUpdateToolInputSchema.safeParse(input).success).toBe(true);
    }
    for (const input of [{ mode: "view" }, { mode: "create", kind: "cron" },
      { ...cron, status: "unknown" }, { ...cron, projectId: 1 },
      { ...heartbeat, name: 1 }, { mode: 1 }, {}]) {
      expect(ParseCodexAppToolArgs("automation_update", input).success).toBe(false);
    }
    const opaque = { mode: "update", id: "automation", future_operation: { arbitrary: true } };
    expect(ParseCodexAppToolArgs("automation_update", opaque)).toEqual({ success: true, data: opaque });
    expect(CodexAppKnownAutomationUpdateToolInputSchema.safeParse(opaque).success).toBe(false);
  });

  test("thread target and starting-state variants preserve their own required fields", () => {
    for (const target of [
      { type: "project", projectId: "project", environment: { type: "local" } },
      { type: "project", projectId: "project", environment: { type: "worktree" } },
      { type: "project", projectId: "project", environment: { type: "worktree", startingState: { type: "working-tree" } } },
      { type: "project", projectId: "project", environment: { type: "worktree", startingState: { type: "branch", branchName: "topic", onMissing: "create-branch", future: true } } },
      { type: "projectless" }, { type: "chatgptWorkCloud" }, { type: "chatgptWorkCloud", projectId: "project" },
    ]) {
      const input = { prompt: "Review", target };
      expect<unknown>(ParseCodexAppToolArgs("create_thread", input)).toEqual({ success: true, data: input });
    }
    for (const target of [
      { type: "unknown" }, { type: "project", environment: { type: "local" } },
      { type: "project", projectId: "project" },
      { type: "project", projectId: "project", environment: { type: "worktree", startingState: { type: "branch" } } },
    ]) expect(ParseCodexAppToolArgs("create_thread", { prompt: "Review", target }).success).toBe(false);
  });

  test("opening review targets validates baseBranch instead of treating it as an unknown extension", () => {
    for (const target of [
      { type: "file", path: "/tmp/file.ts", line: 12 }, { type: "page", pageId: "page" },
      { type: "browser" }, { type: "browser", tabId: "tab", url: "https://example.com" },
      { type: "terminal", sessionId: "terminal" }, { type: "review" },
      { type: "review", view: "staged", path: "file.ts" },
      { type: "review", baseBranch: "main" }, { type: "review", baseBranch: "main", view: "branch" },
    ]) expect(ParseCodexAppToolArgs("open_in_codex", { target }).success).toBe(true);
    for (const target of [
      { type: "review", baseBranch: 42 }, { type: "review", baseBranch: "main", view: "staged" },
      { type: "page" }, { type: "unknown" },
    ]) expect(ParseCodexAppToolArgs("open_in_codex", { target }).success).toBe(false);
  });

  test("page edits retain concurrency tokens, nullable anchors and nested extensions", () => {
    const input = {
      page_id: "page", base_sequence: 3, request_id: "request",
      operations: [{
        op: "insert_markdown", block_id: "block", block_kind: "markdown", markdown: "Text",
        after_block_id: null, expected_hash: "hash", expected_title_hash: "title-hash",
        layout: "full-width", block_units: [{ kind: "markdown", markdown: "Text", future: true }],
        at: { kind: "in_block", block_id: "block", following_block_id: null, preceding_block_id: null,
          anchor: { kind: "snapshot_offset", expected_block_hash: "hash", offset_utf16: 4, future: true } },
      }],
    };
    expect<unknown>(ParseCodexAppToolArgs("edit_page", input)).toEqual({ success: true, data: input });
    expect(ParseCodexAppToolArgs("edit_page", { page_id: "page", operations: [{
      op: "insert_markdown", at: { kind: "in_block", anchor: { kind: "yjs_relative", relative_position_base64: "eA==" } },
    }] }).success).toBe(true);
    expect(ParseCodexAppToolArgs("edit_page", { page_id: "page", operations: [{
      op: "insert_markdown", at: { kind: "in_block", anchor: { kind: "snapshot_offset", offset_utf16: "4" } },
    }] }).success).toBe(false);
    expect(ParseCodexAppToolArgs("create_page_visualization", {
      page_id: "page", title: "Chart", html: "<html/>", replace_block: { block_id: "block", expected_hash: "hash" },
    }).success).toBe(true);
    expect(ParseCodexAppToolArgs("create_page_visualization", {
      page_id: "page", title: "Chart", html: "<html/>", replace_block: { block_id: "block" },
    }).success).toBe(false);
    expect(ParseCodexAppToolArgs("create_page_visualization", {
      page_id: "page", title: "Chart", html: "<html/>", after_block_id: "anchor",
      replace_block: { block_id: "block", expected_hash: "hash" },
    }).success).toBe(false);
    expect(ParseCodexAppToolArgs("create_page_visualization", {
      page_id: "page", title: "Chart", html: "<html/>", after_block_id: "anchor",
    }).success).toBe(true);
  });

  test("thread waits and sharing batches enforce documented cardinalities", () => {
    expect(ParseCodexAppToolArgs("wait_threads", { targets: Array.from({ length: 8 }, () => ({ threadId: "thread" })) }).success).toBe(true);
    expect(ParseCodexAppToolArgs("wait_threads", { targets: Array.from({ length: 9 }, () => ({ threadId: "thread" })) }).success).toBe(false);
    expect(ParseCodexAppToolArgs("update_space_sharing", { space_id: "space",
      remove: Array.from({ length: 51 }, () => ({ id: "user", type: "user" })),
    }).success).toBe(false);
    const changes = {
      add_or_replace: Array.from({ length: 25 }, (_, i) => ({ id: "add-" + i, type: "user", role: "viewer" })),
      remove: Array.from({ length: 25 }, (_, i) => ({ id: "remove-" + i, type: "user" })),
    };
    for (const name of ["update_page_sharing", "update_space_sharing"] as const) {
      const input = { page_id: "page", space_id: "space", expected_policy_revision: 1, ...changes };
      expect(ParseCodexAppToolArgs(name, input).success).toBe(true);
      expect(ParseCodexAppToolArgs(name, { ...input, remove: [...changes.remove, { id: "extra", type: "user" }] }).success).toBe(false);
    }
    expect(ParseCodexAppToolArgs("update_page_sharing", { page_id: "page" }).success).toBe(false);
    expect(ParseCodexAppToolArgs("move_thread_to_sidebar_section", { threadId: "thread", sectionId: null }).success).toBe(true);
    expect(ParseCodexAppToolArgs("share_thread", {})).toEqual({ success: true, data: {} });
    expect(ParseCodexAppToolArgs("set_thread_archived", { archived: false })).toEqual({ success: true, data: { archived: false } });
  });

  test("dispatch rejects foreign namespaces and preserves useful inferred types", () => {
    for (const name of ["unknown", "list_agents", "mcp__codex_app__read_page"]) {
      expect(ParseCodexAppToolInput({ tool_name: name, tool_input: {} }).success).toBe(false);
    }
    const parsed = ParseCodexAppToolInput({ tool_name: "read_page", tool_input: { page_id: "page" } });
    if (!parsed.success || parsed.data.tool_name !== "read_page") throw new Error("Expected read_page");
    expectTypeOf(parsed.data.tool_input).toEqualTypeOf<CodexAppReadPageToolInput>();
    expectTypeOf(ParseCodexAppToolArgs("create_thread", {}).data?.prompt).toEqualTypeOf<string | undefined>();
  });
});

describe("Codex app MCP response envelopes", () => {
  test("accepts all declared content blocks and opaque structured result fields", () => {
    const response = {
      content: [
        { type: "text", text: "Done", annotations: { audience: ["assistant"], priority: 1, lastModified: "2026-09-29" }, _meta: { future: true } },
        { type: "image", data: "eA==", mimeType: "image/png" },
        { type: "audio", data: "eA==", mimeType: "audio/wav" },
        { type: "resource_link", name: "Report", uri: "resource://report", title: "Report", description: "Report",
          mimeType: "text/plain", size: 1, icons: [{ src: "https://example.com/icon.png", mimeType: "image/png", sizes: ["16x16"], theme: "light" }] },
        { type: "resource", resource: { uri: "resource://text", text: "Text", mimeType: "text/plain", _meta: { future: true } } },
        { type: "resource", resource: { uri: "resource://blob", blob: "eA==" } },
      ],
      isError: false, structuredContent: { arbitrary_result: { value: 1 } }, _meta: { request: "id" }, future: true,
    };
    expect<unknown>(ParseCodexAppToolResponse(response)).toEqual({ success: true, data: response });
    expect(ParseCodexAppToolResponse({ content: [], isError: true }).success).toBe(true);
  });

  test("rejects malformed envelopes without pretending to validate app-specific result data", () => {
    for (const response of [{}, { content: "text" }, { content: [{ type: "text" }] },
      { content: [{ type: "image", data: "eA==" }] }, { content: [{ type: "resource", resource: { uri: "resource://missing" } }] },
      { content: [{ type: "resource_link", name: "Report" }] },
      { content: [{ type: "audio", data: 1, mimeType: "audio/wav" }] },
      { content: [], isError: "true" }, { content: [], structuredContent: [] }]) {
      expect(ParseCodexAppToolResponse(response).success).toBe(false);
    }
  });
});
