import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { strict as assert } from "node:assert";
import { test } from "node:test";

/**
 * Buy-now checkout scoping contract.
 *
 * "立即购买" must settle only the line it just created. Before this contract
 * every root added the product to the cart and then opened checkout for the
 * whole cart, so a buyer with other lines in the cart could pay for all of them.
 *
 * Each root proves two things statically:
 *   1. the product page passes the created cart line id to checkout, falling
 *      back to the cart (never to an unscoped checkout) when the id is missing;
 *   2. the checkout page consumes that id and resolves the payable amount from
 *      the scoped quote.
 */
const workspaceRoot = fileURLToPath(new URL("../../", import.meta.url));

const ROOTS = [
  {
    name: "pc",
    productPage:
      "apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-catalog/src/pages/CatalogPage.tsx",
    productPatterns: ["立即购买", "/checkout?items=", "/cart"],
    checkoutPage: "apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-cart/src/pages/CartPage.tsx",
    checkoutPatterns: ['params.get("items")'],
    quoteService: "apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-cart/src/cart-service.ts",
    quotePatterns: ["createMallCheckoutQuote(input.cartItemIds)", "cartItemIds: input.cartItemIds"],
  },
  {
    name: "h5",
    productPage:
      "apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-catalog/src/pages/ProductDetailPage.tsx",
    productPatterns: ["立即购买", "/checkout?items=", "/cart"],
    checkoutPage: "apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-cart/src/pages/CheckoutPage.tsx",
    checkoutPatterns: ['searchParams.get("items")'],
    quoteService: "apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-cart/src/cart-service.ts",
    quotePatterns: [
      "export async function createMallH5CheckoutQuote(",
      "cartItemIds: input.cartItemIds",
    ],
  },
  {
    name: "miniProgram",
    productPage: "apps/sdkwork-mall-mini-program/src/pages/product/index.ts",
    productPatterns: ["storefront.mall.checkout", "items: cartItemId", "storefront.mall.cart"],
    checkoutPage: "apps/sdkwork-mall-mini-program/src/pages/checkout/index.ts",
    checkoutPatterns: ["options.items"],
    quoteService: "apps/sdkwork-mall-mini-program/src/services/cart-service.ts",
    quotePatterns: ["createCheckoutQuote({ cartItemIds: options.cartItemIds })"],
  },
  {
    name: "flutter",
    productPage: "apps/sdkwork-mall-flutter-mobile/lib/pages/product_page.dart",
    productPatterns: ["pushNamed('/checkout', arguments: cartItemId)"],
    checkoutPage: "apps/sdkwork-mall-flutter-mobile/lib/pages/checkout_page.dart",
    checkoutPatterns: ["arguments.split(',')"],
    quoteService: "apps/sdkwork-mall-flutter-mobile/lib/services/cart_service.dart",
    quotePatterns: ["createCheckoutQuote("],
  },
];

function read(relativePath) {
  return readFileSync(join(workspaceRoot, relativePath), "utf8");
}

function assertContains(entry, file, source, patterns) {
  for (const pattern of patterns) {
    assert.ok(
      source.includes(pattern),
      `${entry.name} ${file} must contain ${JSON.stringify(pattern)}`,
    );
  }
}

test("every root's 立即购买 scopes checkout to the created cart line", () => {
  for (const entry of ROOTS) {
    assert.ok(existsSync(join(workspaceRoot, entry.productPage)), entry.productPage);
    assertContains(entry, entry.productPage, read(entry.productPage), entry.productPatterns);
  }
});

test("every checkout page consumes the scoped cart line ids", () => {
  for (const entry of ROOTS) {
    assert.ok(existsSync(join(workspaceRoot, entry.checkoutPage)), entry.checkoutPage);
    assertContains(entry, entry.checkoutPage, read(entry.checkoutPage), entry.checkoutPatterns);
  }
});

test("every checkout quote is requested for the scoped lines, not the whole cart", () => {
  for (const entry of ROOTS) {
    assert.ok(existsSync(join(workspaceRoot, entry.quoteService)), entry.quoteService);
    assertContains(entry, entry.quoteService, read(entry.quoteService), entry.quotePatterns);
  }
});
