import { expect, spyOn, test } from "bun:test";
import * as common from "./common.ts";
import { claudeToolIfMatches } from "./claude-hooks-integration.ts";
import { codexToolIfMatches } from "./codex-hooks-integration.ts";

test("tool guards fail closed if regex compilation fails", () => {
  // Simulate the regex engine rejecting a pattern (e.g. an engine size limit),
  // without constructing an enormous expression that could exhaust test memory.
  const compile = spyOn(common, "simpleGlobToRegExp").mockImplementation(() => {
    throw new SyntaxError("Regular expression exceeds engine limits");
  });
  try {
    expect(claudeToolIfMatches("Bash", { command: "git status" }, "Bash(git *)")).toBe(false);
    expect(codexToolIfMatches("Bash", { command: "git status" }, "Bash(git *)")).toBe(false);
  } finally {
    compile.mockRestore();
  }
  expect(claudeToolIfMatches("Bash", { command: "git status" }, "Bash(git *)")).toBe(true);
  expect(codexToolIfMatches("Bash", { command: "git status" }, "Bash(git *)")).toBe(true);
});
