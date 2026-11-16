import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

/**
 * Mini-program tab bar parity with the H5 shell.
 *
 * Authority: `APP_MOBILE_REACT_UI_SPEC.md` section 5 and
 * `@sdkwork/mall-h5-shell` `SHELL_TABS`. The H5 shell renders five tabs
 * (首页 / 分类 / 消息 / 购物车 / 我的) and badges the cart tab with the total
 * quantity. The mini program declares the same five tabs in `app.json`; this
 * guard keeps the two lists from drifting.
 */
const workspaceRoot = path.resolve(import.meta.dirname, "..", "..");
const h5 = path.join(workspaceRoot, "apps", "sdkwork-mall-h5");
const mp = path.join(workspaceRoot, "apps", "sdkwork-mall-mini-program");

function read(base, relative) {
  const absolute = path.join(base, relative);
  assert.ok(existsSync(absolute), `missing ${path.relative(workspaceRoot, absolute)}`);
  return readFileSync(absolute, "utf8");
}

/** Labels of the H5 shell's `SHELL_TABS` declaration, in order. */
function h5ShellTabLabels() {
  const source = read(h5, "packages/sdkwork-mall-h5-shell/src/index.tsx");
  const block = source.slice(source.indexOf("const SHELL_TABS"), source.indexOf("];", source.indexOf("const SHELL_TABS")));
  return [...block.matchAll(/label:\s*"([^"]+)"/gu)].map((match) => match[1]);
}

test("the mini-program tab bar mirrors the H5 shell tabs", () => {
  const appJson = JSON.parse(read(mp, "src/app.json"));
  const mpLabels = appJson.tabBar.list.map((entry) => entry.text);
  assert.deepEqual(mpLabels, h5ShellTabLabels());
  assert.equal(appJson.tabBar.list.length, 5);
});

test("every tab declares both icon states and a registered page", () => {
  const appJson = JSON.parse(read(mp, "src/app.json"));
  const registered = new Set(appJson.pages);
  for (const entry of appJson.tabBar.list) {
    assert.ok(registered.has(entry.pagePath), `${entry.pagePath} must be registered in app.json pages`);
    for (const key of ["iconPath", "selectedIconPath"]) {
      assert.ok(existsSync(path.join(mp, "src", entry[key])), `${entry.pagePath}: ${key} asset is missing`);
    }
  }
});

test("the messages tab is a tab capability, so pages switch instead of push", () => {
  const capabilities = read(mp, "src/routes/capabilities.ts");
  const block = capabilities.slice(
    capabilities.indexOf("MP_TAB_CAPABILITY_ROUTES"),
    capabilities.indexOf("];", capabilities.indexOf("MP_TAB_CAPABILITY_ROUTES")),
  );
  for (const routeId of ["storefront.mall.home", "storefront.mall.categories", "buyer.mall.im.chats", "storefront.mall.cart", "buyer.mall.dashboard"]) {
    assert.match(block, new RegExp(`"${routeId.replace(/\./gu, "\\.")}"`, "u"), `${routeId} must be a tab capability`);
  }
});

test("the cart tab carries the total-quantity badge like the H5 shell", () => {
  const service = read(mp, "src/services/tab-bar-service.ts");
  assert.match(service, /MP_TAB_BAR_TABS/u);
  assert.match(service, /MP_CART_TAB_INDEX = 3/u);
  assert.match(service, /sdkwork-mall-mp-cart-count/u);
  assert.match(service, /reduce\(\(sum, item\) => sum \+ \(Number\(item\.quantity\) \|\| 0\), 0\)/u);
  assert.match(service, /platform\.tabBarBadge\(MP_CART_TAB_INDEX/u);

  // The host must expose the badge API and the platform facade must project it.
  const navigation = read(mp, "packages/sdkwork-mall-mp-host/src/weixin/navigation.ts");
  assert.match(navigation, /setTabBarBadge/u);
  assert.match(navigation, /removeTabBarBadge/u);
  const facade = read(mp, "packages/sdkwork-mall-mp-core/src/platform/index.ts");
  assert.match(facade, /tabBarBadge\(index: number, text\?: string\)/u);
});

test("the badge is reconciled by the app entry and the cart flows", () => {
  const appEntry = read(mp, "src/app.ts");
  assert.match(appEntry, /applyCartTabBadge\(\)/u);
  assert.match(appEntry, /syncCartTabBadge\(\)/u);
  for (const page of ["src/pages/cart/index.ts", "src/pages/product/index.ts", "src/pages/checkout/index.ts"]) {
    const source = read(mp, page);
    assert.match(source, /setCartTabBadge|syncCartTabBadge/u, `${page} must keep the badge in step`);
  }
});
