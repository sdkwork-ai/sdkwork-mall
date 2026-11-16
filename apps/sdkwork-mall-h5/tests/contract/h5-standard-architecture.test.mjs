import { existsSync, readdirSync, readFileSync } from "node:fs";
import { strict as assert } from "node:assert";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

function read(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

test("mall H5 root is manifest-driven with mobile runtime identity", () => {
  const manifest = JSON.parse(read("../../agent.app.config.json"));
  assert.equal(manifest.app?.key, "sdkwork-mall-h5");
  assert.equal(manifest.runtime?.family, "mobile");
  assert.equal(manifest.runtime?.framework, "react-h5");
});

test("the login plane is the shared IAM H5 brick, not an app-owned flow", () => {
  // Brick architecture (APP_H5_ARCHITECTURE_SPEC §7, APP_MOBILE_REACT_UI_SPEC §4):
  // login/register/recovery screens, the auth state machine and the session
  // commit are owned by @sdkwork/iam-h5-auth + @sdkwork/iam-h5-core. The mall
  // root only decides when to mount the gate, and only maps the brick's
  // documented surface tokens onto the flat mall palette.
  const manifest = JSON.parse(read("../../package.json"));
  const dependencies = manifest.dependencies ?? {};

  assert.ok(dependencies["@sdkwork/iam-h5-auth"], "the IAM H5 auth brick must be a direct dependency");
  assert.ok(dependencies["@sdkwork/iam-h5-core"], "the IAM H5 core brick must be a direct dependency");
  assert.ok(dependencies["@sdkwork/iam-service"], "the IAM service facade must be a direct dependency");
  assert.equal(dependencies["@sdkwork/auth-pc-react"], undefined, "the desktop auth package must not be mounted");
  assert.equal(
    dependencies["@sdkwork/auth-runtime-pc-react"],
    undefined,
    "the desktop auth runtime must not be mounted",
  );

  const gate = read("../../src/AuthGate.tsx");
  assert.match(gate, /from "@sdkwork\/iam-h5-auth"/u, "the gate mounts the IAM H5 auth brick");
  assert.match(gate, /SdkworkIamH5AuthRoutes/u);
  assert.match(gate, /createSdkworkIamH5AuthController/u, "the controller comes from the brick");
  assert.doesNotMatch(gate, /auth-pc-react/u, "no desktop auth import may remain");

  const iamRuntime = read("../../src/bootstrap/iamRuntime.ts");
  assert.match(iamRuntime, /createIamH5RuntimeService/u, "the IAM runtime is composed by the H5 core brick");
  assert.match(iamRuntime, /readBootstrapAccessTokenFromProcessEnv/u, "the auth calls carry the public application token");
  assert.match(iamRuntime, /@sdkwork\/iam-h5-core/u);

  const css = read("../../src/index.css");
  assert.match(
    css,
    /@source "[^"]*sdkwork-iam-h5-auth\/src"/u,
    "Tailwind must scan the auth brick for the utilities it renders",
  );
  assert.match(css, /\.sdkwork-iam-h5-auth-surface/u, "the host maps the brick surface tokens");
  assert.doesNotMatch(css, /sdk-mall-auth-page/u, "the app must not style its own auth screens");
});

test("the order list is composed from the order mobile brick", () => {
  // Brick architecture (APP_MOBILE_REACT_UI_SPEC §4): the order card, its
  // status tabs and the order read model belong to
  // @sdkwork/order-mobile-react-orders. The mall root injects the order SDK
  // client through the brick runtime and keeps only its own page chrome,
  // loading/empty states and payment navigation.
  const manifest = JSON.parse(read("../../package.json"));
  const dependencies = manifest.dependencies ?? {};
  assert.ok(
    dependencies["@sdkwork/order-mobile-react-orders"],
    "the order mobile brick must be a direct dependency",
  );
  assert.ok(dependencies["@sdkwork/ui-mobile-react"], "the shared mobile UI package must be declared");

  const runtime = read("../../src/bootstrap/runtime.ts");
  assert.match(runtime, /configureOrderMobileRuntime/u, "the host must inject the order brick runtime");
  assert.match(runtime, /orderAppClient/u, "the brick reads the host order SDK client");

  const page = read("../../packages/sdkwork-mall-h5-order/src/pages/OrderPage.tsx");
  assert.match(page, /from "@sdkwork\/order-mobile-react-orders"/u);
  assert.match(page, /OrderTabsNav/u, "the status tabs are the brick's tab nav");
  assert.match(page, /<OrderCard/u, "order rows are the brick's order card");
  assert.doesNotMatch(page, /sdk-h5-order-row/u, "no hand-rolled order card may remain");

  const detail = read("../../packages/sdkwork-mall-h5-order/src/pages/OrderDetailPage.tsx");
  assert.match(detail, /from "@sdkwork\/order-mobile-react-orders"/u);
  assert.match(detail, /<OrderDetail/u, "the detail page mounts the brick page");
  assert.match(detail, /orderCashierPath="\/buyer\/orders\/:orderId\/cashier"/u, "detail pays through the brick cashier");
  assert.doesNotMatch(detail, /loadMallH5OrderDetail/u, "no mall-owned order detail data flow may remain");

  const routes = read("../../src/routes/AppRoutes.tsx");
  assert.match(
    routes,
    /import\("@sdkwork\/order-mobile-react-orders"\)\.then\(\(module\) => \(\{ default: module\.CashierPage \}\)\)/u,
    "the cashier route mounts the order brick's CashierPage",
  );
  assert.match(routes, /path="\/buyer\/orders\/:orderId\/cashier"/u);
  assert.doesNotMatch(
    read("../../packages/sdkwork-mall-h5-order/src/pages/OrderPage.tsx"),
    /payMallH5Order/u,
    "the order list must route into the cashier instead of creating payments itself",
  );

  const cartService = read("../../packages/sdkwork-mall-h5-cart/src/cart-service.ts");
  assert.match(
    cartService,
    /nextUrl = `\/buyer\/orders\/\$\{encodeURIComponent\(orderId\)\}\/cashier`/u,
    "checkout must hand the buyer over to the brick cashier",
  );
  assert.doesNotMatch(
    cartService,
    /payment\/result\?status=/u,
    "checkout must not build the legacy payment-result URL",
  );

  const shell = read("../../packages/sdkwork-mall-h5-shell/src/index.tsx");
  assert.match(shell, /isSdkworkMallH5PageOwnedChrome/u, "the shell must yield chrome the brick owns");
  assert.match(
    shell,
    /isProductDetail \|\| isPageOwnedChrome \? null/u,
    "a page-owned header must replace the shell navbar",
  );

  const css = read("../../src/index.css");
  assert.match(
    css,
    /@source "[^"]*sdkwork-order-mobile-react-orders\/src"/u,
    "Tailwind must scan the order brick for the utilities it renders",
  );
  assert.match(css, /--color-text-main/u, "the host maps the brick's design tokens");
  assert.match(
    css,
    /\.sdk-h5-main \[class\*="shadow"\]/u,
    "the flat policy must neutralize brick elevation utilities",
  );
});

