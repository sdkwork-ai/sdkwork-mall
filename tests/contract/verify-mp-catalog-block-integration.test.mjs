import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

/**
 * The catalogue is a building block.
 *
 * Authority: `TECH-BLOCK-INTEGRATION.md` (catalog row). Categories, product cards
 * and product detail are owned by the mall commerce block; the mall service
 * projects them and must not hand-roll a catalogue wire path.
 */
const workspaceRoot = path.resolve(import.meta.dirname, "..", "..");
const miniProgram = path.join(workspaceRoot, "apps", "sdkwork-mall-mini-program");

function read(relative) {
  const absolute = path.join(miniProgram, relative);
  assert.ok(existsSync(absolute), `missing ${relative}`);
  return readFileSync(absolute, "utf8");
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .replace(/^[ \t]*\/\/.*$/gmu, "")
    .replace(/`(?:[^`\\]|\\.)*`/gu, "``")
    .replace(/'(?:[^'\\\n]|\\.)*'/gu, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/gu, '""');
}

test("the catalogue service reads through the commerce block", () => {
  const service = read("src/services/catalog-service.ts");
  assert.match(service, /getMallMpRuntime\(\)\.commerceClient/u);
  for (const call of [
    "catalog\\(\\)\\.categories\\.list",
    "catalog\\(\\)\\.products\\.list",
    "catalog\\(\\)\\.products\\.retrieve",
  ]) {
    assert.match(service, new RegExp(call, "u"), `missing block call ${call}`);
  }
});

test("the catalogue service owns no catalogue wire path", () => {
  const source = stripComments(read("src/services/catalog-service.ts"));
  for (const pattern of [/path:\s*"\/catalog/u, /\/catalog\/(?:products|categories|spus)/u]) {
    assert.doesNotMatch(source, pattern, `hand-rolled catalogue endpoint: ${pattern}`);
  }
  assert.doesNotMatch(source, /from "\.\/transport"/u, "the catalogue must not import the raw request seam");
});
