# Client Capability Parity

Status: active
Owner: SDKWork maintainers
Updated: 2026-11-02
Specs: APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md (§7 route identity, §11
cross-architecture alignment), APP_H5_ARCHITECTURE_SPEC.md,
MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md, FLUTTER_APP_MOBILE_ARCHITECTURE_SPEC.md,
APP_PC_ARCHITECTURE_SPEC.md

## 1. Why This Contract Exists

SDKWork Mall ships four client roots for one commerce product:

| Field | PC | H5 | Mini program | Flutter |
| --- | --- | --- | --- | --- |
| Root | `apps/sdkwork-mall-pc` | `apps/sdkwork-mall-h5` | `apps/sdkwork-mall-mini-program` | `apps/sdkwork-mall-flutter-mobile` |
| Architecture | `pc-react` | `h5-react` | `weixin-mini-program` | `flutter-mobile` |
| Route registry | `packages/*/src/routes.ts` | `packages/*/src/routes.ts` | `src/app.json` | `lib/shell/mobile_shell.dart` |
| Buyer surfaces | storefront + buyer + merchant + admin | storefront + buyer | storefront + buyer | storefront + buyer |

Before this contract, only the PC root had an architecture gate. A capability
could therefore be dropped from, or silently added to, one client without any
build noticing — the classic cross-client drift described in
`APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md` §11.

`specs/mall-capability-parity.json` is now the single source of truth for
"which commerce capability ships on which client root". Every entry declares
one business capability, the roots that must ship it, and the concrete artifact
each root uses (route id, mini-program page, Flutter route or tab).

## 2. Enforcement

| Gate | Command | Failure mode |
| --- | --- | --- |
| Contract validation | `node --test tests/contract/verify-mall-capability-parity.test.mjs` | Missing/duplicated capability, unknown platform, malformed canonical route id |
| Registry resolution | same test | Declared route/page/route-key does not exist in the platform registry |
| Drift guard (PC) | same test | A new PC storefront/buyer route is not represented in the contract |
| Drift guard (H5) | same test | A new H5 route is neither in the contract nor in `platformExtras.h5` |
| Drift guard (MP) | same test | A page in `app.json` is neither in the contract nor declared as an extra |
| Drift guard (Flutter) | same test | A route in `buildSdkworkMallRoutes()` is not represented |
| Navigation evidence | same test | A capability page exists but nothing links to it (orphan screen) |
| Router mounting | same test | A route is declared in `routes.ts` but the PC/H5 router never mounts it (`case "<id>"` / `path="<path>"` missing) |
| Checkout scoping | `tests/contract/verify-checkout-scoping.test.mjs` | 立即购买 stops passing the created cart line id, a checkout page stops consuming it, or a quote is requested without the scoped lines |
| Route identity (mobile) | same test | A capability's canonical route id is missing from `mini-program/src/routes/capabilities.ts` or `flutter-mobile/lib/routes/capability_routes.dart`, or points at a different page/path than the contract |
| Mini-program navigation | `apps/sdkwork-mall-mini-program/tests/capability-navigation.test.mjs` | A page module hard-codes `/pages/...`, the registry and `app.json` disagree, a tab capability is not classified for `wx.switchTab`, a page calls `mpCapabilityUrl` with an id the registry does not publish, or a non-tab capability page has no entry from another page |
| Link integrity (web) | PC + H5 architecture tests | An in-app `to`/`navigate` link targets a path no route contributes |
| Orphan screens | PC + H5 architecture tests | A registered route has no in-app entry; the page module resolved from the router is excluded so a page cannot link to itself. PC covers storefront routes (buyer/merchant/admin nav is generated from the registry and asserted as such); H5 covers every non-tab route |
| Flutter route references | `apps/sdkwork-mall-flutter-mobile/test/route_references_test.dart` | A page pushes a named route `buildSdkworkMallRoutes()` never registers, a registered route is never pushed, or a capability-registry path has no shell route |
| Accessible page heading (H5) | `apps/sdkwork-mall-h5/tests/contract/h5-standard-architecture.test.mjs` | A page component renders no `<h1>`: the shell navbar is a styled div, so assistive technology would get no page title |
| Auth alignment | same test | The same capability is public on one web root and auth-required on the other |
| Title-key convention | same test | A route title key does not follow `<namespace>.routes.<screen>.title` |
| Shared copy | same test | The upstream notice or buyer-hub label is reworded on one root |
| Capability title | same test | The screen name a user reads differs between roots: the contract `title` is canonical, and PC/H5 route titles, mini-program `navigationBarTitleText` and Flutter `AppBar` must all show it |
| Human report | `pnpm check:capability-parity` | Prints the matrix, the documented asymmetries, and exits non-zero when a required cell is missing |

