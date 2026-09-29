import { z } from "zod";

/**
 * Codex desktop app tool inputs exposed on 2026-09-29.
 * See docs/codex-tools-audit-2026-09-29.md. IDs are opaque strings and objects
 * retain host extensions. Parsing never authorizes an action or verifies access.
 */
const EmptyInputSchema = z.object({}).loose();
const PageIdSchema = z.object({ page_id: z.string() }).loose();
const SpaceIdSchema = z.object({ space_id: z.string() }).loose();
const ThreadHostFields = { hostId: z.string().optional(), threadId: z.string() };
const ReasoningEffortSchema = z.enum(["none", "minimal", "low", "medium", "high", "xhigh", "max", "ultra"]);
const RecipientSchema = z.object({
  id: z.string(), role: z.enum(["viewer", "commenter", "editor"]), type: z.enum(["user", "workspace_group"]),
}).loose();
const RemovedRecipientSchema = z.object({
  id: z.string(), type: z.enum(["user", "workspace_group"]),
}).loose();
const SharingChanges = {
  add_or_replace: z.array(RecipientSchema).max(50).optional(),
  remove: z.array(RemovedRecipientSchema).max(50).optional(),
};
const withinSharingLimit = (input: { add_or_replace?: unknown[]; remove?: unknown[] }) =>
  (input.add_or_replace?.length ?? 0) + (input.remove?.length ?? 0) <= 50;

/**
 * The session exposes view/create definitions, but leaves the remaining
 * automation modes opaque. Known modes must pass their own validation; other
 * modes retain their fields without claiming to validate their contracts.
 */
export const CodexAppKnownAutomationUpdateToolInputSchema = z.union([
  z.object({ mode: z.literal("view"), id: z.string() }).loose(),
  z.object({
    mode: z.enum(["create", "suggested_create"]), kind: z.literal("cron"),
    destination: z.literal("local").optional(), executionEnvironment: z.literal("local"),
    model: z.string(), name: z.string(), notificationPolicy: z.literal("failed_runs_only").nullable().optional(),
    projectId: z.string().nullable(), prompt: z.string(), reasoningEffort: ReasoningEffortSchema,
    rrule: z.string(), status: z.enum(["ACTIVE", "PAUSED"]),
  }).loose(),
  z.object({
    mode: z.enum(["create", "suggested_create"]), kind: z.literal("heartbeat"),
    destination: z.enum(["local", "thread"]).optional(), name: z.string(),
    notificationPolicy: z.literal("failed_runs_only").nullable().optional(),
    prompt: z.string(), rrule: z.unknown(), status: z.unknown(), targetThreadId: z.unknown().optional(),
  }).loose(),
]);
export const CodexAppAutomationUpdateToolInputSchema = z.union([
  CodexAppKnownAutomationUpdateToolInputSchema,
  z.object({
    mode: z.string().refine((mode) => !["view", "create", "suggested_create"].includes(mode), {
      message: "Use the documented schema for this automation mode",
    }),
  }).loose(),
]);

export const CodexAppCaptureHeapSnapshotsToolInputSchema = EmptyInputSchema;
export const CodexAppCaptureScreenContextToolInputSchema = EmptyInputSchema;
export const CodexAppConsumeUsageResetToolInputSchema = z.object({ idempotencyKey: z.string() }).loose();
export const CodexAppCreatePageToolInputSchema = z.object({
  markdown: z.string().optional(), parent_page_id: z.string().optional(),
  space_id: z.string().optional(), title: z.string(),
}).loose();
export const CodexAppCreatePageVisualizationToolInputSchema = z.object({
  after_block_id: z.string().optional(), base_sequence: z.number().optional(),
  html: z.string(), page_id: z.string(),
  replace_block: z.object({ block_id: z.string(), expected_hash: z.string() }).loose().optional(),
  request_id: z.string().optional(), title: z.string(),
}).loose().refine((input) => input.after_block_id === undefined || input.replace_block === undefined, {
  message: "Choose insertion or replacement, not both",
  path: ["replace_block"],
});
export const CodexAppCreateSidebarSectionToolInputSchema = z.object({ name: z.string() }).loose();
export const CodexAppCreateSpaceToolInputSchema = z.object({
  existing_space: z.object({ root_page_id: z.string(), space_id: z.string() }).loose().optional(),
  name: z.string(),
}).loose();

