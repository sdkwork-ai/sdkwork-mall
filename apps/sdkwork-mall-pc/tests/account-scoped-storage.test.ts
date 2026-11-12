import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  MALL_ACCOUNT_SCOPE_ANONYMOUS,
  clearMallAccountScopedStorage,
  configureMallAccountScopeProvider,
  currentMallAccountScopeId,
  readAccountScopedItem,
  resetMallAccountScopeForTests,
  writeAccountScopedItem,
} from "@sdkwork/mall-pc-core/session";

import {
  clearMallFavorites,
  readMallFavorites,
  toggleMallFavorite,
} from "../packages/sdkwork-mall-pc-commerce/src/favorites-service";
import {
  readMallFootprint,
  recordMallFootprint,
} from "../packages/sdkwork-mall-pc-reviews/src/footprint-service";
import {
  defaultMallCmsConfig,
  readMallCmsConfig,
  writeMallCmsConfig,
} from "../packages/sdkwork-mall-pc-cms/src/cms-config";
import {
  invalidateMallCmsConfigCache,
  loadMallCmsConfigRemote,
  saveMallCmsConfigRemote,
} from "../packages/sdkwork-mall-pc-cms/src/cms-service";
import {
  MALL_ADMIN_MINIMAL_PERMISSIONS,
  MALL_ADMIN_ROLE_STORAGE_KEY,
  listMallAdminRolePermissions,
  readSelectedMallAdminRole,
  writeSelectedMallAdminRole,
} from "../packages/sdkwork-mall-pc-admin-permissions/src/role-matrix";

/**
 * Cross-account storage regression tests for the Mall PC surfaces.
 *
 * Favourites, footprint, search history, the CMS fallback and the admin role
 * used to share bare browser-storage keys, so the next account on the same
 * browser inherited the previous account's data (and admin role). They are now
 * keyed by `<base>::<tenantId>:<userId>` and cleared when the identity changes.
 */

function useAccount(tenantId: string, userId: string): void {
  configureMallAccountScopeProvider(() => ({ tenantId, userId }));
}

beforeEach(() => {
  window.localStorage.clear();
  resetMallAccountScopeForTests();
  invalidateMallCmsConfigCache();
});

afterEach(() => {
  resetMallAccountScopeForTests();
  invalidateMallCmsConfigCache();
  window.localStorage.clear();
});

describe("account scoped buyer data", () => {
  it("stores favourites under the tenant and user scope", () => {
    useAccount("tenant-a", "user-1");

    toggleMallFavorite({ id: "product-1", title: "Account A product" });

    expect(window.localStorage.getItem("sdkwork-mall-pc-favorites::tenant-a:user-1"))
      .toContain("product-1");
    expect(readMallFavorites()).toEqual([{ id: "product-1", title: "Account A product" }]);
  });

  it("never shows the previous account favourites to the next account", () => {
    useAccount("tenant-a", "user-1");
    toggleMallFavorite({ id: "product-a", title: "Account A product" });
    recordMallFootprint({ id: "footprint-a", title: "Account A footprint" });

    useAccount("tenant-b", "user-2");

    expect(readMallFavorites()).toEqual([]);
    expect(readMallFootprint()).toEqual([]);
    expect(currentMallAccountScopeId()).toBe("tenant-b:user-2");
  });

  it("clears the account scope, the anonymous bucket and legacy keys on sign-out", () => {
    useAccount("tenant-a", "user-1");
    toggleMallFavorite({ id: "product-a", title: "Account A product" });
    writeAccountScopedItem("sdkwork-mall-pc-search-history", JSON.stringify(["account-a query"]));
    window.localStorage.setItem("sdkwork-mall-pc-search-history", JSON.stringify(["legacy query"]));
    window.localStorage.setItem(
      "sdkwork-mall-pc-favorites::tenant-b:user-2",
      JSON.stringify([{ id: "other", title: "Other account" }]),
    );
    window.localStorage.setItem("sdkwork-mall-pc-theme", "dark");

    const removed = clearMallAccountScopedStorage();

    expect(removed).toContain("sdkwork-mall-pc-favorites::tenant-a:user-1");
    expect(removed).toContain("sdkwork-mall-pc-search-history::tenant-a:user-1");
    expect(removed).toContain("sdkwork-mall-pc-search-history");
    expect(window.localStorage.getItem("sdkwork-mall-pc-favorites::tenant-a:user-1")).toBeNull();
    expect(window.localStorage.getItem("sdkwork-mall-pc-favorites::tenant-b:user-2"))
      .toContain("Other account");
    expect(window.localStorage.getItem("sdkwork-mall-pc-theme")).toBe("dark");
  });

  it("clears only this account favourites from the settings action", () => {
    useAccount("tenant-a", "user-1");
    toggleMallFavorite({ id: "product-a", title: "Account A product" });
    useAccount("tenant-a", "user-1");

    clearMallFavorites();

    expect(readMallFavorites()).toEqual([]);
  });

  it("falls back to the anonymous scope when no session claims are available", () => {
    configureMallAccountScopeProvider(() => null);

    expect(currentMallAccountScopeId()).toBe(MALL_ACCOUNT_SCOPE_ANONYMOUS);
    writeAccountScopedItem("sdkwork-mall-pc-footprint", "[]");
    expect(readAccountScopedItem("sdkwork-mall-pc-footprint")).toBe("[]");
  });
});

