# i18n Readiness

Status: S1 catalogue landed; per-root runtime migration pending
Owner: SDKWork maintainers
Updated: 2026-11-02
Specs: I18N_SPEC.md, FRONTEND_CODE_SPEC.md, APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md

## 1. Current State

`pnpm audit:i18n` (reproducible; run it instead of trusting these numbers for
long):

| Root | i18n mechanism | Files with copy | Hard-coded strings | Locale data (excluded) |
| --- | --- | --- | --- | --- |
| PC | i18next + per-package `*-copy.ts` and `commerce-intl.tsx`; route `titleKey` | 114 | 1452 | 0 |
| H5 | i18next runtime + `zh-CN/{checkout,catalog,storefront,account,support,order}` fragments | 53 | 272 | 390 (`regions.ts`) |
| Mini program | `src/i18n` runtime + `zh-CN/{account/*,support/*,storefront/home,checkout/confirm-order}` JS fragments | 58 | 229 | 302 (province/city picker data) |
| Flutter | `SdkworkI18n` runtime + `lib/src/i18n/zh-CN/{support/*,account/*,storefront/home,catalog/product-detail,checkout/confirm-order}` fragments | 29 | 279 | 230 (province/city picker data) |

2232 user-facing strings remain hard-coded (`specs/i18n-readiness.baseline.json`).
Test fixtures and assertions are excluded: they are not user-facing copy, and
counting them made every new behavioral test look like an i18n regression. The
count is a **ceiling**, not a target: `pnpm check:i18n-baseline` fails when a
root adds copy without an explicit baseline update, so the backlog can only grow
through a reviewable decision.

## 2. What Already Exists

The migration does not start from zero:

- **Canonical capability labels** — `specs/mall-capability-parity.json` owns the
  canonical screen name of all 36 capabilities, enforced across roots by the
  parity gate (`every root shows the same capability title to the user`).
- **Shared notices** — the upstream-review and gift-card statements are already
  declared once under `sharedCopy` with byte-exact enforcement.
- **Route title keys** — PC/H5 route contributions carry
  `<namespace>.routes.<screen>.title` keys, validated by the parity gate.
- **PC catalogue precedent** — `*-copy.ts` modules prove the per-domain
  catalogue shape the other roots need.

## 3. Key Strategy

Keys are derived from capability ids, not from file paths, so all four roots can
share one vocabulary:

```text
capability.<capability-id>.title      # 我的评价 / My reviews
capability.<capability-id>.empty      # empty-state sentence
capability.<capability-id>.action     # primary action label
common.retry | common.confirm | common.cancel | common.loading
upstream.<capability-id>.pending      # the shared upstream-notice statements
```

`capability.*` values are generated from the parity contract, so a capability
cannot be renamed on one root without the catalogue changing for all of them.

## 4. Staged Path

**S1 — shared capability layer (small, no UI churn).**
Generate `specs/app-i18n/capabilities.<locale>.json` from
`specs/mall-capability-parity.json` (title + shared notices). Wire each root's
route/page title lookup to it. This removes duplicate literals for the 36 screen
names and the two upstream notices, and makes future locale additions a
catalogue drop rather than a code change.

**S1a — catalogue (landed).** `scripts/generate-mall-i18n-catalogues.mjs`
projects the parity contract into `specs/app-i18n/capabilities.zh-CN.json`:
`capability.<id>.title` for all 36 capabilities, `shared.<key>` for every
`sharedCopy` entry, and the `common.*` action labels. The output is sorted and
deterministic, `pnpm check:i18n-catalogues` fails when it drifts from the
contract, `tests/contract/verify-i18n-catalogue.test.mjs` pins the projection,
and `pnpm verify` runs the check. No UI reads it yet.

**S1b — wiring (next).** Point the PC/H5 route `titleKey` lookups and the
mini-program/Flutter title maps at the catalogue, then delete the duplicated
literal titles. This is the step that turns the catalogue into visible copy.

**S2 — per-root message catalogues.**
Introduce the runtime for the three roots without one (H5: i18next to match PC;
mini program: a typed message map loaded once into `app.ts`; Flutter:
`flutter_localizations` + an ARB-derived message map). Migrate in hotspot order,
highest first, keeping the existing `sdkwork` prefix conventions.

**S2a — H5 runtime (started).** `apps/sdkwork-mall-h5/src/i18n/index.ts`
initialises i18next with `initReactI18next` and composes authored fragments from
`i18n/<locale>/<domain>/<capability>/` (`zh-CN/checkout/payment-result`,
`zh-CN/checkout/confirm-order`, `zh-CN/catalog/product-detail`,
`zh-CN/storefront/home`, `zh-CN/account/buyer-hub`, `zh-CN/account/addresses`,
`zh-CN/support/{help,after-sales}` and `zh-CN/order/{detail,list}`), imported once
from `main.tsx`; the default locale is unchanged, so no visible copy moved. Ten
surfaces are migrated: payment-result, confirm-order, product detail, storefront
home, the buyer hub, the address book, the help centre, the after-sales centre, the
order detail page and the order list (status filter tabs, per-status action set,
pagination and empty/loading states). H5's hard-coded count dropped 536 → 283 and
the baseline was refreshed.

