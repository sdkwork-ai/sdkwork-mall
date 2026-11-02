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

Known platform-level dependency gap (tracked outside this contract): the
composed federated transport `@sdkwork/cloudrouter-app-sdk/domains` and
`@sdkwork/cloudrouter-backend-sdk/domains` are imported by
`apps/*/src/bootstrap/{sdkClients,iamRuntime}.ts`, but the sibling
`sdkwork-cloudrouter` SDK family in this checkout does not yet publish the
`./domains` subpath (`package.json#exports` has only `"."`).

Consequences observed on 2026-11-02, before and after this parity work
(identical baseline and current state):

```text
pnpm typecheck
  error TS2307: Cannot find module '@sdkwork/cloudrouter-app-sdk/domains'   (x2 per root)
  error TS2307: Cannot find module '@sdkwork/cloudrouter-backend-sdk/domains' (x2 per root)

vite build (apps/sdkwork-mall-h5)
  [rolldown:vite-resolve] "./domains" is not exported under the conditions
  ["module","browser","production","import"] from package @sdkwork/cloudrouter-app-sdk
```

The fix belongs upstream: publish the `./domains` composed facade in the
`sdkwork-cloudrouter` SDK family per `APP_SDK_INTEGRATION_SPEC.md` §9 /
`SDK_WORKSPACE_GENERATION_SPEC.md` composed-facade rules, then regenerate. Until
that lands, the four client roots' own gates (contract tests, vitest,
`flutter analyze`/`flutter test`, mini-program `tsc`) are the enforceable
regression surface, and they are green.

## 6. Verification Evidence (2026-11-02)

```text
pnpm test:node                                                     → 52/52 pass
  (tests/contract/verify-mall-capability-parity.test.mjs           → 15/15)
  (tests/contract/verify-mall-standard-architecture.test.mjs       → 16/16)
  (apps/sdkwork-mall-h5/tests/contract/h5-standard-architecture)   → 8/8
  (apps/sdkwork-mall-mini-program/tests/mp-standard-architecture)  → 5/5
  (apps/sdkwork-mall-mini-program/tests/capability-navigation)     → 6/6
  (apps/sdkwork-mall-mini-program/tests/currency-format)           → 2/2)
pnpm typecheck:packages                                            → 46 packages, 0 failed
pnpm test:vitest                                                   → 68 files / 169 tests pass
mini program: npx tsc --noEmit                                     → clean
flutter analyze                                                    → no issues
flutter test                                                       → 21/21 pass
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

### 6.2 Per-package typecheck while the root gate is upstream-blocked

The root `pnpm typecheck` fails on the missing `./domains` facade (section 5),
which would otherwise hide any regression in the capability packages. Every
active client package on both browser roots carries its own `tsconfig.json`, so
`scripts/typecheck-mall-packages.mjs` (`pnpm typecheck:packages`) typechecks
each package in isolation — 33 PC packages plus 13 H5 packages — and
`pnpm check` runs it *before* the root typecheck. Both
`tests/contract/verify-mall-standard-architecture.test.mjs` and
`apps/sdkwork-mall-h5/tests/contract/h5-standard-architecture.test.mjs` assert
that every active package declares a `tsconfig.json`, so a new package cannot
silently escape the gate. Inactive legacy packages (billing, checkout, offer,
pricing, subscription, membership-purchase, entitlement, payment) are declared
by no app root, are excluded from the root tsconfig, and are reported as
skipped rather than hidden.

Flutter visual review: `flutter test -DVISUAL_CAPTURE=true --update-goldens
test/visual_capture_test.dart` now captures the help, reviews, gift-card,
profile and account-security surfaces alongside the shell tabs. Goldens are
local review artifacts and are not committed.

Before this change the H5 and mini-program architecture tests were not wired
into any package script (vitest only collects `*.test.ts(x)`, `test:node` only
collected repository-level `*.test.mjs`), so those two roots had no automated
architecture gate at all. `test:node` now collects all three test roots.

Before this change the H5 and mini-program architecture tests were not wired
into any package script (vitest only collects `*.test.ts(x)`, `test:node` only
collected repository-level `*.test.mjs`), so those two roots had no automated
architecture gate at all. `test:node` now collects all three test roots.
