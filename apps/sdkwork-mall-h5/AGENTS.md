# sdkwork-mall-h5

H5 (mobile web) storefront and buyer console for SDKWork Mall, per
`APP_H5_ARCHITECTURE_SPEC.md`. Consume federated commerce through
`@sdkwork/cloudrouter-app-sdk/domains` (client.commerce.*) and the T1 domain
services; the shared headless anchors are
`@sdkwork/mall-commerce-sdk-ports` / `@sdkwork/mall-commerce-service`.

v1 scope: storefront + buyer surfaces (home, catalog/search, product detail,
cart, checkout, payment result, orders, logistics, my). Console/admin and the
Capacitor host package are follow-ups recorded in `docs/decisions.md`.

Architecture direction (`docs/decisions.md`, 2026-11-16): brick composition.
Login/session is the shared IAM H5 brick; order, cart, account and membership
surfaces migrate to their upstream mobile bricks instead of growing more
mall-owned implementations. Upstream gaps are fixed upstream.

## IAM H5 auth brick (login / register / recovery)

- `src/AuthGate.tsx` mounts the shared brick: `SdkworkIamH5AuthRoutes` with a
  controller from `createSdkworkIamH5AuthController({ service })`. The mall root
  owns no auth screen, appearance config, QR rail or credential flow.
- `src/bootstrap/iamRuntime.ts` composes the IAM runtime with
  `createIamH5RuntimeService`, seeds it with the committed public application
  token (`readBootstrapAccessTokenFromProcessEnv`) so access-token-only login
  calls work before a session exists, re-applies the session token after every
  commit, and projects the IAM session (tokens + tenant/user context) into the
  host session store that unlocks protected routes.
- `src/index.css` must keep the `@source` root for
  `@sdkwork/iam-h5-auth`: Tailwind v4 only scans this app root, so removing it
  strips every utility class of the auth surface and the screens render with no
  layout. The same file maps the brick's documented
  `.sdkwork-iam-h5-auth-surface` tokens onto the flat mall palette; do not
  restyle the screens or fork the brick. The H5 contract test pins both.
- A missing flow (verification code delivery, OAuth provider wiring, scan login)
  is completed in `sdkwork-iam`, not reimplemented here.

## Order mobile brick

- `src/bootstrap/runtime.ts` injects the order SDK client through
  `configureOrderMobileRuntime({ client: sdkClients.orderAppClient })`; the
  brick (`@sdkwork/order-mobile-react-orders`) owns the order read/write model
  and its card/tab UI. Do not add a second order service or hand-roll order
  cards.
- `OrderPage` keeps the mall page chrome, data loading, empty/error states and
  payment navigation; it renders the brick's `OrderTabsNav` and `OrderCard`.
  `src/index.css` must keep the brick's `@source` root and map its design tokens
  (`--color-text-main/sub`, `--color-primary-blue`, `--color-border-color`,
  `--color-active-bg`, `--color-chat-other-bg`) onto the flat palette.
- Detail/cashier/refund/voucher screens already ship in the brick; move them in
  rather than growing new mall-owned order pages.
- Detail is already migrated: `/buyer/orders/:orderId` mounts the brick's
  `OrderDetail`. Because that page owns its `PageLayout` header, the shell must
  keep `isSdkworkMallH5PageOwnedChrome` in sync (no second navbar) and the host
  passes its cashier/refund templates. Never add mall-owned order detail cards
  back.
- Payment is the brick's `CashierPage` at `/buyer/orders/:orderId/cashier`
  (lazy-mounted from `@sdkwork/order-mobile-react-orders`). Order list/detail
  must navigate into it instead of creating payment sessions; the cashier owns
  methods, QR, countdown, polling and provider redirects. Checkout hands off to
  the same route (`submitMallH5CheckoutOrder` returns the cashier URL and must
  not call `orders.pay`); `/payment/result` is only the provider-return surface.