The after-sales service no longer owns display copy either: request types,
reasons, statuses and return carriers are exported as `<…>LabelKey` / `nameKey`
references (`afterSales.type.*`, `afterSales.reason.*`, `afterSales.status.*`,
`afterSales.carrier.*`), and the page resolves them through `t()`. Server-provided
status names still win when the backend localizes them itself.

Component tests render pages whose copy resolves through the runtime, so
`vitest.setup.ts` initialises the H5 i18n instance once; no test has to stub
translation resources.

**S2c — mini-program runtime (started).** `src/i18n/index.ts` flattens authored
fragments into `a.b.c` keys and exposes a synchronous `t(key, params)` with
`{{name}}` interpolation. Because the mini-program module system resolves
JavaScript at runtime (not JSON), copy lives in plain-object
`src/i18n/<locale>/<domain>/<capability>/messages.js` files with sibling
`messages.d.ts` declarations for typing. Migrated surfaces: the buyer hub (order
shortcuts, asset/service/account menus, logout dialog), the help centre (FAQ
sections, quick links, contact rows), the storefront home (banners, quick entries,
seckill/sold labels, loading/error states), confirm-order (address, delivery,
coupons, deductions, gift card, remark, invoice, summary, submit and every
validation message), the membership centre (packages, purchase states) and the
after-sales centre (apply form, evidence grid, records, return shipment, progress
timeline, type/status/reason/carrier labels). Their hard-coded count dropped
378 → 229, and all templates render catalogue-driven data only.
`tests/contract/verify-mp-i18n-runtime.test.mjs` pins the runtime, the fragment
wiring and the no-literal rule (including WXML templates).

**S2b — Flutter runtime (started).** `lib/src/i18n/runtime.dart` flattens the
authored fragments into a synchronous message map (`t(key, {params})` with
`{{name}}` interpolation), loads them once from `rootBundle` in `main()` before
`runApp`, and degrades to the key when a fragment is missing. Fragments live under
`lib/src/i18n/<locale>/<domain>/<capability>/messages.json` and are declared in
`pubspec.yaml`. Migrated surfaces: the help centre, the buyer hub, the
settings/invoices pages, the confirm-order page, the after-sales centre, the
membership centre, the storefront home, product detail and the wallet/points pages
(27 + 38 + 44 + 51 + 56 + 20 + 26 + 18 strings), all resolved from `help.*` /
`buyerHub.*` / `invoices.*` / `settings.*` / `checkout.*` / `afterSales.*` /
`membership.*` / `home.*` / `productDetail.*` / `wallet.*` / `points.*`. Widget
tests install the fragments from disk through `test/support/i18n_fixture.dart`, so
the suite does not depend on asset-bundle resolution. Flutter's hard-coded count
dropped 571 → 279.

**S3 — locale switching and verification.**
Locale store per root, `Accept-Language` propagation through the transport seams,
and a pseudo-locale render check in the Flutter visual harness plus a `zh-CN`
baseline snapshot for H5.

## 5. Non-Goals For Now

- No bulk extraction of all 3016 strings in one change: a mass rename without
  per-root render verification is not reviewable.
- Do not translate locale data (province/city lists); it is data, not copy.
- Do not introduce a second key vocabulary next to the capability ids.

## 6. Verification

| Step | Gate |
| --- | --- |
| Numbers refresh | `pnpm audit:i18n` (no diff expected unless copy changed) |
| Readiness ratchet | `pnpm check:i18n-baseline` — fails when a root adds hard-coded copy; refresh with `pnpm i18n:baseline` |
| S1a catalogue | `pnpm check:i18n-catalogues` + `tests/contract/verify-i18n-catalogue.test.mjs` |
| S1b wiring | parity title gate: every root still shows the contract title |
| S2 H5 runtime | `tests/contract/verify-h5-i18n-runtime.test.mjs` (runtime, key coverage, no literal copy on migrated pages) |
| S2 Flutter runtime | `tests/contract/verify-flutter-i18n-runtime.test.mjs` + `test/i18n_runtime_test.dart` |
| S2 mini-program runtime | `tests/contract/verify-mp-i18n-runtime.test.mjs` |
| S2 per root | existing architecture gates per root, plus catalogue reachability test |
| S3 locale switch | Flutter visual capture with the pseudo-locale; H5 baseline screenshot |