export const CodexAppCreateThreadToolInputSchema = z.object({
  model: z.string().optional(), prompt: z.string(),
  target: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("project"), projectId: z.string(),
      environment: z.discriminatedUnion("type", [
        z.object({ type: z.literal("local") }).loose(),
        z.object({
          type: z.literal("worktree"),
          startingState: z.discriminatedUnion("type", [
            z.object({ type: z.literal("working-tree") }).loose(),
            z.object({
              type: z.literal("branch"), branchName: z.string(),
              onMissing: z.literal("create-branch").optional(),
            }).loose(),
          ]).optional(),
        }).loose(),
      ]),
    }).loose(),
    z.object({ type: z.literal("projectless"), directoryName: z.string().optional() }).loose(),
    z.object({ type: z.literal("chatgptWorkCloud"), projectId: z.string().optional() }).loose(),
  ]),
  thinking: ReasoningEffortSchema.optional(), title: z.string().optional(),
}).loose();
export const CodexAppDeleteSidebarSectionToolInputSchema = z.object({ sectionId: z.string() }).loose();
export const CodexAppEditPageToolInputSchema = z.object({
  base_sequence: z.number().optional(),
  operations: z.array(z.object({
    after_block_id: z.string().nullable().optional(),
    at: z.object({
      anchor: z.object({
        expected_block_hash: z.string().optional(), kind: z.enum(["snapshot_offset", "yjs_relative"]),
        offset_utf16: z.number().optional(), relative_position_base64: z.string().optional(),
      }).loose().optional(),
      block_id: z.string().optional(), following_block_id: z.string().nullable().optional(),
      kind: z.enum(["between_blocks", "in_block"]), preceding_block_id: z.string().nullable().optional(),
    }).loose().optional(),
    block_id: z.string().optional(), block_kind: z.enum(["markdown", "agent_instructions"]).optional(),
    block_units: z.array(z.object({
      kind: z.enum(["markdown", "agent_instructions"]), markdown: z.string(),
    }).loose()).optional(),
    expected_hash: z.string().optional(), expected_title_hash: z.string().optional(),
    layout: z.enum(["normal", "flexible", "full-width"]).optional(), markdown: z.string().optional(),
    op: z.enum(["set_title", "insert_markdown", "replace_block_markdown", "delete_block", "move_block", "set_block_layout", "insert_page_link"]),
    target_page_id: z.string().optional(), title: z.string().optional(),
  }).loose()),
  page_id: z.string(), request_id: z.string().optional(),
}).loose();
export const CodexAppEndRealtimeVoiceCallToolInputSchema = EmptyInputSchema;
export const CodexAppFindPagesToolInputSchema = z.object({
  cursor: z.string().optional(), limit: z.number().optional(), query: z.string(), space_id: z.string().optional(),
}).loose();
export const CodexAppFireConfettiToolInputSchema = z.object({ emojis: z.array(z.string()).optional() }).loose();
export const CodexAppForkThreadToolInputSchema = z.object({
  environment: z.object({ type: z.enum(["same-directory", "worktree"]) }).loose().optional(),
  threadId: z.string().optional(),
}).loose();
export const CodexAppGetHandoffStatusToolInputSchema = z.object({
  afterRevision: z.number().optional(), operationId: z.string(), waitMs: z.number().optional(),
}).loose();
export const CodexAppGetPageSharingToolInputSchema = PageIdSchema;
export const CodexAppGetSpaceSharingToolInputSchema = SpaceIdSchema;
export const CodexAppGetUsageLimitsToolInputSchema = EmptyInputSchema;
export const CodexAppHandoffThreadToolInputSchema = z.object({
  destinationHostId: z.string().optional(), followUpPrompt: z.string().optional(), threadId: z.string(),
}).loose();
export const CodexAppListArchivedThreadsToolInputSchema = z.object({
  cursor: z.string().optional(), hostId: z.string().optional(), limit: z.number().optional(),
}).loose();
export const CodexAppListPageCommentsToolInputSchema = z.object({
  block_id: z.string().optional(), limit: z.number().optional(), page_id: z.string(),
  state: z.enum(["open", "resolved"]).optional(),
}).loose();
export const CodexAppListPagesToolInputSchema = z.object({
  cursor: z.string().optional(), limit: z.number().optional(),
  parent_page_id: z.string().optional(), space_id: z.string().optional(),
}).loose();
export const CodexAppListProjectsToolInputSchema = EmptyInputSchema;
export const CodexAppListSpacesToolInputSchema = z.object({
  cursor: z.string().optional(), limit: z.number().optional(),
}).loose();
export const CodexAppListThreadsToolInputSchema = z.object({ limit: z.number().optional() }).loose();
export const CodexAppLoadWorkspaceDependenciesToolInputSchema = EmptyInputSchema;
export const CodexAppManagePageCommentToolInputSchema = z.object({
  action: z.enum(["add", "reply", "react", "resolve", "reopen", "edit", "delete_message", "delete_thread"]),
  active: z.boolean().optional(), block_id: z.string().optional(), body: z.string().optional(),
  emoji: z.enum(["👍", "❤️", "🎉", "👀"]).optional(), message_id: z.string().optional(),
  occurrence: z.number().optional(), page_id: z.string(),
  selected_text: z.string().optional(), thread_id: z.string().optional(),
}).loose();
export const CodexAppMovePageToolInputSchema = z.object({
  page_id: z.string(), parent_page_id: z.string(),
}).loose();
export const CodexAppMoveProjectToSidebarSectionToolInputSchema = z.object({
  projectId: z.string(), sectionId: z.string().nullable(),
}).loose();
export const CodexAppMoveThreadToSidebarSectionToolInputSchema = z.object({
  ...ThreadHostFields, sectionId: z.string().nullable(),
}).loose();
export const CodexAppNavigateToCodexPageToolInputSchema = z.object({ threadId: z.string() }).loose();
export const CodexAppOpenInCodexToolInputSchema = z.object({
  placement: z.enum(["right", "bottom"]).optional(),
  target: z.union([
    z.object({ type: z.literal("file"), line: z.number().optional(), path: z.string() }).loose(),
    z.object({ type: z.literal("page"), pageId: z.string() }).loose(),
    z.object({ type: z.literal("browser"), tabId: z.string().optional(), url: z.string().optional() }).loose(),
    z.object({ type: z.literal("terminal"), sessionId: z.string().optional() }).loose(),
    z.object({
      type: z.literal("review"), baseBranch: z.string().optional(), path: z.string().optional(),
      view: z.enum(["last-turn", "branch", "unstaged", "staged"]).optional(),
    }).loose().refine((target) => target.baseBranch === undefined ||
      target.view === undefined || target.view === "branch", {
      message: "A baseBranch selects branch review",
      path: ["view"],
    }),
  ]),
  threadId: z.string().optional(),
}).loose();
export const CodexAppReadPageToolInputSchema = z.object({
  block_ids: z.array(z.string()).optional(), include_metadata: z.boolean().optional(),
  max_chars: z.number().optional(), page_id: z.string(),
}).loose();
export const CodexAppReadPageChangesToolInputSchema = z.object({
  after_sequence: z.number().optional(), include_comments: z.boolean().optional(),
  max_chars: z.number().optional(), page_id: z.string(),
}).loose();
export const CodexAppReadThreadToolInputSchema = z.object({
  ...ThreadHostFields, cursor: z.string().optional(), includeOutputs: z.boolean().optional(),
  maxOutputCharsPerItem: z.number().optional(), turnLimit: z.number().optional(),
}).loose();
export const CodexAppReadThreadTerminalToolInputSchema = EmptyInputSchema;
export const CodexAppRenameSidebarSectionToolInputSchema = z.object({
  name: z.string(), sectionId: z.string(),
}).loose();
export const CodexAppReorderSectionToolInputSchema = z.object({
  sectionId: z.string(), threadIds: z.array(z.string()),
}).loose();
export const CodexAppReorderSidebarProjectsToolInputSchema = z.object({ projectIds: z.array(z.string()) }).loose();
export const CodexAppReorderSidebarSectionsToolInputSchema = z.object({ sectionIds: z.array(z.string()) }).loose();
export const CodexAppSearchSharingRecipientsToolInputSchema = z.object({
  limit: z.number().optional(), page_id: z.string().optional(), query: z.string(), space_id: z.string().optional(),
}).loose();
export const CodexAppSendMessageToThreadToolInputSchema = z.object({
  ...ThreadHostFields, model: z.string().optional(), prompt: z.string(), thinking: ReasoningEffortSchema.optional(),
}).loose();
export const CodexAppSetThreadArchivedToolInputSchema = z.object({
  archived: z.boolean(), hostId: z.string().optional(), threadId: z.string().optional(),
}).loose();
export const CodexAppSetThreadTitleToolInputSchema = z.object({
  threadId: z.string().optional(), title: z.string(),
}).loose();
export const CodexAppShareThreadToolInputSchema = z.object({
  hostId: z.string().optional(), threadId: z.string().optional(),
}).loose();
export const CodexAppUninstallPluginToolInputSchema = z.object({ plugin: z.string() }).loose();
export const CodexAppUpdatePageSharingToolInputSchema = z.object({
  ...SharingChanges, expected_policy_revision: z.number(), page_id: z.string(),
}).loose().refine(withinSharingLimit, { message: "At most 50 sharing changes per request" });
export const CodexAppUpdateSpaceSharingToolInputSchema = z.object({
  ...SharingChanges, space_id: z.string(),
}).loose().refine(withinSharingLimit, { message: "At most 50 sharing changes per request" });
export const CodexAppWaitForPageUpdatesToolInputSchema = z.object({
  after_sequence: z.number(), page_id: z.string(), timeout_ms: z.number().optional(),
}).loose();
export const CodexAppWaitThreadsToolInputSchema = z.object({
  targets: z.array(z.object({
    afterCursor: z.string().optional(), ...ThreadHostFields,
  }).loose()).min(1).max(8),
  timeoutMs: z.number().optional(),
}).loose();

