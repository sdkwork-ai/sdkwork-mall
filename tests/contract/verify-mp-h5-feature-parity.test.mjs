import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

/**
 * H5 -> mini-program feature parity.
 *
 * Authority: `APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md` section 7 and
 * `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` section 13. Route identity parity only
 * proves a page exists; this guard pins the *feature* behind each route so a
 * storefront surface cannot quietly regress below the H5 implementation.
 *
 * Every case points at the H5 implementation and the mini-program counterpart.
 * When H5 grows a surface, this list is the place that records the pairing.
 */
const workspaceRoot = path.resolve(import.meta.dirname, "..", "..");
const h5 = path.join(workspaceRoot, "apps", "sdkwork-mall-h5");
const mp = path.join(workspaceRoot, "apps", "sdkwork-mall-mini-program");

function read(base, relative) {
  const absolute = path.join(base, relative);
  assert.ok(existsSync(absolute), `missing ${path.relative(workspaceRoot, absolute)}`);
  return readFileSync(absolute, "utf8");
}

const H5_HOME_SERVICE = "packages/sdkwork-mall-h5-home/src/home-service.ts";
const H5_CATALOG_PAGE = "packages/sdkwork-mall-h5-catalog/src/pages/CatalogPage.tsx";
const H5_PRODUCT_PAGE = "packages/sdkwork-mall-h5-catalog/src/pages/ProductDetailPage.tsx";
const H5_CART_PAGE = "packages/sdkwork-mall-h5-cart/src/pages/CartPage.tsx";
const H5_ORDER_PAGE = "packages/sdkwork-mall-h5-order/src/pages/OrderPage.tsx";
const H5_BUYER_PAGE = "packages/sdkwork-mall-h5-buyer/src/pages/BuyerHomePage.tsx";
const H5_MEMBERSHIP_PAGE = "packages/sdkwork-mall-h5-membership/src/pages/MembershipPage.tsx";
const H5_CHAT_PAGE = "packages/sdkwork-mall-h5-im/src/pages/ChatPage.tsx";

test("the home storefront keeps the H5 floors", () => {
  const h5Home = read(h5, H5_HOME_SERVICE);
  // H5 loads the default hot page + newest products, shops and local footprint.
  // The authority ignores `sort: "sales"`; neither root may claim that ranking.
  assert.doesNotMatch(h5Home, /sort: "sales"/u);
  assert.match(h5Home, /sort: "newest"/u);
  assert.match(h5Home, /shops\.list/u);

  const mpHome = read(mp, "src/pages/home/index.ts");
  assert.doesNotMatch(mpHome, /sort: "sales"/u, "hot floor uses the default server order");
  assert.match(mpHome, /sort: "newest"/u, "new-arrivals floor wired to the same sort");
  assert.match(mpHome, /listShops/u, "featured-shop floor");
  assert.match(mpHome, /readFootprint/u, "local footprint chips");
  assert.match(mpHome, /seckill/i, "seckill floor");
});

test("the category browser keeps the two-level drill-down", () => {
  const h5Catalog = read(h5, H5_CATALOG_PAGE);
  // H5 projects the flat category page into a two-level tree ("children").
  assert.match(h5Catalog, /buildMallH5CategoryTree|children/u, "H5 derives the second level");

  const mpCategory = read(mp, "src/pages/category/index.ts");
  assert.match(mpCategory, /children:/u, "second-level taxonomy state");
  assert.match(mpCategory, /activeChildId/u, "leaf selection");
  assert.match(mpCategory, /parentId/u, "children derived from parentId");
});

test("the product detail keeps the H5 purchase context", () => {
  const h5Product = read(h5, H5_PRODUCT_PAGE);
  assert.match(h5Product, /coupon|offers/u, "H5 exposes claimable offers");
  assert.match(h5Product, /recommendations|看了又看/u, "H5 exposes recommendations");
  assert.match(h5Product, /delivery/u, "H5 exposes the delivery row");

  const mpProduct = read(mp, "src/pages/product/index.ts");
  assert.match(mpProduct, /listOffers/u, "claimable coupon row");
  assert.match(mpProduct, /recommendations/u, "recommendation strip");
  assert.match(mpProduct, /deliveryText/u, "delivery row");
  assert.match(mpProduct, /listAddresses/u, "delivery row reads the default address");
  assert.match(mpProduct, /openSkuPopup/u, "SKU sheet");
  assert.match(mpProduct, /onShareAppMessage/u, "share card");
});

test("cart, orders and the buyer hub keep their H5 actions", () => {
  // The H5 cart is the shop-mobile shopping brick now; parity means the mini
  // program keeps the same buyer actions (manage mode, bulk delete, shop entry),
  // not that both files contain the same identifiers.
  const h5Cart = read(h5, H5_CART_PAGE);
  assert.match(h5Cart, /ShoppingCartPage|shop-mobile-react-shopping/u, "H5 cart is the shopping brick");
  const mpCart = read(mp, "src/pages/cart/index.ts");
  assert.match(mpCart, /manageMode/u, "manage mode");
  assert.match(mpCart, /removeSelected/u, "bulk delete");
  assert.match(mpCart, /goShop/u, "shop entry on the group header");

  const h5Order = read(h5, H5_ORDER_PAGE);
  assert.match(h5Order, /order-mobile-react-orders|OrderTabsNav|OrderCard/u, "H5 orders render the order brick");
  const mpOrder = read(mp, "src/pages/orders/index.ts");
  assert.match(mpOrder, /goAfterSales/u, "after-sales entry per order");

  const h5Buyer = read(h5, H5_BUYER_PAGE);
  assert.match(h5Buyer, /displayName|session/u, "H5 greets the signed-in account");
  const mpBuyer = read(mp, "src/pages/buyer/index.ts");
  assert.match(mpBuyer, /getProfile/u, "buyer hub loads the profile");
  assert.match(mpBuyer, /displayName/u, "identity hero uses the profile name");
});

test("membership and chat keep the H5 affordances", () => {
  const h5Membership = read(h5, H5_MEMBERSHIP_PAGE);
  assert.match(h5Membership, /benefit/u, "H5 renders benefit tiles");
  const mpMembership = read(mp, "src/pages/membership/index.ts");
  assert.match(mpMembership, /benefits/u, "benefit tiles");

  const h5Chat = read(h5, H5_CHAT_PAGE);
  assert.match(h5Chat, /maxLength=\{500\}/u, "H5 caps the composer at 500");
  assert.match(h5Chat, /poll|Poll/u, "H5 keeps the poll fallback");
  const mpChat = read(mp, "src/pages/chat/index.ts");
  const mpChatTemplate = read(mp, "src/pages/chat/index.wxml");
  assert.match(mpChatTemplate, /maxlength="500"/u, "composer cap");
  assert.match(mpChat, /startPolling/u, "poll fallback");
  assert.match(mpChat, /subscribeConversationMessages/u, "live messages");
});