describe("admin role fail-closed", () => {
  it("grants nothing when no role was selected", () => {
    useAccount("tenant-a", "user-1");

    expect(readSelectedMallAdminRole()).toBeNull();
    expect(listMallAdminRolePermissions(readSelectedMallAdminRole())).toEqual(
      MALL_ADMIN_MINIMAL_PERMISSIONS,
    );
    expect(listMallAdminRolePermissions("not-a-role")).toEqual([]);
  });

  it("cannot select an unknown role and stores a known role per account", () => {
    useAccount("tenant-a", "user-1");
    writeSelectedMallAdminRole("not-a-role");
    expect(readSelectedMallAdminRole()).toBeNull();
    expect(window.localStorage.getItem(`${MALL_ADMIN_ROLE_STORAGE_KEY}::tenant-a:user-1`))
      .toBeNull();

    writeSelectedMallAdminRole("财务");
    expect(readSelectedMallAdminRole()).toBe("财务");
    expect(listMallAdminRolePermissions("财务")).toContain("commerce.reports.read");

    useAccount("tenant-b", "user-2");
    expect(readSelectedMallAdminRole()).toBeNull();
  });

  it("ignores a stale unscoped admin role from the pre-scope build", () => {
    useAccount("tenant-a", "user-1");
    window.localStorage.setItem(MALL_ADMIN_ROLE_STORAGE_KEY, "超级管理员");

    expect(readSelectedMallAdminRole()).toBeNull();
    expect(listMallAdminRolePermissions(readSelectedMallAdminRole())).toEqual([]);
  });
});

describe("tenant scoped CMS fallback", () => {
  it("reads and writes the CMS fallback under the account scope", () => {
    useAccount("tenant-a", "user-1");
    const custom = {
      ...defaultMallCmsConfig(),
      banners: [{ enabled: true, id: "tenant-a-banner", linkUrl: "/a", sortOrder: 0, title: "Tenant A" }],
    };

    writeMallCmsConfig(custom);

    expect(readMallCmsConfig().banners[0]?.id).toBe("tenant-a-banner");
    expect(window.localStorage.getItem("sdkwork-mall-pc-cms-config::tenant-a:user-1"))
      .toContain("tenant-a-banner");
  });

  it("does not serve the previous tenant cached CMS configuration", async () => {
    useAccount("tenant-a", "user-1");
    await saveMallCmsConfigRemote({
      ...defaultMallCmsConfig(),
      hotKeywords: [{ enabled: true, id: "tenant-a-keyword", keyword: "tenant-a", sortOrder: 0 }],
    });

    useAccount("tenant-b", "user-2");
    const loaded = await loadMallCmsConfigRemote();

    expect(loaded.hotKeywords[0]?.keyword).not.toBe("tenant-a");
    expect(loaded.hotKeywords[0]?.keyword).toBe(defaultMallCmsConfig().hotKeywords[0]?.keyword);
  });
});
