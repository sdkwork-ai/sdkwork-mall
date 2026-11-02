/**
 * Capability route identity for the mini program.
 *
 * Every page that represents a commerce capability carries the same route id as
 * the PC, H5 and Flutter roots (APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC section 7:
 * route identity is aligned across clients, physical paths may differ). The
 * parity contract (specs/mall-capability-parity.json) and
 * tests/contract/verify-mall-capability-parity.test.mjs keep this table and
 * app.json in sync.
 *
 * Pages navigate with mpCapabilityUrl() so a renamed page only has to be
 * corrected here.
 */
export interface MpCapabilityRoute {
  /** Canonical route id shared with the other client roots. */
  readonly routeId: string;
  /** Physical page path registered in app.json. */
  readonly page: string;
}

export const MP_CAPABILITY_ROUTES: readonly MpCapabilityRoute[] = [
  { routeId: "storefront.mall.home", page: "pages/home/index" },
  { routeId: "storefront.mall.categories", page: "pages/category/index" },
  { routeId: "storefront.mall.search", page: "pages/search/index" },
  { routeId: "storefront.mall.product-detail", page: "pages/product/index" },
  { routeId: "storefront.mall.shop", page: "pages/shop/index" },
  { routeId: "storefront.mall.activity-list", page: "pages/activity/index" },
  { routeId: "storefront.mall.activity-detail", page: "pages/activity-detail/index" },
  { routeId: "storefront.mall.cart", page: "pages/cart/index" },
  { routeId: "storefront.mall.checkout", page: "pages/checkout/index" },
  { routeId: "storefront.mall.payment-cashier", page: "pages/cashier/index" },
  { routeId: "storefront.mall.payment-result", page: "pages/payment-result/index" },
  { routeId: "storefront.mall.help", page: "pages/help/index" },
  { routeId: "buyer.mall.dashboard", page: "pages/buyer/index" },
  { routeId: "buyer.mall.orders", page: "pages/orders/index" },
  { routeId: "buyer.mall.orders.detail", page: "pages/order-detail/index" },
  { routeId: "buyer.mall.orders.logistics", page: "pages/logistics/index" },
  { routeId: "buyer.mall.addresses", page: "pages/address/index" },
  { routeId: "buyer.mall.after-sales", page: "pages/aftersales/index" },
  { routeId: "buyer.mall.coupons", page: "pages/coupons/index" },
  { routeId: "buyer.mall.favorites", page: "pages/favorites/index" },
  { routeId: "buyer.mall.footprint", page: "pages/footprint/index" },
  { routeId: "buyer.mall.messages", page: "pages/messages/index" },
  { routeId: "buyer.mall.reviews", page: "pages/reviews/index" },
  { routeId: "buyer.mall.gift-cards", page: "pages/gift-cards/index" },
  { routeId: "buyer.mall.profile", page: "pages/profile/index" },
  { routeId: "buyer.mall.security", page: "pages/security/index" },
  { routeId: "buyer.mall.wallet", page: "pages/wallet/index" },
  { routeId: "buyer.mall.points", page: "pages/points/index" },
  { routeId: "buyer.mall.membership", page: "pages/membership/index" },
  { routeId: "buyer.mall.distribution", page: "pages/partner/index" },
  { routeId: "buyer.mall.invoices", page: "pages/invoices/index" },
  { routeId: "buyer.mall.im.chats", page: "pages/chats/index" },
  { routeId: "buyer.mall.im.chat", page: "pages/chat/index" },
  { routeId: "buyer.mall.im.notices", page: "pages/notices/index" },
  { routeId: "buyer.mall.settings", page: "pages/settings/index" },
  { routeId: "account.mall.login", page: "pages/login/index" },
];

const ROUTES_BY_ID: Record<string, MpCapabilityRoute> = {};
for (const route of MP_CAPABILITY_ROUTES) {
  ROUTES_BY_ID[route.routeId] = route;
}

export function findMpCapabilityRoute(routeId: string): MpCapabilityRoute | undefined {
  return ROUTES_BY_ID[routeId];
}

/** Absolute page URL for a capability route, with optional query parameters. */
export function mpCapabilityUrl(
  routeId: string,
  query?: Record<string, string | number | undefined>,
): string {
  const route = ROUTES_BY_ID[routeId];
  if (!route) {
    throw new Error(`Unknown mini-program capability route: ${routeId}`);
  }
  const pairs = Object.keys(query ?? {})
    .filter((key) => (query ?? {})[key] !== undefined && (query ?? {})[key] !== "")
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(String((query ?? {})[key]))}`);
  return `/${route.page}${pairs.length > 0 ? `?${pairs.join("&")}` : ""}`;
}

/**
 * Tab destinations. `wx.navigateTo` cannot open a tabBar page, so callers must
 * use `wx.switchTab` for these capabilities.
 */
export const MP_TAB_CAPABILITY_ROUTES: readonly string[] = [
  "storefront.mall.home",
  "storefront.mall.categories",
  "storefront.mall.cart",
  "buyer.mall.dashboard",
];

export function isMpTabCapability(routeId: string): boolean {
  return MP_TAB_CAPABILITY_ROUTES.indexOf(routeId) >= 0;
}