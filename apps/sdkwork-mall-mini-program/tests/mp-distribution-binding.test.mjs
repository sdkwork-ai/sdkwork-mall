/**
 * Distribution binding guard.
 *
 * A shared product link or QR carries `invite=<code>`; both roots must remember it
 * and bind the buyer through the partner app API (`customerBindings.create`) so
 * orders attribute to the distributor. This guard fails when the wiring is dropped
 * on either root.
 */
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(appRoot, "..", "..");
const read = (relative) => readFileSync(relative, "utf8");

test("the mini program captures invite codes and binds through the app API", () => {
  const service = read(path.join(appRoot, "src/services/partner-service.ts"));
  assert.match(service, /customerBindings\.create/u, "partner service must call the binding operation");
  const invite = read(path.join(appRoot, "src/services/invite-service.ts"));
  assert.match(invite, /PENDING_INVITE_KEY/u);
  assert.match(invite, /bindPartnerCustomerByInviteCode/u);
  const product = read(path.join(appRoot, "src/pages/product/index.ts"));
  assert.match(product, /captureInviteCode\(options\.invite\)/u);
  const login = read(path.join(appRoot, "src/pages/login/index.ts"));
  assert.match(login, /bindPendingInvite\(\)/u, "sign-in must flush the pending binding");
});

test("the H5 root binds the invite code through the shared partner service", () => {
  const port = read(
    path.join(repoRoot, "apps/sdkwork-mall-pc/packages/sdkwork-mall-partner-service/src/partner-sdk-port.ts"),
  );
  assert.match(port, /customerBindings/u);
  const service = read(
    path.join(repoRoot, "apps/sdkwork-mall-pc/packages/sdkwork-mall-partner-service/src/partner-service.ts"),
  );
  assert.match(service, /bindCustomerByInviteCode/u);
  const shell = read(path.join(repoRoot, "apps/sdkwork-mall-h5/src/App.tsx"));
  assert.match(shell, /sdkwork-mall-h5-pending-invite/u, "the shell must persist the invite code");
  assert.match(shell, /bindCustomerByInviteCode\(invite\)/u, "the shell must bind once authenticated");
});
