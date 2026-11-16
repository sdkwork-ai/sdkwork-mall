import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

/**
 * PC/H5 credential-entry handoff contract (APP_ACCESS_TOKEN_SPEC.md §2/§4,
 * IAM_CREDENTIAL_ENTRY_SPEC.md §4).
 *
 * Every manifest-bearing browser surface must carry the committed public
 * application access token in all ten per-scope profile files, and its Vite
 * config must hand that token to the renderer for every build and for every
 * non-development serve. A renderer that ships without it fails at the first
 * authenticated call with the runtime error
 * `access-token-only request requires Access-Token before request dispatch`.
 */
const workspaceRoot = path.resolve(import.meta.dirname, "..", "..");

const DEPLOYMENT_PROFILES = ["standalone", "cloud"];
const LIFECYCLES = ["development", "test", "staging", "demo", "production"];

const SURFACES = [
  { appId: "sdkwork-mall-pc", root: "apps/sdkwork-mall-pc" },
  { appId: "sdkwork-mall-h5", root: "apps/sdkwork-mall-h5" },
];

function read(relativePath) {
  const absolutePath = path.join(workspaceRoot, relativePath);
  assert.ok(existsSync(absolutePath), `missing ${relativePath}`);
  return readFileSync(absolutePath, "utf8");
}

function decodeSegment(segment) {
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
}

function readProfileToken(appRoot, profileId) {
  const document = read(`${appRoot}/.env.${profileId}`);
  const values = document
    .split(/\r?\n/u)
    .filter((line) => line.startsWith("SDKWORK_ACCESS_TOKEN="))
    .map((line) => line.slice("SDKWORK_ACCESS_TOKEN=".length).trim());
  assert.equal(values.length, 1, `${appRoot}/.env.${profileId}: exactly one SDKWORK_ACCESS_TOKEN`);
  assert.ok(values[0], `${appRoot}/.env.${profileId}: SDKWORK_ACCESS_TOKEN must be non-empty`);
  return values[0];
}

test("PC and H5 declare a unique, bootstrap-ready application identity", () => {
  const appIds = new Set();
  for (const { appId, root } of SURFACES) {
    const manifest = JSON.parse(read(`${root}/agent.app.config.json`));
    assert.equal(manifest.backend?.appId, appId, `${root}: backend.appId`);
    assert.ok(
      Array.isArray(manifest.backend?.accessTokenPermissionScope)
        && manifest.backend.accessTokenPermissionScope.length > 0,
      `${root}: backend.accessTokenPermissionScope must be a non-empty array for IAM bootstrap`,
    );
    appIds.add(appId);
  }
  assert.equal(appIds.size, SURFACES.length, "each credential-entry surface needs a unique appId");

  // The repository root registers the server application too, so it must carry
  // the same bootstrap field (IAM_APPLICATION_BOOTSTRAP_SPEC.md §4).
  const rootManifest = JSON.parse(read("agent.app.config.json"));
  assert.ok(
    Array.isArray(rootManifest.backend?.accessTokenPermissionScope)
      && rootManifest.backend.accessTokenPermissionScope.length > 0,
    "repository root manifest: backend.accessTokenPermissionScope must be a non-empty array",
  );
});

test("every PC/H5 profile file carries an identity-matched public application token", () => {
  for (const { appId, root } of SURFACES) {
    const manifest = JSON.parse(read(`${root}/agent.app.config.json`));
    for (const deploymentProfile of DEPLOYMENT_PROFILES) {
      for (const environment of LIFECYCLES) {
        const profileId = `${deploymentProfile}.${environment}`;
        const token = readProfileToken(root, profileId);
        const parts = token.split(".");
        assert.equal(parts.length, 3, `${root} ${profileId}: JWT compact serialization`);
        assert.equal(parts[2], "public", `${root} ${profileId}: public signature segment`);

        const header = decodeSegment(parts[0]);
        assert.equal(header.alg, "none", `${root} ${profileId}: header alg`);
        assert.equal(header.kid, "public-app-token", `${root} ${profileId}: header kid`);

        const claims = decodeSegment(parts[1]);
        assert.equal(claims.token_class, "application", `${root} ${profileId}: token_class`);
        assert.equal(claims.token_type, "access", `${root} ${profileId}: token_type`);
        assert.equal(claims.app_id, manifest.backend.appId, `${root} ${profileId}: app_id claim`);
        assert.equal(claims.aud, manifest.backend.appId, `${root} ${profileId}: aud claim`);
        assert.equal(
          String(claims.tenant_id),
          String(manifest.backend.tenantId),
          `${root} ${profileId}: tenant_id claim`,
        );
        assert.equal(
          String(claims.organization_id),
          String(manifest.backend.organizationId),
          `${root} ${profileId}: organization_id claim`,
        );
        assert.equal(claims.environment, environment, `${root} ${profileId}: environment claim`);
        assert.equal(
          claims.deployment_profile,
          deploymentProfile,
          `${root} ${profileId}: deployment_profile claim`,
        );
        assert.equal(
          claims.login_scope,
          String(manifest.backend.organizationId) === "0" ? "TENANT" : "ORGANIZATION",
          `${root} ${profileId}: login_scope claim`,
        );
        assert.deepEqual(
          claims.permission_scope,
          manifest.backend.accessTokenPermissionScope,
          `${root} ${profileId}: permission_scope claim`,
        );
        assert.ok(
          typeof claims.exp === "number" && claims.exp * 1000 > Date.now(),
          `${root} ${profileId}: rotation deadline must be in the future`,
        );
      }
    }
  }
});

test("PC/H5 vite configs hand the public token to every build and non-dev serve", () => {
  for (const { root } of SURFACES) {
    const config = read(`${root}/vite.config.ts`);
    assert.match(
      config,
      /createSdkworkPublicApplicationAccessTokenVitePlugin/u,
      `${root}: missing the public application access token plugin`,
    );
    assert.match(
      config,
      /command === "serve" && environment === "development"/u,
      `${root}: only development serve may use the private bootstrap handoff`,
    );
    assert.match(
      config,
      /resolveViteEnvironment\(mode, process\.env\)/u,
      `${root}: the plugin environment must be the normalized lifecycle, never raw Vite mode`,
    );
    assert.doesNotMatch(
      config,
      /environment:\s*mode\b/u,
      `${root}: raw Vite mode must never be passed as the lifecycle environment`,
    );
    assert.doesNotMatch(
      config,
      /define:\s*\{[^}]*process\.env\.SDKWORK_ACCESS_TOKEN/u,
      `${root}: the token must not be passed through a Vite define entry`,
    );
  }
});
