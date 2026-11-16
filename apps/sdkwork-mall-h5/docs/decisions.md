# H5 Decisions

- 2026-09-30: v1 ships browser runtime only (no Capacitor host package yet).
  Adoption follows APP_H5_ARCHITECTURE_SPEC §8.2 as a follow-up.
- 2026-09-30: console/admin packages are not part of v1; the PC root owns
  operator surfaces.
- 2026-09-30: auth reuses @sdkwork/auth-pc-react + @sdkwork/auth-runtime-pc-react
  (already workspace members). Migrating to sdkwork-iam-h5 auth packages is a
  follow-up.
- 2026-09-30 (updated): shop and activity mobile pages have landed
  (storefront.mall.shop / storefront.mall.activity-list / -detail), closing
  the public storefront parity with the PC root.
- 2026-09-30: buyer mobile surfaces landed for the JD core loop
  (订单/物流/地址/优惠券/售后/发票). Remaining buyer surfaces are tracked
  here: 收藏/足迹 (needs a server-side favorites API; PC root keeps local
  storage today), 会员/钱包/积分 (needs Tier-1 account/membership service
  wiring on mobile), 消息中心 (needs a notification API). Each lands as its
  own change with route ids aligned to the PC registry.
- 2026-10-03: messaging lands on the sdkwork-im capability. The
  `@sdkwork/im-app-sdk` notifications plane (cursor-paged list + retrieve +
  request submission) is consumed through the generated client created in the
  H5 bootstrap (same dual-token token manager as every other family); a new
  `sdkwork-mall-h5-im` package owns the notices page, customer-service
  conversation list (form follows the im-h5 chat list) and chat room.
  Customer-service message streams ride a single package-local transport seam
  (`im-transport.ts`) over the federation gateway chat endpoints until the IM
  realtime CCP connection is adopted for the mall — adopting it swaps
  send/receive to the websocket without touching pages. Trade events
  (order created / paid / cancelled / received) are delivered as IM
  notifications so 通知与提醒统一走消息管道.
- 2026-11-04: the IAM login/register/recovery screens are rendered as a native
  H5 surface instead of a desktop card squeezed into a phone viewport.
  `@sdkwork/auth-pc-react` still owns the flows (controller, validation,
  verification codes, organization selection), but three things are app-owned:
  (1) `src/index.css` declares `@source` roots for the shared auth and UI
  packages — Tailwind v4 only scans this app root, so without them every
  utility class of the auth surface is missing and the screens render with no
  layout at all (the defect this change fixes); (2) `src/bootstrap/
  authAppearance.tsx` binds the mall appearance — brand header, commerce color
  tokens, `--sdk-color-brand-primary`, and the desktop QR/highlight rail hidden
  (`qrLoginEnabled: false`, `leftRailMode: "highlights-only"`) because a phone
  cannot scan its own screen; (3) the `.sdk-mall-auth-*` rules own the mobile
  layout: full-bleed single column with safe-area padding, segmented method
  switcher, inline resend action on the code field, 48px primary action, 16px
  inputs (no iOS focus zoom), focus/invalid field states, a compact rhythm
  under 720px height and a centered card from 640px width up. Migrating to the
  native `@sdkwork/iam-h5-auth` package stays a follow-up; a full login round
  trip in dev additionally needs the bootstrap credential (`SDKWORK_ACCESS_TOKEN`)
  that the dev runner injects, otherwise sign-in fails before dispatch.
- 2026-11-16: the storefront home hero is a complete H5 carousel — full-bleed
  (zero outer spacing, square corners per APP_MOBILE_REACT_UI_SPEC §5), a
  poster height instead of a text strip, one slide per viewport, auto-rotation
  with an explicit pause control, swipe (a swipe never also fires the slide
  link), arrow keys that move focus with the slide, and a reduced-motion
  fallback that does not rotate. Its copy is still authored in the home i18n
  fragment rather than read from the storefront CMS: `sdkwork-mall-pc-cms`
  already persists the banner config into a storefront promotion offer marked
  `sdkwork-mall-pc-cms-config`, and wiring the H5 home to that read model is
  the remaining storefront-banner follow-up (the carousel data list is shaped
  so only the loader changes).
