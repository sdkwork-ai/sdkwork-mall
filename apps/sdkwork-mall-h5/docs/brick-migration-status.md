# Brick migration status

Status snapshot of the H5 brick-composition migration
(`docs/decisions.md` keeps the per-change decision log). The app is the
storefront shell; capabilities with an upstream mobile brick are composed from
that brick with a host-injected runtime port. Application-specific storefront
surfaces stay in the mall packages by design.

## Capability matrix

| Capability | Route(s) | Owning brick | Mall adapter / host wiring |
| --- | --- | --- | --- |
| Login / session | `/auth/*` | `@sdkwork/iam-h5-auth` | `src/bootstrap/iamRuntime.ts` (`createIamH5RuntimeService`, session commit into the host store) |
| Order list | `/buyer/orders` | `@sdkwork/order-mobile-react-orders` (card/tab components) | `configureOrderMobileRuntime` with the order SDK client |
| Order detail | `/buyer/orders/:orderId` | order brick page | `OrderDetailPage.tsx` wrapper |
| Cashier | `/buyer/orders/:orderId/cashier` | order brick page | host route templates (order center/detail) |
| Refunds | `/buyer/refunds` | order brick page | buyer hub + order detail entry; shell page-owned chrome |
| Voucher redeem | `/buyer/vouchers` | order brick page | gift-card hub entry; `--order-accent` mapped to commerce blue |
| Logistics | `/buyer/logistics` | order brick `OrderShipmentPage` | `src/logistics-brick.ts` (`OrderLogisticsRuntime` → commerce order plane) |
| Cart | `/cart` | `@sdkwork/shop-mobile-react-shopping` | `src/cart-brick.ts` (`configureShopMobileCartRuntime` → `cart.current`/`cart.items`) |
| Checkout | `/checkout` | shop brick `CheckoutPage` | `src/checkout-brick.ts` (`ShopCheckoutRuntime` → commerce checkout facade + cashier handoff) |
| Profile / password | `/buyer/profile`, `/buyer/password` | `@sdkwork/iam-h5-user-center` | `src/user-center-runtime.ts` (`configureSdkworkMallH5UserCenter(iamRuntime.iamService)`) |

Application-owned (not a capability gap): home, catalog/search, product detail,
shop page, activity, buyer hub, settings, addresses, coupons, favorites,
footprint, invoices, reviews, IM/support, partner/distribution.

## Upstream changes delivered together with the app

- `sdkwork-order` order brick: card/tab component exports; compact summary card;
  order wire-status mapping (`PENDING_RECEIPT` …); shared `formatOrderDateTime`;
  voucher page/modal (removed the fake scanner, own header, tokenized accent);
  refund status normalization; `OrderShipmentPage` + `OrderLogisticsRuntime`;
  payment-params normalization and channel-scheme QR support (`weixin://`,
  `alipays://`).
- `sdkwork-shop` shopping brick: real `ShoppingCartPage` (shop grouping,
  selection, totals, checkout handoff) + `CartService` runtime port; real
  `CheckoutPage` (confirm-order form) + `CheckoutRuntime`; tokenized accent,
  placeholder-safe images, `verbatimModuleSyntax`-clean type imports.
- `sdkwork-iam` H5 auth brick: token-driven brand mark (no gradient/glow by
  default) and a browser-safe countdown timer type.
- `sdkwork-specs/workspace/consumers/sdkwork-mall.json`: registered the
  `iam-h5-core`, `iam-h5-auth`, `iam-h5-commons`, `iam-h5-user-center`,
  `order-mobile-react-orders`, `shop-mobile-react-shopping`, `ui-mobile-react`
  sibling packages; `pnpm-workspace.yaml` is generated from that registry
  (`node ../sdkwork-specs/tools/sync-workspace.mjs --repo sdkwork-mall --root .`).

## Remaining upstream gaps (not reimplemented in the app)

1. **Membership**: `@sdkwork/membership-mobile-react-subscription` is still a
   marketing demo (hardcoded plans/benefits, no backend/runtime port). It needs
   a real runtime port + service binding upstream before `MembershipPage` can
   move onto it.
2. **Wallet / points**: `sdkwork-account` has no H5 wallet brick yet. It needs a
   new mobile package upstream.
3. **Payment result boundary**: `/payment/result` remains the provider-return
   surface only; the brick cashier owns creation/QR/polling.

## Verification

```bash
pnpm run typecheck
pnpm run typecheck:packages
node --test apps/sdkwork-mall-h5/tests/contract/h5-standard-architecture.test.mjs
pnpm run test:vitest
node ../sdkwork-specs/tools/verify-repo.mjs --root .
node ../sdkwork-specs/tools/check-dependency-list-completeness.mjs --root .
node ../sdkwork-specs/tools/check-app-sdk-consumer-imports.mjs --workspace .
pnpm run check:i18n-baseline
node ../sdkwork-specs/tools/build-browser-client.mjs --app-root apps/sdkwork-mall-h5 --environment dev
```

The browser acceptance sweep (mocked gateways) measures every migrated route at
360px and 1440px, plus dark-preference checks: no horizontal overflow, zero
gradients, zero shadows, zero page/console errors. See `docs/decisions.md`
(2026-11-16 entries) for the per-round evidence.
