# Hook and agent tool audit — 21 September 2026

Compared live official references with local commit `b790e6b4d732f15a06d30f2b739fcdaa119d57ea` (package version 0.3.1). This updates the September 7 audit. Findings describe gaps in this checkout; a field newly covered here is not necessarily newly released upstream.

## Sources and scope

| Provider | Official reference | Result |
| --- | --- | --- |
| Claude Code | [Hooks](https://code.claude.com/docs/en/hooks), [tools](https://code.claude.com/docs/en/tools-reference) | Still 33 hook events; tool catalog grows from 45 to 46 with `SubagentHandback` (v2.1.271+). Fixed parsing and field-typing gaps below. |
| Claude Agent SDK | [0.3.278 package](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk/v/0.3.278), [published declarations](https://registry.npmjs.org/@anthropic-ai/claude-agent-sdk/-/claude-agent-sdk-0.3.278.tgz) | Inspected `sdk.d.ts` and `sdk-tools.d.ts` directly. Existing Agent arguments already accept this version, including `fable`; no speculative Handback argument/response schema added. |
| Codex | [Hooks](https://developers.openai.com/codex/hooks), [stable 0.155.1 release](https://github.com/openai/codex/releases/tag/rust-v0.155.1) | Still 12 events. No confirmed schema change in the checked reference areas. |
| GitHub Copilot | [Hooks reference](https://docs.github.com/en/copilot/reference/hooks-reference) | 14 event families, including `userPromptTransformed`; added its contracts and updated matcher behavior. |
| Cursor | [Hooks](https://cursor.com/docs/hooks) | Existing 21-event coverage, configuration, metadata, and outputs reviewed; no confirmed change in the checked areas. |
| Gemini CLI | [Hooks](https://geminicli.com/docs/hooks/reference/), [tools](https://geminicli.com/docs/reference/tools/) | Existing 11-event coverage includes tail calls, model overrides, and context clearing. No confirmed hook-schema change in the checked areas. |
| Antigravity | [Hooks and tools](https://antigravity.google/docs/hooks) | Existing five-event coverage and typed `toolCall` remain applicable. Its collaboration tool descriptions do not establish a complete response contract. |

The npm registry reported SDK 0.3.278 as latest. GitHub's latest stable release endpoint reported Codex 0.155.1, published September 18. Prereleases and unreleased `main` code were not used to replace stable contracts.

## Implemented changes

### Claude

- Accept nullable compaction instructions, optional PreToolUse decisions, prompt titles/suppression, classifier context, and Stop/SubagentStop feedback. Tool-output replacements follow the SDK's opaque value contract; the vendor runtime validates each built-in replacement.
- Explicitly type prompt IDs, scratchpad paths, session/cache metadata, prompt source, display chunks, MCP provenance, failed-tool duration, and background task/cron summaries. Effort levels and provenance sources remain open to future values.
- Accept structured, null, or omitted batch responses alongside existing strings.

The live hook reference's 52 parseable, concrete JSON stdin/stdout examples pass local probes after these changes. Before the update, four failed: prompt title output, classifier context, Stop context, and null compaction instructions. That probe excludes configuration and non-JSON/placeholder examples; it is not exhaustive runtime conformance.

Claude-specific stdout changes extend provider-local schemas. Shared public schemas and capture-backed Codex output validators remain unchanged.

### Copilot

- Preserve `userPromptTransformed` in config merging and infer it before the structurally similar submitted-prompt event. Validate `transformedPrompt` even if another loose union branch could accept the payload. No undocumented PascalCase alias was invented.
- Validate `modifiedTransformedPrompt` and SDK-only `modifiedPrompt`; reject empty/non-string replacements. Config-file submitted-prompt hooks do not gain mutation behavior from schema validation.
- Apply tool-name filtering to post-tool hooks. PascalCase PreToolUse supports documented Claude tool aliases, literal alternatives, and `*`/`**`; native events retain anchored regex semantics.

When only a canonical Claude tool name is supplied to the resolver, it cannot reconstruct which runtime alias originally produced it. Pass the runtime name when matching runtime-name literals.

### Codex agent tools

The [0.153.4](https://github.com/openai/codex/blob/rust-v0.153.4/codex-rs/core/src/tools/handlers/multi_agents_spec.rs) and [0.155.1](https://github.com/openai/codex/blob/rust-v0.155.1/codex-rs/core/src/tools/handlers/multi_agents_spec.rs) tool-definition files are byte-identical (SHA-256 `c4c5d7bb0a6cc22e27bf6f26bb3e14abebfdbdfce64a92d916e20ccc268c2f2d`). Existing V1/V2 input definitions therefore need no change based on that file. This does not establish identical handlers, responses, availability, or runtime behavior.

## Validation and limits

Regression fixtures are in `reference-updates-2026-09.test.ts`; built-package checks cover the root and provider exports.

- `bun run build`: passed, including TypeScript declarations.
- `bun run test:types`: passed, including exact stop-event output type checks.
- `bun test --parallel=4`: **717 passed, 27 skipped, 0 failed** across 22 files. The skips require optional external Cursor/Gemini captures.
- `bun run test:coverage`: passed; all 21 library modules meet the coverage gate, with only the existing three-line compile-time exhaustiveness guard exempted.
- `git diff --check`: passed.

No vendor application replay, external capture refresh, package publication, commit, or push is part of this audit. Unknown input fields remain forward compatible; published tool catalogs are not a promise of tools enabled in a particular session.
