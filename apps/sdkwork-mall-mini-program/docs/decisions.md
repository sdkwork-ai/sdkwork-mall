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
