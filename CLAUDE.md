# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Test Commands

```bash
bun install                # install dependencies
bun run build              # tsup → dist/ (ESM + .d.ts)
bun test --concurrent      # run all tests (400+ tests across 9 files)
bun test codex-tasks.test.ts index.test.ts codex-hooks-integration.test.ts  # run specific test files
bun test --concurrent -t "pattern"  # run tests matching a name pattern
```

Always verify with `bun run build && bun test --concurrent` before committing schema changes.

## npm Publish

```bash
bunx npm publish --otp=$(op item get "Npmjs" --otp)
```

- `bun publish` ignores `.npmrc` auth tokens and falls back to browser WebAuthn flow
- `pnpm publish` fails with `ERR_PNPM_OTP_NON_INTERACTIVE` in non-interactive terminals
- `bunx npm publish` reads `.npmrc` correctly and accepts `--otp`
- The `.npmrc.tpl` uses 1Password `op://` syntax for the auth token

## Architecture

This is a Zod v4 schema library for AI coding assistant hook stdin/stdout JSON across six platforms: **Claude Code**, **OpenAI Codex**, **GitHub Copilot**, **Gemini CLI**, **Cursor**, and **Google Antigravity**.

### Module layout (each is a separate subpath export via `package.json` `exports` + `tsup.config.ts` entry)

- `antigravity.ts` — Google Antigravity `hooks.json` config, stdin/stdout schemas (5 events, camelCase), `ParseAntigravityHookInput()`
- `antigravity-hooks-integration.ts` — `mergeAntigravityHooksFiles()`, `resolveMatchingAntigravityHandlers()`, matcher/timeout helpers
- `claude.ts` — Claude Code event schemas (31 events), tool input/response schemas, settings schema, `ParseHookInput()` discriminated union parser, stdout schemas
- `claude-hooks-integration.ts` — `mergeClaudeHooksFiles()`, `resolveMatchingClaudeHandlers()`, matcher/`if` guard evaluation
- `claude-tasks.ts` — Claude Code task management tool input/response schemas (TaskCreate, TaskUpdate, TaskGet, TaskList, TaskOutput, TaskStop)
- `codex.ts` — Codex event schemas (11 events), strict wire-format stdout, `mergeCodexHooksFiles()`, resolver
- `codex-tasks.ts` — Codex `update_plan` argument, function-call envelope, and output schemas
- `codex-hooks-integration.ts` — Codex integration helpers with `if` guard support
- `copilot.ts` — GitHub Copilot hook schemas (13 events), `CopilotHooksFileSchema`, `ParseCopilotHookInput()`, stdout schemas
- `copilot-hooks-integration.ts` — `mergeCopilotHooksFiles()`, `resolveMatchingCopilotHandlers()`
- `gemini.ts` — Gemini CLI settings hooks, stdin/stdout schemas, `ParseGeminiHookInput()`
- `gemini-hooks-integration.ts` — `mergeGeminiHooksFiles()`, `resolveMatchingGeminiHandlers()`
- `cursor.ts` — Cursor agent + Tab hooks stdin schemas (20 events, camelCase), helper schemas for edits/ranges, `ParseCursorHookInput()`
- `common.ts` — Shared shapes where Claude and Codex overlap (not re-exported from root barrel)
- `index.ts` — Root barrel re-exporting all modules

### Key patterns