`pnpm check` runs the parity test; `pnpm verify` additionally runs the matrix
report. `pnpm report:capability-parity` prints only gaps.

## 3. Rules For Changing Capability Set

1. Add or remove the capability in `specs/mall-capability-parity.json` first.
2. Give every required root a concrete implementation artifact.
3. Keep route identity aligned: the PC route id is canonical, and H5 must reuse
   it verbatim for the same workflow (`APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md`
   §7). Presentation differences are fine; identity differences are not.
4. Declare `navigationEvidence` whenever a capability must be reachable from the
   buyer hub, so an unlinked screen fails the gate.
5. When a root genuinely fuses two capabilities into one surface (H5 payment
   inside checkout, category detail inside the category tab), use `fusedInto`
   and record the reason in `notes` instead of inventing a duplicate route.
6. Platform-only surfaces go to `platformExtras` with a written reason, never
   silently into a capability entry.
7. Capability copy that must not drift (upstream notices, buyer-hub labels) is
   declared under `sharedCopy` with the exact text and every file that ships it.
8. A capability a root deliberately does not ship stays out of that root's
   `requiredOn` **and** carries a `notes` reason; the report lists every such
   asymmetry on each run.
9. Route identity is carried by all four roots: PC/H5 in route contributions,
   the mini program in `src/routes/capabilities.ts`, Flutter in
   `lib/routes/capability_routes.dart`. The mobile registries are the single
   place a page path is mapped to a capability, so renaming a page means editing
   the registry — never scattering raw paths through pages. Flutter validates
   the registry against `buildSdkworkMallRoutes()` in debug builds.

## 4. Current Parity Status

36 capabilities × 4 roots, 0 required gaps.

Buyer and storefront capabilities required on **all four** roots: home,
categories, category detail, search, product detail, shop home, activity list,
activity detail, cart, checkout, payment, payment result, help, buyer dashboard,
orders, order detail, logistics, addresses, after-sales, coupons, favourites,
footprint, messages, reviews, gift cards, profile, account security, settings,
wallet, points, membership, invoices.

Settings scope is identical on every root by contract: clear local footprint,
clear local favourites, sign out. Cross-root preferences (notification channels,
locale) are deliberately absent until a server-side preference contract exists —
inventing them per client is exactly the drift this contract prevents.

Root-scoped capabilities: IM conversations, chat and notices are required on
H5/mini program/Flutter; login is required on mini program/Flutter because PC
and H5 delegate authentication to the shared IAM auth gate.

Route identity: all four roots now publish the same canonical route ids — PC/H5
through route contributions, the mini program through
`src/routes/capabilities.ts` (every page module navigates via
`mpCapabilityUrl()`; no page hard-codes a `/pages/...` path any more), and
Flutter through `lib/routes/capability_routes.dart` (validated against the
named-route table in debug builds).

PC-only by design: `admin.*` platform governance, `merchant.*` seller console,
and the inactive `app.commerce.*` legacy SaaS dashboards.

## 4.1 Canonical Screen Names

The contract `title` is the canonical label a buyer reads for a capability, and
every root must show exactly that string (PC/H5 route `title`, mini-program
`navigationBarTitleText`, Flutter `AppBar`). Auditing the three web+mobile roots
found 17 capabilities whose screen name drifted — the same screen was labelled
收银台 on one root and 确认订单 on another, 消息中心 vs 消息, 钱包 vs 我的钱包,
售后 vs 售后中心. All titles are now aligned and the gate fails on any drift.

