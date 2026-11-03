import { beforeEach, describe, expect, it } from "vitest";

import { zhCnDefaultDataset } from "./dataset";
import {
  configureMallDefaultDataProvider,
  runMallDefaultDataInitialization,
  verifyMallDefaultDataInitialization,
} from "./default-data-service";
import { buildMallCmsConfigFromDataset, buildMallCmsPresetId } from "./plan";
import { createFakeMallDefaultDataPort } from "../../tests/default-data-fake-port";

describe("mall default data verification", () => {
  beforeEach(() => {
    configureMallDefaultDataProvider(null);
  });

  it("passes once the environment is provisioned", async () => {
    const port = createFakeMallDefaultDataPort();
    configureMallDefaultDataProvider({ port, environment: "development", defaultLocale: "zh-CN" });
    await runMallDefaultDataInitialization();

    const verification = await verifyMallDefaultDataInitialization();
    expect(verification.ok).toBe(true);
    expect(verification.checks.every((check) => check.status === "pass")).toBe(true);
    expect(verification.checks.map((check) => check.id)).toEqual(
      expect.arrayContaining([
        "catalog.categories",
        "shops.stores",
        "catalog.products",
        "catalog.skus",
        "promotions.offers",
        "membership.plans",
        "membership.packages",
        "cms.storefront",
      ]),
    );
  });

  it("fails an empty environment with actionable missing keys", async () => {
    const port = createFakeMallDefaultDataPort();
    configureMallDefaultDataProvider({ port, environment: "development", defaultLocale: "zh-CN" });

    const verification = await verifyMallDefaultDataInitialization();
    expect(verification.ok).toBe(false);
    const categoryCheck = verification.checks.find((check) => check.id === "catalog.categories");
    expect(categoryCheck?.status).toBe("fail");
    expect(categoryCheck?.missing).toContain("MALL-CAT-DIGITAL");
    expect(verification.checks.find((check) => check.id === "cms.storefront")?.status).toBe("fail");
  });

  it("reports partial provisioning as a warning, not a failure", async () => {
    const port = createFakeMallDefaultDataPort();
    configureMallDefaultDataProvider({ port, environment: "development", defaultLocale: "zh-CN" });
    await runMallDefaultDataInitialization();
    port.state.products.splice(0, 3);

    const verification = await verifyMallDefaultDataInitialization();
    const productCheck = verification.checks.find((check) => check.id === "catalog.products");
    expect(productCheck?.status).toBe("warn");
    expect(productCheck?.missing.length).toBe(3);
    expect(verification.ok).toBe(true);
  });

  it("warns when storefront content exists but the preset marker is missing", async () => {
    const port = createFakeMallDefaultDataPort();
    configureMallDefaultDataProvider({ port, environment: "development", defaultLocale: "zh-CN" });
    await runMallDefaultDataInitialization();
    port.state.cmsPreset = null;

    const verification = await verifyMallDefaultDataInitialization();
    const cmsCheck = verification.checks.find((check) => check.id === "cms.storefront");
    expect(cmsCheck?.status).toBe("warn");
    expect(verification.ok).toBe(true);
  });

  it("verifies against the slice the profile provisions", async () => {
    const port = createFakeMallDefaultDataPort();
    configureMallDefaultDataProvider({ port, environment: "production", defaultLocale: "zh-CN" });
    await runMallDefaultDataInitialization();

    const verification = await verifyMallDefaultDataInitialization();
    expect(verification.profile).toBe("minimal");
    expect(verification.checks.some((check) => check.id === "catalog.products")).toBe(false);
    expect(verification.checks.some((check) => check.id === "promotions.offers")).toBe(false);
    expect(verification.ok).toBe(true);
    expect(
      zhCnDefaultDataset.membership.packages.length,
    ).toBeGreaterThanOrEqual(port.state.packages.length);
  });

  it("keeps the CMS preset identity stable for a locale", () => {
    const config = buildMallCmsConfigFromDataset(zhCnDefaultDataset);
    expect(buildMallCmsPresetId("zh-CN")).toBe("v1:zh-CN");
    expect(config.banners[0]?.id.startsWith("mall-cms-banner-")).toBe(true);
  });
});
