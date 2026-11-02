import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";

/**
 * Mini-program i18n runtime contract.
 *
 * The mini-program module system resolves JavaScript at runtime, not JSON, so
 * copy is authored as plain-object `.js` fragments under
 * `src/i18n/<locale>/<domain>/<capability>/` with a sibling `.d.ts`. The runtime
 * flattens them once and exposes a synchronous `t(key, params)`.
 */
const workspaceRoot = path.resolve(import.meta.dirname, "..", "..");
const appRoot = "apps/sdkwork-mall-mini-program";

function read(relativePath) {
  const absolutePath = path.join(workspaceRoot, relativePath);
  assert.ok(existsSync(absolutePath), `missing ${relativePath}`);
  return readFileSync(absolutePath, "utf8");
}

test("the runtime flattens authored fragments and exposes lookups", () => {
  const runtime = read(`${appRoot}/src/i18n/index.ts`);
  assert.match(runtime, /from "\.\/zh-CN\/account\/buyer-hub\/messages"/u);
  assert.match(runtime, /export function t\(/u);
  assert.match(runtime, /export function hasMessage\(/u);
  assert.match(runtime, /\{\{\$\{name\}\}\}/u);

  const fragment = read(`${appRoot}/src/i18n/zh-CN/account/buyer-hub/messages.js`);
  assert.match(fragment, /buyerHub/u);

  const declarations = read(`${appRoot}/src/i18n/zh-CN/account/buyer-hub/messages.d.ts`);
  assert.match(declarations, /export = messages;/u);
});

test("the buyer hub resolves every label from the catalogue", () => {
  const page = read(`${appRoot}/src/pages/buyer/index.ts`);
  assert.match(page, /labelKey: "buyerHub\.orders\.all"/u);
  assert.match(page, /label: t\(entry\.labelKey\)/u);
  assert.match(page, /label: t\(link\.labelKey\)/u);
  assert.match(page, /t\("buyerHub\.logout\.title"\)/u);
  assert.doesNotMatch(page, /label: "全部订单"/u);

  const chineseLiterals = [...page.matchAll(/"[^"\n]*[\u4e00-\u9fff][^"\n]*"/gu)]
    .map((match) => match[0])
    .filter((literal) => !literal.startsWith('"{{'));
  assert.deepEqual(chineseLiterals, [], "buyer hub must not inline Chinese copy");
});
