import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

/**
 * The committed capability snapshot (`specs/capability-parity.snapshot.json`)
 * is the versioned evidence of cross-client coverage: every capability, which
 * roots must ship it, which roots do, and which asymmetries are documented.
 * It must be refreshed deliberately (`pnpm parity:snapshot`) so a coverage
 * change shows up as a reviewable diff instead of a claim in a commit message.
 *
 * This test runs the same checker CI runs, so `pnpm test:node` covers it too.
 */

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

test("capability parity snapshot matches the live matrix", () => {
  try {
    execFileSync(
      process.execPath,
      [path.join(workspaceRoot, "scripts", "mall-capability-parity-report.mjs"), "--check"],
      { cwd: workspaceRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
  } catch (error) {
    const output = `${error.stdout ?? ""}${error.stderr ?? ""}`.trim();
    assert.fail(
      `capability snapshot check failed — run \`pnpm parity:snapshot\` and review the diff.\n${output}`,
    );
  }
});
