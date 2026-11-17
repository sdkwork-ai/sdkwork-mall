# REVIEW-20261114 fresh install opens an empty mall

Status: implemented
Scope: `apps/sdkwork-mall-pc` (storefront home / catalog / search, bootstrap, tests)

## Follow-up 2026-11-18: professional-scale dataset

The first pass made an empty install recoverable but the seeded catalog was too
small to demo a real mall (32 products / 56 SKUs / 25 leaves). The dataset is now
generated from an authored taxonomy model:

- **Scale**: 20 root categories / 100 leaf categories / 45 brands / 16 shops /
  1100 products / 3575 SKUs; every product is multi-variant (3–4 spec
  combinations) and every leaf category carries at least one spec attribute.
- **Realistic prices and specs**: per-leaf retail bands (5.00–44939.00 CNY),
  2-decimal amounts, deliberate list prices with 3–50% markdowns, valid EAN-13
  check digits on every physical SKU, and variant dictionaries that fit the
  goods (precious metal for jewellery, portions for food and drinks, sizes for
  apparel) instead of one generic dictionary.
- **Generation, not transcription**: `scripts/generate-mall-default-dataset.mjs`
  emits both locale documents deterministically (same seed → identical keys,
  barcodes and translations). `pnpm check:dataset-generation` fails on drift and
  `pnpm verify` runs it before the data gate.
- **Integrity gates**: `pnpm check:default-data` now enforces the minimum scale,
  per-leaf/per-shop product depth, unique spec combinations, spec dictionary
  membership, EAN-13 checksums, realistic prices/discounts, and that every CMS
  floor query matches at least one product title in both locales.
- **Provisioning at scale**: the bootstrap port now walks bounded pages for every
  provisioning lookup instead of reading one page (a catalog larger than one page
  would otherwise be re-created on rerun), and the 1.7 MB dataset chunk is loaded
  lazily so the storefront initial bundle stays unchanged.
- **Cross-surface alignment**: the H5 category visual contract reads the dataset;
  a generated seeded-taxonomy table (`category-seeded-taxonomy.ts`, 120 entries,
  glyphs and both locale names) keeps every seeded category resolving to one
  deliberate icon, and the test still fails on omission or glyph mismatch.
- **Stale partner fixtures**: the repo currently failed `pnpm typecheck` because
  the new partner customer-binding methods were not added to four test stubs;
  those fixtures are repaired as part of this regression.

Verification for the follow-up: typecheck, 353 vitest tests, the two dataset
gates, app config preflight, `pnpm verify` and `pnpm build` all pass.

## Symptom

After installing the app, the storefront showed no categories, products, SKUs or
shops, so the shopping journey (browse → PDP → cart → checkout → orders) could
not be exercised at all.

## Root cause

Three independent gaps combined into "empty mall with no explanation":

1. **The storefront swallowed transport failures.** `loadMallHomeSnapshot` read
   the four home sections through `Promise.allSettled` and mapped every
   rejection to `[]`. A dead gateway, a wrong API base URL and a genuinely
   unprovisioned catalog all rendered the same: an empty page with no error and
   no recovery action.
2. **Provisioning was admin-only.** The authored default dataset (33 categories,
   8 shops, 32 products, 56 SKUs, campaigns, membership, CMS) existed and was
   covered by offline gates, but the only way to write it was
   `管理后台 → 默认数据初始化`. A fresh install therefore started empty by
   design until an operator found that page — and nothing on the storefront
   pointed at it.
3. **Failing list pages looked like empty/loading pages.** The catalog page left
   its skeleton up forever when the listing request rejected, and the search
   page rendered "没有找到相关商品" for a failed request.

## Fix

### Storefront read model (`@sdkwork/mall-pc-home`)

- `loadMallHomeSnapshot` now reports per-section issues, marks a genuinely empty
  catalog (`isEmpty`), and throws `MallHomeUnavailableError` when **all four**
  reads fail, so an outage is never presented as an empty shop.
- `home-seed.ts` adds a first-run provisioning port (`configureMallHomeSeedProvider`,
  `runMallHomeSeed`, `claimMallHomeAutomaticSeed`) — same port-injection pattern
  as the rest of the app, so the home package never imports the admin package.
- `HomePage` seeds automatically on an empty catalog when the runtime policy
  allows it, shows progress, reloads data and CMS on success, and surfaces the
  failing step with a retry on failure. Production installs get an explicit
  action instead, plus a separate "载入演示数据（含商品）" action because the
  production `minimal` slice intentionally ships no products.

### Runtime policy (`src/bootstrap/default-data-remote.ts`)

- The existing default-data provider now also registers the storefront seed
  port with the environment-derived profile and an `automatic` flag
  (`profile !== "minimal"` unless overridden by `SDKWORK_MALL_AUTO_SEED`).
- `SDKWORK_MALL_SEED_PROFILE` forces a slice (documented escape hatch for demoing
  a production install); production campaigns stay drafts regardless.

### Catalog, search, shop pages and CMS shelves

- `CatalogPage`: request failures now end the skeleton and render an error state
  with retry + default-data link; an unfiltered empty result explains that the
  environment has no catalog yet instead of blaming filters.
- `SearchPage`: failures render "搜索请求失败" with retry instead of the
  misleading "没有找到相关商品"; an unfiltered empty result links to
  initialization.
- `ShopPage`: a transport failure no longer renders "未找到店铺"; it shows the
  real error with retry, and a shop with no products explains initialization.
- Home CMS floors fall back to the general product list when their free-text
  keyword matches nothing, so a localized shelf over a differently-localized
  catalog never renders an empty shelf after seeding.

### Campaign and buyer consoles

- `ActivityPage` list/detail: a failed campaign read no longer renders "暂无活动"
  or a permanent skeleton; both surfaces show the real error with retry, and an
  unfiltered empty list links to initialization.
- `BuyerDashboardPage`: a failed dashboard load previously left "加载买家中心…"
  spinning forever (the snapshot stays null); it now renders an error state with
  retry.

## Verification

- `pnpm typecheck`, `pnpm typecheck:packages` (49 packages), app `tsconfig.app.json`.
- `pnpm test:vitest`: 290 tests / 87 files, including new coverage:
  - home read model: empty vs outage vs partial failure vs envelope errors;
  - seed port: unavailable, single automatic claim, in-flight dedupe, profile
    override, signed-in gating, typed failure;
  - home page: automatic seeding, explicit seeding, structure-only demo action,
    failed step, no-backend copy, anonymous sign-in copy, outage copy,
    shelf fallback;
  - `src/bootstrap/storefront-first-run.test.ts`: fresh install opens empty →
    provisioning writes the demo dataset through an in-memory authority →
    storefront reads categories/products/shops; rerun creates nothing;
    production writes structure only.
- `pnpm check:default-data`, `pnpm check:app-composition`, parity + snapshot,
  i18n catalogues/baseline, `pnpm --dir apps/sdkwork-mall-pc run test:config`,
  `pnpm build` (standalone.production dist).

## Residual risks

- The new chain is proven against an in-memory authority. Writing to the real
  federated backends still depends on backend availability and on the signed-in
  account holding create permissions; a permission failure now surfaces as an
  actionable error on the home page instead of silence.
- Product cards on the home/list projections read price fields from the SPU
  payload. The seeding writes prices on SKUs and the price ladder; if the
  platform's SPU projection does not aggregate them, cards fall back to
  "询价". This is a server-projection question, not a seeding defect.
- Checkout/payment/order journeys remain dependent on the platform services and
  a real signed-in buyer; they are not exercised by this change.
