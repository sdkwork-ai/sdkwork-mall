/**
 * Tab bar model and cart badge.
 *
 * Authority: `APP_MOBILE_REACT_UI_SPEC.md` section 5 and the H5 shell
 * (`@sdkwork/mall-h5-shell` `SHELL_TABS`). The mini program renders the platform
 * tab bar declared in `app.json`; this module is the single place that names its
 * tabs, their indices and the cart badge so no page carries a magic index.
 *
 * Parity with H5: five tabs (首页 / 分类 / 消息 / 购物车 / 我的), the cart tab
 * carries the total quantity badge, exactly like `readMallH5CartCount` /
 * `writeMallH5CartCount`.
 */
import { platform } from "@sdkwork/mall-mp-core";

import { getCart } from "./cart-service";
import { isLoggedIn } from "./session";

export interface MpTabBarTab {
  readonly id: string;
  readonly index: number;
  readonly path: string;
}

/** `app.json` `tabBar.list` order; the index is the platform badge target. */
export const MP_TAB_BAR_TABS: readonly MpTabBarTab[] = [
  { id: "home", index: 0, path: "pages/home/index" },
  { id: "category", index: 1, path: "pages/category/index" },
  { id: "messages", index: 2, path: "pages/chats/index" },
  { id: "cart", index: 3, path: "pages/cart/index" },
  { id: "buyer", index: 4, path: "pages/buyer/index" },
];

export const MP_CART_TAB_INDEX = 3;

/** Same storage contract as H5, namespaced per root. */
export const MP_CART_COUNT_STORAGE_KEY = "sdkwork-mall-mp-cart-count";

function badgeText(totalQuantity: number): string {
  if (totalQuantity <= 0) {
    return "";
  }
  return totalQuantity > 99 ? "99+" : String(totalQuantity);
}

/** Last known total quantity, so a cold tab bar shows the badge instantly. */
export function readCartTabCount(): number {
  try {
    const raw = platform.storage.get(MP_CART_COUNT_STORAGE_KEY);
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
  } catch {
    return 0;
  }
}

/**
 * Applies the badge from the stored count without a network hop.
 *
 * Called on `app.onShow` so returning to the app never shows a stale badge.
 */
export function applyCartTabBadge(): void {
  const text = badgeText(readCartTabCount());
  platform.tabBarBadge(MP_CART_TAB_INDEX, text);
}

/** Persists one total quantity and projects it onto the cart tab. */
export function setCartTabBadge(totalQuantity: number): void {
  const total = Number.isFinite(totalQuantity) ? Math.max(0, Math.floor(totalQuantity)) : 0;
  try {
    platform.storage.set(MP_CART_COUNT_STORAGE_KEY, String(total));
  } catch {
    // A badge is decoration; storage denial must not break the cart screen.
  }
  platform.tabBarBadge(MP_CART_TAB_INDEX, badgeText(total));
}

/**
 * Recomputes the badge from the cart block.
 *
 * Fail-soft: an offline cart read keeps the last known count instead of clearing
 * the badge (a cleared badge would read as "your cart is empty").
 */
export async function syncCartTabBadge(): Promise<void> {
  if (!isLoggedIn()) {
    setCartTabBadge(0);
    return;
  }
  try {
    const cart = await getCart();
    const total = cart.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    setCartTabBadge(total);
  } catch {
    // keep the previous count
  }
}