- 2026-11-16: category tiles carry a derived icon. The commerce category API
  has no icon column (`CreateCategoryRequest` is a closed
  categoryNo/parentId/name/sortOrder body), so
  `@sdkwork/mall-h5-commons/category-visual` resolves a glyph plus accent from
  the stable category code first (`MALL-CAT-DIGITAL` → `digital`), then the
  localized name (explicit zh-CN/en-US rules for the seeded taxonomy, plus
  generic rules for tenant categories), then a deterministic fallback. Both the
  home grid (four columns × two rows, first-level categories only) and the
  分类 second-level grid render it, so a category is never iconless and never
  changes glyph when the server reorders the list. The commons test
  `tests/category-visual.test.ts` pins the contract with the default dataset:
  all eight roots and twenty-five children must resolve to the same glyph from
  key, wire code and both authored locales, so an initialized environment
  cannot ship blank or index-shuffled tiles.
- 2026-11-16: the storefront home surface was polished rather than redesigned.
  The five top entries and the four service entries now carry tinted icon tiles
  (`.sdk-h5-quick-icon` / `.sdk-h5-service-icon` share the category tone
  classes), section headers gained a "更多" affordance where a destination
  exists, featured shops became rating cards instead of text chips, and the
  product card keeps a two-line title height so a grid row never staggers.
  The first load renders a skeleton (no "加载中..." text flash) and an empty
  feed renders a recovery surface with an in-place retry, so the page never
  presents a blank scroll body under the hero. The 分类 content column also
  gained the 0.6rem inset that mirrors the rail gap, so tiles and rows end
  inside the viewport edge instead of being cut by it.
- 2026-11-16 (flat redesign): the H5 design system moved from gradient/elevation
  to a borderless flat language, because the gradient style fatigues quickly and
  read as dated next to current commerce apps. Rules: no decorative gradients
  anywhere (top bar is a solid brand plane, hero slides are solid brand colours
  with flat translucent discs, skeletons pulse instead of shimmering); content
  surfaces are flat blocks on one gray plane with no border and no shadow;
  controls, chips and inputs use filled `--sdk-h5-fill` backgrounds instead of
  outlines; only overlays (sheets, modals) keep `--sdk-h5-shadow-overlay`; dense
  list rows and sticky chrome keep one 5%-opacity hairline so content scrolling
  underneath stays legible. The contract test
  `h5-standard-architecture.test.mjs` pins the no-gradient and
  no-content-elevation rules, and page-level checks confirmed zero rendered
  gradients/shadows on home, auth and help.
- 2026-11-16 (search field): the `/search` results screen now owns a flat query
  field (`role="search"`, `enterKeyHint="search"`, filled pill, no outline) that
  rewrites `?q=` in place. Before it only listed hot keywords and history, so a
  query could not be refined without navigating back.
- 2026-11-16 (flat consistency pass): every primary list surface now renders the
  shared `SdkworkMallH5EmptyState` (muted glyph + headline + optional hint and
  action) instead of a bare line of text; order empty state gained a
  "browse home" action, checkout's missing-address branch keeps its accessible
  heading, sort/status filters use a short flat accent underline, and notices
  are inset flat blocks. A 25-route audit with an injected session confirmed
  zero rendered gradients, zero shadows, no horizontal overflow and no console
  errors across cart, checkout, orders, logistics, buyer, account, membership,
  IM and distribution surfaces.
