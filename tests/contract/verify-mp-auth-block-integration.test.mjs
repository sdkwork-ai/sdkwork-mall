import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

/**
 * Authentication is a building block, not a mall feature.
 *
 * Authority: `IAM_LOGIN_INTEGRATION_SPEC.md` sections 3-5 and
 * `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` section 6. The mini program composes
 * SDKWork IAM: credential grants run through `@sdkwork/iam-app-sdk`
 * (`auth.sessions`), identity through `iam.users.current`, and no mall service
 * owns a hand-written `/auth/*` or `/iam/*` wire path.
 *
 * This guard is static on purpose: a duplicated endpoint passes typecheck and
 * only diverges from the IAM contract at runtime.
 */
const workspaceRoot = path.resolve(import.meta.dirname, "..", "..");
const miniProgram = path.join(workspaceRoot, "apps", "sdkwork-mall-mini-program");
const SKIP_DIRS = new Set(["dist", "build", "node_modules", "coverage"]);

function collect(directory) {
  const files = [];
  if (!existsSync(directory)) {
    return files;
  }
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) {
      continue;
    }
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        files.push(...collect(entryPath));
      }
    } else if (entry.name.endsWith(".ts")) {
      files.push(entryPath);
    }
  }
  return files;
}

/** Removes comments so prose about the endpoint cannot trip the guard. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/^[ \t]*\/\/.*$/gmu, "");
}

function read(relative) {
  const absolute = path.join(miniProgram, relative);
  assert.ok(existsSync(absolute), `missing ${relative}`);
  return readFileSync(absolute, "utf8");
}

test("no mall service hand-rolls an IAM wire endpoint", () => {
  const offenders = [];
  for (const file of [...collect(path.join(miniProgram, "src")), ...collect(path.join(miniProgram, "packages"))]) {
    const source = stripComments(readFileSync(file, "utf8"));
    if (/path:\s*[`"']\/(?:auth|iam)\//u.test(source)) {
      offenders.push(path.relative(miniProgram, file).replace(/\\/gu, "/"));
    }
  }
  assert.deepEqual(offenders, [], "Challenge/identity calls belong to @sdkwork/iam-app-sdk, not a mall endpoint");
});

test("the account capability signs in through the IAM session contract", () => {
  const service = read("packages/sdkwork-mall-mp-auth/src/services/auth-service.ts");
  assert.match(service, /iamClient\.auth\.sessions\.create/u, "credential grant is an IAM SDK operation");
  assert.match(service, /grantType: "password"/u, "the password grant is declared, not implied");
  assert.match(service, /iamClient\.iam\.users\.current\.retrieve/u, "identity comes from iam.users.current");
  assert.match(service, /iamClient\.iam\.users\.current\.password\.update/u, "password change is an IAM credential operation");
  // The capability receives clients; it must not open its own transport.
  assert.doesNotMatch(service, /runtime\.request/u, "the account capability owns no request seam");
  assert.doesNotMatch(service, /\/auth\/sessions/u, "no hand-written session endpoint");
});

test("the IAM client is built from the generated app SDK in one place", () => {
  const sdk = read("packages/sdkwork-mall-mp-core/src/sdk/index.ts");
  assert.match(sdk, /from "@sdkwork\/iam-app-sdk"/u);
  assert.match(sdk, /createMpIamAppSdkClient/u);
  assert.doesNotMatch(sdk, /path: "\/auth/u, "the client is the only IAM wire surface");
});

test("the profile screen reads identity from IAM, not a mall summary endpoint", () => {
  const profile = read("src/services/profile-service.ts");
  assert.match(profile, /createMpAuthService/u, "identity is projected from the account capability");
  assert.match(profile, /loadCurrentUser/u, "iam.users.current is the identity source");
  assert.doesNotMatch(stripComments(profile), /\/accounts\/current\/summary/u, "no mall-owned account summary");
});

test("the security screen writes credentials through the IAM block", () => {
  const page = read("src/pages/security/index.ts");
  assert.match(page, /changePassword/u, "the form calls the capability");
  const service = read("src/services/profile-service.ts");
  assert.match(service, /changePassword/u);
  const template = read("src/pages/security/index.wxml");
  assert.match(template, /submitPassword/u, "the credential form is wired, not a placeholder");
});
