import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const workspaceRoot = path.resolve(import.meta.dirname, "..", "..");
const generatorPath = path.join(workspaceRoot, "scripts", "generate-mall-i18n-catalogues.mjs");
const cataloguePath = path.join(workspaceRoot, "specs", "app-i18n", "capabilities.zh-CN.json");
const contractPath = path.join(workspaceRoot, "specs", "mall-capability-parity.json");

const contract = JSON.parse(readFileSync(contractPath, "utf8"));
const catalogue = JSON.parse(readFileSync(cataloguePath, "utf8"));

test("i18n capability catalogue is generated from the parity contract", () => {
  const result = execFileSync(process.execPath, [generatorPath, "--check"], {
    cwd: workspaceRoot,
    encoding: "utf8",
  });
  assert.match(result, /matches the parity contract/u);
});

test("every capability publishes exactly one title key", () => {
  const ids = contract.capabilities.map((capability) => capability.id);
  const titleKeys = Object.keys(catalogue.messages).filter((key) =>
    /^capability\..+\.title$/u.test(key),
  );

  assert.equal(titleKeys.length, ids.length);
  for (const id of ids) {
    const key = `capability.${id}.title`;
    assert.ok(key in catalogue.messages, `missing ${key}`);
    assert.equal(catalogue.messages[key], contract.capabilities.find((entry) => entry.id === id).title);
  }
  assert.equal(catalogue.capabilityCount, ids.length);
});

test("shared cross-root copy and common actions are published", () => {
  for (const entry of contract.sharedCopy ?? []) {
    assert.equal(catalogue.messages[`shared.${entry.key}`], entry.text, entry.key);
  }
  for (const key of ["common.retry", "common.confirm", "common.cancel", "common.loading"]) {
    assert.ok(catalogue.messages[key], `missing ${key}`);
  }
});

test("catalogue values are non-empty and keys are unique", () => {
  const entries = Object.entries(catalogue.messages);
  assert.equal(new Set(entries.map(([key]) => key)).size, entries.length);
  for (const [key, value] of entries) {
    assert.equal(typeof value, "string", key);
    assert.ok(value.trim().length > 0, `${key} must not be empty`);
  }
});
