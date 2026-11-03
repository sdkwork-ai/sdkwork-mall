import { beforeEach, describe, expect, it } from "vitest";

import {
  configureMallDefaultDataProvider,
  resolveMallDefaultDataSlice,
  runMallDefaultDataInitialization,
} from "./default-data-service";
import { buildMallSpuNo } from "./plan";
import { selectMallDefaultDataSlice } from "./profiles";
import { zhCnDefaultDataset } from "./dataset";
import { createFakeMallDefaultDataPort } from "../../tests/default-data-fake-port";

function expectedCreatedForDemo(): number {
  const slice = selectMallDefaultDataSlice(zhCnDefaultDataset, "demo");
  const categories = slice.categories.reduce(
    (total, category) => total + 1 + category.children.length,
    0,
  );
  const skus = slice.products.reduce((total, product) => total + product.skus.length, 0);
  return (
    categories +
    slice.shops.length +
    slice.products.length +
    skus +
    slice.offers.length +
    slice.membership.plans.length +
    slice.membership.packageGroups.length +
    slice.membership.packages.length +
    1 // storefront CMS preset
  );
}

describe("mall default data execution", () => {
  beforeEach(() => {
    configureMallDefaultDataProvider(null);
  });

  it("provisions the whole demo environment", async () => {
    const port = createFakeMallDefaultDataPort();
    configureMallDefaultDataProvider({ port, environment: "development", defaultLocale: "zh-CN" });

    const report = await runMallDefaultDataInitialization();

    expect(report.ok).toBe(true);
    expect(report.profile).toBe("demo");
    expect(report.summary.created).toBe(expectedCreatedForDemo());
    expect(report.summary.failed).toBe(0);
    expect(report.summary.pending).toBe(0);
    expect(port.state.categories).toHaveLength(
      zhCnDefaultDataset.categories.reduce((total, category) => total + 1 + category.children.length, 0),
    );
    expect(port.state.products).toHaveLength(zhCnDefaultDataset.products.length);
    expect(port.calls.published).toHaveLength(zhCnDefaultDataset.products.length);
    expect(port.state.cmsPreset).toBe("v1:zh-CN");
    expect(port.calls.cmsWrites).toBe(1);
  });

  it("is idempotent: a rerun writes nothing and reports skips", async () => {
    const port = createFakeMallDefaultDataPort();
    configureMallDefaultDataProvider({ port, environment: "development", defaultLocale: "zh-CN" });

    await runMallDefaultDataInitialization();
    const createdAfterFirstRun = port.calls.created.length;
    const rerun = await runMallDefaultDataInitialization();

    expect(rerun.ok).toBe(true);
    expect(rerun.summary.created).toBe(0);
    expect(rerun.summary.skipped).toBeGreaterThan(0);
    expect(port.calls.created).toHaveLength(createdAfterFirstRun);
    expect(port.calls.cmsWrites).toBe(1);
    for (const step of rerun.steps) {
      expect(step.status).toBe("skipped");
    }
  });

  it("a dry run reports the plan and writes nothing", async () => {
    const port = createFakeMallDefaultDataPort();
    configureMallDefaultDataProvider({ port, environment: "test", defaultLocale: "zh-CN" });

    const report = await runMallDefaultDataInitialization({ dryRun: true });

    expect(report.dryRun).toBe(true);
    expect(report.ok).toBe(true);
    expect(report.summary.created).toBe(0);
    expect(report.summary.planned).toBeGreaterThan(0);
    expect(port.calls.created).toEqual([]);
    expect(port.calls.cmsWrites).toBe(0);
    expect(port.state.cmsPreset).toBeNull();
    expect(report.steps.every((step) => step.status === "skipped")).toBe(true);
    expect(report.steps.some((step) => step.details.some((detail) => detail.includes("dry run")))).toBe(true);
  });

  it("stops at a failed step and marks the remainder pending", async () => {
    const firstProduct = zhCnDefaultDataset.products[0];
    const port = createFakeMallDefaultDataPort({ failOn: buildMallSpuNo(firstProduct.key) });
    configureMallDefaultDataProvider({ port, environment: "development", defaultLocale: "zh-CN" });

    const report = await runMallDefaultDataInitialization();

    expect(report.ok).toBe(false);
    expect(report.summary.failed).toBe(1);
    const failedIndex = report.steps.findIndex((step) => step.status === "failed");
    expect(failedIndex).toBeGreaterThanOrEqual(0);
    expect(report.steps[failedIndex]?.id).toBe("catalog.products");
    expect(report.steps[failedIndex]?.message).toContain("forced failure");
    for (const step of report.steps.slice(failedIndex + 1)) {
      expect(step.status).toBe("pending");
    }
  });

  it("provisions only platform reference data for production", async () => {
    const port = createFakeMallDefaultDataPort();
    configureMallDefaultDataProvider({ port, environment: "production", defaultLocale: "zh-CN" });

    const report = await runMallDefaultDataInitialization();

    expect(report.profile).toBe("minimal");
    expect(report.ok).toBe(true);
    expect(port.state.products).toEqual([]);
    expect(port.state.offers).toEqual([]);
    expect(port.state.shops.every((shop) => shop.businessModel === "self-operated")).toBe(true);
    expect(port.state.plans.length).toBe(zhCnDefaultDataset.membership.plans.length);
    expect(port.state.packageGroups.length).toBe(zhCnDefaultDataset.membership.packageGroups.length);
    expect(port.state.packages.length).toBeGreaterThanOrEqual(3);
  });

  it("seeds campaigns as drafts in production and live elsewhere", async () => {
    const productionPort = createFakeMallDefaultDataPort();
    configureMallDefaultDataProvider({ port: productionPort, environment: "production", defaultLocale: "zh-CN" });
    // A richer profile in production still lands campaigns as drafts for review.
    const productionReport = await runMallDefaultDataInitialization({ profile: "standard" });
    expect(productionReport.profile).toBe("standard");
    expect(productionPort.state.offers.length).toBeGreaterThan(0);
    expect(productionPort.state.offers.every((offer) => offer.status === "draft")).toBe(true);

    const stagingPort = createFakeMallDefaultDataPort();
    configureMallDefaultDataProvider({ port: stagingPort, environment: "staging", defaultLocale: "zh-CN" });
    await runMallDefaultDataInitialization();
    expect(stagingPort.state.offers.every((offer) => offer.status === "active")).toBe(true);

    const demoPort = createFakeMallDefaultDataPort();
    configureMallDefaultDataProvider({ port: demoPort, environment: "demo", defaultLocale: "zh-CN" });
    await runMallDefaultDataInitialization();
    expect(demoPort.state.offers.every((offer) => offer.status === "active")).toBe(true);
  });

  it("provisions the English locale without changing identities", async () => {
    const port = createFakeMallDefaultDataPort();
    configureMallDefaultDataProvider({ port, environment: "demo", defaultLocale: "en-US" });

    const report = await runMallDefaultDataInitialization();
    expect(report.locale).toBe("en-US");
    expect(port.state.categories[0]?.categoryNo).toBe("MALL-CAT-DIGITAL");
    expect(port.state.cmsPreset).toBe("v1:en-US");
    expect(String(port.state.products[0]?.title)).toContain("AURORA X1 Pro");
  });

  it("refuses to run when no port is configured", async () => {
    await expect(runMallDefaultDataInitialization()).rejects.toMatchObject({
      code: "not-configured",
    });
  });

  it("resolves the same slice the plan provisions", () => {
    const slice = resolveMallDefaultDataSlice("zh-CN", "standard");
    expect(slice.products.every((product) => !product.demoOnly)).toBe(true);
    expect(slice.offers.every((offer) => !offer.demoOnly)).toBe(true);
  });
});