- 2026-11-16 (IAM H5 brick): the login plane is the shared IAM H5 brick
  (`@sdkwork/iam-h5-auth` + `@sdkwork/iam-h5-core`) instead of the desktop
  `@sdkwork/auth-pc-react` mount with a mall-owned appearance and the
  `.sdk-mall-auth-*` CSS block. `src/bootstrap/iamRuntime.ts` composes the IAM
  runtime with `createIamH5RuntimeService`, seeds it with the committed public
  application token before login, re-applies the session token after every
  commit, and projects the IAM session (tokens + tenant/user context) into the
  mall session store; `src/AuthGate.tsx` only decides when to mount
  `SdkworkIamH5AuthRoutes`, and `src/index.css` keeps the brick's `@source`
  root plus a flat token mapping for `.sdkwork-iam-h5-auth-surface`. The stale
  `authAppearance.tsx` / `authConfig.ts` are empty compatibility seams awaiting
  a separate deletion change. Verified end-to-end against a mocked
  `/auth/sessions`: the brick posts with the application token, commits the
  session, the gate redirects to the return path, and the storefront loads with
  zero gradients/shadows on the auth surface. Two upstream improvements landed
  in `sdkwork-iam`: the auth header brand mark is a token-driven solid field
  (`--iam-h5-auth-brand-mark-bg`, no gradient/glow) and its countdown timer no
  longer depends on Node typings, so browser hosts can consume the brick
  without a theme fork.
- 2026-11-16 (order mobile brick): the order list is composed from
  `@sdkwork/order-mobile-react-orders`. `src/bootstrap/runtime.ts` calls
  `configureOrderMobileRuntime({ client: sdkClients.orderAppClient })` so the
  brick reads the host order SDK client (no second order service); the list page
  keeps only its page chrome, data loading, empty/error states and payment
  navigation, while rows and status tabs render the brick's `OrderCard` /
  `OrderTabsNav`. The host maps the brick's design tokens
  (`--color-text-main/sub`, `--color-primary-blue`, `--color-border-color`,
  `--color-active-bg`, `--color-chat-other-bg`) onto the flat mall palette and
  declares the brick's Tailwind `@source` root. Upstream improvements in
  `sdkwork-order`: the brick now exports its card/tab components for host
  composition, and `OrderCard` skips the item section when a summary list has
  no line items instead of rendering an empty gap. `sdkwork-ui` `Tabs.tsx`
  gained a type-only `ReactNode` import so browser hosts with
  `verbatimModuleSyntax` can compile the shared UI. Next: order detail and
  cashier routes onto the same brick (they already ship in the package).
- 2026-11-16 (order detail brick): `/buyer/orders/:orderId` now mounts the
  brick's `OrderDetail` page instead of the mall-owned detail implementation.
  The brick renders its own `PageLayout` header (title + back), so the shell
  yields chrome for page-owned surfaces via
  `isSdkworkMallH5PageOwnedChrome` and the mall root keeps only the host route
  templates (`/payment/result?orderId=:orderId`,
  `/buyer/after-sales`) plus an accessibility `h1`. `@sdkwork/order-mobile-react-orders`
  gained the wire-status mapping the order app-api actually emits
  (`PENDING_RECEIPT`/`PENDING_SHIPMENT`/`PAID`/`WAIT_*` → the mobile union), so
  the action buttons and status styling stay correct against the real service;
  without it a fulfilled order rendered no confirm/refund action. The mall flat
  policy also neutralizes brick Tailwind elevation inside `main`
  (`.sdk-h5-main [class*="shadow"]`), keeping the rendered detail at zero
  gradients and zero shadows.
- 2026-11-16 (cashier brick): payment entry moved to the order brick's
  `CashierPage` at `/buyer/orders/:orderId/cashier`; the order list's 去支付 and
  the detail page's pay action both route there, and the list no longer creates
  payment sessions itself (`payMallH5Order` import removed from the list). The
  brick owns the payment-method matrix, QR rendering, countdown, result polling
  and provider redirects; the host passes `orderDetailPath`/`orderCenterPath`.
  Verified against mocked order/payment endpoints: the cashier posts
  `POST /orders/{id}/payments`, renders amount/method list/countdown at zero
  gradients and zero shadows with a single `PageLayout` header. Upstream fix:
  the cashier's auto-close default used `{countdown}` instead of the i18next
  `{{countdown}}` placeholder, so hosts without the translation saw the raw
  token. Remaining: checkout still builds its own payment session and lands on
  `/payment/result`; migrate that path onto the cashier next.
