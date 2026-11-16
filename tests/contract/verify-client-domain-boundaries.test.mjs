import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

/**
 * Client domain boundaries.
 *
 * Authority: `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` section 6 and the client
 * domain ownership rule: authentication belongs to SDKWork IAM and messaging to
 * SDKWork IM. A chat/notification implementation must never appear in the IAM
 * mini-program, and the mall capability packages must not cross the line in
 * either direction.
 *
 * This is a static guard: the build cannot catch "the auth package grew a chat
 * client" or "the message package opened a session of its own".
 */
const workspaceRoot = path.resolve(import.meta.dirname, "..", "..");
const iamMiniProgram = path.resolve(workspaceRoot, "..", "sdkwork-iam", "apps", "sdkwork-iam-mini-program");
const mallMiniProgram = path.join(workspaceRoot, "apps", "sdkwork-mall-mini-program");

const SKIP_DIRS = new Set(["dist", "build", "node_modules", "coverage", ".git", "target"]);

function collectTypeScript(directory) {
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
      if (SKIP_DIRS.has(entry.name)) {
        continue;
      }
      files.push(...collectTypeScript(entryPath));
    } else if (entry.name.endsWith(".ts")) {
      files.push(entryPath);
    }
  }
  return files;
}

/** Removes comments and string literals so prose cannot trip the guard. */
function stripProse(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .replace(/^[ \t]*\/\/.*$/gmu, "")
    .replace(/`(?:[^`\\]|\\.)*`/gu, "``")
    .replace(/'(?:[^'\\\n]|\\.)*'/gu, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/gu, '""');
}

function findViolations(files, patterns) {
  const violations = [];
  for (const file of files) {
    const source = stripProse(readFileSync(file, "utf8"));
    for (const [label, pattern] of patterns) {
      if (pattern.test(source)) {
        violations.push(`${path.relative(workspaceRoot, file).replace(/\\/gu, "/")} → ${label}`);
      }
    }
  }
  return violations;
}

/** Messaging surfaces that must never live in the IAM mini-program. */
const CHAT_SURFACES = [
  ["IM chat transport", /\/im\/chat/u],
  ["IM conversation read", /conversations\.(?:list|listMessages|postText|updateReadCursor)/u],
  ["IM mini-program package", /@sdkwork\/im-mp/u],
  ["IM chat message model", /\bchatMessages?\b/u],
  ["IM realtime plane", /\bchatRealtime/u],
];

test("the IAM mini-program carries no chat or messaging implementation", (t) => {
  const packagesRoot = path.join(iamMiniProgram, "packages");
  if (!existsSync(packagesRoot)) {
    t.skip("sdkwork-iam checkout is not available in this workspace");
    return;
  }
  // Auth packages may talk about sessions, credentials and identity — never
  // about conversations, messages or the IM transport.
  const files = collectTypeScript(packagesRoot);
  assert.ok(files.length > 0, "expected IAM mini-program package sources");
  assert.deepEqual(
    findViolations(files, CHAT_SURFACES),
    [],
    "Message/chat code must live in sdkwork-im, not in sdkwork-iam",
  );
});

test("the mall account capability carries no messaging surface", () => {
  const files = collectTypeScript(path.join(mallMiniProgram, "packages", "sdkwork-mall-mp-auth", "src"));
  assert.ok(files.length > 0, "expected the account capability sources");
  assert.deepEqual(
    findViolations(files, [
      ["IM app SDK", /@sdkwork\/im-/u],
      ["IM services", /@sdkwork\/im-mp-chat/u],
      ["IM chat transport", /\/im\/chat/u],
      ["conversation model", /\bconversations?\b/u],
      ["notification model", /\bnotifications?\b/u],
    ]),
    [],
    "The account capability must only own sign-in and session recovery",
  );
});

test("the mall messaging capability carries no authentication logic", () => {
  const files = collectTypeScript(path.join(mallMiniProgram, "packages", "sdkwork-mall-mp-im", "src"));
  assert.ok(files.length > 0, "expected the messaging capability sources");
  assert.deepEqual(
    findViolations(files, [
      ["IAM app SDK", /@sdkwork\/iam-/u],
      ["session access", /getMallMpRuntime\(\)\.session/u],
      ["session manager", /\bauthManager\b/u],
      ["login flow", /\bloginWith/u],
    ]),
    [],
    "The messaging capability must receive the signed-in user id, not own a session",
  );
});

test("the app entry wires the two domains separately", () => {
  const entry = readFileSync(path.join(mallMiniProgram, "src", "app.ts"), "utf8");
  assert.match(entry, /createMpAuthService/u, "auth wiring stays in the account service");
  assert.match(entry, /createMpImServices/u, "messaging wiring stays in the IM services");
  // The session lifecycle is IAM's; the entry must not open a chat plane itself.
  assert.doesNotMatch(stripProse(entry), /\/im\/chat/u);
});
