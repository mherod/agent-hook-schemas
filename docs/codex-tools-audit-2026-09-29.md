# Codex tool contract audit — September 29, 2026

## Evidence and scope

Source: the function declarations and direct tool parameter schemas exposed by
the active Codex desktop session on 2026-09-29. This is a dated host contract
snapshot, not a claim that every Codex version exposes these tools.
Existing collaboration V1/V2 and update_plan contracts remain separate.

The app inventory was enumerated from runtime tool metadata, selecting the
mcp__codex_app__ prefix: 51 tools. Core coverage adds 19 tools, including the
directly exposed execution wrapper, wait, question, and sleep tools.
The input fixtures specify all names independently and test each parser with
valid and malformed payloads. No app mutation was invoked to test these schemas.

## Core inventory (19)

- `exec_command`
- `write_stdin`
- `apply_patch`
- `exec`
- `wait`
- `view_image`
- `create_goal`
- `get_goal`
- `update_goal`
- `request_user_input`
- `request_user_input_async`
- `list_mcp_resources`
- `list_mcp_resource_templates`
- `read_mcp_resource`
- `request_plugin_install`
- `clock.curr_time`
- `clock.sleep`
- `image_gen.imagegen`
- `web.run`

## Codex app inventory (51)

Use these basenames after removing the mcp__codex_app__ transport prefix.

- `automation_update`
- `capture_heap_snapshots`
- `capture_screen_context`
- `consume_usage_reset`
- `create_page`
- `create_page_visualization`
- `create_sidebar_section`
- `create_space`
- `create_thread`
- `delete_sidebar_section`
- `edit_page`
- `end_realtime_voice_call`
- `find_pages`
- `fire_confetti`
- `fork_thread`
- `get_handoff_status`
- `get_page_sharing`
- `get_space_sharing`
- `get_usage_limits`
- `handoff_thread`
- `list_archived_threads`
- `list_page_comments`
- `list_pages`
- `list_projects`
- `list_spaces`
- `list_threads`
- `load_workspace_dependencies`
- `manage_page_comment`
- `move_page`
- `move_project_to_sidebar_section`
- `move_thread_to_sidebar_section`
- `navigate_to_codex_page`
- `open_in_codex`
- `read_page`
- `read_page_changes`
- `read_thread`
- `read_thread_terminal`
- `rename_sidebar_section`
- `reorder_section`
- `reorder_sidebar_projects`
- `reorder_sidebar_sections`
- `search_sharing_recipients`
- `send_message_to_thread`
- `set_thread_archived`
- `set_thread_title`
- `share_thread`
- `uninstall_plugin`
- `update_page_sharing`
- `update_space_sharing`
- `wait_for_page_updates`
- `wait_threads`

## Modeling decisions

- Freeform exec source and apply_patch patches are strings. Schema validation
  neither interprets their grammar nor executes their contents.
- exec_command uses cmd; it is distinct from a hook's normalized Bash command.
  Its numeric session_id and write_stdin differ from wait's string cell_id.
- Optional defaults remain absent in parsed results. Host-adjusted timing
  fields retain their values instead of being silently clamped.
- Input objects, including nested objects, preserve unknown host fields.
  Known discriminants and field types remain validated. Tool registries
  reject unknown names rather than silently accepting arbitrary JSON.
- Generic Codex hook parsing continues to accept arbitrary tool input JSON.
  Typed tool dispatch is explicit and does not change hook compatibility.
- Models, hosts, IDs, branch names, paths, and URLs stay strings. Their live
  availability and authorization belong to the host. In particular, the
  handoff destination host list is session-specific, not a portable enum.
- Structural limits include question and option counts, sleep duration,
  at most eight thread-wait targets, and a combined 50-change sharing limit.
  A review baseBranch selects branch view. Visualization insertion and
  replacement placements are mutually exclusive.
- The exposed automation_update declaration describes view, create, and
  suggested_create variants, then has two opaque unknown alternatives.
  Known variants cannot fall through to the opaque mode parser on malformed
  input. Other mode strings accept opaque object fields; this is partial
  coverage, not a recovered update/delete contract. Heartbeat rrule, status,
  and targetThreadId retain the declaration's unknown types.
- Runtime permission rules, voice-session requirements, share revisions,
  recipient authorization, branch existence, and scheduling policy are not
  established by parsing. These validators must not be used as authorization.

## Response coverage

The exposed return declarations specify exec_command and write_stdin output,
timing, exit/session IDs and optional metadata; view_image detail and image URL;
and clock.curr_time current_time. These four have dedicated response schemas.

The other core return declarations are unknown or unspecified. They intentionally
have no per-tool response validators. Every Codex app tool returns CallToolResult;
the shared response schema models its text, image, audio, resource-link, embedded
text/blob resource, annotations, metadata, error flag, and structured-content
envelope. It does not infer app-specific result semantics from opaque text or
structuredContent.

## Public surface and validation

New exports: agent-hook-schemas/codex-tools and
agent-hook-schemas/codex-app-tools, plus the root and Codex barrels.
Input and known response types are inferred from their schemas. Dispatch unions
retain the relationship between a tool name and its parsed argument type.

Tests cover every inventory entry, wrong required-field types, nested variants,
extension preservation, freeform input, response envelopes, partial automation
coverage, and type narrowing. Built-package smoke checks load the new entries
first in separate Node and Bun processes to detect initialization-order errors.
The repository coverage gate includes both new production modules automatically.

Validation on the completed change:

- Build and TypeScript checks passed.
- Normal bounded-parallel suite: 848 passed, 27 optional capture tests skipped,
  zero failures.
- Built-package smoke suite: 24 passed, including both new entries under Node
  and Bun.
- Source coverage suite: 824 passed, 27 optional capture tests skipped; the
  coverage gate passed for all 24 library modules. Both new tool modules have
  100% function and line coverage.
- The app registry matches all 51 names in the live runtime inventory.
- Git whitespace validation passed.

Individual connector tools and browser automation plugins remain outside this
update. No version bump or package publication is part of this schema change.