test("the cart is composed from the shop mobile shopping brick", () => {
  // Brick architecture: the cart page, shop grouping, selection, totals and
  // empty state belong to @sdkwork/shop-mobile-react-shopping. The mall root
  // only binds the brick's cart runtime port to its commerce cart facade.
  const manifest = JSON.parse(read("../../package.json"));
  const dependencies = manifest.dependencies ?? {};
  assert.ok(
    dependencies["@sdkwork/shop-mobile-react-shopping"],
    "the shop shopping brick must be a direct dependency",
  );
  assert.ok(dependencies.zustand, "the brick's store peer must be declared");

  const cartPage = read("../../packages/sdkwork-mall-h5-cart/src/pages/CartPage.tsx");
  assert.match(cartPage, /from "@sdkwork\/shop-mobile-react-shopping"/u);
  assert.match(cartPage, /<ShoppingCartPage/u, "the cart route mounts the brick page");
  assert.doesNotMatch(cartPage, /loadMallH5Cart/u, "no mall-owned cart UI may remain");

  const runtime = read("../../src/bootstrap/runtime.ts");
  assert.match(runtime, /configureSdkworkMallH5CartBrick/u, "the host must compose the cart runtime port");
  const adapter = read("../../packages/sdkwork-mall-h5-cart/src/cart-brick.ts");
  assert.match(adapter, /configureShopMobileCartRuntime/u);
  assert.match(adapter, /loadMallH5Cart/u, "the brick reads the mall commerce cart facade");
  assert.match(adapter, /publishMallH5CartCount/u, "the tab badge follows the brick cart");

  const css = read("../../src/index.css");
  assert.match(
    css,
    /@source "[^"]*sdkwork-shop-mobile-react-shopping\/src"/u,
    "Tailwind must scan the shop shopping brick",
  );
  assert.match(css, /--color-bg-color/u, "the host maps the brick page background token");
  assert.match(css, /--shopping-accent/u, "the host maps the brick accent to commerce blue");

  // Settlement bar: fixed above the host tab bar, not a sticky element that
  // floats mid-page on short carts.
  const appRoot = fileURLToPath(new URL("../../", import.meta.url));
  const brickCart = readFileSync(
    join(
      appRoot,
      "../../../sdkwork-shop/apps/sdkwork-shop-common/packages/sdkwork-shop-mobile-react-shopping/src/pages/ShoppingCart.tsx",
    ),
    "utf8",
  );
  assert.match(brickCart, /fixed inset-x-0/u, "the settlement bar must be fixed");
  assert.match(brickCart, /footerBottom/u, "the host tab-bar height offsets the bar");
});

