import { z } from "zod";
import {
  CopilotHookEventNameSchema,
  CopilotHooksFileSchema,
  type CopilotHookEventInput,
  type CopilotHookEventName,
  type CopilotHookHandler,
  type CopilotHooksConfig,
} from "./copilot.ts";

// ---------------------------------------------------------------------------
// Config merge
// ---------------------------------------------------------------------------

/**
 * Copilot combines hook entries from user, project, and plugin sources. For a
 * disabled hooks file, only that file's hooks are skipped.
 */
export function mergeCopilotHooksFiles(
  files: unknown[],
):
  | { ok: true; config: CopilotHooksConfig }
  | { ok: false; index: number; error: z.ZodError } {
  const merged: CopilotHooksConfig = {};
  const events = CopilotHookEventNameSchema.options;

  for (let i = 0; i < files.length; i++) {
    const parsed = CopilotHooksFileSchema.safeParse(files[i]);
    if (!parsed.success) return { ok: false, index: i, error: parsed.error };
    if (parsed.data.disableAllHooks === true) continue;

    const hooks = parsed.data.hooks;
    for (const event of events) {
      const handlers = hooks[event];
      if (!handlers?.length) continue;
      merged[event] = [...(merged[event] ?? []), ...handlers];
    }
  }

  return { ok: true, config: merged };
}

// ---------------------------------------------------------------------------
// Matcher matching
// ---------------------------------------------------------------------------

const COPILOT_MATCHER_EVENTS: ReadonlySet<CopilotHookEventName> = new Set([
  "Notification",
  "PermissionRequest",
  "PreCompact",
  "PreToolUse",
  "SubagentStart",
  "notification",
  "permissionRequest",
  "preCompact",
  "preToolUse",
  "subagentStart",
]);

/**
 * Copilot matcher regexes are anchored as `^(?:matcher)$`. Invalid regexes
 * fail closed, matching the runtime behavior that skips invalid entries.
 */
export function copilotMatcherMatches(matcher: string | undefined, subject: string): boolean {
  if (matcher === undefined) return true;
  try {
    return new RegExp(`^(?:${matcher})$`).test(subject);
  } catch {
    return false;
  }
}

function copilotEventUsesMatcher(event: CopilotHookEventName): boolean {
  return COPILOT_MATCHER_EVENTS.has(event);
}

// ---------------------------------------------------------------------------
// Handler resolution
// ---------------------------------------------------------------------------

export function resolveMatchingCopilotHandlers(
  config: CopilotHooksConfig,
  event: CopilotHookEventName,
  subject: string,
): CopilotHookHandler[] {
  const handlers = config[event];
  if (!handlers?.length) return [];
  if (!copilotEventUsesMatcher(event)) return handlers;
  return handlers.filter((handler) => copilotMatcherMatches(handler.matcher, subject));
}

function stringField(record: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string") return value;
  }
  return "";
}

export function copilotResolutionSubjectFromInput(
  event: CopilotHookEventName,
  input: CopilotHookEventInput,
): string {
  const record = input as Record<string, unknown>;
  switch (event) {
    case "Notification":
    case "notification":
      return stringField(record, "notification_type");
    case "PermissionRequest":
    case "PreToolUse":
    case "permissionRequest":
    case "preToolUse":
      return stringField(record, "toolName", "tool_name");
    case "PreCompact":
    case "preCompact":
      return stringField(record, "trigger");
    case "SubagentStart":
    case "subagentStart":
      return stringField(record, "agentName", "agent_name");
    default:
      return "";
  }
}

/**
 * Infer the config event name from parsed stdin when possible. CamelCase
 * `permissionRequest` and `preToolUse` payloads are structurally identical, so
 * pass an explicit event to `resolveMatchingCopilotHandlersFromInput` for
 * permission request hooks.
 */
export function copilotEventNameFromInput(
  input: CopilotHookEventInput,
): CopilotHookEventName | undefined {
  const record = input as Record<string, unknown>;
  const hookEventName = record.hook_event_name;
  if (typeof hookEventName === "string") {
    const parsed = CopilotHookEventNameSchema.safeParse(hookEventName);
    if (parsed.success) return parsed.data;
  }

  if (typeof record.errorContext === "string") return "errorOccurred";
  if (typeof record.trigger === "string") return "preCompact";
  if (typeof record.agentName === "string" && typeof record.stopReason === "string") {
    return "subagentStop";
  }
  if (typeof record.agentName === "string") return "subagentStart";
  if (typeof record.stopReason === "string") return "agentStop";
  if (typeof record.toolName === "string" && typeof record.error === "string") {
    return "postToolUseFailure";
  }
  if (typeof record.toolResult === "object" && record.toolResult !== null) {
    return "postToolUse";
  }
  if (typeof record.toolName === "string") return "preToolUse";
  if (typeof record.prompt === "string") return "userPromptSubmitted";
  if (typeof record.reason === "string") return "sessionEnd";
  if (typeof record.source === "string") return "sessionStart";
  return undefined;
}

export function resolveMatchingCopilotHandlersFromInput(
  config: CopilotHooksConfig,
  input: CopilotHookEventInput,
  eventOverride?: CopilotHookEventName,
): CopilotHookHandler[] {
  const event = eventOverride ?? copilotEventNameFromInput(input);
  if (!event) return [];
  return resolveMatchingCopilotHandlers(
    config,
    event,
    copilotResolutionSubjectFromInput(event, input),
  );
}

/** Effective timeout in seconds (Copilot default: 30). */
export function effectiveCopilotHandlerTimeoutSec(
  handler: Pick<CopilotHookHandler, "timeoutSec">,
): number {
  return handler.timeoutSec ?? 30;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/** Validate a Copilot hooks JSON file. Returns typed config or Zod error. */
export function parseCopilotHooksFile(json: unknown):
  | { ok: true; config: CopilotHooksConfig }
  | { ok: false; error: z.ZodError } {
  const result = CopilotHooksFileSchema.safeParse(json);
  if (!result.success) return { ok: false, error: result.error };
  if (result.data.disableAllHooks === true) return { ok: true, config: {} };
  return { ok: true, config: result.data.hooks };
}
