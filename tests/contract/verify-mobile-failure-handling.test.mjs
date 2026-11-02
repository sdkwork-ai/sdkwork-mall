import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";

/**
 * Mobile failure-handling contract.
 *
 * A release build has no dev overlay: an uncaught script error or a failed
 * widget build is invisible unless the root installs a handler. The mini
 * program had no `onError` / `onUnhandledRejection` / `onPageNotFound`, and
 * Flutter relied on the framework's default error widget and an unwrapped zone.
 * Both roots must keep a root-level handler and a branded failure surface.
 */
const workspaceRoot = path.resolve(import.meta.dirname, "..", "..");

function read(relativePath) {
  const absolutePath = path.join(workspaceRoot, relativePath);
  assert.ok(existsSync(absolutePath), `missing ${relativePath}`);
  return readFileSync(absolutePath, "utf8");
}

test("the mini-program root logs uncaught errors and redirects unknown pages", () => {
  const app = read("apps/sdkwork-mall-mini-program/src/app.ts");
  assert.match(app, /onError\(/u);
  assert.match(app, /onUnhandledRejection\(/u);
  assert.match(app, /onPageNotFound\(/u);
  assert.match(
    app,
    /mpCapabilityUrl\("storefront\.mall\.home"\)/u,
    "an unknown page must land on the storefront home capability",
  );
});

test("the Flutter root installs global handlers and a branded error widget", () => {
  const mainDart = read("apps/sdkwork-mall-flutter-mobile/lib/main.dart");
  assert.match(mainDart, /FlutterError\.onError\s*=/u);
  assert.match(mainDart, /ErrorWidget\.builder\s*=/u);
  assert.match(mainDart, /runZonedGuarded/u);
  assert.match(mainDart, /class SdkworkFatalErrorView/u);
  assert.match(
    mainDart,
    /页面出现异常/u,
    "the failure surface must tell the user what happened",
  );
});
