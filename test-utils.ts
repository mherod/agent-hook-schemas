import { existsSync, readFileSync } from "node:fs";

const HOOK_TMP = "/private/tmp";

export function readHookSample(name: string, event: string): unknown | null {
  const p = `${HOOK_TMP}/${name}`;
  if (!existsSync(p)) return null;
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  if ((data as { hook_event_name?: unknown }).hook_event_name !== event)
    return null;
  return data;
}
