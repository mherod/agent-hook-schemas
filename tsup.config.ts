import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "index.ts",
    "claude.ts",
    "claude-hooks-integration.ts",
    "claude-tasks.ts",
    "codex.ts",
    "codex-hooks-integration.ts",
    "codex-tasks.ts",
    "common.ts",
    "cursor.ts",
    "gemini.ts",
    "gemini-hooks-integration.ts",
  ],
  format: "esm",
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  external: ["zod"],
  outDir: "dist",
});