test("voucher redemption is the order brick's page, not an app-owned form", () => {
  // The gift-card hub links into the order brick's voucher page; the brick owns
  // the redeem form, header and close affordance. Its earlier mock scanner view
  // must not come back: it could never open a camera.
  const routes = read("../../src/routes/AppRoutes.tsx");
  assert.match(routes, /module\.VoucherCodePage/u, "the voucher route mounts the brick page");
  assert.match(routes, /path="\/buyer\/vouchers"/u);

  const shell = read("../../packages/sdkwork-mall-h5-shell/src/index.tsx");
  assert.match(shell, /pathname === "\/buyer\/vouchers"/u, "the brick page owns its chrome");

  const giftCards = read("../../packages/sdkwork-mall-h5-buyer/src/pages/GiftCardsPage.tsx");
  assert.match(giftCards, /to="\/buyer\/vouchers"/u, "the hub must expose the live redemption entry");

  const appRoot = fileURLToPath(new URL("../../", import.meta.url));
  const modal = readFileSync(
    join(
      appRoot,
      "../../../sdkwork-order/apps/sdkwork-order-common/packages/sdkwork-order-mobile-react-orders/src/components/VoucherRedeemModal.tsx",
    ),
    "utf8",
  );
  assert.doesNotMatch(modal, /isScanning/u, "the fake scanner flow must not return");
  assert.match(modal, /var\(--order-accent/u, "the host maps the brick accent to commerce blue");
});

test("refund requests are the order brick's page, linked from the buyer hub", () => {
  // The refund surface (list + create) lives in the order brick. The mall hub
  // only links to it; the order detail refund action deep-links with ?orderId=.
  const routes = read("../../src/routes/AppRoutes.tsx");
  assert.match(routes, /module\.RefundRequestsPage/u, "the refund route mounts the brick page");
  assert.match(routes, /path="\/buyer\/refunds"/u);

  const shell = read("../../packages/sdkwork-mall-h5-shell/src/index.tsx");
  assert.match(shell, /pathname === "\/buyer\/refunds"/u, "the brick page owns its chrome");

  const detail = read("../../packages/sdkwork-mall-h5-order/src/pages/OrderDetailPage.tsx");
  assert.match(detail, /refundRequestsPath="\/buyer\/refunds"/u);

  const buyerHub = read("../../packages/sdkwork-mall-h5-buyer/src/pages/BuyerHomePage.tsx");
  assert.match(buyerHub, /path: "\/buyer\/refunds"/u, "the buyer hub must expose the refund entry");

  const appRoot = fileURLToPath(new URL("../../", import.meta.url));
  const brickPage = readFileSync(
    join(
      appRoot,
      "../../../sdkwork-order/apps/sdkwork-order-common/packages/sdkwork-order-mobile-react-orders/src/pages/RefundRequestsPage.tsx",
    ),
    "utf8",
  );
  assert.match(brickPage, /refundStatusKey/u, "wire statuses must normalize onto the readable badges");
});

test("the account profile, password and user-center bricks share one IAM service", () => {
  // Account surfaces are the IAM H5 user-center brick. The mall root injects its
  // IAM service once; the pages wrap the screens with the brick's i18n provider.
  const manifest = JSON.parse(read("../../package.json"));
  const buyerManifest = JSON.parse(
    read("../../packages/sdkwork-mall-h5-buyer/package.json"),
  );
  assert.ok(
    buyerManifest.dependencies["@sdkwork/iam-h5-user-center"],
    "the buyer package must depend on the IAM user-center brick",
  );
  assert.ok(
    buyerManifest.dependencies["@sdkwork/iam-h5-commons"],
    "the buyer package must depend on the IAM H5 kit (provider + screen frame)",
  );

  const profile = read("../../packages/sdkwork-mall-h5-buyer/src/pages/ProfilePage.tsx");
  assert.match(profile, /SdkworkIamH5UserCenterProfileScreen/u);
  assert.match(profile, /SdkworkIamH5I18nProvider/u, "the screens need the registered catalog");
  assert.match(profile, /IAM_H5_USER_CENTER_I18N_CATALOG/u);

  const password = read("../../packages/sdkwork-mall-h5-buyer/src/pages/PasswordPage.tsx");
  assert.match(password, /SdkworkIamH5UserCenterPasswordScreen/u);

  const runtime = read("../../src/bootstrap/runtime.ts");
  assert.match(runtime, /configureSdkworkMallH5UserCenter\(iamRuntime\.iamService\)/u);

  const shell = read("../../packages/sdkwork-mall-h5-shell/src/index.tsx");
  assert.match(shell, /pathname === "\/buyer\/profile"/u);
  assert.match(shell, /pathname === "\/buyer\/password"/u);

  const security = read("../../packages/sdkwork-mall-h5-buyer/src/pages/SecurityPage.tsx");
  assert.match(security, /to="\/buyer\/password"/u, "security must link to the brick password page");
  assert.doesNotMatch(security, /to="\/auth\/login"/u, "changing a password must not log the buyer out");
});

test("logistics tracking is the order brick's shipment page", () => {
  // The tracking UI (shipment header, packages, event timeline, empty/error
  // states) belongs to the order brick; the mall order package only binds its
  // logistics runtime port to the commerce order data plane.
  const logisticsPage = read("../../packages/sdkwork-mall-h5-order/src/pages/LogisticsPage.tsx");
  assert.match(logisticsPage, /<OrderShipmentPage/u, "the logistics route mounts the brick page");
  assert.doesNotMatch(logisticsPage, /loadMallH5OrderLogistics/u, "no mall-owned tracking UI may remain");

  const adapter = read("../../packages/sdkwork-mall-h5-order/src/logistics-brick.ts");
  assert.match(adapter, /configureOrderLogisticsRuntime/u);
  assert.match(adapter, /loadMallH5OrderLogistics/u, "the brick reads the mall order data plane");

  const runtime = read("../../src/bootstrap/runtime.ts");
  assert.match(runtime, /configureSdkworkMallH5OrderLogisticsBrick/u);

  const shell = read("../../packages/sdkwork-mall-h5-shell/src/index.tsx");
  assert.match(shell, /pathname === "\/buyer\/logistics"/u, "the brick page owns its chrome");
});

test("order brick surfaces render locale dates instead of raw ISO timestamps", () => {
  // Wire timestamps are ISO-8601; rendering them raw leaks machine text into
  // order detail, refund records and the tracking timeline. All three read the
  // brick's shared formatter.
  const appRoot = fileURLToPath(new URL("../../", import.meta.url));
  const brickSrc = join(
    appRoot,
    "../../../sdkwork-order/apps/sdkwork-order-common/packages/sdkwork-order-mobile-react-orders/src",
  );
  const formatter = readFileSync(join(brickSrc, "services/datetime.ts"), "utf8");
  assert.match(formatter, /export function formatOrderDateTime/u);

  for (const relativePath of [
    "components/OrderInfoCards.tsx",
    "pages/RefundRequestsPage.tsx",
    "pages/OrderShipmentPage.tsx",
  ]) {
    const source = readFileSync(join(brickSrc, relativePath), "utf8");
    assert.match(source, /formatOrderDateTime/u, `${relativePath} must format dates`);
    assert.doesNotMatch(source, /order\.createdAt\}/u, `${relativePath} must not render raw createdAt`);
    assert.doesNotMatch(source, /request\.createdAt\}/u, `${relativePath} must not render raw createdAt`);
  }
});

test("the cashier renders scannable channel QR payloads", () => {
  // WeChat Native and Alipay return deep-link payloads (`weixin://`,
  // `alipays://`); an http-only guard hid the desktop QR for both channels.
  const appRoot = fileURLToPath(new URL("../../", import.meta.url));
  const cashier = readFileSync(
    join(
      appRoot,
      "../../../sdkwork-order/apps/sdkwork-order-common/packages/sdkwork-order-mobile-react-orders/src/pages/CashierPage.tsx",
    ),
    "utf8",
  );
  assert.match(cashier, /weixin\|wxpay\|alipays\?/u, "channel schemes must be scannable");
});