- 2026-11-16 (checkout hands off to the cashier): `submitMallH5CheckoutOrder`
  no longer creates a payment session or builds the legacy
  `/payment/result?status=...` URL. It applies coupons/wallet holds and then
  returns `/buyer/orders/{orderId}/cashier`, so the order brick cashier owns the
  method choice, session creation, QR/countdown and result polling. The
  `checkout-payload` test now asserts the handoff URL, `paymentId: undefined`
  and that `orders.pay` is never called from checkout. `/payment/result` stays
  mounted as the payment-provider return surface (old channel sessions redirect
  there); the orphan-route check marks it as an external-entry route instead of
  an in-app link target.
- 2026-11-16 (cart brick): the cart tab now mounts
  `@sdkwork/shop-mobile-react-shopping`'s `ShoppingCartPage` instead of the
  mall-owned cart page. The brick previously rendered a
  "capability unavailable" placeholder and its `CartService` only threw, so the
  brick was completed upstream: it now has a real cart surface (shop grouping,
  per-line and all-line selection, quantity stepper, delete, totals, empty /
  loading / error states, checkout handoff with `?items=`), a host-injected
  `ShopMobileCartRuntime` port (`configureShopMobileCartRuntime`), a tokenized
  accent (`--shopping-accent`), placeholder-safe images and
  `verbatimModuleSyntax`-clean type imports. The mall cart package binds the port
  to its commerce facade in `src/cart-brick.ts` (selection is session-scoped,
  the tab badge follows the brick via `publishMallH5CartCount`), and
  `src/index.css` scans the brick and maps `--color-bg-color` / `--color-fill` /
  `--shopping-accent`. Verified in the browser against mocked cart endpoints:
  two shop groups, totals, PATCH on the stepper, `/checkout?items=…` handoff,
  empty state, badge count, zero gradients/shadows. The workspace registry
  (`sdkwork-specs/workspace/consumers/sdkwork-mall.json`) gained the brick path
  and `pnpm-workspace.yaml` was re-synced, so repo drift checks pass.
- 2026-11-16 (voucher brick): `/buyer/vouchers` mounts the order brick's
  `VoucherCodePage` (coupon-code redemption over
  `OrderService.redeemVoucher` → `POST /orders/coupon_redemptions`). The brick
  was completed upstream first: the fake scanner viewport (which could never
  open a camera) was removed, the page now owns a single header with a close
  affordance, the redeem button is tokenized (`--order-accent`, mapped to
  commerce blue by the host), and the submit path has a busy state and a
  `try/finally`. The gift-card hub (`/buyer/gift-cards`) is no longer a dead
  placeholder: it explains the pending gift-card/red-packet API and exposes the
  live voucher-redemption entry. The shell treats `/buyer/vouchers` as
  page-owned chrome, and the route is registered in the order package's route
  manifest so link/orphan checks and the document title stay coherent.
- 2026-11-16 (refund brick): `/buyer/refunds` mounts the order brick's
  `RefundRequestsPage` (refund records + create form, `?orderId=` deep links).
  The order detail refund action now points at `/buyer/refunds`, the buyer hub
  gains a 我的退款 service entry, and the shell treats the route as page-owned
  chrome. The brick was completed upstream first: wire statuses
  (`PENDING`/`PENDING_REVIEW`/`IN_REVIEW`/`DENIED`/`PAYOUT`) normalize onto the
  readable badge/label keys instead of rendering raw English status text, and
  the refund amount renders in the target asset's unit. Verified in the browser
  with a mocked refund list: single `PageLayout` header, record card with
  待审核 badge and ¥129.00, inline create form (asset selector, amount,
  reason), zero gradients/shadows.