The only documented exception is the Flutter search screen, whose AppBar hosts a
search field instead of a static title — the conventional mobile search UX.
## 5. Upstream Gaps Represented, Not Hidden
Two capabilities have no published upstream contract yet. All four roots ship
the same realized subset and the same honest notice instead of diverging:

| Capability | Upstream state | Realized behaviour on every root |
| --- | --- | --- |
| Buyer reviews | T1 product-review API not landed | Lists completed orders as review candidates; media upload copy states the pending contract |
| Gift cards / red packets | Commerce gift-cards API not landed | Reserved entry with wallet fallback |

Known platform-level dependency gap, resolved 2026-11-02: the composed
federated transport `@sdkwork/cloudrouter-app-sdk/domains` and
`@sdkwork/cloudrouter-backend-sdk/domains` are imported by
`apps/*/src/bootstrap/{sdkClients,iamRuntime}.ts`. The sibling
`sdkwork-cloudrouter` SDK families published only `"."` and no `./domains`
subpath, so the imports failed to resolve:

```text
pnpm typecheck
  error TS2307: Cannot find module '@sdkwork/cloudrouter-app-sdk/domains'   (x2 per root)
  error TS2307: Cannot find module '@sdkwork/cloudrouter-backend-sdk/domains' (x2 per root)

vite build (apps/sdkwork-mall-h5)
  [rolldown:vite-resolve] "./domains" is not exported under the conditions
  ["module","browser","production","import"] from package @sdkwork/cloudrouter-app-sdk
```

The fix landed upstream in the `sdkwork-cloudrouter` SDK family, per
`APP_SDK_INTEGRATION_SPEC.md` §9 / `SDK_WORKSPACE_GENERATION_SPEC.md`
composed-facade rules: the family now carries an authored
`src/domains/index.ts` facade over the generator-owned
`generated/commerce-server-openapi/**` transport, exports `./domains` from
`package.json`, and re-exports the transport types. The facade groups the
generated commerce transports under `client.commerce.*` and keeps the
`setTokenManager()` seam the IAM runtime installs. No generated file was
hand-edited and no local SDK fork was introduced.

After the facade landed, the same commands that were previously blocked pass:

```text
pnpm typecheck        → clean (both browser roots)
pnpm build:h5:dev     → PASS dist/standalone/dev/
pnpm build:pc:dev     → PASS dist/standalone/dev/
```

Retained residual upstream gaps are business-contract gaps, not build gaps, and
stay listed in section 5's table above.

## 6. Verification Evidence (2026-11-02)

```text
pnpm test:node                                                     → 86/86 pass
  (tests/contract/verify-mall-capability-parity.test.mjs           → 15/15)
  (tests/contract/verify-mall-standard-architecture.test.mjs       → 17/17)
  (tests/contract/verify-capability-snapshot.test.mjs              → 1/1)
  (tests/contract/verify-checkout-scoping.test.mjs                 → 6/6)
  (tests/contract/verify-i18n-catalogue.test.mjs                   → 4/4)
  (tests/contract/verify-after-sales-depth.test.mjs                → 1/1)
  (tests/contract/verify-browser-page-titles.test.mjs              → 3/3)
  (tests/contract/verify-mobile-failure-handling.test.mjs          → 2/2)
  (tests/contract/verify-i18n-readiness.test.mjs                   → 2/2)
  (tests/contract/verify-search-depth.test.mjs                     → 1/1)
  (tests/contract/verify-h5-i18n-runtime.test.mjs                  → 3/3)
  (tests/contract/verify-after-sales-depth.test.mjs                → 2/2)
  (tests/contract/verify-flutter-i18n-runtime.test.mjs            → 2/2)
  (tests/contract/verify-mp-i18n-runtime.test.mjs                 → 2/2)
  (tests/contract/verify-invoice-tax-validation.test.mjs          → 2/2)
  (apps/sdkwork-mall-h5/tests/contract/h5-standard-architecture)   → 10/10
  (apps/sdkwork-mall-mini-program/tests/mp-standard-architecture)  → 5/5
  (apps/sdkwork-mall-mini-program/tests/capability-navigation)     → 7/7
  (apps/sdkwork-mall-mini-program/tests/currency-format)           → 2/2)
pnpm typecheck                                                     → clean (both roots)
pnpm build:h5:dev / pnpm build:pc:dev                              → PASS (standalone/dev)
pnpm typecheck:packages                                            → 46 packages, 0 failed
pnpm test:vitest                                                   → 70 files / 177 tests pass
mini program: npx tsc --noEmit                                     → clean
flutter analyze                                                    → no issues
flutter test                                                       → 23/23 pass
node ../sdkwork-specs/tools/verify-repo.mjs --root .               → passed
node ../sdkwork-specs/tools/check-application-layering.mjs --root .→ passed
node ../sdkwork-specs/tools/check-app-sdk-consumer-imports.mjs     → passed
pnpm check:capability-parity                                       → 36 capabilities, 0 gaps
```

