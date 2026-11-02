import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

/**
 * i18n readiness ratchet.
 *
 * The per-root migration is staged, so the audit cannot require zero hard-coded
 * copy yet. The committed baseline is a ceiling instead: a root may not add copy
 * without an explicit `pnpm i18n:baseline` in the same change. This keeps the
 * readiness number from drifting while the catalogues land root by root.
 */
const workspaceRoot = path.resolve(import.meta.dirname, "..", "..");
const auditScript = path.join(workspaceRoot, "scripts", "audit-mall-i18n-readiness.mjs");
const baselinePath = path.join(workspaceRoot, "specs", "i18n-readiness.baseline.json");
const ROOT_NAMES = ["flutter", "h5", "miniProgram", "pc"];

test("no root added hard-coded copy beyond the committed baseline", () => {
  const result = execFileSync(process.execPath, [auditScript, "--check"], {
    cwd: workspaceRoot,
    encoding: "utf8",
  });
  assert.match(result, /i18n readiness ratchet holds/u);
});

test("the i18n baseline is well formed and covers every root", () => {
  const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));

  assert.equal(baseline.schemaVersion, 1);
  assert.deepEqual(Object.keys(baseline.roots).sort(), ROOT_NAMES);
  for (const rootName of ROOT_NAMES) {
    assert.equal(typeof baseline.roots[rootName], "number", rootName);
    assert.ok(baseline.roots[rootName] > 0, `${rootName} must have a positive count`);
  }

  const sum = ROOT_NAMES.reduce((total, rootName) => total + baseline.roots[rootName], 0);
  assert.equal(baseline.total, sum, "total must equal the per-root sum");
});