- 2026-11-16 (account bricks): the buyer profile and password surfaces are now
  the IAM H5 user-center bricks (`@sdkwork/iam-h5-user-center` screens over
  `@sdkwork/iam-h5-commons`). `ProfilePage` renders
  `SdkworkIamH5UserCenterProfileScreen` (identity card + editable display
  name/nickname + save + password entry) and a new `/buyer/password` route
  renders `SdkworkIamH5UserCenterPasswordScreen`; both wrap the bricks with
  `SdkworkIamH5I18nProvider` and the user-center catalog, and the screen frame
  self-injects the kit styles. The mall root injects its one IAM service through
  `configureSdkworkMallH5UserCenter(iamRuntime.iamService)`. The shell yields
  chrome for `/buyer/profile` and `/buyer/password`, and the security page's
  password cell now links to `/buyer/password` instead of `/auth/login` (which
  logged the buyer out). The routes are registered in the buyer manifest;
  `<h1>` ownership moved into the IAM H5 screen frame, pinned by the contract
  test. Verified in the browser with mocked IAM user endpoints: profile identity
  + editable fields + save, password form with three fields, zero
  gradients/shadows on both.
- 2026-11-16 (logistics brick): `/buyer/logistics` mounts the order brick's new
  `OrderShipmentPage` (shipment header, packages, tracking-event timeline, empty
  and error states, host-owned back action). The brick exposes an
  `OrderLogisticsRuntime` port; the mall order package binds it to
  `loadMallH5OrderLogistics` in `src/logistics-brick.ts` (order → fulfillment →
  shipment → packages → tracking events stays in the commerce data plane), and
  the shell treats the route as page-owned chrome. Tracking timestamps are
  locale-formatted in the brick instead of rendering raw ISO strings. Verified
  in the browser with mocked shipment endpoints: single header, 运单号 +
  carrier/status + package + three timeline events, zero gradients/shadows.
- 2026-11-16 (order brick polish): order surfaces now share one locale date
  formatter (`formatOrderDateTime` in the brick) — order detail created/pay
  time, refund records and the tracking timeline show `11/15 20:00`-style local
  times instead of raw ISO strings. Payment-session params are normalized in the
  brick (`paymentParams` object or JSON string; `qrCodePayload`/`qr_code_payload`/
  `code_url`, `cashierUrl`/`cashier_url`) so a casing/encoding difference cannot
  silently hide the QR. The desktop QR path is now verified end-to-end: WeChat
  Native/Alipay return `weixin://`/`alipays://` payloads and the brick's QR
  renderer only accepted http(s), so it now treats those channel schemes as
  scannable; with the normalized params a mocked Native payment renders the
  220px QR on the desktop cashier. The contract test pins the shared date
  formatter on the three order surfaces and the channel-scheme QR guard.
- 2026-11-16 (brick coverage audit): the adopted brick routes were swept in one
  real-browser pass against mocked gateways — `/auth/login` (IAM H5 auth),
  storefront home, `/cart` (shop shopping brick), checkout handoff
  (`/checkout?items=…`), `/buyer/orders` (order card/tab components),
  `/buyer/orders/:id` (brick detail), `/buyer/orders/:id/cashier` (brick
  cashier with desktop QR), `/buyer/refunds`, `/buyer/vouchers`,
  `/buyer/logistics`, `/buyer/profile`, `/buyer/password` (IAM user center).
  Every route reported `errors=[]`, **0 gradients, 0 shadows**. A contract test
  now pins the coverage matrix (route → owning brick package), so the table only
  changes when a capability genuinely moves. Remaining mall-owned funnel
  surface: `CheckoutPage` (upstream checkout brick is still a placeholder with
  demo-grade components).
- 2026-11-16 (checkout brick): the confirm-order page is now the shop brick's
  `CheckoutPage` with a host `ShopCheckoutRuntime` port. The brick owns the
  whole confirmation form — items summary, address picker, delivery methods,
  payment methods, coupon list, wallet/points deduction, gift card, invoice,
  buyer remark, quote totals and the submit action — with loading/error states
  and a page-owned header. The mall cart package binds the port to its commerce
  facade in `src/checkout-brick.ts` (addresses, coupons, methods, cart items,
  quote) and keeps the cashier handoff from `submitMallH5CheckoutOrder`; the
  shell treats `/checkout` as page-owned chrome. Verified in the browser with
  mocked checkout endpoints: address (default badge), two cart lines with SKU
  and amounts, delivery/payment/coupon selections, ¥347.00 totals, submit →
  `POST /addresses/{id}/default_selection` + `POST /checkout/sessions` +
  `POST /checkout/sessions/{id}/orders` → navigates to
  `/buyer/orders/o-1001/cashier`; zero gradients/shadows. With cart, checkout,
  orders and account all brick-owned, the remaining capability gaps are
  membership and wallet only.
