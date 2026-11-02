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

/**
 * Payment providers settle asynchronously, so the result screens poll. An
 * unbounded poll (the mini-program and Flutter roots shipped one) keeps a phone
 * awake and hammering the gateway when a settlement never completes.
 */
const PAYMENT_POLLERS = [
  {
    name: "h5",
    file: "apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-cart/src/pages/PaymentResultPage.tsx",
    patterns: ["PAYMENT_POLL_MAX_ATTEMPTS"],
  },
  {
    name: "miniProgram",
    file: "apps/sdkwork-mall-mini-program/src/pages/payment-result/index.ts",
    patterns: ["PAYMENT_POLL_MAX_ATTEMPTS"],
  },
  {
    name: "flutter",
    file: "apps/sdkwork-mall-flutter-mobile/lib/pages/payment_result_page.dart",
    patterns: ["_maxPollAttempts", "Timer(_pollInterval"],
  },
];

test("payment-status polling is bounded on every polling root", () => {
  for (const entry of PAYMENT_POLLERS) {
    assert.ok(existsSync(join(workspaceRoot, entry.file)), entry.file);
    assertContains(entry, entry.file, read(entry.file), entry.patterns);
  }
});

/**
 * Invoice selection is part of the confirm-order surface: a buyer who needs an
 * invoice must be able to declare it before the order exists. PC shipped it;
 * the three mobile roots did not, so the order contract's `needInvoice` /
 * `invoiceForm` fields were unreachable there.
 */
const INVOICE_ROOTS = [
  {
    name: "pc",
    service: "apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-cart/src/cart-service.ts",
    servicePatterns: ["MallCheckoutInvoiceForm", "needInvoice", "invoiceForm"],
    pageFiles: [
      {
        path: "apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-cart/src/pages/CartPage.tsx",
        patterns: ["发票", "taxNumber", "/^[A-Z0-9]{15,20}$/"],
      },
    ],
  },
  {
    name: "h5",
    service: "apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-cart/src/cart-service.ts",
    servicePatterns: ["MallH5CheckoutInvoiceForm", "needInvoice", "invoiceForm"],
    pageFiles: [
      {
        path: "apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-cart/src/pages/CheckoutPage.tsx",
        patterns: ["checkout.invoice.need", "invoiceForm", "/^[A-Z0-9]{15,20}$/u"],
      },
    ],
  },
  {
    name: "miniProgram",
    service: "apps/sdkwork-mall-mini-program/src/services/cart-service.ts",
    servicePatterns: ["MpCheckoutInvoiceForm", "needInvoice", "invoiceForm"],
    pageFiles: [
      {
        path: "apps/sdkwork-mall-mini-program/src/pages/checkout/index.ts",
        patterns: ["invoiceForm", "/^[A-Z0-9]{15,20}$/"],
      },
      {
        path: "apps/sdkwork-mall-mini-program/src/pages/checkout/index.wxml",
        patterns: ["需要开具发票", "onInvoiceTitleInput"],
      },
    ],
  },
  {
    name: "flutter",
    service: "apps/sdkwork-mall-flutter-mobile/lib/services/cart_service.dart",
    servicePatterns: ["needInvoice", "invoiceForm"],
    pageFiles: [
      {
        path: "apps/sdkwork-mall-flutter-mobile/lib/pages/checkout_page.dart",
        patterns: ["checkout.invoice.need", "invoiceForm", "r'^[A-Z0-9]{15,20}$'"],
      },
    ],
  },
];

test("every root lets the buyer declare an invoice at checkout", () => {
  for (const entry of INVOICE_ROOTS) {
    const service = read(entry.service);
    for (const pattern of entry.servicePatterns) {
      assert.ok(
        service.includes(pattern),
        `${entry.name} checkout service must contain ${JSON.stringify(pattern)}`,
      );
    }
    for (const pageFile of entry.pageFiles) {
      const page = read(pageFile.path);
      for (const pattern of pageFile.patterns) {
        assert.ok(
          page.includes(pattern),
          `${entry.name} ${pageFile.path} must contain ${JSON.stringify(pattern)}`,
        );
      }
    }
  }
});

/**
 * Delivery selection and gift-card redemption are confirm-order choices that
 * the order command already accepts (`deliveryMethod`, `giftCardCode`). PC
 * shipped both; the mobile roots dropped them, so a phone buyer could not pick
 * a delivery speed or pay with a gift card.
 */
const DELIVERY_ROOTS = [
  {
    name: "pc",
    service: "apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-cart/src/cart-service.ts",
    servicePatterns: ["deliveryMethod", "giftCardCode"],
    pageFiles: [
      {
        path: "apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-cart/src/pages/CartPage.tsx",
        patterns: ["配送方式", "礼品卡", "DELIVERY_METHODS"],
      },
    ],
  },
  {
    name: "h5",
    service: "apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-cart/src/cart-service.ts",
    servicePatterns: ["deliveryMethod", "giftCardCode"],
    pageFiles: [
      {
        path: "apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-cart/src/pages/CheckoutPage.tsx",
        patterns: ["checkout.delivery.title", "checkout.giftCard.title", "DELIVERY_METHODS"],
      },
    ],
  },
  {
    name: "miniProgram",
    service: "apps/sdkwork-mall-mini-program/src/services/cart-service.ts",
    servicePatterns: ["deliveryMethod", "giftCardCode"],
    pageFiles: [
      {
        path: "apps/sdkwork-mall-mini-program/src/pages/checkout/index.ts",
        patterns: ["deliveryMethodCode", "giftCardApplied"],
      },
      {
        path: "apps/sdkwork-mall-mini-program/src/pages/checkout/index.wxml",
        patterns: ["配送方式", "礼品卡"],
      },
    ],
  },
  {
    name: "flutter",
    service: "apps/sdkwork-mall-flutter-mobile/lib/services/cart_service.dart",
    servicePatterns: ["deliveryMethod", "giftCardCode"],
    pageFiles: [
      {
        path: "apps/sdkwork-mall-flutter-mobile/lib/pages/checkout_page.dart",
        patterns: ["checkout.delivery.title", "checkout.giftCard.title", "_deliveryMethods"],
      },
    ],
  },
];

test("every root lets the buyer choose delivery and redeem a gift card", () => {
  for (const entry of DELIVERY_ROOTS) {
    const service = read(entry.service);
    for (const pattern of entry.servicePatterns) {
      assert.ok(
        service.includes(pattern),
        `${entry.name} checkout service must contain ${JSON.stringify(pattern)}`,
      );
    }
    for (const pageFile of entry.pageFiles) {
      const page = read(pageFile.path);
      for (const pattern of pageFile.patterns) {
        assert.ok(
          page.includes(pattern),
          `${entry.name} ${pageFile.path} must contain ${JSON.stringify(pattern)}`,
        );
      }
    }
  }
});