### 6.1 Navigation integrity

Both browser roots now prove statically that every in-app link resolves to a
mounted route (`to="…"`, `navigate("…")`, and template-literal links, with
`:param` matching):

- H5: `apps/sdkwork-mall-h5/tests/contract/h5-standard-architecture.test.mjs`;
- PC: `tests/contract/verify-mall-standard-architecture.test.mjs` — this gate
  found two dead admin-product links (`/admin/catalog/products`,
  `/admin/catalog/products/new`) whose target routes were never contributed, so
  "back to product list" and "add product" dropped the operator out of the
  console. The product admin now contributes `admin.commerce.product-admin.create`
  (`/admin/products/new`) and `admin.commerce.product-admin.edit`
  (`/admin/products/:productId/edit`), AppRoutes mounts them with the matching
  `CatalogAdmin sectionId`, and the links point at them.

The inverse check runs on H5: every registered route must have at least one
in-app entry, where the page module resolved from the router is excluded so a
page cannot satisfy the check by linking to itself. It found `storefront.mall.tv`
(`/tv`) reachable from nowhere — the TV showcase was implemented and routed but
had no entry point. The H5 home page now carries a 更多服务 row (帮助中心 /
电视购物 / 我的订单 / 设置), so the TV surface is discoverable instead of dead.

### 6.1.1 Accessible page headings (H5)

The H5 navbar renders the page title as a styled `div`, so screen-reader users
got no page heading unless the page rendered one. Six page components
(`BuyerHomePage`, `SelectOrderPage`, `ChatPage`, `ConversationListPage`,
`LogisticsPage`, `OrderPage`) shipped without one. All 34 page components now
render an `<h1>` (visually hidden via `.sdk-h5-visually-hidden`, the pattern the
other pages already used), and the H5 architecture test fails when a page
component loses it.

### 6.1.2 Shared load-failure state (H5)

Fourteen H5 data pages rendered a bare red `<div>` on load failure with no
recovery path other than reloading the whole app. `@sdkwork/mall-h5-commons`
now owns the domain-neutral error/retry primitive `SdkworkMallH5ErrorState`
(alert semantics preserved, retry defaults to a page reload and can be
overridden), every page that can fail a load uses it, and form/action validation
messages use the `sdk-h5-notice-danger` tone instead of the error banner. The H5
architecture test fails when a page renders `sdk-h5-error` directly.

A second pass closed the remaining escape hatch. Six pages (product detail,
checkout, coupons, addresses, invoices, after-sales) reported load failures
through a transient toast instead of the banner, and product detail misreported
every failure as 商品不存在或已下架 with no retry. All six now render the banner
with a page-scoped retry, checkout refuses to submit without an authoritative
quote, and the architecture test fails when a page can say `加载失败` without
rendering `SdkworkMallH5ErrorState`.

### 6.1.3 Recoverable failures (mini program)