- **`.loose()` for forward compatibility**: Input schemas use `.loose()` so unknown fields from future platform versions pass through without breaking parsing. This is intentional — do not replace with `.strict()`.
- **Forward-compatible enums in input paths** (Issue #3): Enum fields in hook stdin use `.or(z.string())` to accept known values + unknown future values. Pattern:
  ```ts
  export const EnumNameSchema = z.enum(["value1", "value2"]);
  export const EnumNameInputSchema = EnumNameSchema.or(z.string()); // Accept future values
  // Use EnumNameInputSchema in hook input schemas, keep EnumNameSchema for outputs/settings
  ```
  This enables downstream consumers to accept future enum values without requiring package version bumps. See commit 514179c for full implementation examples in claude.ts and gemini.ts.
- **Discriminated unions**: `HookEventInputSchema` discriminates on `hook_event_name`; `ReadToolResponseSchema` on `type`; `HookHandlerSchema` on handler `type`; `TaskToolInputSchema` on `tool_name`.
- **Fallback catch-all schemas**: Unknown hook event types use fallback schemas with `.refine()` guard to ensure known event types still validate their specific schemas:
  ```ts
  const UnknownHookEventInputSchema = HookInputBaseSchema.extend({
    hook_event_name: z.string().refine(
      (name) => !HookEventNameSchema.safeParse(name).success,
      { message: "Use specific event schema for known event names" },
    ),
  }).loose();
  ```
- **Per-platform Parse functions**: Each platform exports a top-level `Parse*HookInput()` that returns `z.SafeParseReturnType` — one-call parsing of unknown stdin JSON.
- **All fields optional on input base schemas**: `HookInputBaseSchema` and `CodexHookInputBaseSchema` have all fields optional for resilient parsing of partial payloads.
- **Lazy evaluation in integration modules** (Issues #4, #13): Never access `SomeSchema.options` at module level in `*-hooks-integration.ts` files. tsup/esbuild chunk splitting causes the schema chunk to be uninitialized when the integration module runs, yielding `undefined`. Always access `.options` inside the function body:
  ```ts
  // WRONG — module level, breaks with chunk splitting
  const CLAUDE_HOOK_EVENTS = HookEventNameSchema.options;

  // RIGHT — lazy, inside the function that uses it
  export function mergeClaudeHooksFiles(files: unknown[]) {
    const claudeHookEvents = HookEventNameSchema.options;
    return mergeHookConfigLayers({ ..., events: claudeHookEvents });
  }
  ```
  This applies to all three integration files: `claude-hooks-integration.ts`, `codex-hooks-integration.ts`, `gemini-hooks-integration.ts`.

### Schema Consolidation & Public `./common` Surface

**Extracted patterns & public `./common` exports (in `common.ts`):**
- **Primitives & Input Field Schemas**: `JsonObjectSchema` / `JsonObject`, `NullableStringSchema` / `NullableString`, `NullableStringDefaultSchema` / `NullableStringDefault`, `OptionalStringField` / `OptionalString`, `OptionalNumberField` / `OptionalNumber`, `OptionalBooleanField` / `OptionalBoolean`, `ToolNameSchema` / `ToolName`, `OptionalToolNameField` / `OptionalToolName`.
- **Cross-Agent Dispatch & Resolution Functions**: `toCrossAgentInputSchema(schema)`, `regexMatcherMatches`, `simpleGlobToRegExp`, `defaultedTimeoutSec`, `parseSchemaResult`, `appendHookEntriesByEvent`, `mergeHookConfigLayers`.
- **Context & Result Types**: `HookResolutionContext`, `RegexMatcherOptions`, `ParsedSchemaResult`, `MergeHookConfigLayersOptions`.
- **Shared Event Names, Handler, & Matcher Shapes**: `PreToolPermissionDecisionSchema` / `PreToolPermissionDecision`, `SharedHookEventNameSchema` / `SharedHookEventName`, `ToolCallCoreSchema` / `ToolCallCore`, `HookShellSchema`, `HookHandlerCommonSchema`, `CommandHookHandlerSchema` / `CommandHookHandler`, `SharedCommandMatcherGroupSchema` / `SharedCommandMatcherGroup`.
- **Shared Hook Output Schemas**: `SharedHookSpecificPreToolUseOutputSchema`, `SharedHookSpecificSessionStartOutputSchema`, `SharedHookSpecificPostToolUseOutputSchema`, `SharedHookSpecificUserPromptSubmitOutputSchema`, `SharedHookSpecificStopOutputSchema`, `SharedHookSpecificOutputSchema` (discriminated union), `createCodexCommandOutputSchema`, `sharedHookSpecificAdditionalContextSchema`, `SharedHookStdoutCommonFieldsSchema`.

**Public Surface & Semver Policy (Issue #18):**
- `./common` is an exported subpath (`package.json` `exports["./common"]`).
- All exported schemas, types, and utility functions in `common.ts` are considered intentional public API surface.
- Downstream packages may import these directly from `agent-hook-schemas/common`.
- Convenience type aliases (e.g. `OptionalString`, `OptionalNumber`, `OptionalBoolean`, `OptionalToolName`, `NullableString`, `ToolName`, `ToolCallCore`) are intentionally retained for consumers building custom cross-agent validators.
- **De-export Policy**: Any proposed removal or de-export of convenience types must only be scheduled for a future **MAJOR** version bump. Do not remove or break exported types in patch or minor releases.
- `CodexNullableStringSchema` in `codex.ts` is retained as a compatibility alias.

**Intentional platform differences (NOT consolidated):**
- **Input base schemas** differ significantly: Cursor has rich metadata (generation_id, workspace_roots), Codex is minimal, Gemini adds timestamp, Antigravity uses camelCase protojson keys.
- **Decision enums** vary: Claude uses `["allow", "deny", "ask", "defer"]`; Codex uses `["allow", "deny", "ask"]` for permissions and `["block"]` for blocks; Gemini uses `["allow", "deny", "block", "ask"]`; Antigravity PreToolUse uses `["allow", "deny", "ask", "force_ask", "deny_unless_prior_grant"]`.
- **Tool input types** vary: Claude/Cursor/Gemini use `JsonObjectSchema`, Codex PreToolUse uses `z.string()` for bash command, Antigravity uses `args` object.
- **Event naming conventions** differ: Claude/Codex use PascalCase (`SessionStart`, `PreToolUse`), Cursor uses camelCase (`sessionStart`, `preToolUse`), Gemini uses PascalCase (`BeforeTool`, `AfterTool`), Antigravity uses PascalCase (`PreToolUse`, `PreInvocation`).

## Bun Runtime

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Frontend

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from "react";
import { createRoot } from "react-dom/client";

// import .css files directly and it works
import './index.css';

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Then, run index.ts

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.mdx`.

## Codex Capture Schemas

- When refining Codex hook schemas, treat archived transcript captures as the source of truth for payload shape.
- Four events (`SubagentStart`, `PreCompact`, `PostCompact`, `SubagentStop`) are modeled from the public hooks reference (developers.openai.com/codex/hooks), not captures. Keep their input schemas `.loose()` and their stdout schemas non-strict (built on `SharedHookStdoutCommonFieldsSchema`, NOT `createCodexCommandOutputSchema`/`.strict()`) until a capture proves the generated `additionalProperties: false` wire shape. Do NOT add these four to `CodexHookEventNameWireSchema`.
- DON'T trust WebFetch/doc-summary field renames over captured snake_case fields: Claude `PostToolUse` carries `tool_response` (not `tool_result`); `SessionEnd` carries `reason` (not `end_reason`). When a doc summary disagrees with an existing field name, keep the captured name and let `.loose()` absorb the alias.
- When adding a Codex event, also add a `case` to `codexResolutionContextFromInput` in `codex-hooks-integration.ts` (exhaustive `switch`, no `default`) and a key to `CodexHooksConfigSchema`, or `bun run build` fails the DTS step. The Claude equivalent is `subjectForClaudeInput` in `claude-hooks-integration.ts`, which has a `const _exhaustive: never = i.hook_event_name` guard — every new entry in `HookEventNameSchema` needs a matching `case` there (Claude's `HooksConfigSchema` keys auto-derive from the enum, so only the switch needs the manual edit).
- For `update_plan`, model the decoded arguments, the outer `function_call` envelope, and the `function_call_output` record separately.
- Keep `update_plan` step statuses limited to `pending`, `in_progress`, and `completed` unless new captured payloads prove otherwise.
- Preserve compatibility aliases only when they forward to the captured Codex shapes; do not keep Claude-era task contracts once the real payload is known.
- Verify Codex schema changes with `bun test codex-tasks.test.ts index.test.ts codex-hooks-integration.test.ts` and `bun run build`.
