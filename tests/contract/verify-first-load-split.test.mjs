import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

/**
 * First-load split contract (H5).
 *
 * IM notifications and drive uploads are only reachable from lazy routes, so
 * their SDK clients must not be imported statically by the bootstrap — that
 * would pull them into the entry chunk and delay first paint.
 */
const workspaceRoot = path.resolve(import.meta.dirname, "..", "..");

function read(relativePath) {
  const absolutePath = path.join(workspaceRoot, relativePath);
  assert.ok(existsSync(absolutePath), `missing ${relativePath}`);
  return readFileSync(absolutePath, "utf8");
}

test("the H5 runtime boot does not statically import the IM or drive clients", () => {
  const runtime = read("apps/sdkwork-mall-h5/src/bootstrap/runtime.ts");
  assert.doesNotMatch(runtime, /from "@sdkwork\/drive-upload-image-core"/u);
  assert.doesNotMatch(runtime, /from "\.\/driveClient"/u);
  assert.match(runtime, /import\("@sdkwork\/drive-upload-image-core"\)/u);
  assert.match(runtime, /import\("\.\/driveClient"\)/u);

  const iamRuntime = read("apps/sdkwork-mall-h5/src/bootstrap/iamRuntime.ts");
  assert.match(iamRuntime, /await import\("@sdkwork\/im-app-sdk"\)/u);
  assert.doesNotMatch(iamRuntime, /import \{ createClient as createImAppClient \}/u);

  const imProviders = read("apps/sdkwork-mall-h5/src/bootstrap/imProviders.ts");
  assert.match(imProviders, /loadSdkworkMallH5ImAppClient/u);
  assert.doesNotMatch(imProviders, /sdkClients\.imAppClient/u);
});

test("the PC runtime boot does not statically import the IM client", () => {
  const iamRuntime = read("apps/sdkwork-mall-pc/src/bootstrap/iamRuntime.ts");
  assert.match(iamRuntime, /await import\("@sdkwork\/im-app-sdk"\)/u);
  assert.doesNotMatch(iamRuntime, /import \{ createClient as createImAppClient \}/u);

  const remote = read("apps/sdkwork-mall-pc/src/bootstrap/buyer-commerce-remote.ts");
  assert.match(remote, /loadSdkworkMallPcImAppClient/u);
  assert.doesNotMatch(remote, /sdkClients\.imAppClient/u);

  const inventory = read("apps/sdkwork-mall-pc/src/bootstrap/sdkClients.ts");
  assert.doesNotMatch(inventory, /imAppClient:/u);
});

test("the H5 SDK inventory no longer carries a static IM client", () => {
  const inventory = read("apps/sdkwork-mall-h5/src/bootstrap/sdkClients.ts");
  assert.doesNotMatch(inventory, /imAppClient:/u);
  assert.match(inventory, /"sdkwork-im-app-sdk"/u);
});
