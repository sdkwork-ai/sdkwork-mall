import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

/**
 * SDK transport seam.
 *
 * Authority: `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` section 8 and
 * `APP_SDK_INTEGRATION_SPEC.md` section 9. Generated SDKWork SDKs request through
 * the global `fetch`; the mini program has none, so exactly one host adapter
 * installs it over `wx.request` before any SDK client exists. Any other
 * `globalThis.fetch` writer, or a capability constructing an SDK client itself,
 * breaks that seam.
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

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .replace(/^[ \t]*\/\/.*$/gmu, "")
    .replace(/`(?:[^`\\]|\\.)*`/gu, "``")
    .replace(/'(?:[^'\\\n]|\\.)*'/gu, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/gu, '""');
}

function read(relative) {
  const absolute = path.join(miniProgram, relative);
  assert.ok(existsSync(absolute), `missing ${relative}`);
  return readFileSync(absolute, "utf8");
}

test("the runtime installs the fetch adapter before building any SDK client", () => {
  const runtime = read("packages/sdkwork-mall-mp-core/src/runtime/index.ts");
  const install = runtime.indexOf("installMpFetch(input.host.http)");
  const firstClient = runtime.indexOf("createMpIamAppSdkClient(");
  assert.ok(install > 0, "the runtime must install the adapter");
  assert.ok(firstClient > install, "clients are built after the adapter exists");
  assert.match(runtime, /from "@sdkwork\/mall-mp-host\/fetch"/u);
});

test("exactly one module writes the global fetch", () => {
  const writers = [];
  for (const file of [...collect(path.join(miniProgram, "src")), ...collect(path.join(miniProgram, "packages"))]) {
    const source = stripComments(readFileSync(file, "utf8"));
    if (/globalThis\.fetch\s*=|globalScope\.fetch\s*=/u.test(source)) {
      writers.push(path.relative(miniProgram, file).replace(/\\/gu, "/"));
    }
  }
  assert.deepEqual(writers, ["packages/sdkwork-mall-mp-host/src/fetch.ts"]);
});

test("the host exposes the adapter as its own subpath", () => {
  const pkg = JSON.parse(read("packages/sdkwork-mall-mp-host/package.json"));
  assert.equal(pkg.exports["./fetch"], "./src/fetch.ts");
});

test("capability packages never construct a domain SDK client themselves", () => {
  const offenders = [];
  for (const packageRoot of readdirSync(path.join(miniProgram, "packages"))) {
    const sourceRoot = path.join(miniProgram, "packages", packageRoot, "src");
    for (const file of collect(sourceRoot)) {
      const source = stripComments(readFileSync(file, "utf8"));
      // The composed capability *services* (`@sdkwork/im-mp-chat`) and the
      // ports types are allowed; building a generated app client is not.
      if (/from "@sdkwork\/[a-z-]+-app-sdk"/u.test(source) || /\bcreateClient\s*\(/u.test(source)) {
        offenders.push(path.relative(miniProgram, file).replace(/\\/gu, "/"));
      }
    }
  }
  assert.deepEqual(offenders, [], "Only @sdkwork/mall-mp-core may construct domain SDK clients");
});

test("no service falls back to the platform request API", () => {
  const offenders = [];
  for (const file of collect(path.join(miniProgram, "src", "services"))) {
    const source = stripComments(readFileSync(file, "utf8"));
    if (/\bwx\.request\b/u.test(source) || /getMpPlatform\(\)\.request/u.test(source)) {
      offenders.push(path.relative(miniProgram, file).replace(/\\/gu, "/"));
    }
  }
  assert.deepEqual(offenders, []);
});
