import { readdir, readFile } from "node:fs/promises";

/** Fail on missing modules, uncovered functions, or unexpected uncovered lines. */
export function checkCoverage(lcov: string, sources: Map<string, string>): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const record of lcov.split("end_of_record")) {
    const file = /^SF:(.+)$/m.exec(record)?.[1]?.trim();
    if (!file) continue;
    const source = sources.get(file);
    if (source === undefined) {
      errors.push(`Unexpected coverage source: ${file}`);
      continue;
    }
    if (seen.has(file)) errors.push(`Duplicate coverage source: ${file}`);
    seen.add(file);

    const found = /^FNF:(\d+)$/m.exec(record)?.[1];
    const hit = /^FNH:(\d+)$/m.exec(record)?.[1];
    if (found === undefined || hit === undefined || Number(found) !== Number(hit)) {
      errors.push(`${file}: function coverage must be 100%`);
    }

    // This branch is unreachable for the helper's TypeScript parameter union.
    // Keep it in the raw report; allow only this exact existing three-line guard.
    const guard = "    default: {\n      const _x: never = hookEventName;\n      return _x;";
    const guardOffset = file === "common.ts" ? source.indexOf(guard) : -1;
    const guardStart = guardOffset < 0 ? -1 : source.slice(0, guardOffset).split("\n").length;
    const lines = [...record.matchAll(/^DA:(\d+),(\d+)(?:,.*)?$/gm)];
    if (lines.length === 0) errors.push(`${file}: missing line coverage`);
    for (const [, lineText, hits] of lines) {
      const line = Number(lineText);
      if (Number(hits) === 0 && !(guardStart > 0 && line >= guardStart && line < guardStart + 3)) {
        errors.push(`${file}:${line}: uncovered line`);
      }
    }
  }
  for (const file of sources.keys()) {
    if (!seen.has(file)) errors.push(`Missing coverage source: ${file}`);
  }
  return errors;
}

if (import.meta.main) {
  const root = new URL("../", import.meta.url);
  const files = (await readdir(root)).filter((file) => file.endsWith(".ts") &&
    !file.endsWith(".test.ts") && !["test-utils.ts", "tsup.config.ts"].includes(file));
  const sources = new Map(await Promise.all(files.map(async (file) =>
    [file, await readFile(new URL(file, root), "utf8")] as const)));
  const errors = checkCoverage(await readFile(new URL("coverage/lcov.info", root), "utf8"), sources);
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log(`Coverage gate passed for ${sources.size} library modules (only the documented exhaustiveness guard is exempt).`);
  }
}
