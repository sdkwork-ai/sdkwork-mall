/**
 * Shared sign-in gate for account-scoped pages.
 *
 * A guest who deep-links an order, a cashier or the inbox used to see a masked
 * `401` rendered as "加载失败" or an empty list. Every protected page routes
 * through this helper instead, so the visitor lands on the sign-in screen and
 * returns to the page they asked for once authenticated.
 */
import { platform } from "@sdkwork/mall-mp-core";

import { mpCapabilityUrl } from "../routes/capabilities";
import { isLoggedIn } from "../services/session";

/**
 * Returns true when the visitor is signed in.
 *
 * @returns false after routing a guest to the login page; the caller must stop
 * loading (and clear its own loading flag) when this is false.
 */
export function requireSignedIn(): boolean {
  if (isLoggedIn()) {
    return true;
  }
  platform.navigateTo(mpCapabilityUrl("account.mall.login"));
  return false;
}