- 2026-11-16 (commercial acceptance sweep): twenty routes were measured at
  360px and 1440px (plus dark-preference checks on home/cart/orders) with mocked
  gateways — 43 checks, all with `overflow=false`, **0 gradients, 0 shadows, 0
  page/console errors**. The only finding was the cashier's portaled toast
  (`shadow-lg` outside `<main>`), so the flat policy now also neutralizes
  elevation utilities on `body` descendants: overlays convey layering through
  the scrim, not a shadow. Remaining scope for a commercial v1: the membership
  and wallet/points surfaces still need upstream H5 bricks (the membership
  package is a hardcoded marketing demo and sdkwork-account has no wallet H5
  brick).
- 2026-11-16 (page & component audit): every route (34, including all
  session-gated surfaces) was audited in a real browser for heading structure,
  tap-target size, raw-token leaks, overflow, gradients/shadows and console
  errors. Findings and fixes: (1) missing `h1` in catalog/search/loading and
  not-found branches (product, shop, activity, catalog), duplicate `h1` on the
  membership hero, and no `h1` in the brick cashier/refund pages — all pages now
  expose exactly one page heading (brick pages render `sr-only` headings);
  (2) undersized targets — shell back button (36→44), home brand (25→44 tall),
  carousel dots (24→44) and pause (32→40), catalog sort (32→44), chips (28→36),
  shared buttons (40) and error retries (44 wide), cart checkbox/steppers/delete,
  checkout option rows (44 tall), order-copy, buyer logout and review links;
  (3) checkout radios/checkboxes are 44px label rows (the label is the tap
  target). The audit script is repeatable (`.tmp/page-audit.mjs`) and now reports
  `issueCount: 0` for 34 routes.
- 2026-11-16 (cart settlement bar): the cart's 去结算 bar was `sticky` inside a
  `min-h-full` page, so on short carts it floated after the last row with a
  large gray gap above the tab bar. It is now `position: fixed; inset-x-0` with
  `bottom` set from a host-provided `footerBottom` (default
  `calc(var(--sdk-h5-tabbar-height, 0px) + env(safe-area-inset-bottom, 0px))`),
  so it sits flush on top of the tab bar (measured gap = 0px). The list gets
  `pb-32` clearance, and the enlarged 40px steppers wrap to their own line so
  they are no longer clipped at the card edge. Checkbox hit areas stay 40px while
  the visible circles return to 20px (industry convention).
- 2026-11-16 (design polish, page review pass): check of home/catalog/search/
  wallet/points against real data. Product thumbnails now use the fill token so
  an empty-image tile reads as an image slot instead of blending into the card;
  the home coupon strip moved from a saturated full-bleed orange band to a soft
  warm tint (`#fff4e5` on `#9a3412`) so it stops breaking the flat blue rhythm;
  wallet and points heroes show `¥0.00`/`0` instead of `--`, use thousands
  separators, add a hairline divider before the secondary balance row, and the
  points amount carries a small `分` unit. The per-page audit (34 routes) stays at
  `issueCount: 0`; catalog/search rows were verified full-width (the earlier
  "clipping" read was the white placeholder blending into the card).
- 2026-11-16 (cart item layout): each cart line now keeps price and quantity
  stepper on one right-aligned row (`justify-end`, stepper flush with the card
  padding; price to its left) instead of price-left / stepper-wrapped-below. The
  remove action moved out of the flow to a 40px floating control at the card's
  top-right, and the stepper count cell narrowed to `w-10` so the 40px targets
  still fit inside the text column. Cart footer stays fixed on the tab bar.
