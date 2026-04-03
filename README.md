# agent-hook-schemas

[Zod](https://zod.dev) schemas and small helpers for **hook stdin/stdout JSON** and **`hooks` config merging** across AI coding assistants:

| Surface | Module(s) | Notes |
|--------|-----------|--------|
| **Claude Code** | `agent-hook-schemas`, `agent-hook-schemas/claude`, `agent-hook-schemas/claude-hooks-integration` | Large event set; most stdin branches are **loose** (extra keys allowed). `ParseHookInput`, tool input parsers, `mergeClaudeHooksFiles` / `resolveMatchingClaudeHandlers*`. |
| **OpenAI Codex** | `agent-hook-schemas/codex` | Five events (`SessionStart`, `PreToolUse`, `PostToolUse`, `UserPromptSubmit`, `Stop`). **Strict** stdin and **strict command stdout wires** aligned with official `*.command.input` / `*.command.output` JSON Schemas (`ParseCodexHookInput`, `mergeCodexHooksFiles`, `resolveMatchingCodexHandlers*`). |
| **Gemini CLI** | `agent-hook-schemas/gemini`, `agent-hook-schemas/gemini-hooks-integration` | Settings `hooks` + discriminated stdin; `ParseGeminiHookInput` / `ParseGeminiHookOutput`, `mergeGeminiHooksFiles`, `resolveMatchingGeminiHandlers*`. |
| **Cursor** | `agent-hook-schemas/cursor` | Agent `hooks.json` stdin: camelCase `hook_event_name` (`sessionStart`, `preToolUse`, `beforeShellExecution`, …); shared base fields (`conversation_id`, `generation_id`, `workspace_roots`, …). **Loose** branches (`ParseCursorHookInput`). No hooks merge helper or stdout schema in this package yet. |
| **Shared** | `agent-hook-schemas/common` | Shapes shared where Claude and Codex overlap (not re-exported from the root barrel—import this subpath explicitly). |

Root import `agent-hook-schemas` re-exports Claude, Codex, Cursor, Gemini, and their integration modules (not `./common`).

## Install

```bash
bun install agent-hook-schemas
```

(Use `npm` / `pnpm` if you prefer; the package is ESM and TypeScript-first.)

## Usage

```ts
import { ParseHookInput } from "agent-hook-schemas";
import { ParseCodexHookInput } from "agent-hook-schemas/codex";
import { ParseCursorHookInput } from "agent-hook-schemas/cursor";
import { ParseGeminiHookInput } from "agent-hook-schemas/gemini";
import { SharedHookEventNameSchema } from "agent-hook-schemas/common";
```

Use `.safeParse(json)` on parsers or the exported `*Schema` values for custom composition.

## Development

```bash
bun install
bun test
```

Runtime: [Bun](https://bun.com) is used in this repo (`bun test`); consumers may use any ESM-compatible runtime.
