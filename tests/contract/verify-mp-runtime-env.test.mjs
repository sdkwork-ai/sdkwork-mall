import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

/**
 * Mini-program runtime environment contract.
 *
 * The MP bundle resolves its API base URL at build time from the app manifest.
 * A missing environment silently disables that profile, and a release build
 * without injection must never fall back to the development host.
 */
const workspaceRoot = path.resolve(import.meta.dirname, "..", "..");

function read(relativePath) {
  const absolutePath = path.join(workspaceRoot, relativePath);
  assert.ok(existsSync(absolutePath), `missing ${relativePath}`);
  return readFileSync(absolutePath, "utf8");
}

test("the mini-program manifest declares every lifecycle environment", () => {
  const manifest = JSON.parse(
    read("apps/sdkwork-mall-mini-program/agent.app.config.json"),
  );
  const expectedHosts = {
    demo: "https://api-demo.sdkwork.com/apps/sdkwork-mall-mini-program",
    development: "https://api-dev.sdkwork.com/apps/sdkwork-mall-mini-program",
    production: "https://api.sdkwork.com/apps/sdkwork-mall-mini-program",
    staging: "https://api-staging.sdkwork.com/apps/sdkwork-mall-mini-program",
    test: "https://api-test.sdkwork.com/apps/sdkwork-mall-mini-program",
  };
  for (const [environment, accessUrl] of Object.entries(expectedHosts)) {
    assert.equal(
      manifest.environments?.[environment]?.accessUrl,
      accessUrl,
      `manifest environment ${environment}`,
    );
  }
});

test("build-runtime derives /app/v3/api from the manifest access URL", () => {
  const script = read("apps/sdkwork-mall-mini-program/scripts/build-runtime.mjs");
  assert.match(script, /--environment/u);
  assert.match(script, /--deployment-profile/u);
  assert.match(script, /accessUrl\.replace\(\/\\\/apps\\\/\.\*\$\/u, ""\)/u);
  assert.match(script, /\/app\/v3\/api/u);
  assert.match(script, /manifest\.environments\?\.\[environment\]/u);
});

test("the release channel decides the fallback API host", () => {
  const environment = read("apps/sdkwork-mall-mini-program/src/bootstrap/environment.ts");
  assert.match(environment, /getAccountInfoSync\(\)/u);
  assert.match(environment, /envVersion === "release"/u);
  assert.match(environment, /https:\/\/api\.sdkwork\.com\/app\/v3\/api/u);
  assert.match(environment, /https:\/\/api-dev\.sdkwork\.com\/app\/v3\/api/u);

  const transport = read("apps/sdkwork-mall-mini-program/src/services/transport.ts");
  assert.match(transport, /readRuntimeEnv\(\)\.commerceAppApiBaseUrl/u);
  assert.doesNotMatch(transport, /return app\?\.globalData\?\.commerceApiBaseUrl \|\| "https:/u);
});
