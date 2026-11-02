import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";

/**
 * Flutter i18n runtime contract.
 *
 * Flutter was the last root with no i18n mechanism. Messages are authored as
 * JSON fragments under `lib/src/i18n/<locale>/<domain>/<capability>/`, loaded
 * once by `SdkworkI18n` at startup; `t()` is synchronous so widgets never await
 * copy, and a missing fragment degrades to the key.
 */
const workspaceRoot = path.resolve(import.meta.dirname, "..", "..");
const appRoot = "apps/sdkwork-mall-flutter-mobile";

function read(relativePath) {
  const absolutePath = path.join(workspaceRoot, relativePath);
  assert.ok(existsSync(absolutePath), `missing ${relativePath}`);
  return readFileSync(absolutePath, "utf8");
}

test("the runtime loads authored fragments and exposes synchronous lookups", () => {
  const runtime = read(`${appRoot}/lib/src/i18n/runtime.dart`);
  assert.match(runtime, /Future<void> load\(/u);
  assert.match(runtime, /static String t\(/u);
  assert.match(runtime, /installForTest/u);
  assert.match(runtime, /lib\/src\/i18n\/zh-CN\/support\/help\/messages\.json/u);

  const main = read(`${appRoot}/lib/main.dart`);
  assert.match(main, /await SdkworkI18n\.load\(\)/u);

  const pubspec = read(`${appRoot}/pubspec.yaml`);
  assert.match(pubspec, /lib\/src\/i18n\/zh-CN\/support\/help\/messages\.json/u);
});

test("the help page resolves every string from the catalogue", () => {
  const page = read(`${appRoot}/lib/pages/help_page.dart`);
  assert.match(page, /SdkworkI18n\.t\('help\.title'\)/u);
  assert.match(page, /SdkworkI18n\.t\(section\.titleKey\)/u);
  assert.match(page, /SdkworkI18n\.t\(itemKey\)/u);
  assert.match(page, /SdkworkI18n\.t\(link\.labelKey\)/u);

  const literalChinese = [...page.matchAll(/'[^'\n]*[\u4e00-\u9fff][^'\n]*'/gu)].map(
    (match) => match[0],
  );
  assert.deepEqual(literalChinese, [], "help page must not inline Chinese copy");
});
