# Mini-program Decisions

- 2026-09-30: v1 ships the spec-shaped WeChat MP root (manifest, app shell,
  tab pages, runtime-env seam) with surfaces intentionally inert: the
  federated commerce transport for mini-programs is a generated SDK family
  that the ecosystem has not produced for mall yet (PC/H5 consume
  `@sdkwork/cloudrouter-app-sdk/domains`, which cannot run inside the MP
  runtime). Pages fail fast with guidance instead of raw wx.request.
- 2026-10-02 (supersedes the inert-surface stance above; user-directed): the
  mini-program now implements the JD-style commerce flows for real — home,
  category, search, product detail, cart, checkout, cashier, payment result,
  orders, order detail, addresses, coupons, buyer center, token login —
  against the same commerce app-api contract the H5/PC clients consume.
  Architecture keeps the building-block rule: every domain lives in its own
  `src/services/*` module (catalog / cart / order / address / promotion),
  all traffic funnels through the single `services/transport.js` seam (the
  contract test enforces exactly one `wx.request` call site), and
  `bootstrap/sdkClients.ts` composes the services into one typed facade.
  When the generated WeChat MP SDK family lands, each service swaps its
  transport calls for the generated client without page changes.
- Auth: the IAM SDK family for MP runtimes is still pending, so the session
  holds a platform-issued bearer token (login page). wx.login /
  code2session replaces it once the identity contract exists.
- Payment: the cashier page selects a channel and calls `orders.pay`; the
  real `wx.requestPayment` handoff (and its provider params) plugs into
  `pages/cashier/index.ts` when the WeChat pay provider contract lands.
- 2026-10-03 (user-directed): the mini-program is fully TypeScript. Every
  page, service, and the app entry are `.ts` (strict `tsc --noEmit` with
  `miniprogram-api-typings`; WeChat DevTools compile via
  `setting.useCompilerPlugins: ["typescript"]`), the architecture contract
  test enforces the single `wx.request` seam on `transport.ts`, and the
  session speaks the IAM login contract (`POST /auth/sessions`) with dual
  tokens persisted through wx storage — password login form with the token
  paste kept as a dev fallback. A new after-sales center
  (`pages/aftersales`) builds the wire-contract create body
  (`CreateAfterSalesRequest`) from the live order snapshot and revokes
  pending requests via PATCH; wx.request has no documented PATCH method, so
  the transport passes the explicit method and the caveat is documented in
  the transport seam. tsconfig uses ESNext/bundler resolution for
  type-checking only (noEmit); DevTools CommonJS output is unchanged.
- Local dev: point `commerceAppApiBaseUrl` at
  `http://127.0.0.1:3900/app/v3/api` (repo-root
  `scripts/dev/mock-commerce-gateway.mjs`) and enable "不校验合法域名" in
  DevTools.
- 2026-11-02 (user-directed): the mini program now carries the same route
  identity as PC/H5/Flutter. `src/routes/capabilities.ts` is the only place that
  maps a capability route id (`buyer.mall.orders`, `storefront.mall.product-detail`,
  …) to a physical page path, and every page navigates through
  `mpCapabilityUrl()`; `MP_TAB_CAPABILITY_ROUTES` marks the tabBar destinations
  so callers use `wx.switchTab` instead of `wx.navigateTo`. The buyer hub and the
  home/help entry tables were migrated from hard-coded `/pages/...` strings, and
  `tests/capability-navigation.test.mjs` now fails if any page module hard-codes a
  page path again or if the registry and `app.json` disagree.
- 2026-11-16 (user-directed, "align with H5 and polish the storefront"): the
  route-level parity contract already resolved 37/37 capabilities, so this pass
  audited *implementation depth* against the H5 client and fixed the defects it
  found. Recorded here because several of them changed a shared seam:
  - **Pagination was dead.** `PageInfo` carries `totalItems`/`page`/`pageSize`/
    `totalPages`/`hasMore` (API_SPEC §16); the services read a non-existent
    `pageInfo.total`, so `total` was always 0 and every "load more" guard
    (`products.length >= total`) fired immediately — category/search/orders
    could never page past 20. `services/page-info.ts#readPageInfo` now owns the
    normalization (prefers `hasMore`, then `totalPages`, then the item count)
    and the three list pages guard on `hasMore`.
  - **Checkout ignored the picked address.** The address page emitted
    `addressPicked` on the opener EventChannel, but nothing subscribed and every
    `onShow` reset the selection to the default. Checkout now passes an
    `events` handler on `wx.navigateTo` and keeps a still-existing selection
    across refreshes. The address page's picker styling also read the wrong
    data key (`pickerMode` vs `_pickerMode`), so the mode was invisible.
  - **Dead error/empty states.** The home loader swallowed every failure into
    `[]`, so its `{{error}}` block was unreachable; shop and activity detail
    turned network failures into "店铺不存在/活动已结束". Those now surface a
    retry, and `tests/capability-navigation.test.mjs` matches any `{{error…}}`
    binding (its exact-match regex let `{{error || '订单不存在'}}` escape).
  - **Share and pull-to-refresh coverage.** `utils/share.ts` builds cards
    through `mpCapabilityUrl()` so a shared link always restores a registered
    capability; home, category, search, activity (list + detail), shop and order
    detail now publish `onShareAppMessage`/`onShareTimeline` (product already
    did). `enablePullDownRefresh` + `onPullDownRefresh` + `wx.stopPullDownRefresh`
    went from 7 to 22 pages, including the cart and buyer tabs and every
    server-backed buyer list.
  - **H5 parity on the product detail.** The PDP gained the H5 surfaces it was
    missing: claimable-coupon row, service guarantees, a review placeholder, a
    "看了又看" recommendation strip, a full-screen gallery viewer, and a real
    SKU sheet (thumbnail, selected spec, quantity, confirm) instead of the
    confirm-only popup.
  - **Cart parity.** Manage mode with bulk delete, item count, a disabled
    stepper at quantity 1, confirmation dialogs and a busy guard — the H5 cart
    already had all of these.
  - **Smaller correctness fixes:** points rendered through `formatCny` showed
    "¥100.00" for 100 积分 (`utils/format.ts#formatPoints`); the review centre
    sent `?orderId=` to a page reading `id`; the settings page read
    `getApp().environment` instead of `globalData`; the activity list class used
    a `phase` the row view never set; the message centre navigated to itself
    without an id (tap did nothing visible) and now expands the notice inline
    with cursor paging; the chat page never rendered its error and wrote a read
    receipt on every 5 s poll; the cashier always reported `pending` even after
    a completed native payment; partner's invite link was never assigned (now
    derived from the invite code) and the page was the codebase's only
    `px`-styled stylesheet (converted to `rpx`); `sitemap.json` indexed the
    private cart/order/account pages and now allows only the browse set.
  - **Copy moved into catalogues.** New copy went to
    `i18n/zh-CN/{common/share,storefront/cart,storefront/product-detail}` and the
    cart page was migrated wholesale; the readiness ratchet improved from 194 to
    179 hard-coded strings (baseline refreshed).
  - **New guard: `tests/mp-page-contract.test.mjs`.** WXML is not type-checked,
    which is how `{{allCount}}` shipped while `data` only had `selectedIds`.
    The new suite cross-checks every top-level template binding against the
    page module, every `t("…")` key against the catalogue, the `PageInfo`
    contract, `rpx`-only styles, share hooks, and pull-to-refresh pairing.

