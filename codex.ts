// Public compatibility entry. Integration code imports codex-schemas.ts
// directly so schemas never depend on their consumers.
export * from "./codex-schemas.ts";

export {
  codexMatcherMatches,
  codexResolutionContextFromInput,
  codexToolIfMatches,
  effectiveCodexHandlerTimeoutSec,
  mergeCodexHooksFiles,
  parseCodexHooksFile,
  resolveMatchingCodexHandlers,
  resolveMatchingCodexHandlersFromInput,
  type CodexHookResolutionContext,
} from "./codex-hooks-integration.ts";