/** Shared MCP response envelope; individual app result payloads remain opaque. */
const AnnotationsSchema = z.object({
  audience: z.array(z.enum(["user", "assistant"])).optional(),
  priority: z.number().optional(), lastModified: z.string().optional(),
}).loose();
const ContentFields = {
  annotations: AnnotationsSchema.optional(), _meta: z.record(z.string(), z.unknown()).optional(),
};
const ResourceContentsFields = {
  uri: z.string(), mimeType: z.string().optional(), _meta: z.record(z.string(), z.unknown()).optional(),
};
export const CodexAppToolResponseSchema = z.object({
  _meta: z.record(z.string(), z.unknown()).optional(),
  content: z.array(z.discriminatedUnion("type", [
    z.object({ type: z.literal("text"), text: z.string(), ...ContentFields }).loose(),
    z.object({ type: z.literal("image"), data: z.string(), mimeType: z.string(), ...ContentFields }).loose(),
    z.object({ type: z.literal("audio"), data: z.string(), mimeType: z.string(), ...ContentFields }).loose(),
    z.object({
      type: z.literal("resource_link"), name: z.string(), uri: z.string(),
      title: z.string().optional(), description: z.string().optional(), mimeType: z.string().optional(),
      size: z.number().optional(), annotations: AnnotationsSchema.optional(),
      icons: z.array(z.object({
        src: z.string(), mimeType: z.string().optional(), sizes: z.array(z.string()).optional(),
        theme: z.enum(["light", "dark"]).optional(),
      }).loose()).optional(),
    }).loose(),
    z.object({
      type: z.literal("resource"),
      resource: z.union([
        z.object({ ...ResourceContentsFields, text: z.string() }).loose(),
        z.object({ ...ResourceContentsFields, blob: z.string() }).loose(),
      ]),
      annotations: AnnotationsSchema.optional(),
    }).loose(),
  ])),
  isError: z.boolean().optional(),
  structuredContent: z.record(z.string(), z.unknown()).optional(),
}).loose();
export type CodexAppToolResponse = z.infer<typeof CodexAppToolResponseSchema>;

