import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";

/**
 * H5 membership purchase contract.
 *
 * The member centre used to be display-only: it listed plans with an "opening
 * soon" note, so a mobile buyer could not become a member at all while the PC
 * subscription page could. H5 now charges a package through the membership
 * service and reports the resulting status.
 */
const workspaceRoot = path.resolve(import.meta.dirname, "..", "..");
const servicePath =
  "apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-membership/src/membership-service.ts";
const pagePath =
  "apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-membership/src/pages/MembershipPage.tsx";

function read(relativePath) {
  const absolutePath = path.join(workspaceRoot, relativePath);
  assert.ok(existsSync(absolutePath), `missing ${relativePath}`);
  return readFileSync(absolutePath, "utf8");
}

test("the H5 membership service purchases packages through the membership API", () => {
  const service = read(servicePath);
  assert.match(service, /export async function purchaseMallH5Membership/u);
  assert.match(service, /memberships\.purchases\.create/u);
  assert.match(service, /requireSdkworkMembershipSession/u);
  assert.match(service, /status: "completed" \| "failed" \| "pending"/u);
  assert.match(service, /memberships\.packages\.list/u);
});

test("the mini-program member centre purchases packages", () => {
  const service = read("apps/sdkwork-mall-mini-program/src/services/account-service.ts");
  assert.match(service, /export async function purchaseMembership/u);
  assert.match(service, /path: "\/memberships\/purchases"/u);
  assert.match(service, /export async function listMembershipPackages/u);

  const page = read("apps/sdkwork-mall-mini-program/src/pages/membership/index.ts");
  assert.match(page, /purchaseMembership\(\{ packageId, paymentMethod \}\)/u);
  assert.match(page, /membership\.plans\.success/u);
  assert.match(page, /membership\.plans\.pending/u);
  assert.doesNotMatch(page, /暂无可选方案/u);
});

test("the member centre offers a payable action and reports the result", () => {
  const page = read(pagePath);
  assert.match(page, /purchaseMallH5Membership\(\{ packageId, paymentMethod \}\)/u);
  assert.match(page, /listMallH5PaymentMethods/u);
  assert.match(page, /membership\.plans\.success/u);
  assert.match(page, /membership\.plans\.pending/u);
  assert.match(page, /membership\.plans\.failed/u);
  assert.doesNotMatch(page, /购买入口即将开放/u);
});
