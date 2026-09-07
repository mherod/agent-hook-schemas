# agent-hook-schemas

[Zod](https://zod.dev) schemas and helpers for **hook stdin/stdout JSON** and **hooks config merging** across AI coding assistants.

Supports [Claude Code](https://docs.anthropic.com/en/docs/claude-code), [OpenAI Codex](https://github.com/openai/codex), GitHub Copilot CLI / cloud agent hooks, [Gemini CLI](https://github.com/google-gemini/gemini-cli), [Cursor](https://www.cursor.com/), and [Google Antigravity](https://www.antigravity.google).

## Install

```bash
# bun
bun add agent-hook-schemas

# npm
npm install agent-hook-schemas

# pnpm
pnpm add agent-hook-schemas

# yarn
yarn add agent-hook-schemas
```

Requires `zod` v4+ as a dependency and `typescript` v5+ as a peer.

## Quick Start

### Parse hook stdin

Every hook receives JSON on stdin. Parse it into a fully-typed schema in one call:

```ts
import { ParseHookInput } from "agent-hook-schemas";           // Claude Code
import { ParseCodexHookInput } from "agent-hook-schemas/codex"; // OpenAI Codex
import { ParseCopilotHookInput } from "agent-hook-schemas/copilot"; // GitHub Copilot
import { ParseGeminiHookInput } from "agent-hook-schemas/gemini"; // Gemini CLI
import { ParseCursorHookInput } from "agent-hook-schemas/cursor"; // Cursor
import { ParseAntigravityHookInput } from "agent-hook-schemas/antigravity"; // Google Antigravity

// In a hook script:
const raw = JSON.parse(await Bun.stdin.text());
const result = ParseHookInput(raw); // returns z.SafeParseReturnType

if (!result.success) {
  console.error("Invalid hook input:", result.error);
  process.exit(1);
}

const input = result.data;
// input.hook_event_name is narrowed to the specific event
// input.session_id, input.cwd, etc. are typed
```

### Write hook stdout (PreToolUse permission decisions)

```ts
import {
  HookSpecificPreToolUseOutputSchema,
  HookCommandOutputSchema,
} from "agent-hook-schemas";

// Allow a tool call
const allow = HookCommandOutputSchema.parse({
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "allow",
    permissionDecisionReason: "Approved by custom hook",
  },
});
console.log(JSON.stringify(allow));

// Block a tool call
const deny = HookCommandOutputSchema.parse({
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason: "Blocked: unsafe command",
  },
});
console.log(JSON.stringify(deny));
```

### Parse specific tool inputs

```ts
import { ParseBashToolInput, ParseEditToolInput } from "agent-hook-schemas";

const result = ParseHookInput(raw);
if (result.success && result.data.hook_event_name === "PreToolUse") {
  const bash = ParseBashToolInput(result.data.tool_input);
  if (bash.success) {
    console.log("Command:", bash.data.command);
  }
}
```

### Merge hooks config from multiple settings layers

Claude Code, Codex, Copilot, and Gemini all support layered hook configs (user, project, local). Merge them in priority order:

```ts
import { mergeClaudeHooksFiles } from "agent-hook-schemas/claude-hooks-integration";

const userSettings = { hooks: { PreToolUse: [{ hooks: [{ type: "command", command: "lint.sh" }] }] } };
const projectSettings = { hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "guard.sh" }] }] } };

const merged = mergeClaudeHooksFiles([userSettings, projectSettings]);
if (merged.ok) {
  console.log(merged.config);
  // { PreToolUse: [{ hooks: [...lint.sh] }, { matcher: "Bash", hooks: [...guard.sh] }] }
}
```

Equivalent helpers exist for Codex, Copilot, and Gemini:

```ts
import { mergeCodexHooksFiles } from "agent-hook-schemas/codex";
import { mergeCopilotHooksFiles } from "agent-hook-schemas/copilot";
import { mergeGeminiHooksFiles } from "agent-hook-schemas/gemini-hooks-integration";
```

### Resolve matching handlers for an event

Given a merged config and a hook event, find which handlers would run:

```ts
import {
  resolveMatchingClaudeHandlers,
  resolveMatchingClaudeHandlersFromInput,
} from "agent-hook-schemas/claude-hooks-integration";

// From parsed stdin (automatic subject + matcher resolution):
const handlers = resolveMatchingClaudeHandlersFromInput(merged.config, input);

// Or manually with a resolution context:
const handlers2 = resolveMatchingClaudeHandlers(merged.config, "PreToolUse", {
  subject: "Bash",
  toolName: "Bash",
  toolInput: { command: "git status" },
});

for (const h of handlers2) {
  if (h.type === "command") console.log("Would run:", h.command);
}
```

### Validate hooks config files

Use the exported config schemas to validate `settings.json` or `hooks.json` files:

```ts
import { HooksConfigSchema } from "agent-hook-schemas";
import { CodexHooksFileSchema } from "agent-hook-schemas/codex";
import { CopilotHooksFileSchema } from "agent-hook-schemas/copilot";
import { GeminiHooksConfigSchema } from "agent-hook-schemas/gemini";

// Validate a Claude Code hooks config
const result = HooksConfigSchema.safeParse(config);

// Validate a Codex hooks.json
const codexResult = CodexHooksFileSchema.safeParse(hooksJson);

// Validate a Copilot .github/hooks/*.json file
const copilotResult = CopilotHooksFileSchema.safeParse(hooksJson);
```

## Subpath Exports

| Import | Description |
|--------|-------------|
| `agent-hook-schemas` | Root barrel — re-exports Claude, Codex, Copilot, Cursor, Gemini, Antigravity, and integration modules |
| `agent-hook-schemas/antigravity` | Google Antigravity `hooks.json` config, stdin/stdout schemas, `ParseAntigravityHookInput` |
| `agent-hook-schemas/antigravity-hooks-integration` | `mergeAntigravityHooksFiles`, `resolveMatchingAntigravityHandlers`, matcher/timeout helpers |
| `agent-hook-schemas/claude` | Claude Code event schemas, tool input parsers, handler types, stdout schemas |
| `agent-hook-schemas/claude-agents` | Claude `Agent` / legacy `Task`, `ListAgents`, and `SendMessage` input schemas and parsers |
| `agent-hook-schemas/claude-hooks-integration` | `mergeClaudeHooksFiles`, `resolveMatchingClaudeHandlers`, matcher/if helpers |
| `agent-hook-schemas/codex` | Codex event schemas, strict wire-format stdout, `mergeCodexHooksFiles`, resolver |
| `agent-hook-schemas/codex-agents` | Separate Codex collaboration V1 and V2 decoded input and response schemas |
| `agent-hook-schemas/codex-tasks` | Codex `update_plan` argument, function-call, and output schemas |
| `agent-hook-schemas/copilot` | GitHub Copilot hook config, stdin/stdout schemas, `mergeCopilotHooksFiles`, resolver |
| `agent-hook-schemas/copilot-hooks-integration` | `mergeCopilotHooksFiles`, `resolveMatchingCopilotHandlers`, matcher helpers |
| `agent-hook-schemas/gemini` | Gemini CLI settings hooks, stdin/stdout schemas, `ParseGeminiHookInput` |
| `agent-hook-schemas/gemini-hooks-integration` | `mergeGeminiHooksFiles`, `resolveMatchingGeminiHandlers`, timeout helpers |
| `agent-hook-schemas/cursor` | Cursor stdin, config and event-specific stdout schemas; `ParseCursorHookInput`, `ParseCursorHooksFile`, `ParseCursorHookOutput` |
| `agent-hook-schemas/common` | Shared shapes where Claude and Codex overlap (import explicitly, not re-exported from root) |

## Reference updates (September 2026)

### Agent tools

`ClaudeCodeBuiltinToolNameSchema` now recognizes all 45 names in the
[Claude tools reference](https://code.claude.com/docs/en/tools-reference), checked
on September 7, 2026. This is a catalog, not a guarantee that every tool is enabled
in a session. Generic hook parsing still accepts unknown tool names.

`AgentToolInputSchema` follows the optional `subagent_type` and new metadata fields
in [Agent SDK 0.3.263](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk/v/0.3.263):
`name`, `run_in_background`, and `isolation`. It preserves deprecated `team_name`
and `mode`, optional descriptions from older payloads, and future fields and model
names. `ClaudeAgentToolInputSchema` also accepts the legacy `Task` name.

```ts
import { ParseClaudeAgentToolInput } from "agent-hook-schemas/claude-agents";

const message = ParseClaudeAgentToolInput({
  tool_name: "SendMessage",
  tool_input: { to: "migration", notify_when_idle: true },
});
// An idle subscription can omit message. A regular send supplies message.
```

Claude's [cross-session messaging docs](https://code.claude.com/docs/en/cross-session-messaging)
describe discovery, text delivery, and idle subscriptions without publishing a
complete JSON contract. `ListAgentsToolInputSchema` therefore preserves an arbitrary
object. `SendMessageToolInputSchema` types `to`, `message`, `summary`, and
`notify_when_idle`; object messages remain opaque JSON. These modules do not model
Claude discovery or messaging responses. Recipient restrictions and availability
remain runtime checks.

Codex collaboration schemas are based on the
[rust-v0.153.4 tool definitions](https://github.com/openai/codex/blob/rust-v0.153.4/codex-rs/core/src/tools/handlers/multi_agents_spec.rs).
Choose the version exposed by your host:

| Contract | V1 | V2 |
|---|---|---|
| Spawn | `message` or `items`; optional `fork_context` | Required `task_name` and `message`; optional `fork_turns` |
| Send | `send_input` with optional `interrupt` | `send_message`; `followup_task` can start a turn |
| Discovery | No discovery tool in this group | `list_agents` with optional `path_prefix` |
| Wait | `wait_agent` requires `targets`; returns a status map | `wait_agent` waits on the mailbox; returns a summary |
| Lifecycle | `resume_agent` uses `id`; `close_agent` uses `target` | `interrupt_agent` retains the agent |

```ts
import {
  ParseCodexCollaborationV2ToolInput,
  ParseCodexCollaborationV2ToolResponse,
} from "agent-hook-schemas/codex-agents";

const call = ParseCodexCollaborationV2ToolInput({
  tool_name: "spawn_agent",
  tool_input: { task_name: "review", message: "Review the parser", fork_turns: "none" },
});
const result = ParseCodexCollaborationV2ToolResponse("spawn_agent", {
  task_name: "/root/review",
  nickname: null,
});
```

These parsers accept decoded payloads with bare tool names. Decode transport JSON
and separate any namespace before calling them. Inputs stay loose and retain
unknown fields without translating them between versions; V1 item fields are
typed without enforcing each item's runtime requirements. The host selects tools,
model overrides, and timeout limits. V2 message handlers return text (empty on
success in the tagged [implementation](https://github.com/openai/codex/blob/rust-v0.153.4/codex-rs/core/src/tools/handlers/multi_agents_v2/message_tool.rs)).
Existing `update_plan` schemas remain in `codex-tasks`.

### Hook configuration

Cursor now validates configuration and stdout as well as stdin:

```ts
import { ParseCursorHooksFile, ParseCursorHookOutput } from "agent-hook-schemas/cursor";

const hooks = ParseCursorHooksFile({
  version: 1,
  hooks: { stop: [{ command: "bun check.ts", loop_limit: null }] },
});
const result = ParseCursorHookOutput("postToolUse", {
  additional_context: "The generated files passed validation.",
});
```

`CursorCloudHooksFileSchema` checks command-only configuration. Event availability is
separate: hosted cloud agents omit session, MCP-specific, Tab and workspace hooks;
self-hosted workers also support session start/end. Cursor matcher schemas follow the
reference's string examples; no object matcher format is defined there.

Copilot's `parseCopilotHooksDirectoryFile` and `mergeCopilotHooksDirectoryFiles` retain
valid siblings and return diagnostics for invalid items. Existing `CopilotHooksFileSchema`,
settings schemas and `mergeCopilotHooksFiles` remain strict validators. Use
`parseCopilotHookStdout` to separate progress lines from the final JSON result, and
`copilotHttpHookUrlAllowed(url, allowLocalhost)` to check runtime transport policy.
The latter does not replace event-specific HTTPS validation or cloud firewall rules.

Claude and Codex support `mcp_tool` handlers. Claude adds model-switch inputs and outputs;
Codex adds the advisory `Interrupt` event. Supply the event to timeout helpers for lifecycle
defaults. Claude represents `async: true` command timeouts as `Infinity`; `asyncRewake`
still enforces timeouts. For `SessionEnd`, compute the shared budget with
`effectiveClaudeSessionEndBudgetSec(settingsHandlers)` and pass it as the timeout helper's
third argument. Plugin timeouts do not raise that budget; callers can pass an explicit
environment override in seconds. Bash `if` selection runs hooks when shell syntax is
uncertain; settings permission evaluation keeps its separate matching behavior.
Gemini exports `GeminiLlmRequestSchema` and `GeminiLlmResponseSchema` for the stable model
API, including partial output overrides. Antigravity post-tool inputs type `toolCall`.

References: [Claude](https://code.claude.com/docs/en/hooks),
[Codex](https://developers.openai.com/codex/hooks),
[Copilot](https://docs.github.com/en/copilot/reference/hooks-reference),
[Cursor](https://cursor.com/docs/hooks),
[Gemini](https://geminicli.com/docs/hooks/reference/),
[Antigravity](https://antigravity.google/docs/hooks).

## Key Differences Between Platforms

| | Claude Code | Codex | Copilot | Gemini CLI | Cursor | Google Antigravity |
|---|---|---|---|---|---|---|
| **Events** | 33 events | 12 events | 13 events, camelCase or VS-compatible | 11 events | 21 events | 5 events (`PreToolUse`, `PostToolUse`, `PreInvocation`, `PostInvocation`, `Stop`) |
| **Stdin style** | Loose (`.loose()`) | Loose (`.loose()`) | Loose; camelCase or `hook_event_name` | Loose (`.loose()`) | Loose (`.loose()`) | Loose (`.loose()`, camelCase) |
| **Handler types** | command, http, mcp_tool, prompt, agent | command, mcp_tool | command (shell or exec), http, prompt | command only | command, prompt (cloud: command only) | command only |
| **Matcher** | Exact names/lists or regex; event-aware | Regex on subject and tool aliases | Anchored regex on selected events | Regex (tool) / exact (lifecycle) | String matcher in config | Regex on tool name (tool events) / flat array (invocation/stop) |
| **`if` guard** | `Tool(glob)` on tool input | `Bash(glob)` only | No | No | No | No |
| **Config merge** | Yes (`disableAllHooks` resets) | Yes (concatenate) | Yes (concatenate; disabled file skipped) | Yes (concatenate) | No | Yes (named hook specs merge, handler arrays concatenate) |
| **Stdout strictness** | Broad output loose; selected event outputs strict | Captured wires strict; reference-derived events loose | Strict event-specific outputs | Loose | Strict event-specific outputs | Loose |
| **Permission modes** | 6 (`default`, `acceptEdits`, `plan`, `auto`, `dontAsk`, `bypassPermissions`) | 5 (no `auto`) | N/A | N/A | N/A | N/A (`PreToolUse` decisions: `allow`, `deny`, `ask`, `force_ask`, `deny_unless_prior_grant`) |
| **Settings schema** | Full (`ClaudeSettingsSchema`) | Hooks only (`CodexHooksFileSchema`) | Hooks file + settings fragment | Minimal (`GeminiSettingsSchema`) | Hooks file (`CursorHooksFileSchema`) | Hooks file (`AntigravityHooksFileSchema`) |
| **Permission rules** | `allow`/`deny` arrays with `Tool(glob)` syntax | No | `permissionRequest` hook output | No | No | `permissionOverrides` on `PreToolUse` stdout |
| **Default timeout** | Event/type-aware: usually 600s; prompt 30s, agent 60s | Usually 600s; SessionEnd/Interrupt 1s, max 3s | 30s (`timeoutSec` takes precedence over `timeout`) | 60,000ms | Platform default; config uses seconds | 30s (`timeout` in seconds) |

### Event Name Comparison

Events across platforms that serve equivalent purposes but use different names or casing:

| Concept | Claude Code | Codex | Copilot | Gemini CLI | Cursor | Google Antigravity |
|---|---|---|---|---|---|---|
| **Session start** | `SessionStart` | `SessionStart` | `sessionStart` / `SessionStart` | `SessionStart` | `sessionStart` | — |
| **Session end** | `SessionEnd` | `SessionEnd` | `sessionEnd` / `SessionEnd` | `SessionEnd` | `sessionEnd` | — |
| **User prompt** | `UserPromptSubmit` | `UserPromptSubmit` | `userPromptSubmitted` / `UserPromptSubmit` | — | `beforeSubmitPrompt` | — |
| **Before tool** | `PreToolUse` | `PreToolUse` | `preToolUse` / `PreToolUse` | `BeforeTool` | `preToolUse` | `PreToolUse` |
| **After tool** | `PostToolUse` | `PostToolUse` | `postToolUse` / `PostToolUse` | `AfterTool` | `postToolUse` | `PostToolUse` |
| **Tool failure** | `PostToolUseFailure` | — | `postToolUseFailure` / `PostToolUseFailure` | — | `postToolUseFailure` | (via `PostToolUse` `error` field) |
| **Permission request** | `PermissionRequest` | `PermissionRequest` | `permissionRequest` / `PermissionRequest` | — | — | (via `PreToolUse` `decision: "ask"`) |
| **Permission denied** | `PermissionDenied` | — | — | — | — | — |
| **Stop / end of turn** | `Stop` | `Stop` | `agentStop` / `Stop` | — | `stop` | `Stop` |
| **Stop failure** | `StopFailure` | — | — | — | — | (via `Stop` `error` field) |
| **Subagent start** | `SubagentStart` | `SubagentStart` | `subagentStart` / `SubagentStart` | — | `subagentStart` | — |
| **Subagent stop** | `SubagentStop` | `SubagentStop` | `subagentStop` / `SubagentStop` | — | `subagentStop` | — |
| **Before agent turn** | — | — | — | `BeforeAgent` | — | — |
| **After agent turn** | — | — | — | `AfterAgent` | `afterAgentResponse` (message completion) | — |
| **Before shell** | — | — | — | — | `beforeShellExecution` | — |
| **After shell** | — | — | — | — | `afterShellExecution` | — |
| **Before model** | — | — | — | `BeforeModel` | — | `PreInvocation` |
| **After model** | — | — | — | `AfterModel` | — | `PostInvocation` |
| **Tool selection** | — | — | — | `BeforeToolSelection` | — | — |
| **Notification** | `Notification` | — | `notification` / `Notification` | `Notification` | — | — |
| **Compaction** | `PreCompact` / `PostCompact` | `PreCompact` / `PostCompact` | `preCompact` / `PreCompact` | `PreCompress` | `preCompact` | — |
| **Error** | — | — | `errorOccurred` / `ErrorOccurred` | — | — | — |
| **Config change** | `ConfigChange` | — | — | — | — | — |
| **File change** | `FileChanged` | — | — | — | — | — |
| **Worktree** | `WorktreeCreate` / `WorktreeRemove` | — | — | — | — | — |
| **Task lifecycle** | `TaskCreated` / `TaskCompleted` | — | — | — | — | — |
| **Elicitation** | `Elicitation` / `ElicitationResult` | — | — | — | — | — |
| **Instructions** | `InstructionsLoaded` | — | — | — | — | — |
| **Teammate** | `TeammateIdle` | — | — | — | — | — |
| **CWD change** | `CwdChanged` | — | — | — | — | — |
| **Model switch** | `PreModelSwitch` / `PostModelSwitch` | — | — | — | — | — |
| **Interruption** | — | `Interrupt` | — | — | — | — |
| **Workspace open** | — | — | — | — | `workspaceOpen` | — |

### Integration Module Comparison

Each platform with config merge support has a parallel integration module with equivalent functions:

| Function | Claude | Codex | Copilot | Gemini |
|---|---|---|---|---|
| **Merge config layers** | `mergeClaudeHooksFiles()` | `mergeCodexHooksFiles()` | `mergeCopilotHooksFiles()` | `mergeGeminiHooksFiles()` |
| **Merge full settings** | `mergeClaudeSettings()` | — | — | — |
| **Matcher matching** | `claudeMatcherMatches()` | `codexMatcherMatches()` | `copilotMatcherMatches()` | `geminiMatcherMatches()` |
| **`if` guard eval** | `claudeToolIfMatches()` | `codexToolIfMatches()` | — | — |
| **Resolve handlers** | `resolveMatchingClaudeHandlers()` | `resolveMatchingCodexHandlers()` | `resolveMatchingCopilotHandlers()` | `resolveMatchingGeminiHandlers()` |
| **Resolve from stdin** | `resolveMatchingClaudeHandlersFromInput()` | `resolveMatchingCodexHandlersFromInput()` | `resolveMatchingCopilotHandlersFromInput()` | `resolveMatchingGeminiHandlersFromInput()` |
| **Effective timeout** | `effectiveClaudeHandlerTimeoutSec()` → seconds | `effectiveCodexHandlerTimeoutSec()` → seconds | `effectiveCopilotHandlerTimeoutSec()` → seconds | `effectiveGeminiHandlerTimeoutMs()` → milliseconds |
| **Sequential groups** | — | — | — | `resolveMatchingGeminiHandlerGroups()` |
| **Permission rules** | `evaluateSettingsPermissions()` | — | — | — |
| **Validate settings** | `parseClaudeSettings()` | `parseCodexHooksFile()` | `parseCopilotHooksFile()` | `parseGeminiSettings()` |

### Hook Stdin Base Fields

Fields available on hook stdin payloads across platforms:

| Field | Claude | Codex | Copilot | Gemini | Cursor |
|---|---|---|---|---|---|
| `session_id` | Yes | Yes | VS-compatible format | Yes | Yes |
| `sessionId` | — | — | camelCase format | — | — |
| `transcript_path` | `string` | `string \| null` | VS-compatible format | `string` | `string \| null` |
| `transcriptPath` | — | — | camelCase stop/subagent/compact | — | — |
| `cwd` | Yes | Yes | Yes | Yes | Yes (some events) |
| `model` | Yes (SessionStart) | Yes | — | — | Yes |
| `permission_mode` | Yes | Yes | — | — | — |
| `hook_event_name` | PascalCase | PascalCase | VS-compatible format | PascalCase | camelCase |
| `tool_name` | Yes (tool events) | Yes (tool events) | VS-compatible format | Yes (`BeforeTool`/`AfterTool`) | Yes (tool events) |
| `toolName` | — | — | camelCase tool events | — | — |
| `tool_input` | `Record<string, unknown>` | Typed per tool | VS-compatible format | `Record<string, unknown>` | `Record<string, unknown>` |
| `toolArgs` | — | — | camelCase tool events | — | — |
| `tool_response` | Yes (PostToolUse) | Yes (PostToolUse) | — | Yes (`AfterTool`) | — |
| `tool_output` | — | — | — | — | `string \| object` (postToolUse; objects retained for capture compatibility) |
| `model_id` / `model_params` | — | — | — | — | Typed model ID and parameter list |
| `toolResult` / `tool_result` | — | — | success result shape | — | — |
| `stop_hook_active` | Yes (Stop) | Yes (Stop) | — | Yes (`AfterAgent`) | — |
| `timestamp` | — | — | number (camel) / string (VS) | Yes | — |
| `turn_id` | — | Yes | — | — | — |
| `agent_id`/`agent_type` | Yes | — | — | — | — |
| `conversation_id` | — | — | — | — | Yes |
| `generation_id` | — | — | — | — | Yes |
| `cursor_version` | — | — | — | — | Yes |
| `workspace_roots` | — | — | — | — | Yes |

### Hook Stdout Comparison

How hook scripts communicate results back to the platform:

| Field | Claude | Codex | Copilot | Gemini | Cursor |
|---|---|---|---|---|---|
| `continue` | Optional | Default `true` | — | Optional | beforeSubmitPrompt; sessionStart parses but does not enforce it |
| `decision` | `"block"` | `"approve" \| "block"` (PreToolUse), `"block"` (others) | `"block" \| "allow"` (agent stops) | `"allow" \| "deny" \| "block"` | — |
| `reason` | Optional string | `string \| null` | Required for stop `block` | Optional string | — |
| `hookSpecificOutput` | Discriminated on `hookEventName` | Strict wire schemas per event | — | Shared + Gemini extension | — |
| `systemMessage` | Optional | `string \| null` | — | Optional | — |
| `suppressOutput` | Optional | Default `false` | — | Optional | — |
| `stopReason` | Optional | `string \| null` | — | Optional | — |
| `permissionDecision` | via `hookSpecificOutput` | via `hookSpecificOutput` | `allow \| deny \| ask` | — | — |
| `permissionDecisionReason` | via `hookSpecificOutput` | via `hookSpecificOutput` | Required for `deny` | — | — |
| `modifiedArgs` | — | — | Optional tool arg replacement | — | — |
| `modifiedResult` | — | — | Optional successful post-tool result replacement | — | — |
| `permission` / `updated_input` | — | — | — | — | Event-specific permission decision / tool input replacement |
| `additional_context` / `updated_mcp_tool_output` | — | — | — | — | Post-tool context / MCP output replacement |
| `followup_message` / `pluginPaths` | — | — | — | — | Stop follow-up / workspace plugin directories |
| `behavior` | — | — | `allow \| deny` (`permissionRequest`) | — | — |
| `additionalContext` | Top-level or event-specific | via `hookSpecificOutput` | Session/notification/subagent/failure/post-tool | via `hookSpecificOutput` | — |
| `hookSpecificOutput.updatedInput` | Optional | `object \| null` | — | — | — |
| `hookSpecificOutput.updatedMCPToolOutput` | Optional (PostToolUse) | `object \| null` (PostToolUse) | — | — | — |
| `hookSpecificOutput.tool_input` | — | — | — | Optional (Gemini-only) | — |
| `hookSpecificOutput.llm_request` | — | — | — | Optional (Gemini-only) | — |
| `hookSpecificOutput.toolConfig` | — | — | — | Optional (Gemini-only) | — |
| `hookSpecificOutput.tailToolCallRequest` | — | — | — | Optional (Gemini-only) | — |
| `watchPaths` | Yes (Claude-only) | — | — | — | — |

### Task Schema Comparison

| | Claude Code (`claude-tasks.ts`) | Codex (`codex-tasks.ts`) |
|---|---|---|
| **Mechanism** | Built-in tools (`TaskCreate`, `TaskUpdate`, etc.) | `update_plan` function call |
| **Status values** | `pending`, `in_progress`, `completed`, `deleted` | `pending`, `in_progress`, `completed` |
| **Schema style** | Loose (`.loose()`) | Loose (`.loose()`) |
| **Tool count** | 6 tools (Create, Update, Get, List, Output, Stop) | 1 function (`update_plan`) |
| **Plan structure** | Individual tasks with subject/description | Ordered step array with explanation |
| **Wire format** | Tool input/response JSON | Function call envelope + decoded arguments |

## Development

```bash
bun install
bun run build          # tsup → dist/ (required by the package smoke tests)
bun run test           # all tests, isolated across four workers
bun run test:types     # type-check library, test fixtures and development scripts
bun run test:coverage  # build, type-check, package smoke tests, source coverage and gate
```

`test:coverage` writes a text report and `coverage/lcov.info`. It includes every
root library module, even if no test imports it. Tests, test helpers, development
scripts, build configuration and generated bundles are excluded from source
coverage. Published exports are checked separately by `dist-smoke.test.ts`.

The gate requires **100% function coverage** and rejects every uncovered source
line except the three-line `never` fallback in
`sharedHookSpecificAdditionalContextSchema`. That branch is unreachable for the
declared TypeScript parameter union. It remains visible in the raw report
(currently **99.92% lines**); `common.ts` is included in coverage. The gate also
rejects missing modules. `bunfig.toml` supplies a 98% per-file line floor, and
`scripts/check-coverage.ts` enforces the stricter line-by-line rule.

The coverage entry loads the source suites in one module registry to avoid
[Bun's worker coverage merge bug](https://github.com/oven-sh/bun/issues/39930).
Use `bun run test:coverage` for coverage; ordinary `bun run test` retains file
isolation. The coverage command requires Bun 1.4 or later.

Coverage measures executed lines and functions, not branch coverage or complete
provider protocol conformance. Optional local capture tests may skip when their
`/private/tmp` files are absent; deterministic fixtures always run.

Schema modules do not depend on integration helpers. Codex and Copilot use
internal `codex-schemas.ts` and `copilot-schemas.ts` modules; their public platform
entries continue to export the same schemas and helpers for compatibility.
Integration code imports the internal schemas directly. The dependency test
rejects runtime import cycles, and package smoke tests check root, platform and
integration imports in fresh Node and Bun processes. Keep lazy schema `.options`
access inside integration functions as an additional initialization safeguard.

## License

MIT