test("brick coverage matrix stays wired to the shared packages", () => {
  // One table pins which brick owns each migrated route, so a future refactor
  // cannot quietly reintroduce a mall-owned screen for a capability that has an
  // upstream mobile brick.
  const routes = read("../../src/routes/AppRoutes.tsx");
  const authGate = read("../../src/AuthGate.tsx");
  const cartPage = read("../../packages/sdkwork-mall-h5-cart/src/pages/CartPage.tsx");
  const orderPage = read("../../packages/sdkwork-mall-h5-order/src/pages/OrderPage.tsx");
  const detailPage = read("../../packages/sdkwork-mall-h5-order/src/pages/OrderDetailPage.tsx");
  const logisticsPage = read("../../packages/sdkwork-mall-h5-order/src/pages/LogisticsPage.tsx");
  const profilePage = read("../../packages/sdkwork-mall-h5-buyer/src/pages/ProfilePage.tsx");
  const passwordPage = read("../../packages/sdkwork-mall-h5-buyer/src/pages/PasswordPage.tsx");

  assert.match(authGate, /@sdkwork\/iam-h5-auth/u, "login plane = IAM H5 auth brick");
  assert.match(cartPage, /@sdkwork\/shop-mobile-react-shopping/u, "cart = shop mobile shopping brick");
  assert.match(orderPage, /@sdkwork\/order-mobile-react-orders/u, "order list = order brick components");
  assert.match(detailPage, /<OrderDetail/u, "order detail = order brick page");
  assert.match(routes, /module\.CashierPage/u, "cashier = order brick page");
  assert.match(routes, /module\.RefundRequestsPage/u, "refunds = order brick page");
  assert.match(routes, /module\.VoucherCodePage/u, "vouchers = order brick page");
  assert.match(logisticsPage, /<OrderShipmentPage/u, "logistics = order brick page");
  assert.match(
    read("../../packages/sdkwork-mall-h5-account/src/pages/WalletPage.tsx"),
    /@sdkwork\/account-mobile-react-wallet/u,
    "wallet = account wallet brick",
  );
  assert.match(
    read("../../packages/sdkwork-mall-h5-account/src/pages/PointsPage.tsx"),
    /@sdkwork\/account-mobile-react-wallet/u,
    "points = account wallet brick",
  );
  assert.match(
    read("../../packages/sdkwork-mall-h5-membership/src/pages/MembershipPage.tsx"),
    /@sdkwork\/membership-mobile-react-subscription/u,
    "membership = membership subscription brick",
  );
  assert.match(
    read("../../src/bootstrap/runtime.ts"),
    /configureSdkworkMallH5MembershipBrick/u,
    "the membership brick runtime is composed",
  );
  assert.match(
    read("../../src/bootstrap/runtime.ts"),
    /configureSdkworkMallH5WalletBrick/u,
    "the wallet brick runtime is composed",
  );
  assert.match(profilePage, /SdkworkIamH5UserCenterProfileScreen/u, "profile = IAM user-center brick");
  assert.match(passwordPage, /SdkworkIamH5UserCenterPasswordScreen/u, "password = IAM user-center brick");
  // Checkout is the last funnel screen: it is now the shop brick's page with
  // the host checkout runtime (no mall-owned confirm-order form).
  assert.match(
    read("../../packages/sdkwork-mall-h5-cart/src/pages/CheckoutPage.tsx"),
    /@sdkwork\/shop-mobile-react-shopping/u,
  );
});

test("the confirm-order page is the shop brick's checkout", () => {
  // Checkout is the last funnel screen; it now lives in the shop brick with a
  // host checkout runtime. The mall cart package keeps only the adapter and the
  // cashier handoff.
  const manifest = JSON.parse(read("../../packages/sdkwork-mall-h5-cart/package.json"));
  assert.ok(
    manifest.dependencies["@sdkwork/shop-mobile-react-shopping"],
    "the cart package must depend on the shop shopping brick",
  );

  const checkoutPage = read("../../packages/sdkwork-mall-h5-cart/src/pages/CheckoutPage.tsx");
  assert.match(checkoutPage, /CheckoutPage as ShopCheckoutPage/u);
  assert.match(checkoutPage, /<ShopCheckoutPage/u);
  assert.doesNotMatch(checkoutPage, /submitMallH5CheckoutOrder/u, "no mall-owned checkout form may remain");

  const adapter = read("../../packages/sdkwork-mall-h5-cart/src/checkout-brick.ts");
  assert.match(adapter, /configureShopMobileCheckoutRuntime/u);
  assert.match(adapter, /submitMallH5CheckoutOrder/u, "the host keeps the cashier handoff");

  const runtime = read("../../src/bootstrap/runtime.ts");
  assert.match(runtime, /configureSdkworkMallH5CheckoutBrick/u);

  const shell = read("../../packages/sdkwork-mall-h5-shell/src/index.tsx");
  assert.match(shell, /pathname === "\/checkout"/u, "the brick page owns its chrome");
});