export function ParseCodexAppToolResponse(response: unknown) {
  return CodexAppToolResponseSchema.safeParse(response);
}

export type CodexAppAutomationUpdateToolInput = z.infer<typeof CodexAppAutomationUpdateToolInputSchema>;
export type CodexAppCaptureHeapSnapshotsToolInput = z.infer<typeof CodexAppCaptureHeapSnapshotsToolInputSchema>;
export type CodexAppCaptureScreenContextToolInput = z.infer<typeof CodexAppCaptureScreenContextToolInputSchema>;
export type CodexAppConsumeUsageResetToolInput = z.infer<typeof CodexAppConsumeUsageResetToolInputSchema>;
export type CodexAppCreatePageToolInput = z.infer<typeof CodexAppCreatePageToolInputSchema>;
export type CodexAppCreatePageVisualizationToolInput = z.infer<typeof CodexAppCreatePageVisualizationToolInputSchema>;
export type CodexAppCreateSidebarSectionToolInput = z.infer<typeof CodexAppCreateSidebarSectionToolInputSchema>;
export type CodexAppCreateSpaceToolInput = z.infer<typeof CodexAppCreateSpaceToolInputSchema>;
export type CodexAppCreateThreadToolInput = z.infer<typeof CodexAppCreateThreadToolInputSchema>;
export type CodexAppDeleteSidebarSectionToolInput = z.infer<typeof CodexAppDeleteSidebarSectionToolInputSchema>;
export type CodexAppEditPageToolInput = z.infer<typeof CodexAppEditPageToolInputSchema>;
export type CodexAppEndRealtimeVoiceCallToolInput = z.infer<typeof CodexAppEndRealtimeVoiceCallToolInputSchema>;
export type CodexAppFindPagesToolInput = z.infer<typeof CodexAppFindPagesToolInputSchema>;
export type CodexAppFireConfettiToolInput = z.infer<typeof CodexAppFireConfettiToolInputSchema>;
export type CodexAppForkThreadToolInput = z.infer<typeof CodexAppForkThreadToolInputSchema>;
export type CodexAppGetHandoffStatusToolInput = z.infer<typeof CodexAppGetHandoffStatusToolInputSchema>;
export type CodexAppGetPageSharingToolInput = z.infer<typeof CodexAppGetPageSharingToolInputSchema>;
export type CodexAppGetSpaceSharingToolInput = z.infer<typeof CodexAppGetSpaceSharingToolInputSchema>;
export type CodexAppGetUsageLimitsToolInput = z.infer<typeof CodexAppGetUsageLimitsToolInputSchema>;
export type CodexAppHandoffThreadToolInput = z.infer<typeof CodexAppHandoffThreadToolInputSchema>;
export type CodexAppListArchivedThreadsToolInput = z.infer<typeof CodexAppListArchivedThreadsToolInputSchema>;
export type CodexAppListPageCommentsToolInput = z.infer<typeof CodexAppListPageCommentsToolInputSchema>;
export type CodexAppListPagesToolInput = z.infer<typeof CodexAppListPagesToolInputSchema>;
export type CodexAppListProjectsToolInput = z.infer<typeof CodexAppListProjectsToolInputSchema>;
export type CodexAppListSpacesToolInput = z.infer<typeof CodexAppListSpacesToolInputSchema>;
export type CodexAppListThreadsToolInput = z.infer<typeof CodexAppListThreadsToolInputSchema>;
export type CodexAppLoadWorkspaceDependenciesToolInput = z.infer<typeof CodexAppLoadWorkspaceDependenciesToolInputSchema>;
export type CodexAppManagePageCommentToolInput = z.infer<typeof CodexAppManagePageCommentToolInputSchema>;
export type CodexAppMovePageToolInput = z.infer<typeof CodexAppMovePageToolInputSchema>;
export type CodexAppMoveProjectToSidebarSectionToolInput = z.infer<typeof CodexAppMoveProjectToSidebarSectionToolInputSchema>;
export type CodexAppMoveThreadToSidebarSectionToolInput = z.infer<typeof CodexAppMoveThreadToSidebarSectionToolInputSchema>;
export type CodexAppNavigateToCodexPageToolInput = z.infer<typeof CodexAppNavigateToCodexPageToolInputSchema>;
export type CodexAppOpenInCodexToolInput = z.infer<typeof CodexAppOpenInCodexToolInputSchema>;
export type CodexAppReadPageToolInput = z.infer<typeof CodexAppReadPageToolInputSchema>;
export type CodexAppReadPageChangesToolInput = z.infer<typeof CodexAppReadPageChangesToolInputSchema>;
export type CodexAppReadThreadToolInput = z.infer<typeof CodexAppReadThreadToolInputSchema>;
export type CodexAppReadThreadTerminalToolInput = z.infer<typeof CodexAppReadThreadTerminalToolInputSchema>;
export type CodexAppRenameSidebarSectionToolInput = z.infer<typeof CodexAppRenameSidebarSectionToolInputSchema>;
export type CodexAppReorderSectionToolInput = z.infer<typeof CodexAppReorderSectionToolInputSchema>;
export type CodexAppReorderSidebarProjectsToolInput = z.infer<typeof CodexAppReorderSidebarProjectsToolInputSchema>;
export type CodexAppReorderSidebarSectionsToolInput = z.infer<typeof CodexAppReorderSidebarSectionsToolInputSchema>;
export type CodexAppSearchSharingRecipientsToolInput = z.infer<typeof CodexAppSearchSharingRecipientsToolInputSchema>;
export type CodexAppSendMessageToThreadToolInput = z.infer<typeof CodexAppSendMessageToThreadToolInputSchema>;
export type CodexAppSetThreadArchivedToolInput = z.infer<typeof CodexAppSetThreadArchivedToolInputSchema>;
export type CodexAppSetThreadTitleToolInput = z.infer<typeof CodexAppSetThreadTitleToolInputSchema>;
export type CodexAppShareThreadToolInput = z.infer<typeof CodexAppShareThreadToolInputSchema>;
export type CodexAppUninstallPluginToolInput = z.infer<typeof CodexAppUninstallPluginToolInputSchema>;
export type CodexAppUpdatePageSharingToolInput = z.infer<typeof CodexAppUpdatePageSharingToolInputSchema>;
export type CodexAppUpdateSpaceSharingToolInput = z.infer<typeof CodexAppUpdateSpaceSharingToolInputSchema>;
export type CodexAppWaitForPageUpdatesToolInput = z.infer<typeof CodexAppWaitForPageUpdatesToolInputSchema>;
export type CodexAppWaitThreadsToolInput = z.infer<typeof CodexAppWaitThreadsToolInputSchema>;