- 2026-11-16 (PDP review): product detail prices now use grouped locale
  formatting (`¥4,899.00`) in the hero, the compact sticky header and the
  selected-SKU row; sales/stock counts are grouped too. The no-image gallery
  fallback sits on the fill token so it reads as an image slot, and the
  duplicate favorite pill next to the price was removed — the fixed action bar
  already owns favorite, leaving one control per action.
- 2026-11-16 (cart line alignment): the price column now starts on the same
  left edge as the product title (`justify-between` inside the text column),
  while the stepper stays flush right. The stepper is shorter (32px content,
  40px-wide targets) so it reads as a secondary control instead of a large
  block; both buttons were updated (the first pass only compacted one and the
  shared class string masked the other).
- 2026-11-16 (order & buyer hub review): order detail no longer prints the raw
  payment channel (`WECHAT`); the brick normalizes codes and maps aliases to
  readable labels (`微信支付`, `支付宝`, `银联支付`, `货到付款`, `钱包余额`) with
  the i18n key still taking precedence. The buyer hub's nine service tiles moved
  from a 4-column grid (4+4+1 orphan) to a 3x3 service dock so every row is full.
- 2026-11-16 (refund & gift-card review): the refund reason field is now a
  localized select (质量问题/未收到货/与描述不符/商品破损/其他) that still submits the
  stable wire codes (`quality`, `not_received`, `not_as_described`, `damaged`,
  `other`); the old free-text field exposed codes like `quality / not_received`
  in its placeholder. The gift-card page's two CTAs became an equal-width row
  (`sdk-h5-action-row-full`) instead of small right-floating buttons on a mostly
  empty surface. Logistics and cashier states were re-checked: the brick already
  renders dedicated paid/expired/cancelled/not-payable result screens.
- 2026-11-16 (width & appearance matrix): the H5 app now renders as a centered
  34rem (`544px`) mobile canvas on screens ≥40rem, with a neutral surround
  (`#e7e9ee`) and hairline side borders; before this the home hero, service
  grids and action bars stretched across a 1440 desktop. Fixed chrome (tab bar,
  PDP compact/search/action bars, sheets, partner modal, and brick-owned
  `fixed inset-x-0` bars such as the cart settlement bar) is clipped to the same
  canvas column. Dark preference is intentionally not themed: `color-scheme:
  light` keeps the flat white/blue palette consistent rather than half-dark.
  Verification: 34-route page audit `issueCount: 0`; 43-check 360/1440 sweep
  problems: [].
- 2026-11-16 (wallet brick): a new upstream H5 package
  @sdkwork/account-mobile-react-wallet now owns the wallet and points screens
  (balance hero, cash ledger rows, expiring point lots, loading/error/empty
  states) behind an AccountWalletRuntime port. The mall account package keeps
  only the adapter (src/wallet-brick.ts) and the app composes the runtime in
  bootstrap; the former host wallet/points markup is gone. This removes the
  last duplicated account surface - membership remains the only capability
  still on an app-owned screen until the membership brick gains a runtime
  port. Registered through the workspace registry (wildcard) plus
  sync-workspace.mjs and pnpm install; contract tests pin brick ownership and
  headings.
- 2026-11-17 (membership brick): the membership subscription brick now ships a
  data-driven MembershipSubscriptionPage plus a MembershipSubscriptionRuntime
  port (status / plans / payment methods / purchase). The mall membership
  package keeps only the adapter (src/membership-brick.ts) and the app composes
  the runtime in bootstrap; the host membership-service stays the single data
  source. The page owns its chrome, renders the level hero, 2x2 benefits,
  plan cards with recommended badge and grouped prices, a payment-method
  picker and purchase feedback. Verified in the browser: 黄金会员 status,
  month/year plans, 微信/支付宝 selection, purchase -> 会员开通成功. This removes
  the last app-owned capability screen; only the provider-return
  /payment/result surface remains intentionally host-owned.
  headings.