The same audit on the mini program found 23 pages rendering an error state, of
which only 7 could recover (pull-down refresh) and one had a retry action. Every
error block now carries a 重试 action bound to the page's own loader (pull-down
refresh remains where it already existed), `app.wxss` lays the message and the
action out on one line, and
`apps/sdkwork-mall-mini-program/tests/capability-navigation.test.mjs` fails when
a page renders `mp-error` without pull-down or a retry binding. The login form
is the one exemption: its error is a rejected credential, retried by submitting
the form again.

The gate originally keyed off the `mp-error` class, so the product page — which
rendered its failure through `mp-empty` — escaped it. The product page now
separates a failed load (retryable `mp-error` block) from an off-shelf product
(empty state with 回到首页), and the gate keys off `{{error}}` so rendering an
error through another class can no longer bypass recovery.

### 6.1.4 Recoverable failures (Flutter)

The Flutter root already had `SdkworkErrorView`, but four full-page error states
omitted `onRetry` (cart, checkout, cashier, product) and three asset pages
(wallet, points, membership) plus chat rendered a bare red text row. Checkout,
cashier, cart, product, order detail and the test/fixture pages now wire the
page's loader; the asset pages and chat use the new compact
`SdkworkInlineError`, which keeps the surrounding data visible and still offers
重试. `test/error_recovery_test.dart` fails when a full-page error view has no
`onRetry` or a page renders a bare `Text(_error` row.
### 6.1.5 Buy-now checkout scoping

Every root implemented 立即购买 as "add to cart, then open checkout". On PC and
Flutter that opened checkout for the whole cart; on H5 and the mini program it
dropped the buyer in the cart. A buyer with other lines in the cart could
therefore pay for all of them by clicking 立即购买 on one product.

Each root now adds the line, reads the created cart item id from the add
response, and opens checkout scoped to that id (`/checkout?items=<id>` on
PC/H5, the `items` query on the mini program, the route argument on Flutter).
When the backend does not return an id, the buyer is sent to the cart to choose
— never to an unscoped checkout. `tests/contract/verify-checkout-scoping.test.mjs`
fails if a product page stops passing the id, a checkout page stops consuming
it, or a quote is requested without the scoped lines.

The confirm-order summary is aligned too: PC already showed
goods/discount/delivery/payable; H5, the mini program and Flutter now show
商品金额 / 优惠 / 应付 from the quote instead of only the payable amount, and all
three block submission when the authoritative quote failed. A rejected coupon or
an unavailable wallet/points hold is reported as a warning instead of throwing
after the order already exists.

### 6.1.6 Recoverable failures (PC storefront)

The admin packages already used `BusinessStatePanel` with `onRetry`, but the
storefront console did not: home, product detail and order detail reported a
load failure as a bare empty state with no retry, and product detail additionally
labelled every transport failure 商品不存在 while leaving the rejected load
promise unhandled. All four storefront surfaces now distinguish "load failed"
(title + message + 重试) from "not found", and the PC architecture test fails when
a page that can say 加载失败 does not offer a retry.

### 6.1.7 Payment result polling

The mini program and Flutter result screens polled the payment-success endpoint
every three seconds with no attempt limit, so a settlement that never completed
kept a phone awake and the gateway busy; H5 did not poll at all. All three now
poll at the same three-second interval for at most 20 attempts (60 seconds),
then stop with 支付结果确认超时 and offer 刷新状态. The PC result screen keeps its
single fetch and adds the same manual refresh.

### 6.1.8 After-sales return tracking

The commerce API accepts `POST /after_sales/requests/{id}/return_shipments`, but
no root exposed it: a buyer could apply for a return, be approved, and then have
no way to tell the merchant which carrier shipped the goods back, so the refund
could not progress. PC also already listed return shipments but could not create
one.

All four roots now submit the buyer's carrier and tracking number with an
`Idempotency-Key`, offer the action only when the request is approved for a
return or exchange, and refresh the case after submission. The mini-program and
Flutter transports accept per-request headers so the idempotency key rides the
same seam as auth. `tests/contract/verify-after-sales-depth.test.mjs` pins the
submission path and the eligibility predicate on every root.