export const CodexAppToolNameSchema = z.enum([
  "automation_update",
  "capture_heap_snapshots",
  "capture_screen_context",
  "consume_usage_reset",
  "create_page",
  "create_page_visualization",
  "create_sidebar_section",
  "create_space",
  "create_thread",
  "delete_sidebar_section",
  "edit_page",
  "end_realtime_voice_call",
  "find_pages",
  "fire_confetti",
  "fork_thread",
  "get_handoff_status",
  "get_page_sharing",
  "get_space_sharing",
  "get_usage_limits",
  "handoff_thread",
  "list_archived_threads",
  "list_page_comments",
  "list_pages",
  "list_projects",
  "list_spaces",
  "list_threads",
  "load_workspace_dependencies",
  "manage_page_comment",
  "move_page",
  "move_project_to_sidebar_section",
  "move_thread_to_sidebar_section",
  "navigate_to_codex_page",
  "open_in_codex",
  "read_page",
  "read_page_changes",
  "read_thread",
  "read_thread_terminal",
  "rename_sidebar_section",
  "reorder_section",
  "reorder_sidebar_projects",
  "reorder_sidebar_sections",
  "search_sharing_recipients",
  "send_message_to_thread",
  "set_thread_archived",
  "set_thread_title",
  "share_thread",
  "uninstall_plugin",
  "update_page_sharing",
  "update_space_sharing",
  "wait_for_page_updates",
  "wait_threads"
]);
export type CodexAppToolName = z.infer<typeof CodexAppToolNameSchema>;

