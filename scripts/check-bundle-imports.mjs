import assert from "node:assert/strict";

// Each invocation starts with an empty module cache. Exercise the selected
// entry before importing the others so they cannot mask an initialization bug.
const first = await import(process.argv[2]);
for (const merge of [first.mergeCodexHooksFiles, first.mergeCopilotHooksFiles]) {
  if (merge) assert.deepEqual(merge([]), { ok: true, config: {} });
}

const root = await import("agent-hook-schemas");
const codex = await import("agent-hook-schemas/codex");
const copilot = await import("agent-hook-schemas/copilot");
const codexIntegration = await import("agent-hook-schemas/codex-hooks-integration");
const copilotIntegration = await import("agent-hook-schemas/copilot-hooks-integration");

for (const [platform, integration] of [[codex, codexIntegration], [copilot, copilotIntegration]]) {
  for (const [name, value] of Object.entries(platform)) {
    assert.notEqual(value, undefined, name);
    assert.equal(root[name], value, `root/platform identity: ${name}`);
  }
  for (const [name, value] of Object.entries(integration)) {
    assert.notEqual(value, undefined, name);
    assert.equal(platform[name], value, `platform/integration identity: ${name}`);
  }
}

const handler = { type: "command", command: "echo ready" };
const codexFile = { hooks: { SessionStart: [{ matcher: "startup", hooks: [handler] }] } };
const codexMerged = codex.mergeCodexHooksFiles([codexFile]);
assert.equal(codexMerged.ok, true);
assert.deepEqual(codex.parseCodexHooksFile(codexFile), codexMerged);
const codexInput = codex.ParseCodexHookInput({ hook_event_name: "SessionStart", source: "startup" });
assert.equal(codexInput.success, true);
assert.deepEqual(codex.resolveMatchingCodexHandlersFromInput(codexMerged.config, codexInput.data), [handler]);
assert.equal(codex.CodexHooksFileSchema.safeParse(codexFile).success, true);

const copilotFile = { version: 1, hooks: { sessionStart: [handler] } };
const copilotMerged = copilot.mergeCopilotHooksFiles([copilotFile]);
assert.equal(copilotMerged.ok, true);
assert.deepEqual(copilot.parseCopilotHooksFile(copilotFile), copilotMerged);
const copilotInput = copilot.ParseCopilotHookInput({ sessionId: "smoke", timestamp: 0, cwd: "/project", source: "new" });
assert.equal(copilotInput.success, true);
assert.deepEqual(copilot.resolveMatchingCopilotHandlersFromInput(copilotMerged.config, copilotInput.data), [handler]);
assert.equal(copilot.CopilotHooksFileSchema.safeParse(copilotFile).success, true);
