# Storefront browse / search regression — login must never block discovery

**Rule:** every storefront *discovery* surface (home, search, categories, product detail, shop, activity, help) must load for a visitor with no session. Only *account and transaction* actions (add to cart, buy now, coupon claim, favourites, orders, payment, wallet, addresses, after-sales) may require a login.

This document is the page-level companion to the generated operation-level matrix in
[`app-api-access-matrix.md`](./app-api-access-matrix.md). The matrix answers "what tier is this operation
published at"; this page answers "what breaks on screen if it is wrong".

Status captured after the retail app-api tier change (catalog/shop/promotion/membership reads published as
`dual-token-or-anonymous`, auth profile `dual-token-or-anonymous`).

## 1. Public routes and their calls

`auth: "public"` route contributions stay reachable without a session (`src/authGateLogic.ts`,
`ProtectedRoute` in `src/AppRoutes.tsx`). Each screen's service layer was traced to the app-api operation it
issues.

### PC (`apps/sdkwork-mall-pc`)

| Page | Route | Call | app-api operation | Published tier | Result |
| --- | --- | --- | --- | --- | --- |
| Home | `/` | categories | `GET /catalog/categories` | `dual-token-or-anonymous` | ✅ anonymous |
| Home | `/` | hot / new product rails | `GET /catalog/spus` | **not published** | ❌ 404 |
| Home | `/` | featured shops | `GET /shops` | `dual-token-or-anonymous` | ✅ anonymous |
| Search | `/search` | category filter | `GET /catalog/categories` | `dual-token-or-anonymous` | ✅ anonymous |
| Search | `/search` | free-text results | `GET /catalog/spus` | **not published** | ❌ 404 |
| Search | `/search` | shop-scoped results | `GET /catalog/products` | `dual-token-or-anonymous` | ✅ anonymous |
| Search | `/search` | shop results | `GET /shops` | `dual-token-or-anonymous` | ✅ anonymous |
| Category | `/categories/:categoryId` | category record | `GET /catalog/categories/{categoryId}` | `dual-token-or-anonymous` | ✅ anonymous |
| Category | `/categories/:categoryId` | product grid | `GET /catalog/products` | `dual-token-or-anonymous` | ✅ anonymous |
| Product detail | `/product/:productId` | product record | `GET /catalog/spus/{spuId}` | **not published** | ❌ 404 |
| Product detail | `/product/:productId` | promotion strip | `GET /promotions/offers` | `dual-token-or-anonymous` | ✅ anonymous |
| Shop | `/shop/:shopId` | shop record | `GET /shops/{shopId}` | `dual-token-or-anonymous` | ✅ anonymous |
| Shop | `/shop/:shopId` | shop products | `GET /catalog/spus` | **not published** | ❌ 404 |
| Activity | `/activity`, `/activity/:eventId` | offers | `GET /promotions/offers[/{offerId}]` | `dual-token-or-anonymous` | ✅ anonymous |
| Help | `/help` | — | — | — | ✅ static |

### H5 (`apps/sdkwork-mall-h5`)

Same surface and the same operations; the H5 service layer additionally reads product detail through
`catalog.spus.retrieve`, so `/product/:productId` is blocked by the same missing route. `/tv` and `/help` are static.

## 2. Transactional routes (correctly gated)

| Route | PC | H5 | Behaviour |
| --- | --- | --- | --- |
| `/cart` | `auth: required` | `auth: required` | unauthenticated visit redirects to `/auth/login?redirect=…` |
| `/checkout` | `auth: required` | `auth: required` | same |
| `/payment/cashier` | `auth: required` | — | same |
| `/payment/result` | `auth: public` | `auth: public` | landing after a provider redirect; reads require the session that made the payment |

Buyer console (`/buyer/**`), merchant and backend-admin surfaces are `auth: required` throughout.

## 3. Transactional actions on public pages

A visitor can reach a public page and press a transactional control. Those must become a login hand-off,
never a raw `401`:

| Action | Trigger | Session required | Behaviour |
| --- | --- | --- | --- |
| Add to cart | PDP "加入购物车" | yes | `MallLoginRequiredError` / `MallH5LoginRequiredError` → `/auth/login?redirect=<current page>` |
| Buy now | PDP "立即购买" | yes | same; the follow-up `/checkout` navigation is skipped |
| Favourites / footprint | PDP heart, auto-record | no (browser-local) | account-scoped local storage, no request |
| Coupon claim | PDP / activity offer | yes (`promotions.user_coupon_claims`) | **follow-up:** apply the same login hand-off |
| Cart badge | masthead link | no | plain link, no request |

## 4. Why the remaining red rows are not 403

`/catalog/spus` is declared only by the mall's legacy commerce aggregate contract; no T1 domain service
publishes it (the catalog authority deliberately retired the collection in favour of `/catalog/products`).
The gateway therefore answers `404 route-not-in-manifest`, which is a different failure from the `401/403`
login gate fixed here. Restoring those rails needs a buyer-facing storefront projection (product + primary
media + price range + SKU summary) published by the catalog app-api — tracked as a separate task.

Until then the browser console shows, for every storefront page:

- `GET /app/v3/api/catalog/spus?...` → `404` (product rails, free-text search, shop grid, product detail)
- no `401`/`403` for any discovery read

## 5. How to re-check

```bash
# operation-level tiers (385 operations, 12 contracts)
pnpm audit:app-api-access

# page-level evidence, after any service-layer change
rg -n "getSdkwork(Home|Search|Catalog|Shop|Activity)RemotePort" apps/sdkwork-mall-pc/packages
rg -n "getSdkworkCommerceService\(\)\." apps/sdkwork-mall-h5/packages
```
