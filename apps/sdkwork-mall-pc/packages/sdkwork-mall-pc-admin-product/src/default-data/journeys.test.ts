import { describe, expect, it } from "vitest";

import {
  MALL_DEFAULT_DATA_JOURNEYS,
  reportMallDefaultDataJourneys,
} from "./journeys";
import type { MallDefaultDataCheck } from "./verify";

const MOUNTED_STATIC_PATHS = new Set([
  "/",
  "/categories",
  "/search",
  "/cart",
  "/checkout",
  "/activity",
  "/buyer/membership",
  "/buyer/coupons",
  "/buyer/orders",
  "/buyer/after-sales",
  "/admin/products",
  "/admin/shops",
  "/admin/marketing",
]);

const KNOWN_CHECK_IDS = new Set([
  "catalog.categories",
  "catalog.coverage",
  "catalog.products",
  "catalog.skus",
  "cms.storefront",
  "membership.package-groups",
  "membership.packages",
  "membership.plans",
  "promotions.offers",
  "shops.stores",
]);

function check(id: string, status: MallDefaultDataCheck["status"]): MallDefaultDataCheck {
  return { id, label: id, status, expected: 1, actual: status === "fail" ? 0 : 1, missing: [] };
}

describe("mall default data journey guide", () => {
  it("covers the end-to-end walkthrough with unique ids", () => {
    const ids = MALL_DEFAULT_DATA_JOURNEYS.map((journey) => journey.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([
      "storefront.home",
      "storefront.categories",
      "storefront.search",
      "storefront.cart",
      "storefront.checkout",
      "storefront.activity",
      "buyer.membership",
      "buyer.coupons",
      "buyer.orders",
      "buyer.after-sales",
      "admin.products",
      "admin.shops",
      "admin.marketing",
    ]);
  });

  it("only links to mounted static routes", () => {
    for (const journey of MALL_DEFAULT_DATA_JOURNEYS) {
      expect(MOUNTED_STATIC_PATHS.has(journey.href)).toBe(true);
    }
  });

  it("only requires checks the verifier actually produces", () => {
    for (const journey of MALL_DEFAULT_DATA_JOURNEYS) {
      for (const requirement of journey.requires) {
        expect(KNOWN_CHECK_IDS.has(requirement)).toBe(true);
      }
    }
  });

  it("marks every journey ready when all checks pass", () => {
    const checks = [...KNOWN_CHECK_IDS].map((id) => check(id, "pass"));
    const reports = reportMallDefaultDataJourneys({ checks });
    expect(reports.every((report) => report.status === "ready")).toBe(true);
    expect(reports.every((report) => report.missing.length === 0)).toBe(true);
  });

  it("marks partial data as partial and missing data as blocked", () => {
    const checks = [
      check("catalog.categories", "pass"),
      check("catalog.products", "warn"),
      check("catalog.skus", "warn"),
      check("catalog.coverage", "warn"),
      check("cms.storefront", "pass"),
      check("shops.stores", "pass"),
      check("promotions.offers", "fail"),
      check("membership.plans", "fail"),
      check("membership.package-groups", "fail"),
      check("membership.packages", "fail"),
    ];
    const reports = reportMallDefaultDataJourneys({ checks });
    const byId = new Map(reports.map((report) => [report.id, report]));
    expect(byId.get("storefront.home")?.status).toBe("partial");
    expect(byId.get("storefront.activity")?.status).toBe("blocked");
    expect(byId.get("buyer.membership")?.status).toBe("blocked");
    expect(byId.get("admin.shops")?.status).toBe("ready");
  });

  it("keeps transactional journeys data-independent", () => {
    const reports = reportMallDefaultDataJourneys({ checks: [] });
    const byId = new Map(reports.map((report) => [report.id, report]));
    expect(byId.get("buyer.orders")?.status).toBe("ready");
    expect(byId.get("buyer.orders")?.transactional).toBe(true);
    expect(byId.get("buyer.after-sales")?.status).toBe("ready");
    expect(byId.get("storefront.home")?.status).toBe("blocked");
  });
});
