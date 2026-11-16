import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";

/**
 * H5 share-attribution contract.
 *
 * A distributor sharing a product must send a link that carries their invite code,
 * otherwise the friend's order never attributes and the distributor earns nothing.
 * The catalog brick stays independent of the partner package through the commons
 * seam; the H5 root registers the resolver once.
 */
const workspaceRoot = path.resolve(import.meta.dirname, "..", "..", "..", "..");

function read(relativePath) {
  const absolutePath = path.join(workspaceRoot, relativePath);
  assert.ok(existsSync(absolutePath), "missing " + relativePath);
  return readFileSync(absolutePath, "utf8");
}

test("the commons seam resolves the distributor code defensively", () => {
  const seam = read(
    "apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-commons/src/share-attribution.ts",
  );
  assert.match(seam, /export function registerShareAttributionResolver/u);
  assert.match(seam, /export async function resolveShareAttribution/u);
  assert.match(seam, /return \(await resolver\(\)\)\.trim\(\)/u);
});

test("the H5 root registers the partner-backed resolver", () => {
  const app = read("apps/sdkwork-mall-h5/src/App.tsx");
  assert.match(app, /registerShareAttributionResolver\(/u);
  assert.match(app, /resolveOwnInviteCode\(\)/u);
  const service = read(
    "apps/sdkwork-mall-pc/packages/sdkwork-mall-partner-service/src/partner-service.ts",
  );
  assert.match(service, /async resolveOwnInviteCode\(\)/u);
  assert.match(service, /center\.retrieveCenter\(\)/u);
  assert.match(service, /profile\.inviteCode/u);
});

test("product detail shares append the distributor invite code", () => {
  const page = read(
    "apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-catalog/src/pages/ProductDetailPage.tsx",
  );
  assert.match(page, /import \{ resolveShareAttribution \}/u);
  assert.match(page, /await resolveShareAttribution\(\)/u);
  assert.match(page, /searchParams\.set\("invite", invite\)/u);
});