- `/buyer/vouchers` mounts the brick's `VoucherCodePage` (own header; shell
  chrome is suppressed through `isSdkworkMallH5PageOwnedChrome`). The gift-card
  hub links there; do not reintroduce the brick's old mock scanner or an
  app-owned redeem form.
- `/buyer/refunds` mounts the brick's `RefundRequestsPage` (records + create
  form); the order detail refund action and the buyer hub entry both point at
  it. Keep refund status normalization in the brick (`refundStatusKey`), not in
  the host.
- `/buyer/logistics` mounts the brick's `OrderShipmentPage`; the mall order
  package supplies shipments through `configureOrderLogisticsRuntime`
  (`src/logistics-brick.ts`). Do not rebuild the tracking timeline in the host.
- Order surfaces must format wire timestamps with the brick's
  `formatOrderDateTime` (detail, refunds, tracking), never render raw ISO.

## Membership mobile brick

- /buyer/membership mounts MembershipSubscriptionPage from
  @sdkwork/membership-mobile-react-subscription. The mall membership package
  injects the service through src/membership-brick.ts
  (configureMembershipSubscriptionRuntime -> status, plans, payment methods,
  purchase) and no longer owns level/plan/marketing markup.
- The brick renders the level hero, benefit grid, plan list, payment-method
  picker and purchase feedback; the host supplies localized amounts and the
  page owns its chrome. The app stylesheet keeps the brick's @source root.

## Wallet / points mobile brick

- /buyer/wallet and /buyer/points mount @sdkwork/account-mobile-react-wallet
  (AccountWalletWalletPage / AccountWalletPointsPage). The mall account package
  injects the data plane through src/wallet-brick.ts
  (configureAccountWalletRuntime -> loadMallH5WalletOverview, loadMallH5CashLedger,
  loadMallH5Points); do not rebuild balances, ledgers or point lots in the host.
- The brick renders the balance hero, cash ledger, point lots and the
  loading/error/empty states; the host only supplies localized amounts. The
  app stylesheet must keep the @source root for the account wallet package.

## Account mobile brick (IAM user center)

- Profile and password are the IAM H5 user-center bricks
  (`@sdkwork/iam-h5-user-center` + `@sdkwork/iam-h5-commons`), wrapped with
  `SdkworkIamH5I18nProvider` + `IAM_H5_USER_CENTER_I18N_CATALOG`. The mall root
  injects its single IAM service through
  `configureSdkworkMallH5UserCenter(iamRuntime.iamService)`; do not build a
  second IAM client in the buyer package.
- `/buyer/profile` and `/buyer/password` are page-owned chrome (the IAM screen
  frame renders the header). The security page links to
  `/buyer/password`; never route password changes through `/auth/login`.

## Cart mobile brick

- `/cart` mounts `ShoppingCartPage` from
  `@sdkwork/shop-mobile-react-shopping`; the mall cart package only supplies the
  data plane through `src/cart-brick.ts` (`configureShopMobileCartRuntime` →
  commerce `cart.current` / `cart.items`). Do not re-add mall-owned cart rows,
  totals or selection state.
- `/checkout` mounts the same brick's `CheckoutPage` (confirm-order form) through
  `configureShopMobileCheckoutRuntime` (`src/checkout-brick.ts`); the adapter
  keeps the cashier handoff. The page owns its chrome.
- The brick is the single cart/checkout UI: shop grouping, selection, totals,
  empty/loading/error states, `?items=` handoff and the confirmation form all
  live there. `src/index.css` must keep its `@source` root and the
  `--color-bg-color` / `--color-fill` / `--shopping-accent` token mapping.
- The workspace registry entry
  (`sdkwork-specs/workspace/consumers/sdkwork-mall.json`) is the source of the
  `pnpm-workspace.yaml` sibling paths; after adding a brick, register it there
  and re-run `sync-workspace.mjs`, not by hand-editing only the workspace file.