### 6.1.9 Invoice at checkout

The order command accepts `needInvoice` and `invoiceForm`, and PC shipped the
form: title type (personal/company), title, company tax number with the
15–20 character validation, and a receiving email. H5, the mini program and
Flutter sent neither field, so a buyer on a phone could not declare an invoice
at all and had to file it after the fact.

All four roots now render the invoice section on confirm-order, validate the
same way (title required, company tax number required and format-checked), and
submit `needInvoice` + `invoiceForm` with the order. The checkout contract test
asserts the fields and the validation on every root.

### 6.1.10 Delivery method and gift card at checkout

The order command accepts `deliveryMethod` (`standard`/`express`/`sf`) and
`giftCardCode`, and PC shipped both: a delivery-speed selector priced by the
server, and a gift-card field with a format check. The three mobile roots sent
neither, so a phone buyer could not pick a delivery speed or redeem a gift card.

All four roots now offer the delivery selector, apply the same gift-card format
check (non-empty, at least 8 characters) with an applied/remove state, and send
both fields with the order. Fees stay server-quoted: no client-side fee math.
The checkout contract test asserts the fields, the selector and the redemption
control on every root.

### 6.1.11 Browser page titles

H5 and PC are single-page apps: the tab title only changes if the shell writes
it. Both kept the entry document title (SDKWork 商城) on every route, so browser
history, bookmarks and assistive-technology announcements showed the same name
for a product page, an order and the wallet. The H5 shell now publishes the
matched route title (`<page> · SDKWork 商城`) on every navigation, the PC root
does the same from its route contributions, and
`tests/contract/verify-browser-page-titles.test.mjs` pins both plus the shared
entry-document title.

### 6.1.12 Root-level failure handling (mobile)

A release build has no dev overlay, so an uncaught script error or a failed
widget build is invisible unless the root installs a handler. The mini program
declared no `onError`, `onUnhandledRejection` or `onPageNotFound` — a rejected
fire-and-forget promise vanished and an outdated deep link landed on the
platform's blank page-not-found screen. Flutter relied on the framework's default
error widget (a grey box in release) and left async failures outside the widget
tree unobserved.

The mini-program root now logs uncaught errors and rejections and redirects an
unknown page to the storefront home capability. Flutter installs
`FlutterError.onError`, runs under `runZonedGuarded`, and replaces the default
error widget with the branded `SdkworkFatalErrorView`. The H5/PC roots already
had route-level error boundaries. `tests/contract/verify-mobile-failure-handling.test.mjs`
pins both mobile roots.

### 6.1.13 Browser first-load budget

Both browser roots shipped one oversized entry chunk (H5 1,035 KB raw / 246 KB
gzip, PC 972 KB / 221 KB gzip) that mixed React, the UI primitives and the whole
app graph, so every deploy invalidated all of it.

Vite 8 runs Rolldown, so the roots now use `build.rollupOptions.output.advancedChunks`
to isolate two stable groups — `vendor-react` (react, react-dom, scheduler,
react-router) and `vendor-ui` (@radix-ui, lucide-react, sonner, cmdk). Measured
on the standalone dev build:

| Root | Entry before | Entry after | Stable vendor chunks |
| --- | --- | --- | --- |
| H5 | 1,035 KB / 245.6 KB gz | 852 KB / 180.5 KB gz | 70.4 KB gz (react) + 6.0 KB gz (ui) |
| PC | 972 KB / 220.7 KB gz | 770 KB / 158.3 KB gz | 53.2 KB gz (react) + ui |

First visit bytes stay roughly flat (H5 +~5%); a repeat visit with an unchanged
vendor re-downloads only the app entry, about 65 KB gzip smaller on H5 and 62 KB
on PC. Splitting the SDKWork workspace runtime into its own group was measured
and rejected: it produced eight-plus extra vendor chunks, added first-visit
bytes, and increased request count without a caching win worth the trade.

