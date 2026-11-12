import {
  readAccountScopedItem,
  removeAccountScopedItem,
  writeAccountScopedItem,
} from "@sdkwork/mall-pc-core/session";

export const mallAdminRolePermissions = {
  超级管理员: ["commerce.*"],
  商家运营: ["commerce.shops.read", "commerce.shops.review", "commerce.products.read", "commerce.shops.manage"],
  订单督导: ["commerce.orders.read", "commerce.afterSales.read"],
  营销运营: ["commerce.promotions.read", "commerce.promotions.write", "commerce.cms.write"],
  财务: ["commerce.settlement.read", "commerce.reports.read"],
  风控分析: ["commerce.risk.read", "commerce.audit.read"],
} as const satisfies Record<string, readonly string[]>;

export const MALL_ADMIN_ROLE_STORAGE_KEY = "sdkwork-mall-pc-admin-role";

/**
 * Least privilege. A missing or unknown role grants no backend-admin route:
 * the local role selector is a UX convenience only, and real authorization is
 * always enforced by the server against the session's permission scope.
 */
export const MALL_ADMIN_MINIMAL_PERMISSIONS: readonly string[] = [];

export function listMallAdminRoleNames(): readonly string[] {
  return Object.keys(mallAdminRolePermissions);
}

function isKnownMallAdminRole(roleName: string | null | undefined): roleName is keyof typeof mallAdminRolePermissions {
  return Boolean(roleName) && Object.prototype.hasOwnProperty.call(mallAdminRolePermissions, roleName as string);
}

/**
 * Reads the role selected for this account. The value is account-scoped, so a
 * second account starts with no role rather than inheriting the previous one.
 */
export function readSelectedMallAdminRole(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const role = readAccountScopedItem(MALL_ADMIN_ROLE_STORAGE_KEY)?.trim() ?? "";
  return isKnownMallAdminRole(role) ? role : null;
}

export function writeSelectedMallAdminRole(roleName: string) {
  if (typeof window === "undefined") {
    return;
  }
  // Fail closed: an unknown role is removed instead of being persisted and
  // later matched against a widened permission table.
  if (!isKnownMallAdminRole(roleName)) {
    removeAccountScopedItem(MALL_ADMIN_ROLE_STORAGE_KEY);
    return;
  }
  writeAccountScopedItem(MALL_ADMIN_ROLE_STORAGE_KEY, roleName);
}

export function listMallAdminRolePermissions(roleName: string | null): readonly string[] {
  if (isKnownMallAdminRole(roleName)) {
    return mallAdminRolePermissions[roleName];
  }
  return MALL_ADMIN_MINIMAL_PERMISSIONS;
}

export function matchesMallAdminPermissionHint(
  granted: readonly string[],
  permissionHint: string,
): boolean {
  return granted.some((permission) => {
    if (permission === permissionHint) {
      return true;
    }
    if (permission.endsWith(".*")) {
      return permissionHint.startsWith(permission.slice(0, -1));
    }
    return false;
  });
}
