// Public compatibility entry. Integration code imports copilot-schemas.ts
// directly so schemas never depend on their consumers.
export * from "./copilot-schemas.ts";

export {
  copilotEventNameFromInput,
  copilotMatcherMatches,
  copilotHttpHookUrlAllowed,
  copilotResolutionSubjectFromInput,
  effectiveCopilotHandlerTimeoutSec,
  mergeCopilotHooksFiles,
  mergeCopilotHooksDirectoryFiles,
  parseCopilotHooksFile,
  resolveMatchingCopilotHandlers,
  resolveMatchingCopilotHandlersFromInput,
} from "./copilot-hooks-integration.ts";
