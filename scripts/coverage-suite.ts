import { readdir } from "node:fs/promises";

// Bun 1.4.0 cannot reliably union line/function coverage across workers:
// https://github.com/oven-sh/bun/issues/39930
// Load the source tests through one explicit entry so all hits share one module
// registry. Ordinary test runs still isolate files across four workers.
const root = new URL("../", import.meta.url);
const files = (await readdir(root)).sort();

// Include even modules that no test imports, so adding an untested library file
// cannot silently shrink the coverage denominator.
for (const file of files) {
  if (file.endsWith(".ts") && !file.endsWith(".test.ts") &&
      !["test-utils.ts", "tsup.config.ts"].includes(file)) {
    await import(new URL(file, root).href);
  }
}

// Built-package imports have their own smoke run; their source maps must not
// contribute a second copy of a module to the source coverage report.
for (const file of files) {
  if (file.endsWith(".test.ts") && file !== "dist-smoke.test.ts") {
    await import(new URL(file, root).href);
  }
}