test("the home hero carousel stays full-bleed, poster-sized and pausable", () => {
  // Regression guard for the storefront hero. It used to render as a rounded,
  // inset strip: each slide carried a 0.6rem horizontal margin while still
  // being `flex: 0 0 100%`, so the track was wider than the viewport and every
  // snap landed between two posters. The hero must also keep a real poster
  // height (a text-strip height was the other half of the defect) and expose a
  // pause control, because it rotates on its own.
  const css = read("../../src/index.css");

  const rule = (selector) => {
    const match = css.match(new RegExp(`(?:^|\\n)\\${selector}\\s*\\{([^}]*)\\}`, "u"));
    assert.ok(match, `index.css must define ${selector}`);
    return match[1];
  };

  const carousel = rule(".sdk-h5-hero-carousel");
  assert.match(carousel, /margin:\s*0;/u, "the hero must not carry outer spacing");
  assert.match(carousel, /border-radius:\s*0;/u, "a full-bleed hero keeps square corners");
  assert.match(carousel, /height:\s*clamp\(/u, "the hero owns a poster height");

  const track = rule(".sdk-h5-hero-track");
  assert.match(track, /transition:\s*transform/u, "slide changes must be animated");

  const slide = rule(".sdk-h5-hero-slide");
  assert.match(slide, /flex:\s*0 0 100%;/u, "one slide is exactly one viewport wide");
  assert.match(slide, /margin:\s*0;/u, "a slide margin would break every snap position");

  const homePage = rule(".sdk-h5-home-page");
  assert.match(homePage, /padding-top:\s*0;/u, "no page gutter above the hero");

  assert.match(
    css,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.sdk-h5-hero-track\s*\{[^}]*transition:\s*none;/u,
    "reduced-motion visitors get instant snaps",
  );

  const homeSource = read("../../packages/sdkwork-mall-h5-home/src/pages/HomePage.tsx");
  assert.match(homeSource, /sdk-h5-home-page/u, "the home page mounts the flush-top hero surface");
  assert.match(homeSource, /prefers-reduced-motion/u, "auto-rotation respects the motion preference");
  assert.match(homeSource, /home\.banners\.pause/u, "auto-rotation exposes a pause control");
  assert.match(homeSource, /inert=/u, "off-screen slides must not stay focusable");
});

test("category grids derive their icons from the shared category visual table", () => {
  // The commerce category API carries no icon column, so every category grid
  // has to derive one. Deriving it from the array index (the old home grid)
  // couples the glyph to the server's sort order and gives "美妆个护" a coffee
  // cup; the shared resolver keys off the stable category code/name instead.
  const home = read("../../packages/sdkwork-mall-h5-home/src/pages/HomePage.tsx");
  const catalog = read("../../packages/sdkwork-mall-h5-catalog/src/pages/CatalogPage.tsx");
  const homeService = read("../../packages/sdkwork-mall-h5-home/src/home-service.ts");

  for (const [label, source] of [
    ["home", home],
    ["catalog", catalog],
  ]) {
    assert.match(
      source,
      /resolveSdkworkMallH5CategoryVisual/u,
      `${label} category grid must resolve its icon from the shared table`,
    );
    assert.match(
      source,
      /sdk-h5-category-icon/u,
      `${label} category grid must render an icon tile per category`,
    );
  }

  assert.doesNotMatch(home, /CATEGORY_ICONS/u, "the home grid must not cycle icons by index");
  assert.match(
    homeService,
    /parentId/u,
    "the home grid must show first-level categories, not a roots/leaves mix",
  );
});

test("the home surface keeps icon entries and real loading/empty states", () => {
  // A home page that only renders "加载中..." text and silently disappears when
  // the feed is empty reads as broken on a phone. The surface must keep the
  // entry wheel iconised, show a skeleton during the first load, and offer an
  // in-place retry when the feed comes back empty.
  const home = read("../../packages/sdkwork-mall-h5-home/src/pages/HomePage.tsx");

  assert.match(home, /sdk-h5-quick-icon/u, "quick entries carry an icon tile");
  assert.match(home, /sdk-h5-home-skeleton/u, "first load renders a skeleton");
  assert.match(home, /aria-busy=\{loading\}/u, "the page reports its busy state");
  assert.match(home, /sdk-h5-home-empty/u, "an empty feed renders a recovery surface");
  assert.match(home, /home\.empty\.retry/u, "the empty surface offers a retry");
  assert.match(home, /onRetry=\{reloadHome\}/u, "load failures retry in place");

  const messages = JSON.parse(
    read("../../src/i18n/zh-CN/storefront/home/messages.json"),
  );
  for (const key of ["more", "title", "hint", "retry"]) {
    assert.ok(
      key in (key === "more" ? messages.home.actions : messages.home.empty),
      `home catalogue must define ${key}`,
    );
  }
  assert.ok(messages.home.shops?.ratingAria, "shop ratings need an accessible label");
});

test("the H5 surface stays flat: no decorative gradients or content elevation", () => {
  // Product direction (2026-11): a borderless flat language, because the
  // gradient/elevation style fatigued quickly and dated the app. Solid fills
  // only; content surfaces are flat blocks on one gray plane; overlays are the
  // only elevated layer; dense lists and sticky chrome keep a 5% hairline.
  const css = read("../../src/index.css");

  assert.doesNotMatch(css, /linear-gradient|radial-gradient/u, "decorative gradients are forbidden");
  assert.match(css, /--sdk-h5-shadow-1:\s*none;/u, "content elevation is off");
  assert.match(css, /--sdk-h5-shadow-2:\s*none;/u, "content elevation is off");
  assert.match(css, /--sdk-h5-shadow-overlay:/u, "overlays keep the only shadow");
  assert.match(css, /--sdk-h5-topbar-bg:\s*#/u, "the top bar is a solid brand plane");

  for (const [label, pattern] of [
    ["shop cards", /\.sdk-h5-shop-card\s*\{[^}]*\}/u],
    ["catalog tiles", /\.sdk-h5-catalog-child-card\s*\{[^}]*\}/u],
    ["banners", /\.sdk-h5-banner\s*\{[^}]*\}/u],
  ]) {
    const match = css.match(pattern);
    assert.ok(match, `expected a CSS rule for ${label}`);
    assert.doesNotMatch(match[0], /border:\s*[1-9]/u, `${label} must be borderless`);
    assert.doesNotMatch(match[0], /box-shadow:\s*(?!none)/u, `${label} must not elevate`);
  }

  assert.doesNotMatch(
    css,
    /border:\s*1px solid var\(--sdk-h5-border\)/u,
    "content surfaces must not keep 1px borders",
  );
});

test("the search results surface keeps an editable query field", () => {
  // Entering search from the shell header used to land on a results screen with
  // no input at all: the query could only be changed by going back. The results
  // surface owns a flat query field that rewrites the route query.
  const catalog = read("../../packages/sdkwork-mall-h5-catalog/src/pages/CatalogPage.tsx");
  assert.match(catalog, /role="search"/u, "the query field is a search landmark");
  assert.match(catalog, /sdk-h5-search-field/u, "the query field uses the flat field style");
  assert.match(catalog, /submitKeyword/u, "submitting the field rewrites the query");
  assert.match(catalog, /enterKeyHint="search"/u, "the mobile keyboard offers a search action");
});

test("primary list surfaces share one flat empty-state primitive", () => {
  // Every list used to render a bare line of text, so "no rows" looked like a
  // rendering failure and the tone changed page by page. The shared primitive
  // keeps one flat composition across the main buyer surfaces.
  const pages = [
    "../../packages/sdkwork-mall-h5-order/src/pages/OrderPage.tsx",
    "../../packages/sdkwork-mall-h5-buyer/src/pages/FavoritesPage.tsx",
    "../../packages/sdkwork-mall-h5-buyer/src/pages/CouponsPage.tsx",
    "../../packages/sdkwork-mall-h5-buyer/src/pages/AddressesPage.tsx",
    "../../packages/sdkwork-mall-h5-im/src/pages/NoticesPage.tsx",
  ];
  for (const page of pages) {
    assert.match(
      read(page),
      /SdkworkMallH5EmptyState/u,
      `${page} must render the shared empty state`,
    );
  }

  // Wallet/points moved to the account wallet brick; the brick keeps its flat
  // empty composition for an empty ledger and empty point lots.
  const walletBrickDir = join(
    fileURLToPath(new URL("../../", import.meta.url)),
    "../../../sdkwork-account/apps/sdkwork-account-common/packages/sdkwork-account-mobile-react-wallet/src",
  );
  assert.match(
    readFileSync(join(walletBrickDir, "WalletPage.tsx"), "utf8"),
    /accountWallet\.ledgerEmpty/u,
    "the wallet brick renders its flat empty-ledger state",
  );
  assert.match(
    readFileSync(join(walletBrickDir, "PointsPage.tsx"), "utf8"),
    /accountWallet\.lotsEmpty/u,
    "the wallet brick renders its flat empty-lots state",
  );

  const css = read("../../src/index.css");
  const rule = css.match(/\.sdk-h5-empty-state\s*\{[^}]*\}/u);
  assert.ok(rule, "the empty-state primitive must be styled");
  assert.doesNotMatch(rule[0], /border|box-shadow|gradient/u, "the empty state stays flat");
});