### 6.1.14 Money-path payload tests

The checkout and after-sales contract tests prove a field or control exists in
source; they cannot prove the wire body is assembled correctly. Two behavioral
suites now cover the payloads that decide what the buyer is charged:

- `apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-cart/tests/checkout-payload.test.ts`
  injects a fake commerce service and asserts the exact
  `checkout.sessions.orders.create` body: scoped `cartItemIds`,
  `deliveryMethod`, `giftCardCode`, `needInvoice`/`invoiceForm` gating and
  `quoteId`, plus the post-order coupon/payment flow.
- `apps/sdkwork-mall-mini-program/tests/checkout-payload.test.ts` exercises the
  exported `buildCheckoutOrderBody` and `buildReturnShipmentRequest` builders:
  invoice omission, empty-cart-id omission, tracking-number trimming, the
  `buyer_return` direction and the `Idempotency-Key` header.

Supporting refactor: the mini-program services now export pure builders
(`buildCheckoutOrderBody`, `buildReturnShipmentBody`, `buildReturnShipmentRequest`)
so the payload can be tested without a live transport.

### 6.1.15 Search depth

A shopper expects two affordances on the search screen: hot terms to start from
and a local history to return to. H5, the mini program and Flutter had both; PC
had CMS-driven hot terms but never recorded a history, so a PC buyer lost every
previous query on navigation.

PC now records each effective keyword newest-first (de-duplicated, capped at ten,
stored under `sdkwork-mall-pc-search-history`), renders them as chips with a
清空 action, and hides the row when empty. `tests/contract/verify-search-depth.test.mjs`
pins hot terms plus history on all four roots.

### 6.1.16 H5 i18n runtime

H5 was the last browser root without any i18n mechanism: every string was a
literal in TSX. It now initialises i18next (`initReactI18next`, zh-CN JSON
fragments under `i18n/<locale>/<domain>/<capability>/`) once from `main.tsx`, so
copy changes are fragment diffs and a new locale is a resource addition. Ten
surfaces are migrated: payment-result, confirm-order, product detail, storefront
home, the buyer hub, the address book, the help centre, the after-sales centre,
order detail and the order list — all copy resolves through `t(...)` keys with
identical zh-CN text, and the H5 hard-coded count dropped 536 → 283 (the readiness
baseline was refreshed).

`tests/contract/verify-h5-i18n-runtime.test.mjs` proves the runtime initialises,
every key either migrated page uses exists in the merged catalogue (a missing key
would render the identifier itself), and neither page carries hard-coded user
copy.

### 6.1.17 After-sales progress timeline

A refund the buyer cannot follow becomes a support ticket. PC rendered the
`GET /after_sales/requests/{id}/events` timeline; H5, the mini program and
Flutter showed only a status label, so a buyer had no way to see whether a
request was reviewed, approved or refunded.

Every mobile root now loads the timeline on demand (`处理进度` toggles an
expandable list with the event action and timestamp, cached per request and
closed on collapse), and H5 renders it through the `afterSales.progress.*`
catalogue keys. `tests/contract/verify-after-sales-depth.test.mjs` pins the
service call and the page rendering on all four roots.

The nine new strings that the three catalogue-less roots needed are recorded in
the refreshed i18n baseline (mini program 375 → 378, Flutter 567 → 571, H5 +1
for the session-guard message).

### 6.1.18 Flutter i18n runtime

Flutter was the last root with no i18n mechanism. `lib/src/i18n/runtime.dart`
flattens authored JSON fragments into a synchronous message map
(`t(key, {params})` with `{{name}}` interpolation), loads them once from
`rootBundle` in `main()` before `runApp`, and degrades to the key if a fragment is
missing. Fragments live at
`lib/src/i18n/<locale>/<domain>/<capability>/messages.json`, declared in
`pubspec.yaml`.