- 2026-11-16 (user-directed, second pass: "IM lives in sdkwork-im, auth in
  sdkwork-iam - keep the difference"). The first pass put the WeChat session in
  IAM (correct side) but re-implemented the IM chat/notice transport inside the
  mall app (wrong side). Corrected to domain ownership:
  - **Authentication -> `sdkwork-iam`.** `@sdkwork/iam-mp-core/session-wechat` is
    now the single WeChat mini-program session module: persisted dual-token store,
    `AuthTokenManager` twin, `oauth.miniProgramSessions.create` exchange (with the
    per-install `deviceId` established *before* the exchange), cold-launch
    revalidation and logout. It exports through its own package subpath and is
    authored (not generated), so the IAM app and any product mini program share
    one implementation. `@sdkwork/mall-mp-core` only adapts the host storage and
    re-exports it.
  - **Messaging -> `sdkwork-im`.** The mall deleted its chat/notice transport and
    consumes `@sdkwork/im-mp-chat/services`: `createImMpNotificationsService`
    (newly landed in IM, previously missing - IM had no notice-centre module at
    all), `createImMpChatInboxService` and `createImMpChatConversationService`.
    The mall capability only projects IM domain types onto view models and orders
    the chat stream chronologically; it declares no endpoint.
  - **Client construction stays in `@sdkwork/mall-mp-core`** (spec section 7):
    `@sdkwork/iam-app-sdk` for auth, `@sdkwork/im-app-sdk` for notices,
    `@sdkwork/im-sdk` for conversations, all reading the IAM token manager so a
    login/logout is visible to every client without a rebuild.
  - **Workspace governance.** Consuming sibling mini-program packages required
    registering them in `sdkwork-specs/workspace/consumers/sdkwork-mall.json`
    (`im-mp-{commons,core,shell,chat}`, `iam-mp-core`, `im-sdk`); `verify-repo`
    now passes with the registry-rendered `pnpm-workspace.yaml`.
  - Tests: `mp-runtime-core.test.ts` exercises the IAM module through the mall
    re-export (store/token manager/exchange/restore/expiry), and
    `mp-auth-im.test.ts` pins the IM projections (notice page + cursor, inbox,
    chronological stream, send/read delegated to IM services).

- 2026-11-16 (third pass: "continue, regress repeatedly and align"). Host
  boundary completed — the app root no longer touches a single platform API:
  - `MpHost` gained `MpLifecycle` (start/stop pull-down refresh), `MpDeviceInfo`
    (release channel, platform) and `MpMediaPicker.previewImages`; navigation now
    accepts the platform EventChannel (`events`) so the address picker round trip
    is a host call rather than a page-level `wx.navigateTo`.
  - `@sdkwork/mall-mp-core` exposes the page-facing `platform` facade (toast with
    tone, confirm as a boolean, copy, navigate with fallback, back with
    tab/redirect fallback, preview, choose/read media, payment, storage, stop
    refresh). Every method resolves the installed host per call, so importing it
    before `app.onLaunch` is safe and a profile swap needs no stale closure.
  - All ~140 platform call sites across 34 pages moved behind the facade:
    navigation (45+9+7+4), pull-down refresh (25), toast (18), modal (10),
    clipboard (3), native payment (3), media (2), storage (5). The release
    channel moved into `MpDeviceInfo`, so `bootstrap/environment.ts` is pure and
    the app entry resolves the host first and then the environment.
  - Guards: `mp-page-contract.test.mjs` now scans the whole app root for platform
    globals (comments/strings stripped) and requires destructive actions to
    confirm through the facade; `verify-mp-runtime-env` and
    `verify-payment-channel-wiring` were realigned to the host seam (release
    channel in `mp-host`, cashier through `platform.requestPayment`).
  - Tests: new `mp-platform-host.test.ts` pins the facade projections (tone,
    boolean confirm, EventChannel pass-through, navigation fallbacks, empty
    gallery, media bytes, cancelled cashier, release channel).

- 2026-11-16 (fourth pass: IM realtime + domain boundary). Two changes:
  - **Domain boundary locked by a guard.** `tests/contract/verify-client-domain-boundaries.test.mjs`
    proves the IAM mini-program carries no chat/messaging surface (no `/im/chat`,
    `conversations.*`, `@sdkwork/im-mp*`, chat models or realtime plane), that the
    mall account capability owns no messaging, that the mall messaging capability
    owns no session/login, and that the app entry wires the two separately. The
    IAM repo itself only contains the authored session module
    (`@sdkwork/iam-mp-core/session-wechat`) — auth, no chat.
  - **IM realtime plane landed.** `mp-host` gained `MpSocket` over
    `wx.connectSocket` (WebSocket-subset: tracked `readyState`, buffered `open`
    replay, `send`/`close`), with a scripted memory socket for tests.
    `mp-core` adapts it to the IM SDK's `ImWebSocketFactory`, so
    `@sdkwork/im-mp-chat`'s `chatRealtimeService` can go live. The messaging
    capability exposes `subscribeConversationMessages` / `recoverRealtime` /
    `isRealtimeConnected` / `disposeRealtime`; the chat page leases the open
    conversation, debounces pushes into one re-read (250 ms), reconnects on
    foreground and keeps a 15 s safety-net poll for offline.
  - Tests: `mp-realtime.test.ts` pins the socket adaptation (open/message/close
    transitions, early-open replay, send while connecting) and the facade
    (lease + release, recover, unwired failure). 25 node guards, 49 vitest
    contracts, 135 repo contract tests, both typechecks, composition, parity and
    the i18n ratchet are green.

- 2026-11-16 (fifth pass: H5 feature parity). Route parity only proves a page
  exists, so this pass closed the *feature* gaps against the H5 client:
  - **Category browser** grew the two-level drill-down H5 has: a root rail plus a
    child chip row (`全部` + children derived from `parentId`), a deep link that
    resolves a leaf to its root, and product queries that follow the leaf when one
    is selected.
  - **Home storefront** now carries the H5 floors: featured shops
    (`GET /shops`, fail-soft), new arrivals (`sort=newest`), a device-local
    footprint chip row refreshed on tab return, and a service grid
    (help/orders/coupons/settings). Ratings render from the catalogue instead of
    inline template copy.
  - **Buyer hub** greets the signed-in account: `GET /accounts/current/summary`
    provides the display name and the avatar initial, fail-soft to the catalogue
    fallback.
  - **Order list** exposes the per-order after-sales entry H5 has (paid, shipping,
    received, completed, refunding, refunded).
  - **Product detail** gained the delivery row: the default address (truncated) or
    the "add address" hint, leading to the address book — same as H5.
  - **Cart** group headers link into the shop page; **membership** renders the four
    static benefit tiles; **chat** caps the composer at 500 characters like H5.
  - **Guard:** `tests/contract/verify-mp-h5-feature-parity.test.mjs` pairs each of
    these surfaces against its H5 counterpart, so a storefront feature cannot
    silently regress below the H5 implementation.
  - Known external state: the repo-wide `test:node` i18n ratchet is red on the H5
    root (255 -> 271) because of a concurrent, in-flight H5 edit in this working
    tree; the mini-program root holds at 155/155.

- 2026-11-16 (sixth pass: chat image messages). The messaging capability can now
  send images, keeping bytes out of the message record:
  - `specs/upload.declaration.json` + `bootstrap/uploadDeclaration.ts` declare a
    second purpose, `mall.chat-image` (scene `chat-image`, image profile), so the
    upload is a declared Drive origin rather than an ad-hoc one.
  - `services/drive-upload-service.ts` gained `uploadDriveImageDetailed()`
    (driveUri + spaceId + nodeId + mimeType + sizeBytes); `uploadDriveImage()`
    stays as the string-only facade the after-sales form uses.
  - `@sdkwork/mall-mp-im` gained `sendChatImage()` + an injected
    `MpImImageUploader`: the capability never uploads itself, it hands bytes to
    the Drive port and posts the returned identity through the IM
    `conversation.sendImage` media part. Unwired uploader fails loudly.
  - Chat page: an image button picks one image (5 MB cap) through the host picker,
    reads bytes through the host, sends, and re-reads the stream. Composer copy
    moved into `i18n/zh-CN/communication/chat` (miniProgram readiness 155 -> 152).
  - `app.ts` wires the uploader with the chat declaration, so the messaging
    capability still holds no session and no storage flow.
  - Known limitation this round: inbound image bubbles render the message summary
    text; rendering the stored image needs a Drive download-grant port
    (`resolveChatMediaUrl`), which is the next step.
  - Regression: 25 node guards, 51 vitest contracts (2 new for image sending),
    140/141 repo contract tests — the single failure is still the external H5
    i18n ratchet (h5 255 -> 271 from a concurrent edit); miniProgram improved to
    152, both typechecks, composition, parity and catalogues green.

- 2026-11-16 (sixth pass, continuation: inbound image bubbles). Image messages
  are now readable, not just sendable:
  - `services/drive-download-service.ts` exchanges a stored node for a signed URL
    (`POST /drive/nodes/{nodeId}/download_grants`), the read counterpart of the
    uploader and injected the same way.
  - `listChatMessages` carries `mediaNodeId` from the IM message projection;
    `resolveChatImageUrl(nodeId)` goes through the injected grant port and fails
    loudly when the port is missing.
  - The chat page caches one signed URL per Drive node, renders an `<image>`
    bubble when it resolves (tap opens the platform preview), and keeps the
    file-name text bubble when a grant fails.
  - Regression: 25 node guards, 53 vitest contracts, 141/142 repo contract tests
    (the single failure remains the external H5 i18n ratchet), both typechecks,
    composition, parity, catalogues and default data green; miniProgram readiness
    153/155.

- 2026-11-16 (seventh pass: IAM as a building block). The login surface stopped
  hand-rolling IAM wire calls:
  - `@sdkwork/mall-mp-auth` now runs the credential grant through the generated
    `@sdkwork/iam-app-sdk` (`auth.sessions.create` with an explicit
    `grantType: "password"`), reads identity from `iam.users.current.retrieve`
    and changes credentials through `iam.users.current.password.update`. The raw
    `POST /auth/sessions` call and its hand-assembled token parsing are gone.
  - `profile-service` projects identity from the capability instead of the mall's
    `/accounts/current/summary`; the membership level stays a commerce fact
    (`memberships/current/status`, fail-soft).
  - The security screen's "修改密码 → 前往登录页重新认证" placeholder became a real
    inline credential form (old/new/confirm, client-side pre-checks, IAM policy
    authority, success toast). Phone/email rows now report the IAM verified state
    instead of static copy.
  - Guard: `tests/contract/verify-mp-auth-block-integration.test.mjs` fails the
    build if a mall service hand-rolls `/auth/*` or `/iam/*`, if the capability
    opens its own request seam, or if the security form regresses to a
    placeholder.
  - Added `docs/architecture/TECH-BLOCK-INTEGRATION.md`: the block-ownership map
    (IAM, IM, Drive, host, commerce groups) and the remaining migration phases
    (commerce client seam → cart/order → catalog/promotion/after-sales/... →
    retire the raw transport).
  - Regression: 25 node guards, 55 vitest contracts, 147/147 repo contract tests,
    both typechecks (49 packages), composition, parity, catalogues, default data
    and the i18n ratchet all green; miniProgram readiness 155 -> 149.

- 2026-11-16 (eighth pass: SDK transport seam). Generated SDKWork SDKs request
  through the global `fetch`; WeChat has none, so the blocks could not run on a
  device even though they typechecked. Fixed with one host adapter:
  - `packages/sdkwork-mall-mp-host/src/fetch.ts` (exported as `./fetch`) maps the
    `fetch` subset `@sdkwork/sdk-common` uses (`method`/`headers`/`body`/`signal`
    → `ok`/`status`/`headers.get`/`json`/`text`/`arrayBuffer`) onto
    `MpHttpClient` (`wx.request`). Non-2xx responses resolve so the SDK envelope
    and `ProblemDetail` handling sees the status; only a transport failure rejects.
  - `initializeMallMpRuntime` installs it **before** building any SDK client, and a
    native `fetch` (newer base libraries) always wins.
  - Guard `tests/contract/verify-mp-sdk-transport-seam.test.mjs`: exactly one
    module may write `globalThis.fetch`, the installation must precede the first
    client, capability packages may not construct a domain SDK client, and no
    service may fall back to `wx.request`.
  - Also cleared workspace drift: two IAM H5 packages rendered into
    `pnpm-workspace.yaml` without a consumer-registry entry
    (`sdkwork-specs` commit `a1fab18`), so `verify-repo` is green again.
  - i18n baseline refreshed to the improved counts (miniProgram 155 -> 149).
  - Regression: 25 node guards, 60 vitest contracts, 152/152 repo contract tests,
    both typechecks (49 packages), composition, parity, catalogues and default
    data green.

- 2026-11-16 (ninth pass: cart/checkout/orders on their blocks). The two biggest
  hand-rolled surfaces now project SDKWork blocks:
  - `@sdkwork/mall-mp-core` builds both clients once, over the host `fetch`
    adapter and the shared token manager: `createMpCommerceAppSdkClient`
    (`@sdkwork/commerce-app-sdk`, the mall's generated facade) and
    `createMpOrderAppSdkClient` (`@sdkwork/order-app-sdk`, the same operation set
    the H5 client reaches through `@sdkwork/order-service`). The runtime exposes
    them as `commerceClient` / `orderClient`; a seam helper
    `createMpIdempotencyParams()` supplies the order block's `Idempotency-Key`
    from the shared SDKWork uuid (which falls back without `crypto`, the WeChat
    case).
  - `order-service.ts`: list/statistics/detail/payment-success, pay, cancel,
    receipt confirmation and the shipment trace now call `orders.*` /
    `shipments.*`; eight hand-written order endpoints are gone and the view
    models are unchanged.
  - `cart-service.ts`: cart read/add/update/remove, payment-method list, coupon
    list, checkout session + quote + order creation, address default selection,
    coupon application and wallet holds call the commerce block; the payment
    intent calls the order block. `buildCheckoutOrderBody` stays a pure exported
    builder so the money-path vitest contract keeps guarding it.
  - Guards: `verify-mp-order-block-integration` and
    `verify-mp-cart-block-integration` fail the build on a reintroduced order or
    commerce wire path, on a command without an idempotency key, or on an impure
    checkout body builder. The transport-seam guard now exempts only
    `@sdkwork/mall-mp-core` from the "no client construction" rule.
  - Tests: `mp-order-block.test.ts` pins the order projection (paging, detail
    view model, idempotency keys, statistics) with a fake block client and zero
    HTTP hops.
  - Regression: 25 node guards, 64 vitest contracts, 159/159 contract tests, both
    typechecks (49 packages), composition, parity, catalogues, default data and
    the i18n ratchet green.

- 2026-11-16 (tenth pass: catalogue on its block). `catalog-service.ts` now
  projects `runtime.commerceClient.catalog` (`categories.list`, `products.list`,
  `products.retrieve`); the three hand-written `/catalog/*` paths and the raw
  transport import are gone, while the category tree, product-card and product
  detail view models are unchanged. Guard
  `verify-mp-catalog-block-integration.test.mjs` rejects a reintroduced catalogue
  endpoint or a re-imported transport seam.
  Regression: 25 node guards, 64 vitest contracts, 161/161 contract tests,
  composition and parity green.

- 2026-11-16 (eleventh pass: promotion, addresses, invoices, shops, after-sales on
  their blocks). Five more services stopped owning endpoints:
  - `promotion-service`: offers list, coupon claim and code redemption →
    `promotions.offers/userCoupons.claims/codes.redemptions`.
  - `address-service`: address book CRUD and default selection →
    `addresses.*` / `addresses.defaultSelection`.
  - `invoice-service`: buyer invoices → `invoices.mine.list` / `invoices.create`.
  - `marketing-service`: featured shops, shop detail + shop products and activity
    offers → `shops.list/retrieve`, `catalog.products.list`, `promotions.offers`.
  - `aftersales-service`: requests list/create/cancel, progress timeline and the
    buyer return shipment → `afterSales.requests/events/returnShipments`, with the
    idempotency key from the core seam helper; the mall keeps the commerce create
    body and the presentation constants.
  - Guards: `verify-mp-marketing-block-integration` (six assertions) rejects a
    reintroduced wire path, a re-imported raw transport and an after-sales command
    without an idempotency key. The after-sales depth contract now tracks the
    block call instead of the endpoint literal.
  - Tests: `mp-marketing-block.test.ts` pins offers/coupons, address book,
    invoices/shops/activities and the whole after-sales lifecycle against fake
    blocks with zero HTTP hops.
  - Regression: 25 node guards, 67 vitest contracts, 167/167 contract tests,
    composition, parity, catalogues, default data and the i18n ratchet green.
  - External state: the repo-wide `typecheck` is red only on the H5 order page
    (`apps/sdkwork-mall-h5/.../OrderPage.tsx`), which a concurrent brick-migration
    edit is mid-way through; no mini-program file participates.

- 2026-11-16 (twelfth pass: wallet, points and membership on their blocks).
  `account-service.ts` now projects `runtime.commerceClient.wallet` and
  `.memberships`: cash/points accounts, cash and points ledgers, membership
  status/plans/packages and the package purchase. The eleven hand-written
  `/wallet/*` and `/memberships/*` paths are gone.
  - The commerce block exposes no per-lot points reader, so `lots` stays empty
    instead of being re-derived from a hand-written endpoint; the view model is
    unchanged and the points page degrades to balance + ledger.
  - The marketing guard covers account-service as a sixth case; the membership
    purchase contract now tracks `memberships.purchases.create` instead of the
    endpoint literal.
  - Regression: 25 node guards, 67 vitest contracts, 169/169 contract tests,
    composition, parity, catalogues, default data and the i18n ratchet green.
    (Repo-wide typecheck is still red only on the concurrent H5 OrderPage edit.)

- 2026-11-16 (thirteenth pass: partner, and the transport seam retires to storage).
  - `partner-service.ts` projects `@sdkwork/partner-app-sdk` through the runtime
    (`partnerClient`): join programme, applications list/create/cancel, invite-code
    validation, partner centre, team, commission records and withdrawals. The
    capability keeps its validators, presentation state machine and view models;
    ten hand-written `/partner_join` and `/partner_center` paths are gone.
  - `page-info.ts` now reads list payloads structurally instead of importing the
    raw transport seam, so `src/services/transport.ts` backs only the Drive
    upload/download envelope — the building-block migration's stated end state.
  - Guards: the marketing-block suite gained a partner case; every migrated
    surface (auth, order, cart, catalog, promotion, addresses, invoices, shops,
    after-sales, wallet/membership, partner) now fails the build if a wire path
    returns or the raw transport is re-imported.
  - Regression: 25 node guards, 67 vitest contracts, both typechecks (49
    packages, 0 failed), composition, parity, catalogues, default data and the
    i18n ratchet green; 168/170 contract tests pass. The two failures are H5-only
    and belong to the concurrent H5 brick migration
    (`verify-h5-i18n-runtime` on the in-flight `OrderDetailPage`, and the H5 pay
    action redirect).

- 2026-11-16 (fourteenth pass: tab bar aligned with the H5 shell). The mini
  program tab bar had four tabs and no badge; the H5 shell has five tabs and a
  cart badge.
  - `app.json` now declares the same five tabs, in the same order, as the H5
    shell `SHELL_TABS`: 首页 / 分类 / **消息** / 购物车 / 我的. The 消息 tab roots at
    `pages/chats/index`; the authored icon pair (`message-outline.png` /
    `message-filled.png`, 81x81, rounded speech bubble, brand-red selected state)
    completes the eight-icon set.
  - `buyer.mall.im.chats` joined `MP_TAB_CAPABILITY_ROUTES`, so every capability
    jump to the conversation list uses `switchTab` instead of an illegal
    `navigateTo` push onto a tab page.
  - Cart badge (H5 parity with `readMallH5CartCount` / `writeMallH5CartCount`):
    the host gained `MpNavigation.setTabBarBadge/removeTabBarBadge` (tolerant of
    old base libraries and of "no badge set"), the platform facade projects it as
    `platform.tabBarBadge(index, text?)`, and `src/services/tab-bar-service.ts`
    owns the tab model, the `sdkwork-mall-mp-cart-count` storage contract and the
    99+ cap. The entry paints the stored count on launch/show and reconciles off
    the cart block; the cart, product and checkout flows update it.
  - Guards: `tests/contract/verify-mp-tabbar-h5-parity.test.mjs` pins the tab
    labels against the H5 shell source, requires both icon assets and a registered
    page per tab, checks the tab capability list and the badge wiring; the
    standard-architecture suite now expects five tabs; `mp-platform-host` covers
    set/clear through the host fake.
  - Regression: 25 node guards, 68 vitest contracts, both typechecks (49 packages,
    deferred typecheck), composition, parity, default data green; 175/180 contract
    tests, with the five failures all in the concurrent H5 brick migration
    (OrderDetail i18n key, H5 route registry, shared copy, H5 pay redirect, H5
    page heading). i18n baseline refreshed to the improved counts.

- 2026-11-16 (fifteenth pass: boot failure fixed + per-page audit). DevTools
  reported `module "runtime-env.json.js" is not defined, require args is
  "./runtime-env.json"` and pages never registered.
  - **Root cause**: `app.ts` imported `src/runtime-env.json`. The WeChat compiler
    emits `require("./runtime-env.json")`, and the mini-program module system
    resolves only JS/TS modules, so the whole app aborted before any page
    registered (hence "Page pages/home/index has not been registered yet").
  - **Fix**: the build now materializes `src/bootstrap/runtime-env.generated.ts`
    (committed with the development defaults) and `readRuntimeEnv` merges it with
    the release channel and the runtime global override. `tsconfig` no longer
    sets `resolveJsonModule`, so a JSON import fails typecheck instead of device
    boot. `scripts/build-runtime.mjs` writes the TS module.
  - **Runtime hardening found during the audit**: `@sdkwork/sdk-common` creates an
    `AbortController` per request timeout and the fetch adapter used
    `TextEncoder` for `arrayBuffer()`. Neither is guaranteed on older WeChat base
    libraries, so `installMpFetch` now polyfills `AbortController`/`AbortSignal`
    and the adapter UTF-8 encodes by hand.
  - **Per-page audit** (new `tests/mp-page-completeness.test.mjs`, 4 checks): every
    `src/pages/*` folder has index.ts/wxml/wxss/json; `app.json` pages and the
    folders agree exactly (tab roots included); every template event handler
    (`bindtap`/`catchtap`/`bindinput`/... ) exists on its page module — 36 pages,
    no dead buttons; and no `.ts` in `src/` or `packages/` imports JSON, uses
    `import.meta`, `process.env`, `window`, `document` or `localStorage`.
  - Regression: 29 node guards, 68 vitest contracts, both typechecks, composition,
    parity, default data and the i18n ratchet green; 181/185 contract tests with
    the four failures all in the concurrent H5 brick migration.

- 2026-11-16 (sixteenth pass: the reported boot error persisted after the JSON
  import was removed). Diagnosis: the source tree no longer contains the import
  (only comments mention it), but the dev tool kept compiling an older module
  graph — its project directory cache
  (`%LOCALAPPDATA%\微信开发者工具\User Data\cc5f1145...\WeappCache\dirCache\432ab158...\fileCache.cfg`,
  written 19:41) still lists `src/runtime-env.json` and no `packages/`, i.e. a
  snapshot from before the integration; the tool also runs the compiler in the
  main process with hot reload, so the compiled module graph survives a plain
  "编译".
  - Added `src/runtime-env.json.js`: the WeChat compiler registers a JSON import
    under the module id `runtime-env.json.js`, so this CommonJS shim makes that id
    resolve to the same values the build materializes. A stale compiled bundle now
    boots instead of aborting.
  - `scripts/build-runtime.mjs` writes the shim alongside
    `src/bootstrap/runtime-env.generated.ts`; the completeness guard fails when the
    shim and the generated module disagree, and still fails on any JSON import.
  - Operator action required once: clear the dev-tool cache and recompile, or fully
    quit and reopen the project, so the stale index is dropped.
  - Regression: 30 node guards, 69 vitest contracts, mini typecheck green.

- 2026-11-16 (seventeenth pass: the dev tool now loads a bundled package). The
  launch error survived both the source fix and the loader shim, which proved the
  tool was executing its last successful bundle: the TypeScript plugin cannot
  compile SDKWork workspace packages whose `exports` point at TS sources outside
  the project root, so every compile since the integration silently fell back.
  - Added `scripts/build-miniprogram.mjs` (esbuild): bundles `src/app.ts` plus one
    entry per `app.json` page into `dist/` as CommonJS (ES2020, minified), copies
    WXML/WXSS/JSON/images, and stubs Node-only SDK transports (`node:net`,
    `node:dgram`, ...) to an empty module so dead branches stay loadable.
  - `project.config.json` points `miniprogramRoot` at `dist/` and disables the
    TypeScript compiler plugin; `pnpm build` / `build:standalone` / `build:cloud`
    now materialize the env **and** bundle, with `build:mp:watch` for iteration.
  - Result: `dist/app.js` contains no `require(...)` at all (fully bundled, no
    `runtime-env.json`, no Node built-ins): 37 entries, 8.1 MB total, ~1.7 MB main
    package (app + five tab pages + assets) which is inside the 2 MB main-package
    limit; the remaining pages fit the 20 MB total including subpackages.
  - Guard: the completeness suite now asserts the dev tool runs `dist/`, the build
    scripts bundle, and every `app.json` page becomes an entry.
  - Regression: 31 node guards, 69 vitest contracts, typecheck, composition and
    parity green; 183/190 contract tests with the seven failures all inside the
    concurrent H5 brick migration (checkout brick, H5 route registry, gift-card
    copy, order paymentUrl, H5 i18n).

- 2026-11-16 (eighteenth pass: the bundled app boots cleanly). The first real
  launch after the build change surfaced two bundling-specific defects, both fixed:
  - **`Cannot read property 'wx' of undefined`**: the WeChat adapters read their
    platform scope from a `globalThis` default parameter, and that binding is not
    reliably present in every base library/bundle transform. A `resolvePlatformScope()`
    helper (`typeof globalThis` guard + indirect `Function("return this")()` fallback)
    now backs every adapter and the fetch/AbortController installer.
  - **`runtime is not initialized` / `host profile is not installed`**: bundling per
    entry (app + 36 pages) gave each bundle its own copy of the module-local
    singletons, so `app.onLaunch` initialized one and every page read another. The
    runtime, host profile and IM services registries now live on global keys
    (`__SDKWORK_MALL_MP_RUNTIME__`, `__SDKWORK_MALL_MP_HOST__`,
    `__SDKWORK_MALL_MP_IM_SERVICES__`), matching how the platform scope already works.
  - Added `scripts/smoke-miniprogram.mjs` (`pnpm smoke:mp`): loads the real `dist/`
    bundles with a stub `wx`/`App`/`Page`, runs `app.onLaunch`/`onShow` and every
    page's `onLoad`/`onShow`, and fails on the first error — this is the automated
    "console log until clean" loop, and it now reports
    `PASS no boot or page-lifecycle errors` for all 36 pages.
  - Regression: 31 node guards, 69 vitest contracts, typecheck, composition and
    parity green; contract suite 183/190 with the seven failures all inside the
    concurrent H5 brick migration.

- 2026-11-16 (nineteenth pass: no unguarded `globalThis` anywhere). The next
  launch error was `Cannot read property '__SDKWORK_MALL_MP_RUNTIME_ENV__' of
  undefined`: `bootstrap/environment.ts` read the injection override through
  `globalThis`, and the dev-tool appservice (base library 3.18, after its
  ES6→ES5 pass) does not expose a usable `globalThis` binding.
  - One guarded resolver (`packages/sdkwork-mall-mp-host/src/scope.ts`):
    `resolveGlobalObject()` (`wx` first, then a `typeof globalThis` guard, then a
    module fallback), `resolvePlatformScope()` (the `{ wx }` shape the adapters
    take) and `resolveSharedScope()` (`getApp().globalData`, the documented
    cross-bundle store). Every consumer — environment, runtime/host/IM singletons,
    fetch/AbortController installer — now goes through it.
  - Global *assignments* do not create global *variables* on WeChat, so the
    bundler prepends bundle-scoped shims for `fetch`/`AbortController`/`AbortSignal`
    that resolve the host adapter from `wx.__SDKWORK_MALL_MP_FETCH__` (published by
    `installMpFetch`). SDK HTTP now works end to end: the smoke harness reports 16
    real request attempts and every page handles them.
  - Guard: the completeness suite fails if any `.ts` outside the scope helper
    mentions `globalThis` (comments stripped).
  - Regression: 32 node guards, 69 vitest contracts, mini typecheck, composition and
    parity green; 184/191 contract tests with the seven failures inside the
    concurrent H5 brick migration.

- 2026-11-16 (twentieth pass: resumable runtime after a dev-tool hot reload). The
  next launch log was `runtime is not initialized` on page `onShow` while the app
  itself had booted: the dev tool's auto hot reload re-evaluates page bundles
  without `app.onLaunch`, and the "compileHotReLoad" path can run in a context
  where the runtime/host/services singletons are gone.
  - The runtime, host profile and IM services are now cross-bundle shared state
    (`readSharedState`/`writeSharedState`) written to **every** reachable store
    (`getApp().globalData`, the platform global) so a value written before the app
    instance existed is still found afterwards; the stale module-local fallback no
    longer shadows the real stores.
  - `registerMallMpBootstrap(bootstrapMallMpRuntime)` runs at the app module scope,
    so any later bundle can rebuild the graph; `getMallMpRuntime()` and
    `getMallMpHost()` both self-heal through it, and
    `initializeMallMpRuntime` only short-circuits when the runtime **and** host are
    installed (a half-cleared store rebuilds instead of returning a broken graph).
  - `smoke:mp --hot-reload` reproduces the scenario (clears runtime/host/services
    state, keeps the bootstrap factory) and now passes for all 36 pages, with 16
    request attempts handled by the pages.
  - Regression: 32 node guards, 69 vitest contracts, typecheck, composition green;
    184/191 contract tests with the seven failures inside the concurrent H5 brick
    migration.

- 2026-11-16 (twenty-first pass: a store the platform cannot take away). The
  previous fix relied on `getApp().globalData` / `wx` as the cross-bundle channel,
  but in the dev tool both can be missing or read-only, so the runtime died again
  after a hot reload with `runtime is not initialized`.
  - Added `src/shared-state.js`, copied verbatim into `dist/`: the mini-program
    caches modules per appservice context, so a plain `require` of this one file is
    the only channel that is reliably shared and writable on every base library.
  - The bundler injects `var __sdkworkSharedStore = require(<relative>/shared-state.js)`
    into every entry (a post-build pass rewrites the placeholder to `./shared-state.js`
    for the app and `../../shared-state.js` for pages) and exposes it to the scope
    resolver through a `declare const`.
  - `readSharedState`/`writeSharedState` now consult the module-cache store between
    `getApp().globalData` and the platform global, and every write is try/caught so a
    frozen `wx` cannot fail the write. `installMpFetch` publishes the fetch and
    AbortController shims to the same store; the bundled globals read it first.
  - `smoke:mp --shared-store-only` proves the claim: it clears the runtime/host/
    services keys from `getApp().globalData`, deletes them from `wx`, freezes `wx`,
    then runs all 36 pages — PASS with 16 request attempts, i.e. the module-cache
    store alone carries the graph and the HTTP adapter.
  - Regression: 32 node guards, 69 vitest contracts, typecheck, composition green;
    184/191 contract tests (seven H5-only failures from the concurrent brick
    migration).

- 2026-11-16 (twenty-second pass: flat storefront + H5 home alignment). Feedback
  from the dev-tool screenshot: rounded cards exposed the page background at every
  corner, the hero carousel looked inset, and a raw English SDK error
  ("A required dependency is temporarily unavailable") was rendered to the buyer.
  - Hero carousel: full-width, `border-radius: 0`, no side margin, white / 45 %
    white indicator dots, 320 ms transitions, and the four H5 poster tones
    (`brand`/`ember`/`teal`/`violet`) assigned per banner, so the mini program hero
    matches the H5 carousel posters.
  - Home section order now mirrors H5: search → hero → quick entries → categories →
    seckill → featured shops → footprint → hot → new arrivals → service grid.
  - Every card surface in all 36 pages is rectangular: 29 stylesheets flattened
    (`.mp-card`, `.mp-product-card`, product images, activity/orders/notice/messages
    rows, cart shop blocks, checkout panels, membership hero, logistics cards,
    partner panels, ...) and the `--mp-radius-*` tokens are 0. Pills, chips,
    avatars, checkboxes, dots and inputs keep their radius.
  - `errorMessage()` no longer forwards a message that contains no CJK characters:
    an English SDK/transport failure is logged for diagnostics and the page's
    localized fallback is shown instead.
  - Guard: `card surfaces stay rectangular (flat storefront)` fails the build if a
    card-like selector reintroduces a non-zero radius (interactive/round elements
    are exempt).
  - Regression: 33 node guards, 69 vitest contracts, typecheck, composition, parity
    and the i18n ratchet green; smoke (normal / hot reload / shared-store-only) all
    PASS over 36 pages; contract suite 185/192 with the seven failures inside the
    concurrent H5 brick migration.

- 2026-11-16 (twenty-third pass: rounded hero could not be reproduced in the
  source, so the build now proves which package runs). `src/` and `dist/` both
  carry `border-radius: 0` on `.home-banner`, yet the dev tool still painted
  rounded corners — the tell-tale of a stale compiled package (the tool's project
  cache was already found to predate the integration).
  - The hero and every card class now pin `border-radius: 0 !important`
    (`.home-banner`, `.home-banner swiper-item`, `.home-banner-item`, plus the
    global `.mp-card`/`.mp-product-card`/... set and the 36 page-level card
    classes), so a platform style or an older stylesheet cannot round them again.
  - The bundler injects `__SDKWORK_MALL_MP_BUILD_ID__` (ISO timestamp) into the
    app entry and prints it at launch: `[sdkwork-mall] build <timestamp>`. Comparing
    that line with the build log output proves whether the dev tool is really
    running the new package.
  - Guard: the flatness check accepts `0 !important`, and the built `dist` bundle
    was rebuilt (8.2 MB) with the marker.
  - Regression: 33 node guards, 69 vitest contracts, typecheck, composition green;
    smoke PASS over 36 pages (the technical-error masking is also visible in its
    log); contract suite 185/192 with the seven H5-only failures.

- 2026-11-16 (twenty-fourth pass: the hero no longer uses the platform `swiper`).
  The screenshot was taken at 23:30, one minute before the `!important` build
  (`build 2026-11-16T15:30:37Z` = 23:30:37 +08:00), which explains why rounded
  corners were still visible after the source had been flattened twice.
  - Rather than depend on the dev tool picking up the next package, the hero is now
    a **custom carousel**: plain `view` track with `translateX`, 320 ms transition,
    autoplay every 4.2 s, swipe left/right, tappable dots, and autoplay paused in
    `onHide`/`onUnload` and while the visitor drags. No `swiper` component is
    involved, so no platform default style can round it.
  - `.home-banner`, `.home-banner-slide` and every card class pin
    `border-radius: 0 !important`.
  - The launch log prints `[sdkwork-mall] build <ISO timestamp>`; the current build
    is `2026-11-16T15:33:01.076Z`. A stale package is now identifiable from the
    console instead of inferred from pixels.
  - Regression: 33 node guards, 69 vitest contracts, typecheck, composition, parity
    and i18n green; smoke PASS over 36 pages; contract suite 185/192 (seven
    H5-only failures from the concurrent brick migration).
