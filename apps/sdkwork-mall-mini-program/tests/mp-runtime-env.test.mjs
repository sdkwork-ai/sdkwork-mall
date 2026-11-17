import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";

/**
 * Mini-program runtime env contract (APP_RUNTIME_ENV_SPEC.md §3.1).
 *
 * A packaged surface ships one build per lifecycle: the committed client-env
 * profile is the authority, the canonical generator projects it into a typed
 * EnvConfig at build time, and runtime code imports that module instead of
 * parsing JSON or baking deploy URLs into constants.
 */
const appRoot = path.resolve(import.meta.dirname, "..");
const repoRoot = path.resolve(appRoot, "..", "..");
const profiles = [
  "standalone.development", "standalone.test", "standalone.staging", "standalone.demo", "standalone.production",
  "cloud.development", "cloud.test", "cloud.staging", "cloud.demo", "cloud.production",
];

// IAM makes the deploy application the identity of every access token, so the
// committed `app_id`/`aud` claims are this installation's anchor, never the
// manifest runtime id (APP_ACCESS_TOKEN_SPEC.md section 3.1.1). With no anchor on
// a source checkout the committed profiles carry the explicit placeholder.
const DEPLOY_APPLICATION_ID_ENV = "SDKWORK_DEPLOY_APPLICATION_ID";
const PENDING_DEPLOY_APPLICATION_ID = "__SDKWORK_DEPLOY_APPLICATION_ID__";

function expectedTokenAppId() {
  return String(process.env[DEPLOY_APPLICATION_ID_ENV] ?? "").trim()
    || PENDING_DEPLOY_APPLICATION_ID;
}

function read(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8").replace(/^\uFEFF/u, "");
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

test("the mini-program surface is declared with the canonical env bindings", () => {
  const config = readJson("etc/client-env.materialization.json");
  const surface = config.surfaces.find((entry) => entry.id === "sdkwork-mall-mini-program");
  assert.ok(surface, "the mini-program surface must exist");
  assert.equal(surface.format, "mini-program");
  assert.equal(surface.runtimeTarget, "mini-program");
  assert.equal(surface.accessToken.appIdEnv, "SDKWORK_DEPLOY_APPLICATION_ID");
  for (const key of [
    "SDKWORK_MALL_MINI_PROGRAM_APPLICATION_PUBLIC_HTTP_URL",
    "SDKWORK_MALL_MINI_PROGRAM_PLATFORM_API_GATEWAY_HTTP_URL",
  ]) {
    assert.ok(surface.requiredOutputKeys.includes(key), `requiredOutputKeys must include ${key}`);
    assert.ok(surface.bindings[key], `bindings must declare ${key}`);
  }
});

test("every committed mini-program profile carries the transport URLs and its own token", () => {
  for (const profile of profiles) {
    const values = readJson(`apps/sdkwork-mall-mini-program/config/mini-program/runtime-env.${profile}.json`);
    assert.match(values.SDKWORK_MALL_MINI_PROGRAM_APPLICATION_PUBLIC_HTTP_URL, /^https:\/\/[a-z0-9.-]+$/u, profile);
    assert.match(values.SDKWORK_MALL_MINI_PROGRAM_PLATFORM_API_GATEWAY_HTTP_URL, /^https:\/\/[a-z0-9.-]+$/u, profile);
    assert.equal(values.SDKWORK_PROFILE_ID, profile);
    assert.equal(values.SDKWORK_RUNTIME_TARGET, "mini-program");
    const payload = JSON.parse(Buffer.from(String(values.SDKWORK_ACCESS_TOKEN).split(".")[1], "base64url").toString("utf8"));
    assert.equal(payload.app_id, expectedTokenAppId());
    assert.equal(`${payload.deployment_profile}.${payload.environment}`, profile);
  }
});

test("the committed EnvConfig is the canonical projection of the default profile", () => {
  const generated = read("apps/sdkwork-mall-mini-program/src/bootstrap/runtime-env.generated.ts");
  assert.match(generated, /GENERATED FILE - DO NOT EDIT/u);
  assert.match(generated, /generate-app-env-config\.mjs/u);
  assert.match(generated, /export const ENV_CONFIG: AppEnvConfig = \{/u);
  const values = readJson("apps/sdkwork-mall-mini-program/config/mini-program/runtime-env.cloud.development.json");
  assert.match(generated, new RegExp(`profileId: "${values.SDKWORK_PROFILE_ID}"`, "u"));
  assert.match(generated, new RegExp(`platformApiGatewayHttpUrl: "${values.SDKWORK_MALL_MINI_PROGRAM_PLATFORM_API_GATEWAY_HTTP_URL}"`, "u"));
  assert.match(generated, new RegExp(`applicationPublicHttpUrl: "${values.SDKWORK_MALL_MINI_PROGRAM_APPLICATION_PUBLIC_HTTP_URL}"`, "u"));
});

test("runtime code imports the projection and never bakes a deploy host", () => {
  const environment = read("apps/sdkwork-mall-mini-program/src/bootstrap/environment.ts");
  assert.match(environment, /import \{ ENV_CONFIG \} from "\.\/runtime-env\.generated"/u);
  assert.doesNotMatch(environment, /https:\/\/api/u, "no deploy URL may live in runtime source");
  assert.doesNotMatch(environment, /RUNTIME_ENV\./u, "runtime must read the generated projection");
  const app = read("apps/sdkwork-mall-mini-program/src/app.ts");
  assert.doesNotMatch(app, /FALLBACK_API_BASE_URL/u);
  assert.doesNotMatch(app, /https:\/\/api/u);
});

test("the build projects through the canonical generator and ships per-environment commands", () => {
  const buildRuntime = read("apps/sdkwork-mall-mini-program/scripts/build-runtime.mjs");
  assert.match(buildRuntime, /generate-app-env-config\.mjs/u);
  assert.match(buildRuntime, /"--app-id", appId/u);
  assert.match(buildRuntime, /--check/u);
  const pkg = readJson("apps/sdkwork-mall-mini-program/package.json");
  assert.match(pkg.scripts["build:mp:prod"], /--profile cloud\.production/u);
  assert.match(pkg.scripts["build:mp:dev"], /--profile cloud\.development/u);
  assert.match(pkg.scripts["env:check"], /--check/u);
  const rootPkg = readJson("package.json");
  assert.equal(rootPkg.scripts["env:materialize"], "pnpm run workflow:materialize-topology-env && pnpm run workflow:materialize-client-env");
  assert.match(rootPkg.scripts["build:mp:prod"], /build:mp:prod/u);
});
