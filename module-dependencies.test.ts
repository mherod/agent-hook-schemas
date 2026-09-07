import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { exports as packageExports } from "./package.json";

test("public library entries have no runtime dependency cycles", () => {
  const transpiler = new Bun.Transpiler({ loader: "ts" });
  const visited = new Set<string>();
  const stack: string[] = [];
  const cycles: string[][] = [];

  function visit(file: string) {
    const cycleStart = stack.indexOf(file);
    if (cycleStart !== -1) {
      cycles.push([...stack.slice(cycleStart), file].map((path) => relative(import.meta.dir, path)));
      return;
    }
    if (visited.has(file)) return;
    visited.add(file);
    stack.push(file);
    // Scan emitted runtime dependencies: type-only imports cannot cause
    // initialization failures. Re-exports must be included (issue #15).
    for (const dependency of transpiler.scanImports(readFileSync(file, "utf8"))) {
      if (dependency.path.startsWith(".")) {
        visit(resolve(dirname(file), dependency.path));
      }
    }
    stack.pop();
  }

  for (const entry of Object.keys(packageExports)) {
    visit(resolve(import.meta.dir, entry === "." ? "index.ts" : `${entry}.ts`));
  }
  expect(cycles).toEqual([]);
});