The help centre, the buyer hub, settings/invoices, confirm-order and the
after-sales centre are the migrated surfaces (27 + 38 + 44 + 51 + 56 strings).
Widget tests install the fragments from disk (`test/support/i18n_fixture.dart`), so
the suite does not depend on asset-bundle resolution, and the capability-title
parity gate resolves Flutter `AppBar` titles declared as `SdkworkI18n.t(...)`
through the fragments. Flutter's hard-coded count dropped 571 → 349.

`tests/contract/verify-flutter-i18n-runtime.test.mjs` pins the runtime, the
fragment wiring and the no-literal rule for migrated pages.

### 6.1.19 Mini-program i18n runtime

The mini-program was the last root without a mechanism. `src/i18n/index.ts`
flattens authored fragments into `a.b.c` keys and exposes a synchronous
`t(key, params)`. Copy is authored as plain-object
`src/i18n/<locale>/<domain>/<capability>/messages.js` fragments with sibling
`.d.ts` declarations, because the mini-program module system resolves JavaScript
at runtime rather than JSON.

The buyer hub, the help centre and the storefront home are the first migrated
pages, dropping the mini-program's hard-coded count 378 → 310.
`tests/contract/verify-mp-i18n-runtime.test.mjs` pins the runtime, the fragment
wiring and the no-literal rule for migrated pages and their WXML templates.

### 6.1.20 Invoice tax-number validation

A company invoice is keyed by the 15–20 character unified social credit code.
Checkout paths rejected malformed codes, but the standalone invoice centres (PC
editor dialog, H5, mini program, Flutter) accepted any text, so the merchant
received invoices the tax system later rejects — a failure the buyer only discovers
after issuance.

All four invoice surfaces now validate `^[A-Z0-9]{15,20}$` before submitting and
surface one shared message (`税号格式不正确（15-20 位字母或数字）`) from their
respective catalogues; the PC create form also requires a tax number for company
titles. `tests/contract/verify-invoice-tax-validation.test.mjs` pins the regex on
each root and proves the message stays byte-identical.

### 6.2 Per-package typecheck

Every active client package on both browser roots carries its own `tsconfig.json`, so
`scripts/typecheck-mall-packages.mjs` (`pnpm typecheck:packages`) typechecks
each package in isolation — 33 PC packages plus 13 H5 packages — and
`pnpm check` runs it *before* the root typecheck. The per-package pass stays
valuable now that the root gate is unblocked: it localizes a failure to the
package that owns it instead of returning one root-wide diagnostic list. Both
`tests/contract/verify-mall-standard-architecture.test.mjs` and
`apps/sdkwork-mall-h5/tests/contract/h5-standard-architecture.test.mjs` assert
that every active package declares a `tsconfig.json`, so a new package cannot
silently escape the gate. Inactive legacy packages (billing, checkout, offer,
pricing, subscription, membership-purchase, entitlement, payment) are declared
by no app root, are excluded from the root tsconfig, and are reported as
skipped rather than hidden.

### 6.3 Versioned coverage snapshot

`specs/capability-parity.snapshot.json` is the committed evidence of the matrix:
36 capabilities, the roots that must ship each, which roots resolve, and the
documented asymmetries with their reasons. It is generated from the live
contract + registries, so a coverage change becomes a reviewable diff instead of
a claim in a commit message.

```bash
pnpm parity:snapshot          # refresh after an intended coverage change
pnpm check:parity-snapshot    # fail when the committed snapshot is stale
```

`pnpm verify` runs the check, and
`tests/contract/verify-capability-snapshot.test.mjs` runs the same check inside
`pnpm test:node`, so a stale snapshot fails the ordinary regression run too.

Flutter visual review: `flutter test -DVISUAL_CAPTURE=true --update-goldens
test/visual_capture_test.dart` now captures the help, reviews, gift-card,
profile and account-security surfaces alongside the shell tabs. Goldens are
local review artifacts and are not committed.

Before this change the H5 and mini-program architecture tests were not wired
into any package script (vitest only collects `*.test.ts(x)`, `test:node` only
collected repository-level `*.test.mjs`), so those two roots had no automated
architecture gate at all. `test:node` now collects all three test roots.