test("mall H5 route ids align with the PC root registry", () => {
  const expectedRouteIds = new Set([
    "storefront.mall.home",
    "storefront.mall.categories",
    "storefront.mall.category-detail",
    "storefront.mall.search",
    "storefront.mall.product-detail",
    "storefront.mall.shop",
    "storefront.mall.activity-list",
    "storefront.mall.activity-detail",
    "storefront.mall.cart",
    "storefront.mall.checkout",
    "storefront.mall.payment-result",
    "buyer.mall.dashboard",
    "buyer.mall.orders",
    "buyer.mall.orders.logistics",
    "buyer.mall.addresses",
    "buyer.mall.coupons",
    "buyer.mall.after-sales",
    "buyer.mall.invoices",
    "buyer.mall.wallet",
    "buyer.mall.points",
    "buyer.mall.membership",
    "buyer.mall.favorites",
    "buyer.mall.footprint",
    "buyer.mall.messages",
  ]);
  const routeSources = [
    "../../packages/sdkwork-mall-h5-home/src/routes.ts",
    "../../packages/sdkwork-mall-h5-catalog/src/routes.ts",
    "../../packages/sdkwork-mall-h5-cart/src/routes.ts",
    "../../packages/sdkwork-mall-h5-order/src/routes.ts",
    "../../packages/sdkwork-mall-h5-buyer/src/routes.ts",
    "../../packages/sdkwork-mall-h5-account/src/routes.ts",
    "../../packages/sdkwork-mall-h5-membership/src/routes.ts",
    "../../packages/sdkwork-mall-h5-shop/src/routes.ts",
    "../../packages/sdkwork-mall-h5-activity/src/routes.ts",
  ];
  const collected = new Set();
  for (const source of routeSources) {
    for (const match of read(source).matchAll(/id:\s*"([^"]+)"/gu)) {
      collected.add(match[1]);
    }
  }
  for (const routeId of expectedRouteIds) {
    assert.ok(collected.has(routeId), `route id ${routeId} must be registered`);
  }
});

test("mall H5 packages never import retired commerce transports", () => {
  // Built from parts so this assertion file does not itself contain the
  // retired transport specifiers the workspace import gate greps for.
  const scope = "@sdkwork/";
  const forbidden = [
    `${scope}commerce-app-sdk`,
    `${scope}commerce-backend-sdk`,
    "sdkwork-commerce-app-sdk-generated",
    "sdkwork-commerce-backend-sdk-generated",
  ];
  const files = [
    "../../src/bootstrap/iamRuntime.ts",
    "../../src/bootstrap/commerceProviders.ts",
    "../../packages/sdkwork-mall-h5-home/src/home-service.ts",
    "../../packages/sdkwork-mall-h5-catalog/src/catalog-service.ts",
    "../../packages/sdkwork-mall-h5-cart/src/cart-service.ts",
  ];
  for (const file of files) {
    const source = read(file);
    for (const specifier of forbidden) {
      assert.ok(!source.includes(specifier), `${file} must not import ${specifier}`);
    }
  }
});

test("mall H5 commerce consumption goes through the shared facade", () => {
  for (const file of [
    "../../packages/sdkwork-mall-h5-home/src/home-service.ts",
    "../../packages/sdkwork-mall-h5-catalog/src/catalog-service.ts",
    "../../packages/sdkwork-mall-h5-cart/src/cart-service.ts",
  ]) {
    assert.match(read(file), /getSdkworkCommerceService/u, `${file} must consume the commerce service facade`);
  }
});

test("every in-app H5 link resolves to a mounted route", () => {
  // A link to a path the router does not mount lands on the catch-all "page
  // does not exist" screen. That is a user-visible defect the route registry
  // can prove statically, so no page link should be able to regress silently.
  const packagesRoot = fileURLToPath(new URL("../../packages/", import.meta.url));
  const routePaths = collectRoutePaths(packagesRoot);
  const nonRoutePaths = new Set([
    // IAM auth gate owned by @sdkwork/auth-pc-react (rendered before AppRoutes).
    "/auth/login",
  ]);

  const unresolved = [];
  for (const file of collectTsx(packagesRoot)) {
    const source = readFileSync(file, "utf8");
    const relative = file.replace(packagesRoot, "").replace(/\\/gu, "/");
    for (const match of source.matchAll(/to="(\/[^"$]*)"|navigate\("(\/[^"$]*)"/gu)) {
      const target = match[1] ?? match[2] ?? "";
      const pathOnly = target.split("?")[0].split("#")[0];
      if (pathOnly === "" || nonRoutePaths.has(pathOnly)) {
        continue;
      }
      if (!routePaths.some((registered) => matchesRoutePath(registered, pathOnly))) {
        unresolved.push(`${relative} → ${target}`);
      }
    }
  }

  assert.deepEqual(
    unresolved,
    [],
    `Links target paths the H5 router does not mount:\n${unresolved.join("\n")}`,
  );
});

function collectRoutePaths(packagesRoot) {
  const paths = [];
  for (const packageName of readdirSync(packagesRoot, { withFileTypes: true })) {
    if (!packageName.isDirectory()) {
      continue;
    }
    const routesFile = join(packagesRoot, packageName.name, "src", "routes.ts");
    if (!existsSync(routesFile)) {
      continue;
    }
    for (const match of readFileSync(routesFile, "utf8").matchAll(/path:\s*"([^"]+)"/gu)) {
      paths.push(match[1]);
    }
  }
  return paths;
}

