import { z } from "zod";
import {
  type AntigravityCommandHookHandler,
  type AntigravityHookEventName,
  type AntigravityHooksFile,
  AntigravityHooksFileSchema,
} from "./antigravity.ts";
import { parseSchemaResult, regexMatcherMatches } from "./common.ts";

/**
 * Whether `matcher` matches `toolName`: wildcards when omitted, `""`, or `"*"`;
 * otherwise evaluated as a JavaScript regular expression against the tool name.
 */
export function antigravityMatcherMatches(
  matcher: string | undefined,
  toolName: string,
): boolean {
  if (matcher === undefined || matcher === "" || matcher === "*") return true;
  return regexMatcherMatches(matcher, toolName, { wildcard: false });
}

/** Parse an Antigravity `hooks.json` file. */
export function parseAntigravityHooksFile(
  json: unknown,
): { ok: true; hooks: AntigravityHooksFile } | { ok: false; error: z.ZodError } {
  return parseSchemaResult(AntigravityHooksFileSchema, json, "hooks");
}

/**
 * Merge multiple Antigravity `hooks.json` layers (e.g. workspace, plugin, global).
 * Named hook specifications from later layers are merged with earlier layers;
 * for matching hook names, later handler arrays concatenate after earlier ones.
 */
export function mergeAntigravityHooksFiles(
  files: unknown[],
):
  | { ok: true; hooks: AntigravityHooksFile }
  | { ok: false; index: number; error: z.ZodError } {
  const merged: AntigravityHooksFile = {};

  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    const parsed = AntigravityHooksFileSchema.safeParse(file);
    if (!parsed.success) {
      return { ok: false, index, error: parsed.error };
    }

    for (const [hookName, spec] of Object.entries(parsed.data)) {
      if (!merged[hookName]) {
        merged[hookName] = { ...spec };
      } else {
        const existing = merged[hookName]!;
        merged[hookName] = {
          ...existing,
          ...spec,
          enabled: spec.enabled ?? existing.enabled,
          PreToolUse: [
            ...(existing.PreToolUse ?? []),
            ...(spec.PreToolUse ?? []),
          ],
          PostToolUse: [
            ...(existing.PostToolUse ?? []),
            ...(spec.PostToolUse ?? []),
          ],
          PreInvocation: [
            ...(existing.PreInvocation ?? []),
            ...(spec.PreInvocation ?? []),
          ],
          PostInvocation: [
            ...(existing.PostInvocation ?? []),
            ...(spec.PostInvocation ?? []),
          ],
          Stop: [
            ...(existing.Stop ?? []),
            ...(spec.Stop ?? []),
          ],
        };
      }
    }
  }

  return { ok: true, hooks: merged };
}

/** Resolve command handlers that should execute for this event and optional tool name. */
export function resolveMatchingAntigravityHandlers(
  hooks: AntigravityHooksFile,
  event: AntigravityHookEventName,
  toolName?: string,
): AntigravityCommandHookHandler[] {
  const handlers: AntigravityCommandHookHandler[] = [];

  for (const spec of Object.values(hooks)) {
    if (spec.enabled === false) continue;

    if (event === "PreToolUse" || event === "PostToolUse") {
      const groups = spec[event];
      if (!groups?.length) continue;
      for (const group of groups) {
        if (antigravityMatcherMatches(group.matcher, toolName ?? "")) {
          handlers.push(...group.hooks);
        }
      }
    } else {
      const direct = spec[event];
      if (direct?.length) {
        handlers.push(...direct);
      }
    }
  }

  return handlers;
}

/** Execution timeout in seconds for an Antigravity command handler (default: 30s). */
export function effectiveAntigravityHandlerTimeoutSec(
  handler: AntigravityCommandHookHandler,
): number {
  return handler.timeout ?? 30;
}
