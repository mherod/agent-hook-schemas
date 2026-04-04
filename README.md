# agent-hook-schemas

[Zod](https://zod.dev) schemas and helpers for **hook stdin/stdout JSON** and **hooks config merging** across AI coding assistants.

Supports [Claude Code](https://docs.anthropic.com/en/docs/claude-code), [OpenAI Codex](https://github.com/openai/codex), [Gemini CLI](https://github.com/google-gemini/gemini-cli), and [Cursor](https://www.cursor.com/).

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

Claude Code, Codex, and Gemini all support layered hook configs (user, project, local). Merge them in priority order:

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

Equivalent helpers exist for Codex and Gemini:

```ts
import { mergeCodexHooksFiles } from "agent-hook-schemas/codex";
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
import { GeminiHooksConfigSchema } from "agent-hook-schemas/gemini";

// Validate a Claude Code hooks config
const result = HooksConfigSchema.safeParse(config);

// Validate a Codex hooks.json
const codexResult = CodexHooksFileSchema.safeParse(hooksJson);
```

## Subpath Exports

| Import | Description |
|--------|-------------|
| `agent-hook-schemas` | Root barrel — re-exports Claude, Codex, Cursor, Gemini, and integration modules |
| `agent-hook-schemas/claude` | Claude Code event schemas, tool input parsers, handler types, stdout schemas |
| `agent-hook-schemas/claude-hooks-integration` | `mergeClaudeHooksFiles`, `resolveMatchingClaudeHandlers`, matcher/if helpers |
| `agent-hook-schemas/codex` | Codex event schemas, strict wire-format stdout, `mergeCodexHooksFiles`, resolver |
| `agent-hook-schemas/codex-tasks` | Codex task schemas, including the `update_plan` alias for task updates |
| `agent-hook-schemas/gemini` | Gemini CLI settings hooks, stdin/stdout schemas, `ParseGeminiHookInput` |
| `agent-hook-schemas/gemini-hooks-integration` | `mergeGeminiHooksFiles`, `resolveMatchingGeminiHandlers`, timeout helpers |
| `agent-hook-schemas/cursor` | Cursor agent hooks stdin schemas (camelCase events), `ParseCursorHookInput` |
| `agent-hook-schemas/common` | Shared shapes where Claude and Codex overlap (import explicitly, not re-exported from root) |

## Key Differences Between Platforms

| | Claude Code | Codex | Gemini CLI | Cursor |
|---|---|---|---|---|
| **Events** | 26 events | 5 events | 10 events | 9 events |
| **Stdin style** | Loose (extra keys allowed) | Strict | Strict | Loose |
| **Handler types** | command, http, prompt, agent | command only | command only | N/A |
| **Matcher** | Regex on subject | Regex on subject | Glob pattern | N/A |
| **Config merge** | Yes | Yes | Yes | No |

## Development

```bash
bun install
bun test
bun run build   # tsup → dist/
```

## License

MIT