function collectTsx(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      // Never descend into linked dependencies.
      if (entry.name === "node_modules" || entry.name === "dist") {
        continue;
      }
      files.push(...collectTsx(entryPath));
    } else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
      files.push(entryPath);
    }
  }
  return files;
}

/** `/categories/:categoryId` matches `/categories/42`; exact paths match only themselves. */
function matchesRoutePath(registered, target) {
  const registeredSegments = registered.split("/").filter(Boolean);
  const targetSegments = target.split("/").filter(Boolean);
  if (registeredSegments.length !== targetSegments.length) {
    return false;
  }
  return registeredSegments.every(
    (segment, index) => segment.startsWith(":") || segment === targetSegments[index],
  );
}

test("mall H5 capability packages are individually typecheckable", () => {
  // The root `tsc` resolves the app bootstrap, which imports the federated
  // commerce facade. While that facade subpath is missing upstream, only
  // per-package typechecks can prove a capability package is sound, so every
  // package the app root declares must carry its own tsconfig.
  const manifest = JSON.parse(read("../../package.json"));
  const declared = Object.keys({
    ...(manifest.dependencies ?? {}),
    ...(manifest.devDependencies ?? {}),
  }).filter((name) => name.startsWith("@sdkwork/mall-h5-"));
  assert.ok(declared.length > 0, "the H5 app root must declare its capability packages");

  const packagesRoot = fileURLToPath(new URL("../../packages/", import.meta.url));
  const missing = [];
  for (const entry of readdirSync(packagesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const packageJsonPath = join(packagesRoot, entry.name, "package.json");
    if (!existsSync(packageJsonPath)) {
      continue;
    }
    const packageName = JSON.parse(readFileSync(packageJsonPath, "utf8")).name;
    if (!declared.includes(packageName)) {
      continue;
    }
    if (!existsSync(join(packagesRoot, entry.name, "tsconfig.json"))) {
      missing.push(entry.name);
    }
  }

  assert.deepEqual(
    missing,
    [],
    `H5 packages must declare tsconfig.json so scripts/typecheck-mall-packages.mjs covers them: ${missing.join(", ")}`,
  );
});

test("no H5 capability route is an orphan screen", () => {
  // The inverse of the link check: a registered route that nothing links to is
  // implemented but unreachable. The page module for each path is resolved from
  // the router, so a page's own self-reference cannot satisfy the check. Tab
  // roots are entered from the tab bar and are exempt.
  const packagesRoot = fileURLToPath(new URL("../../packages/", import.meta.url));
  const appRoot = fileURLToPath(new URL("../../", import.meta.url));
  const routerSource = read("../../src/routes/AppRoutes.tsx");
  const tabPaths = new Set(["/", "/categories", "/cart", "/buyer"]);
  // Entered by an external redirect, not an in-app link: payment channels send
  // the payer back to the result URL, and old payment sessions still land here.
  // The brick cashier is the live payment surface, so this route has no in-app
  // link by design.
  const externalEntryPaths = new Set(["/payment/result"]);

  const packageDirectories = new Map();
  for (const entry of readdirSync(packagesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const packageJsonPath = join(packagesRoot, entry.name, "package.json");
    if (!existsSync(packageJsonPath)) {
      continue;
    }
    packageDirectories.set(
      JSON.parse(readFileSync(packageJsonPath, "utf8")).name,
      join(packagesRoot, entry.name),
    );
  }

  const lazyModules = new Map();
  for (const match of routerSource.matchAll(/const (\w+) = lazy\(\(\)[\s\S]*?import\("([^"]+)"\)/gu)) {
    lazyModules.set(match[1], match[2]);
  }

  const pageModuleByPath = new Map();
  for (const segment of routerSource.split("<Route").slice(1)) {
    const pathMatch = segment.match(/path="([^"]+)"/u);
    const componentMatch = segment.match(/<([A-Z]\w+)/u);
    if (!pathMatch || !componentMatch) {
      continue;
    }
    const specifier = lazyModules.get(componentMatch[1]);
    if (!specifier) {
      continue;
    }
    const [packageName, ...subpathParts] = specifier.split("/");
    const packageNameWithScope = specifier.startsWith("@")
      ? [packageName, subpathParts.shift()].join("/")
      : packageName;
    const subpath = subpathParts.join("/");
    const packageDirectory = packageDirectories.get(packageNameWithScope);
    if (!packageDirectory) {
      continue;
    }
    const exportsMap = JSON.parse(readFileSync(join(packageDirectory, "package.json"), "utf8")).exports ?? {};
    const entry = exportsMap[subpath ? `./${subpath}` : "."];
    const relativeModule = entry?.import ?? entry?.default;
    if (typeof relativeModule !== "string") {
      continue;
    }
    pageModuleByPath.set(pathMatch[1], join(packageDirectory, relativeModule));
  }

  const linkSources = collectTsx(packagesRoot)
    .concat(collectTsx(join(appRoot, "src")))
    .filter((file) => !file.endsWith("routes.ts") && !file.endsWith("AppRoutes.tsx"));

  const orphans = [];
  for (const registered of collectRoutePaths(packagesRoot)) {
    if (tabPaths.has(registered) || externalEntryPaths.has(registered)) {
      continue;
    }
    const needle = registered.split("/:")[0];
    if (!needle) {
      continue;
    }
    const ownModule = pageModuleByPath.get(registered);
    const linked = linkSources.some((file) => {
      if (ownModule && file === ownModule) {
        return false;
      }
      const source = readFileSync(file, "utf8");
      return source.includes(`"${needle}`) || source.includes(`\`${needle}`);
    });
    if (!linked) {
      orphans.push(registered);
    }
  }

  assert.deepEqual(
    orphans,
    [],
    `Routes with no in-app entry (implemented but unreachable):\n${orphans.join("\n")}`,
  );
});

test("every H5 page component exposes an accessible page heading", () => {
  // The shell navbar is a styled div, not a heading, so assistive technology
  // gets no page title unless the page renders its own <h1>. Visual users see
  // the navbar title; screen-reader users need the heading.
  const packagesRoot = fileURLToPath(new URL("../../packages/", import.meta.url));
  const appRoot = fileURLToPath(new URL("../../", import.meta.url));
  const missing = [];
  let pages = 0;
  for (const entry of readdirSync(packagesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const pagesDirectory = join(packagesRoot, entry.name, "src", "pages");
    if (!existsSync(pagesDirectory)) {
      continue;
    }
    for (const file of readdirSync(pagesDirectory)) {
      if (!file.endsWith(".tsx")) {
        continue;
      }
      pages += 1;
      const pageKey = `${entry.name}/${file}`;
      if (/<h1[\s>]/u.test(readFileSync(join(pagesDirectory, file), "utf8"))) {
        continue;
      }
      // Wrapper pages delegate their whole surface (including the visible
      // heading) to a brick page; the brick must own that <h1> instead.
      if (pageKey === "sdkwork-mall-h5-cart/CartPage.tsx") {
        const brickCartPage = readFileSync(
          join(
            appRoot,
            "../../../sdkwork-shop/apps/sdkwork-shop-common/packages/sdkwork-shop-mobile-react-shopping/src/pages/ShoppingCart.tsx",
          ),
          "utf8",
        );
        assert.match(brickCartPage, /<h1[\s>]/u, "the cart brick must render the page heading");
        continue;
      }
      if (pageKey === "sdkwork-mall-h5-cart/CheckoutPage.tsx") {
        const brickCheckoutPage = readFileSync(
          join(
            appRoot,
            "../../../sdkwork-shop/apps/sdkwork-shop-common/packages/sdkwork-shop-mobile-react-shopping/src/pages/CheckoutPage.tsx",
          ),
          "utf8",
        );
        assert.match(brickCheckoutPage, /<h1[\s>]/u, "the checkout brick must render the page heading");
        continue;
      }
      if (pageKey === "sdkwork-mall-h5-order/LogisticsPage.tsx") {
        const brickShipmentPage = readFileSync(
          join(
            appRoot,
            "../../../sdkwork-order/apps/sdkwork-order-common/packages/sdkwork-order-mobile-react-orders/src/pages/OrderShipmentPage.tsx",
          ),
          "utf8",
        );
        assert.match(brickShipmentPage, /<h1[\s>]/u, "the shipment brick must render the page heading");
        continue;
      }
      if (pageKey === "sdkwork-mall-h5-membership/MembershipPage.tsx") {
        const brickMembershipPage = readFileSync(
          join(
            appRoot,
            "../../../sdkwork-membership/apps/sdkwork-membership-common/packages/sdkwork-membership-mobile-react-subscription/src/MembershipSubscriptionPage.tsx",
          ),
          "utf8",
        );
        assert.match(brickMembershipPage, /<h1[\s>]/u, "the membership brick must render the page heading");
        continue;
      }
      if (
        pageKey === "sdkwork-mall-h5-account/WalletPage.tsx"
        || pageKey === "sdkwork-mall-h5-account/PointsPage.tsx"
      ) {
        const walletBrickPage = readFileSync(
          join(
            appRoot,
            pageKey.endsWith("WalletPage.tsx")
              ? "../../../sdkwork-account/apps/sdkwork-account-common/packages/sdkwork-account-mobile-react-wallet/src/WalletPage.tsx"
              : "../../../sdkwork-account/apps/sdkwork-account-common/packages/sdkwork-account-mobile-react-wallet/src/PointsPage.tsx",
          ),
          "utf8",
        );
        assert.match(walletBrickPage, /<h1[\s>]/u, "the wallet brick must render the page heading");
        continue;
      }
      if (
        pageKey === "sdkwork-mall-h5-buyer/ProfilePage.tsx"
        || pageKey === "sdkwork-mall-h5-buyer/PasswordPage.tsx"
      ) {
        const kitFrame = readFileSync(
          join(
            appRoot,
            "../../../sdkwork-iam/apps/sdkwork-iam-h5/packages/sdkwork-iam-h5-commons/src/components/layout.tsx",
          ),
          "utf8",
        );
        assert.match(kitFrame, /<h1[\s>]/u, "the IAM H5 screen frame must render the page heading");
        continue;
      }
      missing.push(pageKey);
    }
  }

  assert.ok(pages > 0, "expected H5 page components");
  assert.deepEqual(missing, [], `H5 page components without a <h1> heading:\n${missing.join("\n")}`);
});

test("H5 pages use the shared error state instead of a bare error div", () => {
  // Load failures used to render a red div with no recovery path: the user had
  // to reload the whole app. The shared `SdkworkMallH5ErrorState` keeps the
  // alert semantics and offers a retry, and form/action messages use the notice
  // tone instead of the error banner.
  const packagesRoot = fileURLToPath(new URL("../../packages/", import.meta.url));
  const violations = [];
  for (const entry of readdirSync(packagesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const pagesDirectory = join(packagesRoot, entry.name, "src", "pages");
    if (!existsSync(pagesDirectory)) {
      continue;
    }
    for (const file of readdirSync(pagesDirectory)) {
      if (!file.endsWith(".tsx")) {
        continue;
      }
      const source = readFileSync(join(pagesDirectory, file), "utf8");
      if (source.includes("sdk-h5-error")) {
        violations.push(`${entry.name}/${file}`);
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Use SdkworkMallH5ErrorState (or a notice tone for validation messages):\n${violations.join("\n")}`,
  );
});

test("H5 pages that report a load failure expose the shared recovery path", () => {
  // Reporting "<x>加载失败" in a transient toast or a warning notice leaves the
  // buyer with a broken screen and no way to retry short of reloading the app.
  // Any page that can surface a load-failure message must render the shared
  // retry banner, so the recovery path is guaranteed by construction.
  const packagesRoot = fileURLToPath(new URL("../../packages/", import.meta.url));
  const violations = [];
  for (const entry of readdirSync(packagesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const pagesDirectory = join(packagesRoot, entry.name, "src", "pages");
    if (!existsSync(pagesDirectory)) {
      continue;
    }
    for (const file of readdirSync(pagesDirectory)) {
      if (!file.endsWith(".tsx")) {
        continue;
      }
      const source = readFileSync(join(pagesDirectory, file), "utf8");
      if (source.includes("加载失败") && !source.includes("SdkworkMallH5ErrorState")) {
        violations.push(`${entry.name}/${file}`);
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    `A page that reports a load failure must render SdkworkMallH5ErrorState with a retry:\n${violations.join("\n")}`,
  );
});