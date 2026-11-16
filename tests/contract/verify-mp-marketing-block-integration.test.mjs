import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

/**
 * Promotion, addresses, invoices, shops and after-sales are building blocks.
 *
 * Authority: `TECH-BLOCK-INTEGRATION.md`. Each surface is owned by the mall
 * commerce block; the mall services project it and must not hand-roll a wire
 * path or re-import the raw transport seam.
 */
const workspaceRoot = path.resolve(import.meta.dirname, "..", "..");
const miniProgram = path.join(workspaceRoot, "apps", "sdkwork-mall-mini-program");

function read(relative) {
  const absolute = path.join(miniProgram, relative);
  assert.ok(existsSync(absolute), `missing ${relative}`);
  return readFileSync(absolute, "utf8");
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .replace(/^[ \t]*\/\/.*$/gmu, "")
    .replace(/`(?:[^`\\]|\\.)*`/gu, "``")
    .replace(/'(?:[^'\\\n]|\\.)*'/gu, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/gu, '""');
}

const CASES = [
  {
    file: "src/services/promotion-service.ts",
    calls: [
      "promotions\\(\\)\\.offers\\.list",
      "promotions\\(\\)\\.userCoupons\\.claims\\.create",
      "promotions\\(\\)\\.codes\\.redemptions\\.create",
    ],
    forbidden: [/path:\s*"\/promotions/u, /\/promotions\/(?:offers|user_coupon_claims|codes)/u],
    label: "promotion",
  },
  {
    file: "src/services/address-service.ts",
    calls: [
      "addresses\\(\\)\\.list",
      "addresses\\(\\)\\.create",
      "addresses\\(\\)\\.update",
      "addresses\\(\\)\\.delete",
      "addresses\\(\\)\\.defaultSelection\\.create",
    ],
    forbidden: [/path:\s*"\/addresses/u, /\/addresses\//u, /default_selection/u],
    label: "addresses",
  },
  {
    file: "src/services/invoice-service.ts",
    calls: ["invoices\\(\\)\\.mine\\.list", "invoices\\(\\)\\.create"],
    forbidden: [/path:\s*"\/invoices/u],
    label: "invoices",
  },
  {
    file: "src/services/marketing-service.ts",
    calls: [
      "commerce\\(\\)\\.shops\\.list",
      "commerce\\(\\)\\.shops\\.retrieve",
      "commerce\\(\\)\\.catalog\\.products\\.list",
      "commerce\\(\\)\\.promotions\\.offers\\.list",
      "commerce\\(\\)\\.promotions\\.offers\\.retrieve",
    ],
    forbidden: [/path:\s*"\/(?:shops|catalog|promotions)/u],
    label: "shops/activities",
  },
  {
    file: "src/services/aftersales-service.ts",
    calls: [
      "afterSales\\(\\)\\.requests\\.list",
      "afterSales\\(\\)\\.requests\\.create",
      "afterSales\\(\\)\\.requests\\.update",
      "afterSales\\(\\)\\.events\\.list",
      "afterSales\\(\\)\\.returnShipments\\.create",
    ],
    forbidden: [/path:\s*"\/after_sales/u, /\/after_sales\//u],
    label: "after-sales",
  },
  {
    file: "src/services/account-service.ts",
    calls: [
      'commerce\\(\\)\\.wallet\\.accounts\\.retrieve\\("cash"\\)',
      "commerce\\(\\)\\.wallet\\.accounts\\.points\\.retrieve",
      "commerce\\(\\)\\.wallet\\.ledgerEntries\\.list",
      "commerce\\(\\)\\.wallet\\.ledgerEntries\\.points\\.list",
      "commerce\\(\\)\\.memberships\\.current\\.status\\.retrieve",
      "commerce\\(\\)\\.memberships\\.plans\\.list",
      "commerce\\(\\)\\.memberships\\.packages\\.list",
      "commerce\\(\\)\\.memberships\\.purchases\\.create",
    ],
    forbidden: [/path:\s*"\/(?:wallet|memberships)/u, /\/wallet\/(?:accounts|ledger_entries|points)/u],
    label: "wallet/membership",
  },
];

for (const entry of CASES) {
  test(`${entry.label} projects its commerce block`, () => {
    const service = read(entry.file);
    assert.match(service, /getMallMpRuntime\(\)/u, `${entry.label}: reads the runtime`);
    for (const call of entry.calls) {
      assert.match(service, new RegExp(call, "u"), `${entry.label}: missing block call ${call}`);
    }
    const source = stripComments(service);
    for (const pattern of entry.forbidden) {
      assert.doesNotMatch(source, pattern, `${entry.label}: hand-rolled endpoint ${pattern}`);
    }
    assert.doesNotMatch(source, /from "\.\/transport"/u, `${entry.label}: raw transport import returned`);
  });
}

test("the after-sales commands carry an idempotency key", () => {
  const service = read("src/services/aftersales-service.ts");
  assert.match(service, /createMpIdempotencyParams/u);
  assert.match(service, /createMpIdempotencyParams\(\),\s*\n\s*\)/u);
});
