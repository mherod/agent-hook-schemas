# Hook documentation audit — 7 September 2026

Checked the current official references against `agent-hook-schemas` 0.3.1 at commit `339b91ddfa8a5c28dfc72c776988d41142ed6014`.

The baseline findings below combine documentation with local parser/resolver probes. The follow-up implementation addresses these findings; see the implementation record at the end. Verification uses local tests, not replays from running vendor applications.

## Official references

Counts refer to the events in the reviewed references, not every SDK callback or internal event a vendor might expose. Copilot's two naming conventions count as one event family each.

| Platform | Reference checked | Baseline / documented events | Updated local events |
| --- | --- | --- | --- |
| Claude Code | [Hooks reference](https://code.claude.com/docs/en/hooks) | 31 / 33 | 33 |
| OpenAI Codex | [Hooks reference](https://developers.openai.com/codex/hooks) — currently redirects to ChatGPT Learn | 11 / 12 | 12 |
| GitHub Copilot CLI / cloud agent | [Hooks reference](https://docs.github.com/en/copilot/reference/hooks-reference) | 13 / 13 | 13 |
| Cursor | [Hooks reference](https://cursor.com/docs/hooks) | 20 / 21 | 21 |
| Gemini CLI | [Hooks reference](https://geminicli.com/docs/hooks/reference/) | 11 / 11 | 11 |
| Google Antigravity | [Hooks reference](https://antigravity.google/docs/hooks) | 5 / 5 | 5 |

These are live documentation URLs checked on the audit date, not pinned release specifications. Exact installed-version compatibility still needs captures or versioned upstream evidence.

Sections 1–6 describe behavior at the baseline commit, before the updates.

## 1. Claude Code — configuration and resolver changes

- Add `PreModelSwitch` and `PostModelSwitch` across event schemas, config, outputs, and resolution. The latter requires v2.1.251+. Current input fallback accepts the former, but config parsing drops both.
- Add the `mcp_tool` handler with `server`, `tool`, and optional `input`; the current handler union rejects it.
- Match simple names exactly and support comma-separated alternatives. Keep the documented narrower rules for `FileChanged` and `StopFailure`. Current regex-only matching incorrectly accepts `Bash` against `OtherBash` and rejects `Edit, Write` against `Edit`.
- Reconcile Bash `if` handling with subcommands, assignments, and substitutions. The current whole-command glob misses a matching command after `&&`.
- Make timeout resolution aware of handler type and event. The helper always defaults to 600 seconds, including prompt handlers whose documented default is 30.

Source: [Claude configuration, matchers, and events](https://code.claude.com/docs/en/hooks).

Implementation locations: [claude.ts](../claude.ts), [claude-hooks-integration.ts](../claude-hooks-integration.ts). Refresh known input enum values such as `SessionStart`'s `fork` additively; retain compatibility values.

## 2. Codex — interruption, MCP handlers, and broader tools

- Add `Interrupt` input/config/resolution and advisory output support. Its matcher is ignored; timeout defaults to one second and is limited to one–three seconds. Current stdin parsing rejects it and config parsing drops it.
- Add `mcp_tool` handlers. Current matcher groups only accept command handlers. Keep the documented `SessionEnd` exclusion.
- Reconcile tool inputs with the documented JSON-valued contract and nullable approval description. The current Bash-shaped schema rejects `tool_input.description: null`.
- Resolve `apply_patch` through its `Edit` and `Write` matcher aliases. The current helper returns no handlers for an `Edit` matcher with `tool_name: "apply_patch"`.

Source: [Codex hooks](https://developers.openai.com/codex/hooks).

Implementation locations: [codex.ts](../codex.ts), [codex-hooks-integration.ts](../codex-hooks-integration.ts). Preserve existing capture-backed fields, including `permission_input`; add documented compatibility without renaming them. Keep new output shapes loose until captures establish strict wire schemas. The reference explicitly warns that generated schemas on upstream `main` can run ahead of releases.

## 3. Copilot — valid configuration and stdout rejected

- Add CLI `exec` / `args`, mutually exclusive with shell command fields. An exec-only handler currently fails the shell-command requirement.
- Default an omitted `type` to `command`. It is currently required.
- Preserve `timeout` as an alias and prefer `timeoutSec` when both exist. Parsing currently discards `timeout: 9`, then the helper returns 30 seconds.
- Add a `postToolUse` output schema for `modifiedResult` and `additionalContext`. The generic output parser currently rejects a documented successful replacement result.

Source: [Copilot command configuration and postToolUse output](https://docs.github.com/en/copilot/reference/hooks-reference).

Implementation locations: [copilot.ts](../copilot.ts), [copilot-hooks-integration.ts](../copilot-hooks-integration.ts).

Further review: model progress messages separately from final stdout; distinguish lenient directory-file loading from strict inline settings validation. The HTTP section mixes a general HTTPS runtime restriction with a broader URL schema table, so keep syntax validation and execution policy distinct.

## 4. Cursor — input compatibility first, broader coverage second

- Accept nullable `user_email`; current known-event parsing rejects it.
- Add `workspaceOpen`, which has no agent-session metadata. The current discriminated union rejects this event.
- Type `model_id` and `model_params`. They currently survive through loose parsing without dedicated field schemas.
- Plan config and event-specific stdout exports as an additive extension. The library currently covers stdin only, while the reference includes command/prompt handlers and outputs such as `updated_input`, `additional_context`, and workspace `pluginPaths`.

Source: [Cursor hooks](https://cursor.com/docs/hooks).

Implementation location: [cursor.ts](../cursor.ts). Preserve captured input variants. Before implementing config, resolve the reference's matcher table saying “object” while its examples use strings. Keep cloud support differences explicit; cloud agents only run command hooks.

## 5. Antigravity — small typing gap

The five-event family is present. Add `toolCall` explicitly to `AntigravityPostToolUseInputSchema`, using the existing tool-call schema. It currently survives loose parsing but lacks a declared field validator/type. The reference includes it for both tool events. [Antigravity input/output contract](https://antigravity.google/docs/hooks#inputoutput-contract).

Implementation location: [antigravity.ts](../antigravity.ts). Preserve the intentional partial-input parsing policy; optional local fields alone are not evidence of a defect.

## 6. Gemini CLI — no urgent gap found in this pass

The eleven documented events are present. Tail calls, `original_request_name`, synthetic/replacement model responses, tool selection, and `clearContext` already have schema coverage. Tail-call and clear-context output probes pass. Dedicated stable model request/response schemas could improve typing beyond the current generic JSON objects. [Gemini hooks reference](https://geminicli.com/docs/hooks/reference/).

Implementation location: [gemini.ts](../gemini.ts). Do not remove existing runtime-backed decision values merely because the shorter public reference omits them. This pass does not establish complete runtime parity.

## Suggested delivery order

1. Fix rejections and silent configuration loss in the existing public API.
2. Correct resolver behavior, including matcher aliases and timeout rules.
3. Add dedicated field typing and the missing Cursor config/stdout surface.
4. Refresh README comparisons. Several rows already disagree with local code: Codex has `PermissionRequest`, Cursor has failure/subagent events, and Cursor's post-tool field is `tool_output`.

Keep fixes scoped by platform. Add regression fixtures for the observed incompatibilities, preserve public exports and capture-backed contracts, then run `bun run build` and `bun test --parallel=4` before committing schema changes. The local test-runner hook requires bounded file-level parallelism and blocks `--concurrent`.

## Baseline verification

Ran 24 parser, resolver, and schema-field probes using Bun 1.4.0 with frozen-lockfile dependencies. No hook commands were executed. The probes exercised the findings above plus accepted fallback/loose cases, so an accepted input was not mistaken for fully typed support.

Notable results:

- Both missing-event config probes returned successful parses containing `{}`.
- MCP handler configs, Codex interruption/null-description inputs, Copilot exec/default-type/replacement-result shapes, and Cursor null-email/workspace inputs failed as described above.
- Matcher, alias, and timeout probes reproduced the resolver differences.
- Loose parsing preserved the Cursor metadata and Antigravity tool call; shape inspection confirmed the missing declared fields.

Probe script: `/private/tmp/agent-hook-docs-audit-2026-09-07.ts`.
Probe output: `/private/tmp/agent-hook-docs-audit-2026-09-07.json`.

These temporary artifacts are baseline receipts and are not part of the published package.

## Implementation record

- Claude: model-switch inputs/output/config, MCP handlers, refreshed enum values, exact/list matchers, corrected matcher subjects, Bash subcommand selection, and event/type timeout defaults. `asyncRewake` retains a timeout. A separate helper computes the settings-derived shared `SessionEnd` budget.
- Codex: advisory `Interrupt` support, MCP handlers with the `SessionEnd` exclusion, JSON-valued tool inputs, nullable Bash descriptions, and `apply_patch` aliases. Existing captured fields and strict wire-event schemas remain intact.
- Copilot: default command type, CLI exec/args, timeout alias, replacement-result output, progress parsing, per-item directory diagnostics, and a separate runtime HTTP transport-policy helper.
- Cursor: workspace lifecycle input, nullable email, declared model/MCP metadata, command/prompt configuration, command-only cloud validation, and event-specific stdout schemas/parsers for all 21 events.
- Antigravity: explicit post-tool `toolCall` typing. Gemini: stable model request/response schemas and partial output overrides.
- README comparisons and repository guidance now describe the current surface. Regression cases are in [hook-docs-update.test.ts](../hook-docs-update.test.ts).

### Compatibility boundaries

- Bash selection is best-effort: unsupported or dynamic command syntax can run a hook unnecessarily. It never grants a settings permission. Model-switch callers with provider-specific IDs should supply the canonical model as the resolution subject.
- The Cursor reference supplies string matcher examples but no object matcher contract. Configuration follows those examples. `CursorCloudHooksFileSchema` checks handler type; hosted versus self-hosted event availability remains a deployment concern, documented in the README.
- Copilot directory loading and stdout progress parsing are additive runtime-style helpers. Existing inline settings validators remain strict. The HTTP helper does not replace permission-sensitive URL schemas or cloud firewall policy.
- New documentation-derived Codex events remain loose until runtime captures justify strict wire schemas. The 27 optional Cursor/Gemini capture tests require external local fixture files.

### Final verification

- `bun run build`: passed, including ESM bundles and TypeScript declarations.
- `bun test --parallel=4`: 466 passed, 27 optional capture tests skipped, 0 failed (493 tests across 12 files). This includes built-package export smoke checks and 45 new regression cases.
- `git diff --check`: passed.

These results establish local schema, resolver and package compatibility for the tested cases. No vendor-runtime replay, package publication or release was performed.