export const CodexAppToolInputSchemas = {
  automation_update: CodexAppAutomationUpdateToolInputSchema,
  capture_heap_snapshots: CodexAppCaptureHeapSnapshotsToolInputSchema,
  capture_screen_context: CodexAppCaptureScreenContextToolInputSchema,
  consume_usage_reset: CodexAppConsumeUsageResetToolInputSchema,
  create_page: CodexAppCreatePageToolInputSchema,
  create_page_visualization: CodexAppCreatePageVisualizationToolInputSchema,
  create_sidebar_section: CodexAppCreateSidebarSectionToolInputSchema,
  create_space: CodexAppCreateSpaceToolInputSchema,
  create_thread: CodexAppCreateThreadToolInputSchema,
  delete_sidebar_section: CodexAppDeleteSidebarSectionToolInputSchema,
  edit_page: CodexAppEditPageToolInputSchema,
  end_realtime_voice_call: CodexAppEndRealtimeVoiceCallToolInputSchema,
  find_pages: CodexAppFindPagesToolInputSchema,
  fire_confetti: CodexAppFireConfettiToolInputSchema,
  fork_thread: CodexAppForkThreadToolInputSchema,
  get_handoff_status: CodexAppGetHandoffStatusToolInputSchema,
  get_page_sharing: CodexAppGetPageSharingToolInputSchema,
  get_space_sharing: CodexAppGetSpaceSharingToolInputSchema,
  get_usage_limits: CodexAppGetUsageLimitsToolInputSchema,
  handoff_thread: CodexAppHandoffThreadToolInputSchema,
  list_archived_threads: CodexAppListArchivedThreadsToolInputSchema,
  list_page_comments: CodexAppListPageCommentsToolInputSchema,
  list_pages: CodexAppListPagesToolInputSchema,
  list_projects: CodexAppListProjectsToolInputSchema,
  list_spaces: CodexAppListSpacesToolInputSchema,
  list_threads: CodexAppListThreadsToolInputSchema,
  load_workspace_dependencies: CodexAppLoadWorkspaceDependenciesToolInputSchema,
  manage_page_comment: CodexAppManagePageCommentToolInputSchema,
  move_page: CodexAppMovePageToolInputSchema,
  move_project_to_sidebar_section: CodexAppMoveProjectToSidebarSectionToolInputSchema,
  move_thread_to_sidebar_section: CodexAppMoveThreadToSidebarSectionToolInputSchema,
  navigate_to_codex_page: CodexAppNavigateToCodexPageToolInputSchema,
  open_in_codex: CodexAppOpenInCodexToolInputSchema,
  read_page: CodexAppReadPageToolInputSchema,
  read_page_changes: CodexAppReadPageChangesToolInputSchema,
  read_thread: CodexAppReadThreadToolInputSchema,
  read_thread_terminal: CodexAppReadThreadTerminalToolInputSchema,
  rename_sidebar_section: CodexAppRenameSidebarSectionToolInputSchema,
  reorder_section: CodexAppReorderSectionToolInputSchema,
  reorder_sidebar_projects: CodexAppReorderSidebarProjectsToolInputSchema,
  reorder_sidebar_sections: CodexAppReorderSidebarSectionsToolInputSchema,
  search_sharing_recipients: CodexAppSearchSharingRecipientsToolInputSchema,
  send_message_to_thread: CodexAppSendMessageToThreadToolInputSchema,
  set_thread_archived: CodexAppSetThreadArchivedToolInputSchema,
  set_thread_title: CodexAppSetThreadTitleToolInputSchema,
  share_thread: CodexAppShareThreadToolInputSchema,
  uninstall_plugin: CodexAppUninstallPluginToolInputSchema,
  update_page_sharing: CodexAppUpdatePageSharingToolInputSchema,
  update_space_sharing: CodexAppUpdateSpaceSharingToolInputSchema,
  wait_for_page_updates: CodexAppWaitForPageUpdatesToolInputSchema,
  wait_threads: CodexAppWaitThreadsToolInputSchema,
} satisfies Record<CodexAppToolName, z.ZodType>;
export type CodexAppToolArgs<N extends CodexAppToolName = CodexAppToolName> =
  z.infer<(typeof CodexAppToolInputSchemas)[N]>;

