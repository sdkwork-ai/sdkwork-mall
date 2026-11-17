import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

/**
 * Mini-program runtime environment contract.
 *
 * Authority: APP_RUNTIME_ENV_SPEC.md §3.1. The mini program is a packaged surface:
 * one committed client-env profile per lifecycle is projected into a typed
 * EnvConfig at build time, and runtime code imports that module. No source
 * constant may bake a deploy host, and a release-channel build must run a
 * production profile.
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

test("build-runtime projects the selected profile through the canonical generator", () => {
  const script = read("apps/sdkwork-mall-mini-program/scripts/build-runtime.mjs");
  assert.match(script, /--profile/u);
  assert.match(script, /generate-app-env-config\.mjs/u);
  assert.match(script, /"--app-id", appId/u);
  assert.match(script, /"config", "mini-program"/u);
  assert.match(script, /\/app\/v3\/api/u, "the commerce app-api path is derived once at runtime");
  assert.doesNotMatch(script, /manifest\.environments/u, "the app manifest no longer owns transport hosts");
});

test("the release channel guards the packaged profile", () => {
  // The channel is a host fact: the weixin profile reads the account info,
  // `bootstrap/environment.ts` maps it, and the app entry passes it in.
  const host = read("apps/sdkwork-mall-mini-program/packages/sdkwork-mall-mp-host/src/weixin/lifecycle.ts");
  assert.match(host, /getAccountInfoSync\(\)/u);
  assert.match(host, /envVersion/u);

  const environment = read("apps/sdkwork-mall-mini-program/src/bootstrap/environment.ts");
  assert.match(environment, /EnvVersion === "release"/u);
  assert.match(environment, /resolveReleaseChannel/u);
  assert.match(environment, /ENV_CONFIG/u, "runtime reads the generated projection");
  assert.match(environment, /release channel is production/u, "a release mismatch is surfaced");
  assert.match(environment, /\/app\/v3\/api/u);
  assert.doesNotMatch(environment, /https:\/\/api/u, "no deploy host is baked into source");

  // The base URL is resolved once by the app entry and handed to the runtime
  // (`@sdkwork/mall-mp-core`); the transport seam only delegates, so it must not
  // re-derive the host from `getApp().globalData`.
  const appEntry = read("apps/sdkwork-mall-mini-program/src/app.ts");
  assert.match(appEntry, /readRuntimeEnv\(/u);
  assert.match(appEntry, /accountEnvVersion\(\)/u);
  assert.match(appEntry, /appApiBaseUrl/u);
  assert.doesNotMatch(appEntry, /FALLBACK_API_BASE_URL/u);
  assert.doesNotMatch(appEntry, /https:\/\/api/u);

  const transport = read("apps/sdkwork-mall-mini-program/src/services/transport.ts");
  assert.match(transport, /getMallMpRuntime\(\)\.request/u);
  assert.doesNotMatch(transport, /getApp\(/u);
  assert.doesNotMatch(transport, /wx\.request/u);
});
