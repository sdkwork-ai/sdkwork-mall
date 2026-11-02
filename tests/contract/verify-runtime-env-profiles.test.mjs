import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

/**
 * Runtime environment matrix contract.
 *
 * Every client ships per-environment config files whose identity must match the
 * file name: a `production` file must not report `development`, and its API host
 * must belong to the production family. A build that silently targets `api-dev`
 * from a production profile is a release blocker.
 */
const workspaceRoot = path.resolve(import.meta.dirname, "..", "..");

const FLUTTER_ENV_ROOT = "apps/sdkwork-mall-flutter-mobile/env";
const BROWSER_ENV_ROOTS = [
  "apps/sdkwork-mall-h5/config/browser",
  "apps/sdkwork-mall-pc/config/browser",
];

const HOST_BY_ENVIRONMENT = {
  demo: /^https:\/\/api-demo\.sdkwork\.com\/app\/v3\/api$/u,
  development: /^https:\/\/api-dev\.sdkwork\.com\/app\/v3\/api$/u,
  production: /^https:\/\/api\.sdkwork\.com\/app\/v3\/api$/u,
  staging: /^http:\/\/127\.0\.0\.1:18082\/app\/v3\/api$/u,
  test: /^http:\/\/127\.0\.0\.1:18082\/app\/v3\/api$/u,
};

function listJsonFiles(relativeDir) {
  const absoluteDir = path.join(workspaceRoot, relativeDir);
  assert.ok(existsSync(absoluteDir), `missing ${relativeDir}`);
  return readdirSync(absoluteDir).filter((name) => name.endsWith(".json"));
}

test("the Flutter environment matrix reports matching identities and hosts", () => {
  const failures = [];
  for (const fileName of listJsonFiles(FLUTTER_ENV_ROOT)) {
    const match = /^sdkwork\.(standalone|cloud)\.(development|test|staging|demo|production)\.json$/u.exec(
      fileName,
    );
    if (!match) {
      continue;
    }
    const [, profile, environment] = match;
    const values = JSON.parse(
      readFileSync(path.join(workspaceRoot, FLUTTER_ENV_ROOT, fileName), "utf8"),
    );
    if (values.SDKWORK_ENVIRONMENT !== environment) {
      failures.push(`${fileName}: environment ${values.SDKWORK_ENVIRONMENT} != ${environment}`);
    }
    if (values.SDKWORK_DEPLOYMENT_PROFILE !== profile) {
      failures.push(`${fileName}: profile ${values.SDKWORK_DEPLOYMENT_PROFILE} != ${profile}`);
    }
    const hostPattern = HOST_BY_ENVIRONMENT[environment];
    if (!hostPattern.test(values.SDKWORK_COMMERCE_APP_API_BASE_URL)) {
      failures.push(`${fileName}: unexpected host ${values.SDKWORK_COMMERCE_APP_API_BASE_URL}`);
    }
  }
  assert.deepEqual(failures, [], failures.join("\n"));
});

test("the browser runtime-env files report the environment their name declares", () => {
  const failures = [];
  for (const root of BROWSER_ENV_ROOTS) {
    for (const fileName of listJsonFiles(root)) {
      const match = /^runtime-env\.(standalone|cloud)\.(development|test|staging|demo|production)\.json$/u.exec(
        fileName,
      );
      if (!match) {
        continue;
      }
      const [, profile, environment] = match;
      const values = JSON.parse(readFileSync(path.join(workspaceRoot, root, fileName), "utf8"));
      if (values.environment !== environment) {
        failures.push(`${root}/${fileName}: environment ${values.environment} != ${environment}`);
      }
      if (values.deploymentProfile !== profile) {
        failures.push(`${root}/${fileName}: profile ${values.deploymentProfile} != ${profile}`);
      }
    }
  }
  assert.deepEqual(failures, [], failures.join("\n"));
});

test("browser runtime-env documents never carry loopback origins", () => {
  const failures = [];
  const collect = (value, label, out) => {
    if (typeof value === "string") {
      if (/127\.0\.0\.1|localhost/u.test(value)) {
        out.push(`${label}=${value}`);
      }
      return;
    }
    if (value && typeof value === "object") {
      for (const [key, entry] of Object.entries(value)) {
        collect(entry, `${label}.${key}`, out);
      }
    }
  };
  for (const root of BROWSER_ENV_ROOTS) {
    for (const fileName of listJsonFiles(root)) {
      if (!fileName.startsWith("runtime-env.")) {
        continue;
      }
      const values = JSON.parse(readFileSync(path.join(workspaceRoot, root, fileName), "utf8"));
      collect(values, `${root}/${fileName}`, failures);
    }
  }
  assert.deepEqual(failures, [], failures.join("\n"));
});

test("cloud production documents target the production API origin", () => {
  for (const root of BROWSER_ENV_ROOTS) {
    const values = JSON.parse(
      readFileSync(path.join(workspaceRoot, root, "runtime-env.cloud.production.json"), "utf8"),
    );
    assert.equal(values.appApiBaseUrl, "https://api.sdkwork.com", `${root} appApiBaseUrl`);
    assert.equal(values.sdkBaseUrl, "https://api.sdkwork.com", `${root} sdkBaseUrl`);
    assert.ok(
      Array.isArray(values.cloudApiBaseUrls) &&
        values.cloudApiBaseUrls.includes("https://api.sdkwork.com"),
      `${root} cloudApiBaseUrls`,
    );
  }
});

test("both browser boots install the runtime-env bridge before rendering", () => {
  for (const mainPath of [
    "apps/sdkwork-mall-h5/src/main.tsx",
    "apps/sdkwork-mall-pc/src/main.tsx",
  ]) {
    const main = readFileSync(path.join(workspaceRoot, mainPath), "utf8");
    assert.match(main, /fetch\("\/runtime-env\.json"/u, `${mainPath} must fetch the runtime document`);
    assert.match(main, /SDKWORK_RUNTIME_ENV/u, `${mainPath} must publish the bridge global`);
    assert.match(main, /await import\("\.\/App"\)/u, `${mainPath} must render after installing the bridge`);
  }
});
