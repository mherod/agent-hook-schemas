# agent-hook-schemas

[Zod](https://zod.dev) schemas and helpers for **hook stdin/stdout JSON** and **hooks config merging** across AI coding assistants.

Supports [Claude Code](https://docs.anthropic.com/en/docs/claude-code), [OpenAI Codex](https://github.com/openai/codex), GitHub Copilot CLI / cloud agent hooks, [Gemini CLI](https://github.com/google-gemini/gemini-cli), and [Cursor](https://www.cursor.com/).

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

Every hook receives JSON on stdin. Parse it into a fully-typed, discriminated union in one call:

```ts
import { ParseHookInput } from "agent-hook-schemas";           // Claude Code
import { ParseCodexHookInput } from "agent-hook-schemas/codex"; // OpenAI Codex
import { ParseCopilotHookInput } from "agent-hook-schemas/copilot"; // GitHub Copilot
import { ParseGeminiHookInput } from "agent-hook-schemas/gemini"; // Gemini CLI
import { ParseCursorHookInput } from "agent-hook-schemas/cursor"; // Cursor

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
| `agent-hook-schemas` | Root barrel — re-exports Claude, Codex, Copilot, Cursor, Gemini, and integration modules |
| `agent-hook-schemas/claude` | Claude Code event schemas, tool input parsers, handler types, stdout schemas |
| `agent-hook-schemas/claude-hooks-integration` | `mergeClaudeHooksFiles`, `resolveMatchingClaudeHandlers`, matcher/if helpers |
| `agent-hook-schemas/codex` | Codex event schemas, strict wire-format stdout, `mergeCodexHooksFiles`, resolver |
| `agent-hook-schemas/codex-tasks` | Codex `update_plan` argument, function-call, and output schemas |
| `agent-hook-schemas/copilot` | GitHub Copilot hook config, stdin/stdout schemas, `mergeCopilotHooksFiles`, resolver |
| `agent-hook-schemas/copilot-hooks-integration` | `mergeCopilotHooksFiles`, `resolveMatchingCopilotHandlers`, matcher helpers |
| `agent-hook-schemas/gemini` | Gemini CLI settings hooks, stdin/stdout schemas, `ParseGeminiHookInput` |
| `agent-hook-schemas/gemini-hooks-integration` | `mergeGeminiHooksFiles`, `resolveMatchingGeminiHandlers`, timeout helpers |
| `agent-hook-schemas/cursor` | Cursor agent hooks stdin schemas (camelCase events), `ParseCursorHookInput` |
| `agent-hook-schemas/common` | Shared shapes where Claude and Codex overlap (import explicitly, not re-exported from root) |

## Key Differences Between Platforms

| | Claude Code | Codex | Copilot | Gemini CLI | Cursor |
|---|---|---|---|---|---|
| **Events** | 30 events | 10 events | 13 events, camelCase or VS-compatible | 11 events | 20 events |
| **Stdin style** | Loose (`.loose()`) | Loose (`.loose()`) | Loose; camelCase or `hook_event_name` | Loose (`.loose()`) | Loose (`.loose()`) |
| **Handler types** | command, http, prompt, agent | command only | command, http, prompt | command only | N/A (stdin-only) |
| **Matcher** | Regex on subject | Regex on subject | Anchored regex on selected events | Regex (tool) / exact (lifecycle) | N/A |
| **`if` guard** | `Tool(glob)` on tool input | `Bash(glob)` only | No | No | No |
| **Config merge** | Yes (`disableAllHooks` resets) | Yes (concatenate) | Yes (concatenate; disabled file skipped) | Yes (concatenate) | No |
| **Stdout strictness** | Loose | Strict (`.strict()`, defaults) | Strict event-specific outputs | Loose | N/A |
| **Permission modes** | 6 (`default`, `acceptEdits`, `plan`, `auto`, `dontAsk`, `bypassPermissions`) | 5 (no `auto`) | N/A | N/A | N/A |
| **Settings schema** | Full (`ClaudeSettingsSchema`) | Hooks only (`CodexHooksFileSchema`) | Hooks file + settings fragment | Minimal (`GeminiSettingsSchema`) | N/A |
| **Permission rules** | `allow`/`deny` arrays with `Tool(glob)` syntax | No | `permissionRequest` hook output | No | No |
| **Default timeout** | 600s | 600s (`timeout` or `timeoutSec`) | 30s (`timeoutSec`) | 60,000ms | N/A |

### Event Name Comparison

Events across platforms that serve equivalent purposes but use different names or casing:

| Concept | Claude Code | Codex | Copilot | Gemini CLI | Cursor |
|---|---|---|---|---|---|
| **Session start** | `SessionStart` | `SessionStart` | `sessionStart` / `SessionStart` | `SessionStart` | `sessionStart` |
| **Session end** | `SessionEnd` | — | `sessionEnd` / `SessionEnd` | `SessionEnd` | `sessionEnd` |
| **User prompt** | `UserPromptSubmit` | `UserPromptSubmit` | `userPromptSubmitted` / `UserPromptSubmit` | — | `beforeSubmitPrompt` |
| **Before tool** | `PreToolUse` | `PreToolUse` | `preToolUse` / `PreToolUse` | `BeforeTool` | `preToolUse` |
| **After tool** | `PostToolUse` | `PostToolUse` | `postToolUse` / `PostToolUse` | `AfterTool` | `postToolUse` |
| **Tool failure** | `PostToolUseFailure` | — | `postToolUseFailure` / `PostToolUseFailure` | — | — |
| **Permission request** | `PermissionRequest` | — | `permissionRequest` / `PermissionRequest` | — | — |
| **Permission denied** | `PermissionDenied` | — | — | — | — |
| **Stop / end of turn** | `Stop` | `Stop` | `agentStop` / `Stop` | — | `stop` |
| **Stop failure** | `StopFailure` | — | — | — | — |
| **Before agent** | `SubagentStart` | — | `subagentStart` / `SubagentStart` | `BeforeAgent` | — |
| **After agent** | `SubagentStop` | — | `subagentStop` / `SubagentStop` | `AfterAgent` | `afterAgentResponse` |
| **Before shell** | — | — | — | — | `beforeShellExecution` |
| **After shell** | — | — | — | — | `afterShellExecution` |
| **Before model** | — | — | — | `BeforeModel` | — |
| **After model** | — | — | — | `AfterModel` | — |
| **Tool selection** | — | — | — | `BeforeToolSelection` | — |
| **Notification** | `Notification` | — | `notification` / `Notification` | `Notification` | — |
| **Compaction** | `PreCompact` / `PostCompact` | — | `preCompact` / `PreCompact` | `PreCompress` | `preCompact` |
| **Error** | — | — | `errorOccurred` / `ErrorOccurred` | — | — |
| **Config change** | `ConfigChange` | — | — | — | — |
| **File change** | `FileChanged` | — | — | — | — |
| **Worktree** | `WorktreeCreate` / `WorktreeRemove` | — | — | — | — |
| **Task lifecycle** | `TaskCreated` / `TaskCompleted` | — | — | — | — |
| **Elicitation** | `Elicitation` / `ElicitationResult` | — | — | — | — |
| **Instructions** | `InstructionsLoaded` | — | — | — | — |
| **Teammate** | `TeammateIdle` | — | — | — | — |
| **CWD change** | `CwdChanged` | — | — | — | — |

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
| `tool_response` | Yes (PostToolUse) | Yes (PostToolUse) | — | Yes (`AfterTool`) | `string \| object` (postToolUse) |
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
| `continue` | Optional | Default `true` | — | Optional | — |
| `decision` | `"block"` | `"approve" \| "block"` (PreToolUse), `"block"` (others) | `"block" \| "allow"` (agent stops) | `"allow" \| "deny" \| "block"` | — |
| `reason` | Optional string | `string \| null` | Required for stop `block` | Optional string | — |
| `hookSpecificOutput` | Discriminated on `hookEventName` | Strict wire schemas per event | — | Shared + Gemini extension | — |
| `systemMessage` | Optional | `string \| null` | — | Optional | — |
| `suppressOutput` | Optional | Default `false` | — | Optional | — |
| `stopReason` | Optional | `string \| null` | — | Optional | — |
| `permissionDecision` | via `hookSpecificOutput` | via `hookSpecificOutput` | `allow \| deny \| ask` | — | — |
| `permissionDecisionReason` | via `hookSpecificOutput` | via `hookSpecificOutput` | Required for `deny` | — | — |
| `modifiedArgs` | — | — | Optional tool arg replacement | — | — |
| `behavior` | — | — | `allow \| deny` (`permissionRequest`) | — | — |
| `additionalContext` | via `hookSpecificOutput` | via `hookSpecificOutput` | Session/notification/subagent/failure | — | — |
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
bun test
bun run build   # tsup → dist/
```

## License

MIT
