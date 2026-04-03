import { z } from "zod";
import {
  type GeminiCommandHookHandler,
  type GeminiHookEventInput,
  type GeminiHookEventName,
  type GeminiHooksConfig,
  GeminiHookEventNameSchema,
  GeminiHooksConfigSchema,
  geminiMatcherPatternCompiles,
} from "./gemini.ts";

/** One settings layer: optional `hooks` plus other keys allowed (`.loose()`). */
const GeminiHooksSettingsLayerSchema = z
  .object({
    hooks: GeminiHooksConfigSchema.optional(),
  })
  .loose();

const GEMINI_HOOK_EVENTS = GeminiHookEventNameSchema.options;

/** Tool events: `matcher` is a RegExp on the tool name. Other events: exact string match on the subject. */
const GEMINI_TOOL_REGEX_EVENTS: ReadonlySet<GeminiHookEventName> = new Set(["BeforeTool", "AfterTool"]);

/**
 * Merge hook matcher groups from multiple `settings.json` layers (later files in the array
 * append after earlier ones per event), matching Codex-style concatenation semantics.
 */
export function mergeGeminiHooksFiles(
  files: unknown[],
):
  | { ok: true; config: GeminiHooksConfig }
  | { ok: false; index: number; error: z.ZodError } {
  const merged: GeminiHooksConfig = {};
  for (let i = 0; i < files.length; i++) {
    const parsed = GeminiHooksSettingsLayerSchema.safeParse(files[i]);
    if (!parsed.success) return { ok: false, index: i, error: parsed.error };
    const hooks = parsed.data.hooks;
    if (!hooks) continue;
    for (const event of GEMINI_HOOK_EVENTS) {
      const list = hooks[event];
      if (!list?.length) continue;
      merged[event] = [...(merged[event] ?? []), ...list];
    }
  }
  return { ok: true, config: merged };
}

/**
 * Whether `matcher` matches `subject` for this event: wildcards when omitted, `""`, or `"*"`; regex
 * test for tool events; otherwise exact string equality (Gemini CLI hooks docs).
 */
export function geminiMatcherMatches(
  event: GeminiHookEventName,
  matcher: string | undefined,
  subject: string,
): boolean {
  if (matcher === undefined || matcher === "" || matcher === "*") return true;
  if (GEMINI_TOOL_REGEX_EVENTS.has(event)) {
    if (!geminiMatcherPatternCompiles(matcher)) return false;
    try {
      return new RegExp(matcher).test(subject);
    } catch {
      return false;
    }
  }
  return matcher === subject;
}

/** Command handlers that would run for this event and subject, in merge order then group order. */
export function resolveMatchingGeminiHandlers(
  config: GeminiHooksConfig,
  event: GeminiHookEventName,
  subject: string,
): GeminiCommandHookHandler[] {
  const groups = config[event];
  if (!groups?.length) return [];
  const out: GeminiCommandHookHandler[] = [];
  for (const g of groups) {
    if (geminiMatcherMatches(event, g.matcher, subject)) out.push(...g.hooks);
  }
  return out;
}

function subjectForGeminiInput(input: GeminiHookEventInput): string {
  switch (input.hook_event_name) {
    case "SessionStart":
      return input.source;
    case "SessionEnd":
      return input.reason;
    case "BeforeAgent":
    case "AfterAgent":
      return input.prompt;
    case "BeforeTool":
    case "AfterTool":
      return input.tool_name;
    case "PreCompress":
      return input.trigger;
    case "Notification":
      return input.notification_type;
    default:
      return "";
  }
}

/** Resolve handlers from merged config + parsed stdin payload. */
export function resolveMatchingGeminiHandlersFromInput(
  config: GeminiHooksConfig,
  input: GeminiHookEventInput,
): GeminiCommandHookHandler[] {
  return resolveMatchingGeminiHandlers(
    config,
    input.hook_event_name,
    subjectForGeminiInput(input),
  );
}

/** Effective timeout in milliseconds (Gemini default runtime: 60000). */
export function effectiveGeminiHandlerTimeoutMs(
  handler: Pick<GeminiCommandHookHandler, "timeout">,
): number {
  return handler.timeout ?? 60_000;
}