/** Use the tool basename after removing the mcp__codex_app__ transport prefix. */
export const CodexAppToolInputSchema = z.discriminatedUnion("tool_name", [
  z.object({ tool_name: z.literal("automation_update"), tool_input: CodexAppAutomationUpdateToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("capture_heap_snapshots"), tool_input: CodexAppCaptureHeapSnapshotsToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("capture_screen_context"), tool_input: CodexAppCaptureScreenContextToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("consume_usage_reset"), tool_input: CodexAppConsumeUsageResetToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("create_page"), tool_input: CodexAppCreatePageToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("create_page_visualization"), tool_input: CodexAppCreatePageVisualizationToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("create_sidebar_section"), tool_input: CodexAppCreateSidebarSectionToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("create_space"), tool_input: CodexAppCreateSpaceToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("create_thread"), tool_input: CodexAppCreateThreadToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("delete_sidebar_section"), tool_input: CodexAppDeleteSidebarSectionToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("edit_page"), tool_input: CodexAppEditPageToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("end_realtime_voice_call"), tool_input: CodexAppEndRealtimeVoiceCallToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("find_pages"), tool_input: CodexAppFindPagesToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("fire_confetti"), tool_input: CodexAppFireConfettiToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("fork_thread"), tool_input: CodexAppForkThreadToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("get_handoff_status"), tool_input: CodexAppGetHandoffStatusToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("get_page_sharing"), tool_input: CodexAppGetPageSharingToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("get_space_sharing"), tool_input: CodexAppGetSpaceSharingToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("get_usage_limits"), tool_input: CodexAppGetUsageLimitsToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("handoff_thread"), tool_input: CodexAppHandoffThreadToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("list_archived_threads"), tool_input: CodexAppListArchivedThreadsToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("list_page_comments"), tool_input: CodexAppListPageCommentsToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("list_pages"), tool_input: CodexAppListPagesToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("list_projects"), tool_input: CodexAppListProjectsToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("list_spaces"), tool_input: CodexAppListSpacesToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("list_threads"), tool_input: CodexAppListThreadsToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("load_workspace_dependencies"), tool_input: CodexAppLoadWorkspaceDependenciesToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("manage_page_comment"), tool_input: CodexAppManagePageCommentToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("move_page"), tool_input: CodexAppMovePageToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("move_project_to_sidebar_section"), tool_input: CodexAppMoveProjectToSidebarSectionToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("move_thread_to_sidebar_section"), tool_input: CodexAppMoveThreadToSidebarSectionToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("navigate_to_codex_page"), tool_input: CodexAppNavigateToCodexPageToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("open_in_codex"), tool_input: CodexAppOpenInCodexToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("read_page"), tool_input: CodexAppReadPageToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("read_page_changes"), tool_input: CodexAppReadPageChangesToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("read_thread"), tool_input: CodexAppReadThreadToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("read_thread_terminal"), tool_input: CodexAppReadThreadTerminalToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("rename_sidebar_section"), tool_input: CodexAppRenameSidebarSectionToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("reorder_section"), tool_input: CodexAppReorderSectionToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("reorder_sidebar_projects"), tool_input: CodexAppReorderSidebarProjectsToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("reorder_sidebar_sections"), tool_input: CodexAppReorderSidebarSectionsToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("search_sharing_recipients"), tool_input: CodexAppSearchSharingRecipientsToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("send_message_to_thread"), tool_input: CodexAppSendMessageToThreadToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("set_thread_archived"), tool_input: CodexAppSetThreadArchivedToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("set_thread_title"), tool_input: CodexAppSetThreadTitleToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("share_thread"), tool_input: CodexAppShareThreadToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("uninstall_plugin"), tool_input: CodexAppUninstallPluginToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("update_page_sharing"), tool_input: CodexAppUpdatePageSharingToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("update_space_sharing"), tool_input: CodexAppUpdateSpaceSharingToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("wait_for_page_updates"), tool_input: CodexAppWaitForPageUpdatesToolInputSchema }).loose(),
  z.object({ tool_name: z.literal("wait_threads"), tool_input: CodexAppWaitThreadsToolInputSchema }).loose(),
]);
export type CodexAppToolInput = z.infer<typeof CodexAppToolInputSchema>;

export function ParseCodexAppToolInput(input: unknown) {
  return CodexAppToolInputSchema.safeParse(input);
}

export function ParseCodexAppToolArgs<N extends CodexAppToolName>(name: N, input: unknown) {
  return CodexAppToolInputSchemas[name].safeParse(input) as z.ZodSafeParseResult<CodexAppToolArgs<N>>;
}
