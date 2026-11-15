# Mall app-api access-tier matrix

Generated artifact — do not hand-edit. Regenerate with `pnpm audit:app-api-access` (or `node scripts/audit-mall-app-api-access.mjs`) from the mall repository root.

This matrix answers one question per consumed app-api operation: **should it be reachable without a login (`anonymous` / `dual-token-or-anonymous`), or must it require one (`dual-token`)?**

## How this document is produced

Three source families are joined, with no hand-written rows:

1. **Consumed contract** — the mall SDK specs (`sdks/**/source-openapi.json`) plus the `app-api` authorities of every sibling repo declared in `pnpm-workspace.yaml` (`apis/**/app-api/**/*.openapi.json`, `sdks/**/*app-api*.openapi.json`). Duplicate `method + path` pairs across specs are merged into one row.
2. **Published tier** — checked-in Rust route declarations (`crates/**/http_route_manifest.rs`, `crates/**/manifest*.rs`, `crates/**/routes.rs`): `HttpRoute::public|dual_token|dual_token_or_anonymous`, `HttpRoute::new(.., RouteAuth::X)` and `RouteDefinition { .. }` tables. When a repo materializes its manifest at build time from the OpenAPI authority (`build.rs` → `generate_http_route_manifest`) and has no checked-in routes, the authority declaration (`x-sdkwork-auth-mode`, then `security`) is used, exactly as the framework generator derives it.
3. **Consumer evidence** — a scan of `apps/**` and `packages/**` sources for the operation path template (module-local, so `/catalog/spus` counts but `/catalog/spus/{id}` does not) and for the dotted `operationId` call chain (for example `commerce().catalog.spus.list(..)`).

Path templates are compared with parameter names erased (`{spuId}` ≈ `{productId}` ≈ `` `${id}` ``), so a consumer call site matches regardless of the local variable name.

## Snapshot

- Generated at: `2026-11-15T02:00:52.946Z`
- Consumed app-api specs: 12
- Route declaration files parsed: 157
- Mall source files scanned for consumer evidence: 816

| Repository | HEAD | Working tree |
| --- | --- | --- |
| sdkwork-account | 22e6d89 | clean |
| sdkwork-appbase | ab4a8d7 | clean |
| sdkwork-cloudrouter | 3d4d9f9f | clean |
| sdkwork-drive | b8229cd | clean |
| sdkwork-iam | b407bb83 | dirty (1 paths) |
| sdkwork-im | 3675c18b | clean |
| sdkwork-mall | c9d5a1a | dirty (3 paths) |
| sdkwork-membership | 00cf902 | dirty (24 paths) |
| sdkwork-merchandise | 5dd9689 | clean |
| sdkwork-order | a800e62 | clean |
| sdkwork-partner | d27ccc7 | clean |
| sdkwork-payment | a6ae151 | clean |
| sdkwork-promotion | fefc5ad | clean |
| sdkwork-shop | ad552c3 | clean |

Consumed specs (12):

- `sdkwork-mall/sdks/sdkwork-commerce-app-sdk/sdkwork-commerce-app-sdk-typescript/generated/server-openapi/source-openapi.json` — 182 operations
- `sdkwork-account/apis/app-api/account/account-app-api.openapi.json` — 20 operations
- `sdkwork-cloudrouter/apis/app-api/cloudrouter/cloudrouter-app-api.openapi.json` — 31 operations
- `sdkwork-drive/apis/app-api/drive/drive-app-api.openapi.json` — 101 operations
- `sdkwork-membership/apis/app-api/membership/membership-app-api.openapi.json` — 26 operations
- `sdkwork-order/apis/app-api/order/order-app-api.openapi.json` — 62 operations
- `sdkwork-partner/apis/app-api/partner/sdkwork-partner-app-api.openapi.json` — 10 operations
- `sdkwork-promotion/apis/app-api/promotion/sdkwork-promotion-app-api.openapi.json` — 21 operations
- `sdkwork-shop/apis/app-api/shop/shop-app-api.openapi.json` — 45 operations
- `sdkwork-membership/sdks/sdkwork-membership-app-sdk/openapi/sdkwork-membership-app-api.openapi.json` — 26 operations
- `sdkwork-payment/sdks/sdkwork-payment-app-sdk/openapi/sdkwork-payment-app-api.openapi.json` — 18 operations
- `sdkwork-promotion/sdks/sdkwork-promotion-app-sdk/openapi/sdkwork-promotion-app-api.openapi.json` — 21 operations

## Summary

| Metric | Count |
| --- | --- |
| Total consumed app-api operations | 385 |
| Published `anonymous` | 17 |
| Published `dual-token-or-anonymous` | 17 |
| Published `dual-token` | 317 |
| Published other tier (`bootstrap-body`, `api-key`, …) | 0 |
| Published none (`MISSING-ROUTE`) | 34 |
| Consumed by mall code (path or operationId evidence) | 97 |
| Not consumed (unused) | 288 |

| Verdict | Count |
| --- | --- |
| OK | 83 |
| NEEDS-TIER-CHANGE | 1 |
| MISSING-ROUTE | 34 |
| UNUSED | 267 |

Primary consumed contract (`sdkwork-mall/sdks/sdkwork-commerce-app-sdk/sdkwork-commerce-app-sdk-typescript/generated/server-openapi/source-openapi.json`, 182 operations): 5 anonymous, 16 dual-token-or-anonymous, 127 dual-token, 34 missing, 104 unused, 0 other.

Consistency checks:

- total == Σ published tiers: `true`
- total == Σ verdicts: `true`
- total == consumed + unused: `true`
- total == Σ target tiers: `true`

## Tier policy

### Access tiers

| Tier | Meaning |
| --- | --- |
| `anonymous` | No credential at all. Machine surfaces and public configuration. |
| `dual-token-or-anonymous` | Optional credential: an anonymous visitor is admitted, a signed-in caller is still resolved for per-user scope. Storefront browse traffic uses this. |
| `dual-token` | Login required (`AuthToken` + `AccessToken`). |

### Target-tier rules (applied in order)

| Rule | Applies to | Target tier |
| --- | --- | --- |
| R1 | storefront browse read | `dual-token-or-anonymous` |
| R2 | recharge catalogue read | `anonymous` |
| R3 | preserve already-anonymous surface | `anonymous` |
| R4 | default: login required | `dual-token` |

- **R1 — storefront browse read**: Anonymous visitors must be able to browse the storefront; a signed-in caller is still resolved so per-user scope keeps working.
- **R2 — recharge catalogue read**: Recharge packages/plans/settings are public today and need no credential.
- **R3 — preserve already-anonymous surface**: A non-browse operation that is already published anonymous (webhooks, cashier links, display config) is not proposed for a login gate by this audit.
- **R4 — default: login required**: Every other operation is user-scoped or state-changing and requires a login.

R1 storefront browse reads (the explicit list evaluated by the script):

- `GET /app/v3/api/catalog/attributes` — catalog attribute dictionary
- `GET /app/v3/api/catalog/categories` — category tree
- `GET /app/v3/api/catalog/categories/\{[^}]+\}` — category detail
- `GET /app/v3/api/catalog/products` — product (spu projection) list
- `GET /app/v3/api/catalog/products/\{[^}]+\}` — product detail
- `GET /app/v3/api/catalog/products/\{[^}]+\}/skus` — product sku list
- `GET /app/v3/api/catalog/skus/\{[^}]+\}` — sku detail
- `GET /app/v3/api/catalog/spus` — spu list (storefront grid)
- `GET /app/v3/api/catalog/spus/\{[^}]+\}` — spu detail (product page)
- `GET /app/v3/api/shops` — shop list
- `GET /app/v3/api/shops/\{[^}]+\}` — shop detail
- `GET /app/v3/api/promotions/offers` — promotion offer list
- `GET /app/v3/api/promotions/offers/\{[^}]+\}` — promotion offer detail
- `GET /app/v3/api/memberships/plans` — membership plan catalogue
- `GET /app/v3/api/memberships/package_groups` — membership package group list
- `GET /app/v3/api/memberships/package_groups/\{[^}]+\}` — membership package group detail
- `GET /app/v3/api/memberships/package_groups/\{[^}]+\}/packages` — membership packages of a group
- `GET /app/v3/api/memberships/packages` — membership package list
- `GET /app/v3/api/memberships/packages/\{[^}]+\}` — membership package detail

R2 recharge catalogue reads:

- `GET /app/v3/api/recharges/packages`
- `GET /app/v3/api/recharges/plans`
- `GET /app/v3/api/recharges/settings`

### Verdicts

| Verdict | Meaning |
| --- | --- |
| `OK` | Published tier already equals the target tier and the mall actually calls the operation. |
| `NEEDS-TIER-CHANGE` | Published tier differs from the target tier (also used for `conflict`). |
| `MISSING-ROUTE` | No published route declaration exists for a consumed operation, so the runtime answers `404 route-not-in-manifest`. The operation is declared in an OpenAPI authority but the owning surface never registered it. |
| `UNUSED` | Tier is correct, but no mall source references the operation. |

## Findings

### Needs a tier change (1)

| Method | Path | Published | Target | Rule | Consumed |
| --- | --- | --- | --- | --- | --- |
| GET | `/app/v3/api/ai/routing/account_groups` | dual-token-or-anonymous | `dual-token` | R4 | — |

### Missing published route — join gaps (34)

These operations are declared in a consumed OpenAPI authority, but no checked-in (or build-generated) route manifest declares them, so a caller gets `404 route-not-in-manifest`.

| Method | Path | operationId | Authority spec | Consumed |
| --- | --- | --- | --- | --- |
| GET | `/app/v3/api/addresses` | addresses.list | sdkwork-mall/sdks/sdkwork-commerce-app-sdk/sdkwork-commerce-app-sdk-typescript/generated/server-openapi/source-openapi.json | 5 files |
| POST | `/app/v3/api/addresses` | addresses.create | sdkwork-mall/sdks/sdkwork-commerce-app-sdk/sdkwork-commerce-app-sdk-typescript/generated/server-openapi/source-openapi.json | 5 files |
| DELETE | `/app/v3/api/addresses/{addressId}` | addresses.delete | sdkwork-mall/sdks/sdkwork-commerce-app-sdk/sdkwork-commerce-app-sdk-typescript/generated/server-openapi/source-openapi.json | 5 files |
| PATCH | `/app/v3/api/addresses/{addressId}` | addresses.update | sdkwork-mall/sdks/sdkwork-commerce-app-sdk/sdkwork-commerce-app-sdk-typescript/generated/server-openapi/source-openapi.json | 5 files |
| POST | `/app/v3/api/addresses/{addressId}/default_selection` | addresses.defaultSelection.create | sdkwork-mall/sdks/sdkwork-commerce-app-sdk/sdkwork-commerce-app-sdk-typescript/generated/server-openapi/source-openapi.json | 5 files |
| GET | `/app/v3/api/cart/current` | cart.current.retrieve | sdkwork-mall/sdks/sdkwork-commerce-app-sdk/sdkwork-commerce-app-sdk-typescript/generated/server-openapi/source-openapi.json | 3 files |
| POST | `/app/v3/api/cart/items` | cart.items.create | sdkwork-mall/sdks/sdkwork-commerce-app-sdk/sdkwork-commerce-app-sdk-typescript/generated/server-openapi/source-openapi.json | 5 files |
| DELETE | `/app/v3/api/cart/items/{cartItemId}` | cart.items.delete | sdkwork-mall/sdks/sdkwork-commerce-app-sdk/sdkwork-commerce-app-sdk-typescript/generated/server-openapi/source-openapi.json | 5 files |
| PATCH | `/app/v3/api/cart/items/{cartItemId}` | cart.items.update | sdkwork-mall/sdks/sdkwork-commerce-app-sdk/sdkwork-commerce-app-sdk-typescript/generated/server-openapi/source-openapi.json | 5 files |
| GET | `/app/v3/api/catalog/skus/{skuId}/prices` | catalog.skus.prices.retrieve | sdkwork-mall/sdks/sdkwork-commerce-app-sdk/sdkwork-commerce-app-sdk-typescript/generated/server-openapi/source-openapi.json | — |
| GET | `/app/v3/api/catalog/spus` | catalog.spus.list | sdkwork-mall/sdks/sdkwork-commerce-app-sdk/sdkwork-commerce-app-sdk-typescript/generated/server-openapi/source-openapi.json | 4 files |
| GET | `/app/v3/api/catalog/spus/{spuId}` | catalog.spus.retrieve | sdkwork-mall/sdks/sdkwork-commerce-app-sdk/sdkwork-commerce-app-sdk-typescript/generated/server-openapi/source-openapi.json | 3 files |
| POST | `/app/v3/api/orders` | orders.create | sdkwork-mall/sdks/sdkwork-commerce-app-sdk/sdkwork-commerce-app-sdk-typescript/generated/server-openapi/source-openapi.json | 4 files |
| POST | `/app/v3/api/orders/{orderId}/cancel` | orders.cancel | sdkwork-mall/sdks/sdkwork-commerce-app-sdk/sdkwork-commerce-app-sdk-typescript/generated/server-openapi/source-openapi.json | — |
| POST | `/app/v3/api/payments/reconciliations` | payments.reconcile | sdkwork-mall/sdks/sdkwork-commerce-app-sdk/sdkwork-commerce-app-sdk-typescript/generated/server-openapi/source-openapi.json | 1 file |
| GET | `/app/v3/api/payments/statistics` | payments.statistics.retrieve | sdkwork-mall/sdks/sdkwork-commerce-app-sdk/sdkwork-commerce-app-sdk-typescript/generated/server-openapi/source-openapi.json | — |
| POST | `/app/v3/api/recharges/orders/{orderId}/cancellations` | recharges.orders.cancel | sdkwork-mall/sdks/sdkwork-commerce-app-sdk/sdkwork-commerce-app-sdk-typescript/generated/server-openapi/source-openapi.json | — |
| GET | `/app/v3/api/wallet/accounts/{accountId}` | wallet.accounts.retrieve | sdkwork-mall/sdks/sdkwork-commerce-app-sdk/sdkwork-commerce-app-sdk-typescript/generated/server-openapi/source-openapi.json | — |
| GET | `/app/v3/api/wallet/accounts/overview` | wallet.accounts.overview.retrieve | sdkwork-mall/sdks/sdkwork-commerce-app-sdk/sdkwork-commerce-app-sdk-typescript/generated/server-openapi/source-openapi.json | — |
| GET | `/app/v3/api/wallet/accounts/tokens` | wallet.accounts.tokens.retrieve | sdkwork-mall/sdks/sdkwork-commerce-app-sdk/sdkwork-commerce-app-sdk-typescript/generated/server-openapi/source-openapi.json | — |
| POST | `/app/v3/api/wallet/adjustments` | wallet.adjustments.create | sdkwork-mall/sdks/sdkwork-commerce-app-sdk/sdkwork-commerce-app-sdk-typescript/generated/server-openapi/source-openapi.json | — |
| GET | `/app/v3/api/wallet/exchange_rules` | wallet.exchangeRules.list | sdkwork-mall/sdks/sdkwork-commerce-app-sdk/sdkwork-commerce-app-sdk-typescript/generated/server-openapi/source-openapi.json | — |
| POST | `/app/v3/api/wallet/holds` | wallet.holds.create | sdkwork-mall/sdks/sdkwork-commerce-app-sdk/sdkwork-commerce-app-sdk-typescript/generated/server-openapi/source-openapi.json | 4 files |
| POST | `/app/v3/api/wallet/holds/releases` | wallet.holds.releases.create | sdkwork-mall/sdks/sdkwork-commerce-app-sdk/sdkwork-commerce-app-sdk-typescript/generated/server-openapi/source-openapi.json | — |
| POST | `/app/v3/api/wallet/holds/settlements` | wallet.holds.settlements.create | sdkwork-mall/sdks/sdkwork-commerce-app-sdk/sdkwork-commerce-app-sdk-typescript/generated/server-openapi/source-openapi.json | — |
| POST | `/app/v3/api/wallet/point_exchanges` | wallet.pointExchanges.create | sdkwork-mall/sdks/sdkwork-commerce-app-sdk/sdkwork-commerce-app-sdk-typescript/generated/server-openapi/source-openapi.json | — |
| GET | `/app/v3/api/wallet/point_exchanges/{exchangeNo}` | wallet.pointExchanges.retrieve | sdkwork-mall/sdks/sdkwork-commerce-app-sdk/sdkwork-commerce-app-sdk-typescript/generated/server-openapi/source-openapi.json | — |
| POST | `/app/v3/api/wallet/point_transfers` | wallet.pointTransfers.create | sdkwork-mall/sdks/sdkwork-commerce-app-sdk/sdkwork-commerce-app-sdk-typescript/generated/server-openapi/source-openapi.json | — |
| GET | `/app/v3/api/wallet/requests/{requestNo}` | wallet.requests.retrieve | sdkwork-mall/sdks/sdkwork-commerce-app-sdk/sdkwork-commerce-app-sdk-typescript/generated/server-openapi/source-openapi.json | — |
| GET | `/app/v3/api/wallet/tokens` | wallet.tokens.retrieve | sdkwork-mall/sdks/sdkwork-commerce-app-sdk/sdkwork-commerce-app-sdk-typescript/generated/server-openapi/source-openapi.json | — |
| POST | `/app/v3/api/wallet/topup_transfers` | wallet.topupTransfers.create | sdkwork-mall/sdks/sdkwork-commerce-app-sdk/sdkwork-commerce-app-sdk-typescript/generated/server-openapi/source-openapi.json | — |
| GET | `/app/v3/api/wallet/transactions` | wallet.transactions.list | sdkwork-mall/sdks/sdkwork-commerce-app-sdk/sdkwork-commerce-app-sdk-typescript/generated/server-openapi/source-openapi.json | — |
| GET | `/app/v3/api/wallet/transactions/{transactionId}` | wallet.transactions.retrieve | sdkwork-mall/sdks/sdkwork-commerce-app-sdk/sdkwork-commerce-app-sdk-typescript/generated/server-openapi/source-openapi.json | — |
| POST | `/app/v3/api/wallet/withdrawal_transfers` | wallet.withdrawalTransfers.create | sdkwork-mall/sdks/sdkwork-commerce-app-sdk/sdkwork-commerce-app-sdk-typescript/generated/server-openapi/source-openapi.json | — |

### Unused by mall code (267)

Published tier matches the target tier, but no mall source path or operationId references the operation. They are listed for scope review, not as defects.

| Method | Path | Published |
| --- | --- | --- |
| GET | `/app/v3/api/ai/dashboard/overview` | dual-token |
| GET | `/app/v3/api/ai/gateway/traces` | dual-token |
| GET | `/app/v3/api/ai/pricing/rates` | anonymous |
| GET | `/app/v3/api/ai/routing/api_keys` | dual-token |
| GET | `/app/v3/api/ai/routing/request_traces` | dual-token |
| GET | `/app/v3/api/ai/routing/usage` | dual-token |
| GET | `/app/v3/api/ai/settlements/dashboard` | dual-token |
| GET | `/app/v3/api/ai/usage/logs` | dual-token |
| GET | `/app/v3/api/app_template_orders` | dual-token |
| POST | `/app/v3/api/app_template_orders` | dual-token |
| GET | `/app/v3/api/cashier/{token}` | anonymous |
| POST | `/app/v3/api/cashier/{token}/payments` | anonymous |
| GET | `/app/v3/api/cashier/{token}/status` | anonymous |
| GET | `/app/v3/api/catalog/attributes` | dual-token-or-anonymous |
| GET | `/app/v3/api/catalog/products/{productId}` | dual-token-or-anonymous |
| GET | `/app/v3/api/checkout/sessions/{checkoutSessionId}` | dual-token |
| GET | `/app/v3/api/drive/changes` | dual-token |
| GET | `/app/v3/api/drive/changes/start_page_token` | dual-token |
| POST | `/app/v3/api/drive/changes/watch` | dual-token |
| POST | `/app/v3/api/drive/download_packages` | dual-token |
| GET | `/app/v3/api/drive/download_packages/{packageId}/download_url` | dual-token |
| GET | `/app/v3/api/drive/download_tokens/{token}` | dual-token |
| POST | `/app/v3/api/drive/download_urls` | dual-token |
| GET | `/app/v3/api/drive/favorites` | dual-token |
| POST | `/app/v3/api/drive/favorites/check` | dual-token |
| DELETE | `/app/v3/api/drive/nodes/{nodeId}` | dual-token |
| GET | `/app/v3/api/drive/nodes/{nodeId}` | dual-token |
| PATCH | `/app/v3/api/drive/nodes/{nodeId}` | dual-token |
| GET | `/app/v3/api/drive/nodes/{nodeId}/archive_entries` | dual-token |
| POST | `/app/v3/api/drive/nodes/{nodeId}/archive_entries/extract` | dual-token |
| GET | `/app/v3/api/drive/nodes/{nodeId}/capabilities` | dual-token |
| GET | `/app/v3/api/drive/nodes/{nodeId}/comments` | dual-token |
| POST | `/app/v3/api/drive/nodes/{nodeId}/comments` | dual-token |
| DELETE | `/app/v3/api/drive/nodes/{nodeId}/comments/{commentId}` | dual-token |
| GET | `/app/v3/api/drive/nodes/{nodeId}/comments/{commentId}` | dual-token |
| PATCH | `/app/v3/api/drive/nodes/{nodeId}/comments/{commentId}` | dual-token |
| GET | `/app/v3/api/drive/nodes/{nodeId}/comments/{commentId}/replies` | dual-token |
| POST | `/app/v3/api/drive/nodes/{nodeId}/comments/{commentId}/replies` | dual-token |
| DELETE | `/app/v3/api/drive/nodes/{nodeId}/comments/{commentId}/replies/{replyId}` | dual-token |
| GET | `/app/v3/api/drive/nodes/{nodeId}/comments/{commentId}/replies/{replyId}` | dual-token |
| PATCH | `/app/v3/api/drive/nodes/{nodeId}/comments/{commentId}/replies/{replyId}` | dual-token |
| GET | `/app/v3/api/drive/nodes/{nodeId}/content` | dual-token |
| POST | `/app/v3/api/drive/nodes/{nodeId}/copy` | dual-token |
| POST | `/app/v3/api/drive/nodes/{nodeId}/download_grants` | dual-token |
| GET | `/app/v3/api/drive/nodes/{nodeId}/download_url` | dual-token |
| DELETE | `/app/v3/api/drive/nodes/{nodeId}/favorite` | dual-token |
| PUT | `/app/v3/api/drive/nodes/{nodeId}/favorite` | dual-token |
| GET | `/app/v3/api/drive/nodes/{nodeId}/labels` | dual-token |
| DELETE | `/app/v3/api/drive/nodes/{nodeId}/labels/{labelId}` | dual-token |
| PUT | `/app/v3/api/drive/nodes/{nodeId}/labels/{labelId}` | dual-token |
| POST | `/app/v3/api/drive/nodes/{nodeId}/move` | dual-token |
| GET | `/app/v3/api/drive/nodes/{nodeId}/path` | dual-token |
| GET | `/app/v3/api/drive/nodes/{nodeId}/permissions` | dual-token |
| POST | `/app/v3/api/drive/nodes/{nodeId}/permissions` | dual-token |
| DELETE | `/app/v3/api/drive/nodes/{nodeId}/permissions/{permissionId}` | dual-token |
| GET | `/app/v3/api/drive/nodes/{nodeId}/permissions/{permissionId}` | dual-token |
| PATCH | `/app/v3/api/drive/nodes/{nodeId}/permissions/{permissionId}` | dual-token |
| GET | `/app/v3/api/drive/nodes/{nodeId}/permissions/effective` | dual-token |
| GET | `/app/v3/api/drive/nodes/{nodeId}/properties` | dual-token |
| DELETE | `/app/v3/api/drive/nodes/{nodeId}/properties/{propertyKey}` | dual-token |
| PUT | `/app/v3/api/drive/nodes/{nodeId}/properties/{propertyKey}` | dual-token |
| GET | `/app/v3/api/drive/nodes/{nodeId}/share_links` | dual-token |
| POST | `/app/v3/api/drive/nodes/{nodeId}/share_links` | dual-token |
| POST | `/app/v3/api/drive/nodes/{nodeId}/trash` | dual-token |
| GET | `/app/v3/api/drive/nodes/{nodeId}/versions` | dual-token |
| DELETE | `/app/v3/api/drive/nodes/{nodeId}/versions/{versionId}` | dual-token |
| GET | `/app/v3/api/drive/nodes/{nodeId}/versions/{versionId}` | dual-token |
| POST | `/app/v3/api/drive/nodes/{nodeId}/versions/{versionId}/restore` | dual-token |
| POST | `/app/v3/api/drive/nodes/{nodeId}/watch` | dual-token |
| POST | `/app/v3/api/drive/nodes/files` | dual-token |
| POST | `/app/v3/api/drive/nodes/folders` | dual-token |
| POST | `/app/v3/api/drive/nodes/shortcuts` | dual-token |
| GET | `/app/v3/api/drive/properties/{propertyKey}/nodes` | dual-token |
| GET | `/app/v3/api/drive/quotas/summary` | dual-token |
| GET | `/app/v3/api/drive/recent` | dual-token |
| GET | `/app/v3/api/drive/sandboxes` | dual-token |
| POST | `/app/v3/api/drive/sandboxes/{sandboxId}/directories` | dual-token |
| GET | `/app/v3/api/drive/sandboxes/{sandboxId}/entries` | dual-token |
| PATCH | `/app/v3/api/drive/sandboxes/{sandboxId}/entries/{entryId}` | dual-token |
| POST | `/app/v3/api/drive/sandboxes/{sandboxId}/entries/{entryId}/purge` | dual-token |
| POST | `/app/v3/api/drive/sandboxes/{sandboxId}/files` | dual-token |
| GET | `/app/v3/api/drive/sandboxes/{sandboxId}/files/{entryId}/content` | dual-token |
| PUT | `/app/v3/api/drive/sandboxes/{sandboxId}/files/{entryId}/content` | dual-token |
| GET | `/app/v3/api/drive/search` | dual-token |
| DELETE | `/app/v3/api/drive/share_links/{shareLinkId}` | dual-token |
| GET | `/app/v3/api/drive/share_links/{shareLinkId}` | dual-token |
| PATCH | `/app/v3/api/drive/share_links/{shareLinkId}` | dual-token |
| POST | `/app/v3/api/drive/share_links/{token}/claim` | dual-token |
| GET | `/app/v3/api/drive/shared_with_me` | dual-token |
| GET | `/app/v3/api/drive/spaces` | dual-token |
| POST | `/app/v3/api/drive/spaces` | dual-token |
| DELETE | `/app/v3/api/drive/spaces/{spaceId}` | dual-token |
| GET | `/app/v3/api/drive/spaces/{spaceId}` | dual-token |
| PATCH | `/app/v3/api/drive/spaces/{spaceId}` | dual-token |
| GET | `/app/v3/api/drive/spaces/{spaceId}/move_destinations` | dual-token |
| GET | `/app/v3/api/drive/spaces/{spaceId}/nodes` | dual-token |
| GET | `/app/v3/api/drive/spaces/{spaceId}/website_roots` | dual-token |
| POST | `/app/v3/api/drive/spaces/{spaceId}/website_roots` | dual-token |
| GET | `/app/v3/api/drive/trash` | dual-token |
| POST | `/app/v3/api/drive/trash/{nodeId}/restore` | dual-token |
| POST | `/app/v3/api/drive/trash/empty` | dual-token |
| POST | `/app/v3/api/drive/upload_sessions` | dual-token |
| GET | `/app/v3/api/drive/upload_sessions/{uploadSessionId}` | dual-token |
| POST | `/app/v3/api/drive/upload_sessions/{uploadSessionId}/abort` | dual-token |
| PUT | `/app/v3/api/drive/upload_sessions/{uploadSessionId}/parts/{partNo}` | dual-token |
| PUT | `/app/v3/api/drive/uploader/uploads/{uploadItemId}/parts/{partNo}` | dual-token |
| GET | `/app/v3/api/drive/watch_channels` | dual-token |
| GET | `/app/v3/api/drive/watch_channels/{channelId}` | dual-token |
| POST | `/app/v3/api/drive/watch_channels/{channelId}/stop` | dual-token |
| GET | `/app/v3/api/drive/website_roots/{rootUuid}` | dual-token |
| POST | `/app/v3/api/drive/website_roots/{rootUuid}/generations/{generation}/activate` | dual-token |
| POST | `/app/v3/api/drive/website_roots/{rootUuid}/syncs` | dual-token |
| GET | `/app/v3/api/drive/website_roots/{rootUuid}/syncs/{syncId}` | dual-token |
| POST | `/app/v3/api/drive/website_roots/{rootUuid}/syncs/{syncId}/abort` | dual-token |
| POST | `/app/v3/api/drive/website_roots/{rootUuid}/syncs/{syncId}/finalize` | dual-token |
| GET | `/app/v3/api/fulfillments` | dual-token |
| GET | `/app/v3/api/fulfillments/{fulfillmentId}` | dual-token |
| GET | `/app/v3/api/iam/api_keys` | dual-token |
| POST | `/app/v3/api/iam/api_keys` | dual-token |
| DELETE | `/app/v3/api/iam/api_keys/{apiKeyId}` | dual-token |
| PATCH | `/app/v3/api/iam/api_keys/{apiKeyId}` | dual-token |
| GET | `/app/v3/api/iam/invite/policy` | anonymous |
| POST | `/app/v3/api/iam/invites/claim` | dual-token |
| POST | `/app/v3/api/iam/invites/validate` | anonymous |
| GET | `/app/v3/api/iam/users/settings` | dual-token |
| PUT | `/app/v3/api/iam/users/settings` | dual-token |
| POST | `/app/v3/api/memberships/access/checks` | dual-token |
| GET | `/app/v3/api/memberships/benefits` | anonymous |
| GET | `/app/v3/api/memberships/current` | dual-token |
| POST | `/app/v3/api/memberships/orders` | dual-token |
| GET | `/app/v3/api/memberships/package_groups` | dual-token-or-anonymous |
| GET | `/app/v3/api/memberships/package_groups/{packageGroupId}` | dual-token-or-anonymous |
| GET | `/app/v3/api/memberships/package_groups/{packageGroupId}/packages` | dual-token-or-anonymous |
| GET | `/app/v3/api/memberships/packages/{packageId}` | dual-token-or-anonymous |
| GET | `/app/v3/api/memberships/points/balance` | dual-token |
| POST | `/app/v3/api/memberships/points/daily_rewards` | dual-token |
| GET | `/app/v3/api/memberships/points/daily_rewards/status` | dual-token |
| GET | `/app/v3/api/memberships/points/history` | dual-token |
| POST | `/app/v3/api/memberships/privileges/speed_ups` | dual-token |
| GET | `/app/v3/api/memberships/privileges/usage` | dual-token |
| POST | `/app/v3/api/memberships/purchases/renew` | dual-token |
| POST | `/app/v3/api/memberships/purchases/upgrade` | dual-token |
| GET | `/app/v3/api/memberships/team/seats` | dual-token |
| POST | `/app/v3/api/memberships/team/seats` | dual-token |
| DELETE | `/app/v3/api/memberships/team/seats/{userId}` | dual-token |
| PATCH | `/app/v3/api/memberships/team/seats/policy` | dual-token |
| POST | `/app/v3/api/memberships/team/seats/reconcile` | dual-token |
| GET | `/app/v3/api/memberships/team/subscription` | dual-token |
| POST | `/app/v3/api/memberships/team/subscription/bind` | dual-token |
| GET | `/app/v3/api/notification/notifications` | dual-token |
| POST | `/app/v3/api/notification/notifications/{notificationId}/acknowledge` | dual-token |
| POST | `/app/v3/api/notification/notifications/{notificationId}/popup_seen` | dual-token |
| POST | `/app/v3/api/orders/{orderId}/discount` | dual-token |
| GET | `/app/v3/api/orders/{orderId}/events` | dual-token |
| POST | `/app/v3/api/orders/coupon_redemptions` | dual-token |
| GET | `/app/v3/api/orders/demand_claims` | dual-token |
| POST | `/app/v3/api/orders/demand_claims` | dual-token |
| GET | `/app/v3/api/orders/demand_claims/{claimId}` | dual-token |
| POST | `/app/v3/api/orders/demand_claims/{claimId}/accept` | dual-token |
| POST | `/app/v3/api/orders/demand_claims/{claimId}/cancel` | dual-token |
| POST | `/app/v3/api/orders/demand_claims/{claimId}/complete` | dual-token |
| POST | `/app/v3/api/orders/demand_claims/{claimId}/deliver` | dual-token |
| GET | `/app/v3/api/orders/demand_claims/{claimId}/events` | dual-token |
| POST | `/app/v3/api/orders/demand_claims/{claimId}/reject` | dual-token |
| POST | `/app/v3/api/orders/demand_claims/{claimId}/rework` | dual-token |
| POST | `/app/v3/api/orders/demand_claims/{claimId}/shortlist` | dual-token |
| POST | `/app/v3/api/orders/demand_claims/{claimId}/start` | dual-token |
| POST | `/app/v3/api/orders/demand_claims/{claimId}/withdraw` | dual-token |
| GET | `/app/v3/api/orders/demand_claims/statistics` | dual-token |
| POST | `/app/v3/api/orders/payments/webhooks/{providerCode}` | anonymous |
| GET | `/app/v3/api/orders/refund_requests` | dual-token |
| POST | `/app/v3/api/orders/refund_requests` | dual-token |
| GET | `/app/v3/api/orders/refund_requests/{refundRequestId}` | dual-token |
| POST | `/app/v3/api/orders/refunds/webhooks/{providerCode}` | anonymous |
| POST | `/app/v3/api/partner_join/applications/{applicationId}/cancel` | dual-token |
| GET | `/app/v3/api/partner_join/invite_codes/{code}` | anonymous |
| GET | `/app/v3/api/payments/attempts/{paymentAttemptId}` | dual-token |
| GET | `/app/v3/api/payments/checkout/{paymentId}` | dual-token |
| POST | `/app/v3/api/payments/intents` | dual-token |
| GET | `/app/v3/api/payments/intents/{paymentIntentId}` | dual-token |
| POST | `/app/v3/api/payments/intents/{paymentIntentId}/attempts` | dual-token |
| POST | `/app/v3/api/payments/intents/{paymentIntentId}/cancel` | dual-token |
| POST | `/app/v3/api/promotions/codes/redemptions/preview` | dual-token |
| POST | `/app/v3/api/promotions/discount_applications/{applicationId}/releases` | dual-token |
| POST | `/app/v3/api/promotions/discount_applications/{applicationId}/rollback` | dual-token |
| POST | `/app/v3/api/promotions/discount_applications/{applicationId}/settlements` | dual-token |
| GET | `/app/v3/api/promotions/member_cards` | dual-token |
| GET | `/app/v3/api/promotions/member_cards/{cardId}` | dual-token |
| POST | `/app/v3/api/promotions/member_cards/{cardId}/consumptions` | dual-token |
| GET | `/app/v3/api/promotions/user_coupons/{userCouponId}` | dual-token |
| GET | `/app/v3/api/recharges/orders` | dual-token |
| POST | `/app/v3/api/recharges/orders` | dual-token |
| GET | `/app/v3/api/recharges/orders/{orderId}` | dual-token |
| POST | `/app/v3/api/recharges/orders/{orderId}/cancel` | dual-token |
| GET | `/app/v3/api/recharges/packages` | anonymous |
| GET | `/app/v3/api/recharges/plans` | anonymous |
| GET | `/app/v3/api/recharges/settings` | anonymous |
| GET | `/app/v3/api/refunds` | dual-token |
| POST | `/app/v3/api/refunds` | dual-token |
| GET | `/app/v3/api/refunds/{refundId}` | dual-token |
| GET | `/app/v3/api/runtime/invocations` | dual-token |
| POST | `/app/v3/api/runtime/invocations` | dual-token |
| GET | `/app/v3/api/runtime/invocations/{invocationId}` | dual-token |
| GET | `/app/v3/api/runtime/invocations/{invocationId}/artifacts` | dual-token |
| POST | `/app/v3/api/runtime/invocations/{invocationId}/artifacts` | dual-token |
| POST | `/app/v3/api/runtime/invocations/{invocationId}/completions` | dual-token |
| GET | `/app/v3/api/runtime/invocations/{invocationId}/events` | dual-token |
| POST | `/app/v3/api/runtime/invocations/{invocationId}/events` | dual-token |
| GET | `/app/v3/api/runtime/invocations/{invocationId}/events/stream` | dual-token |
| GET | `/app/v3/api/shops/current` | dual-token |
| GET | `/app/v3/api/shops/current/applications` | dual-token |
| GET | `/app/v3/api/shops/current/brand_authorizations` | dual-token |
| PUT | `/app/v3/api/shops/current/brand_authorizations` | dual-token |
| GET | `/app/v3/api/shops/current/business_hours` | dual-token |
| PATCH | `/app/v3/api/shops/current/business_hours` | dual-token |
| GET | `/app/v3/api/shops/current/category_bindings` | dual-token |
| PUT | `/app/v3/api/shops/current/category_bindings` | dual-token |
| GET | `/app/v3/api/shops/current/channels` | dual-token |
| GET | `/app/v3/api/shops/current/customer_services` | dual-token |
| PUT | `/app/v3/api/shops/current/customer_services` | dual-token |
| GET | `/app/v3/api/shops/current/dashboard` | dual-token |
| GET | `/app/v3/api/shops/current/deposit_account` | dual-token |
| GET | `/app/v3/api/shops/current/fulfillment_profile` | dual-token |
| PATCH | `/app/v3/api/shops/current/fulfillment_profile` | dual-token |
| GET | `/app/v3/api/shops/current/inventory/stocks` | dual-token |
| POST | `/app/v3/api/shops/current/inventory/stocks/{stockId}/adjustments` | dual-token |
| GET | `/app/v3/api/shops/current/orders` | dual-token |
| GET | `/app/v3/api/shops/current/orders/{orderId}` | dual-token |
| POST | `/app/v3/api/shops/current/orders/{orderId}/fulfillments` | dual-token |
| GET | `/app/v3/api/shops/current/policies` | dual-token |
| GET | `/app/v3/api/shops/current/products` | dual-token |
| POST | `/app/v3/api/shops/current/products` | dual-token |
| PATCH | `/app/v3/api/shops/current/products/{productId}` | dual-token |
| POST | `/app/v3/api/shops/current/products/{productId}/publish` | dual-token |
| POST | `/app/v3/api/shops/current/products/{productId}/unpublish` | dual-token |
| GET | `/app/v3/api/shops/current/qualifications` | dual-token |
| PUT | `/app/v3/api/shops/current/qualifications` | dual-token |
| GET | `/app/v3/api/shops/current/readiness` | dual-token |
| GET | `/app/v3/api/shops/current/return_addresses` | dual-token |
| PUT | `/app/v3/api/shops/current/return_addresses` | dual-token |
| GET | `/app/v3/api/shops/current/risk_signals` | dual-token |
| GET | `/app/v3/api/shops/current/service_areas` | dual-token |
| POST | `/app/v3/api/shops/current/service_areas` | dual-token |
| PATCH | `/app/v3/api/shops/current/service_areas/{serviceAreaId}` | dual-token |
| GET | `/app/v3/api/shops/current/settlement_profile` | dual-token |
| PATCH | `/app/v3/api/shops/current/settlement_profile` | dual-token |
| GET | `/app/v3/api/shops/current/settlements` | dual-token |
| GET | `/app/v3/api/shops/current/shipping_templates` | dual-token |
| PUT | `/app/v3/api/shops/current/shipping_templates` | dual-token |
| GET | `/app/v3/api/shops/current/status_events` | dual-token |
| GET | `/app/v3/api/shops/current/verifications` | dual-token |
| GET | `/app/v3/api/system/site/runtime` | anonymous |
| GET | `/app/v3/api/token_bank/account` | dual-token |
| GET | `/app/v3/api/token_bank/holds` | dual-token |
| GET | `/app/v3/api/token_bank/ledger_entries` | dual-token |
| GET | `/app/v3/api/token_bank/overview` | dual-token |
| GET | `/app/v3/api/wallet/accounts` | dual-token |
| GET | `/app/v3/api/wallet/exchange_rate` | anonymous |
| GET | `/app/v3/api/wallet/holds/{holdId}` | dual-token |
| GET | `/app/v3/api/wallet/ledger_entries` | dual-token |
| GET | `/app/v3/api/wallet/ledger_entries/{ledgerEntryId}` | dual-token |
| GET | `/app/v3/api/wallet/ledger_entries/{ledgerEntryId}/allocations` | dual-token |
| GET | `/app/v3/api/wallet/points` | dual-token |
| GET | `/app/v3/api/wallet/points/exchanges/rules` | anonymous |
| GET | `/app/v3/api/wallet/points/history` | dual-token |
| GET | `/app/v3/api/wallet/portfolio` | dual-token |
| GET | `/app/v3/api/withdrawals/requests/{withdrawalRequestId}` | dual-token |

### Route-manifest / OpenAPI-authority drift (14)

The checked-in route manifest (runtime truth) and an OpenAPI authority disagree. Either the authority is stale or the manifest was not regenerated; the runtime follows the manifest. Aggregate contracts (the mall commerce spec) are the usual stale side: they keep declaring `dual-token` after a domain authority moved a read to optional credential.

| Method | Path | Manifest tier | Authority tier(s) | Disagreeing authority spec(s) |
| --- | --- | --- | --- | --- |
| GET | `/app/v3/api/ai/pricing/rates` | anonymous | dual-token | sdkwork-cloudrouter/apis/app-api/cloudrouter/cloudrouter-app-api.openapi.json (dual-token) |
| GET | `/app/v3/api/ai/routing/account_groups` | dual-token-or-anonymous | dual-token | sdkwork-cloudrouter/apis/app-api/cloudrouter/cloudrouter-app-api.openapi.json (dual-token) |
| GET | `/app/v3/api/catalog/attributes` | dual-token-or-anonymous | dual-token | sdkwork-mall/sdks/sdkwork-commerce-app-sdk/sdkwork-commerce-app-sdk-typescript/generated/server-openapi/source-openapi.json (dual-token) |
| GET | `/app/v3/api/catalog/categories` | dual-token-or-anonymous | dual-token | sdkwork-mall/sdks/sdkwork-commerce-app-sdk/sdkwork-commerce-app-sdk-typescript/generated/server-openapi/source-openapi.json (dual-token) |
| GET | `/app/v3/api/catalog/categories/{categoryId}` | dual-token-or-anonymous | dual-token | sdkwork-mall/sdks/sdkwork-commerce-app-sdk/sdkwork-commerce-app-sdk-typescript/generated/server-openapi/source-openapi.json (dual-token) |
| GET | `/app/v3/api/catalog/products` | dual-token-or-anonymous | dual-token | sdkwork-mall/sdks/sdkwork-commerce-app-sdk/sdkwork-commerce-app-sdk-typescript/generated/server-openapi/source-openapi.json (dual-token) |
| GET | `/app/v3/api/catalog/products/{productId}` | dual-token-or-anonymous | dual-token | sdkwork-mall/sdks/sdkwork-commerce-app-sdk/sdkwork-commerce-app-sdk-typescript/generated/server-openapi/source-openapi.json (dual-token) |
| GET | `/app/v3/api/catalog/skus/{skuId}` | dual-token-or-anonymous | dual-token | sdkwork-mall/sdks/sdkwork-commerce-app-sdk/sdkwork-commerce-app-sdk-typescript/generated/server-openapi/source-openapi.json (dual-token) |
| GET | `/app/v3/api/promotions/offers` | dual-token-or-anonymous | anonymous, dual-token, dual-token-or-anonymous | sdkwork-promotion/sdks/sdkwork-promotion-app-sdk/openapi/sdkwork-promotion-app-api.openapi.json (anonymous)<br>sdkwork-mall/sdks/sdkwork-commerce-app-sdk/sdkwork-commerce-app-sdk-typescript/generated/server-openapi/source-openapi.json (dual-token) |
| GET | `/app/v3/api/promotions/offers/{offerId}` | dual-token-or-anonymous | anonymous, dual-token, dual-token-or-anonymous | sdkwork-promotion/sdks/sdkwork-promotion-app-sdk/openapi/sdkwork-promotion-app-api.openapi.json (anonymous)<br>sdkwork-mall/sdks/sdkwork-commerce-app-sdk/sdkwork-commerce-app-sdk-typescript/generated/server-openapi/source-openapi.json (dual-token) |
| GET | `/app/v3/api/shops` | dual-token-or-anonymous | dual-token, dual-token-or-anonymous | sdkwork-mall/sdks/sdkwork-commerce-app-sdk/sdkwork-commerce-app-sdk-typescript/generated/server-openapi/source-openapi.json (dual-token) |
| GET | `/app/v3/api/shops/{shopId}` | dual-token-or-anonymous | dual-token, dual-token-or-anonymous | sdkwork-mall/sdks/sdkwork-commerce-app-sdk/sdkwork-commerce-app-sdk-typescript/generated/server-openapi/source-openapi.json (dual-token) |
| GET | `/app/v3/api/wallet/exchange_rate` | anonymous | anonymous, dual-token | sdkwork-mall/sdks/sdkwork-commerce-app-sdk/sdkwork-commerce-app-sdk-typescript/generated/server-openapi/source-openapi.json (dual-token) |
| GET | `/app/v3/api/wallet/points/exchanges/rules` | anonymous | anonymous, dual-token | sdkwork-mall/sdks/sdkwork-commerce-app-sdk/sdkwork-commerce-app-sdk-typescript/generated/server-openapi/source-openapi.json (dual-token) |

## Consumer evidence (97 operations)

| Method | Path | Evidence | Files |
| --- | --- | --- | --- |
| GET | `/app/v3/api/accounts/current/summary` | operation-id, path | apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-buyer/src/profile-service.ts<br>apps/sdkwork-mall-mini-program/src/services/profile-service.ts |
| GET | `/app/v3/api/addresses` | operation-id, path | apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-buyer/src/addresses-service.ts<br>apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-cart/src/cart-service.ts<br>apps/sdkwork-mall-mini-program/src/services/address-service.ts<br>apps/sdkwork-mall-pc/src/bootstrap/address-commerce-remote.ts<br>apps/sdkwork-mall-pc/src/bootstrap/cart-commerce-remote.ts |
| POST | `/app/v3/api/addresses` | operation-id, path | apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-buyer/src/addresses-service.ts<br>apps/sdkwork-mall-h5/src/bootstrap/commerceProviders.ts<br>apps/sdkwork-mall-mini-program/src/services/address-service.ts<br>apps/sdkwork-mall-pc/src/bootstrap/address-commerce-remote.ts<br>apps/sdkwork-mall-pc/src/bootstrap/commerceProviders.ts |
| DELETE | `/app/v3/api/addresses/{addressId}` | operation-id, path | apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-buyer/src/addresses-service.ts<br>apps/sdkwork-mall-h5/src/bootstrap/commerceProviders.ts<br>apps/sdkwork-mall-mini-program/src/services/address-service.ts<br>apps/sdkwork-mall-pc/src/bootstrap/address-commerce-remote.ts<br>apps/sdkwork-mall-pc/src/bootstrap/commerceProviders.ts |
| PATCH | `/app/v3/api/addresses/{addressId}` | operation-id, path | apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-buyer/src/addresses-service.ts<br>apps/sdkwork-mall-h5/src/bootstrap/commerceProviders.ts<br>apps/sdkwork-mall-mini-program/src/services/address-service.ts<br>apps/sdkwork-mall-pc/src/bootstrap/address-commerce-remote.ts<br>apps/sdkwork-mall-pc/src/bootstrap/commerceProviders.ts |
| POST | `/app/v3/api/addresses/{addressId}/default_selection` | operation-id | apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-buyer/src/addresses-service.ts<br>apps/sdkwork-mall-h5/src/bootstrap/commerceProviders.ts<br>apps/sdkwork-mall-pc/src/bootstrap/address-commerce-remote.ts<br>apps/sdkwork-mall-pc/src/bootstrap/cart-commerce-remote.ts<br>apps/sdkwork-mall-pc/src/bootstrap/commerceProviders.ts |
| GET | `/app/v3/api/after_sales/requests` | operation-id, path | apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-buyer/src/aftersales-service.ts<br>apps/sdkwork-mall-mini-program/src/services/aftersales-service.ts<br>apps/sdkwork-mall-pc/src/bootstrap/buyer-commerce-remote.ts |
| POST | `/app/v3/api/after_sales/requests` | operation-id, path | apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-buyer/src/aftersales-service.ts<br>apps/sdkwork-mall-h5/src/bootstrap/commerceProviders.ts<br>apps/sdkwork-mall-h5/src/bootstrap/uploadDeclaration.ts<br>apps/sdkwork-mall-mini-program/src/bootstrap/uploadDeclaration.ts<br>apps/sdkwork-mall-mini-program/src/services/aftersales-service.ts<br>apps/sdkwork-mall-pc/src/bootstrap/buyer-commerce-remote.ts<br>apps/sdkwork-mall-pc/src/bootstrap/commerceProviders.ts<br>apps/sdkwork-mall-pc/src/bootstrap/uploadDeclaration.ts |
| GET | `/app/v3/api/after_sales/requests/{afterSalesRequestId}` | operation-id, path | apps/sdkwork-mall-mini-program/src/services/aftersales-service.ts<br>apps/sdkwork-mall-pc/src/bootstrap/buyer-commerce-remote.ts |
| PATCH | `/app/v3/api/after_sales/requests/{afterSalesRequestId}` | operation-id, path | apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-buyer/src/aftersales-service.ts<br>apps/sdkwork-mall-mini-program/src/services/aftersales-service.ts<br>apps/sdkwork-mall-pc/src/bootstrap/buyer-commerce-remote.ts<br>apps/sdkwork-mall-pc/src/bootstrap/commerceProviders.ts |
| GET | `/app/v3/api/after_sales/requests/{afterSalesRequestId}/events` | operation-id, path | apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-buyer/src/aftersales-service.ts<br>apps/sdkwork-mall-mini-program/src/services/aftersales-service.ts<br>apps/sdkwork-mall-pc/src/bootstrap/buyer-commerce-remote.ts |
| GET | `/app/v3/api/after_sales/requests/{afterSalesRequestId}/return_shipments` | operation-id, path | apps/sdkwork-mall-mini-program/src/services/aftersales-service.ts<br>apps/sdkwork-mall-pc/src/bootstrap/buyer-commerce-remote.ts |
| POST | `/app/v3/api/after_sales/requests/{afterSalesRequestId}/return_shipments` | operation-id, path | apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-buyer/src/aftersales-service.ts<br>apps/sdkwork-mall-mini-program/src/services/aftersales-service.ts<br>apps/sdkwork-mall-pc/src/bootstrap/buyer-commerce-remote.ts |
| GET | `/app/v3/api/billing/history` | operation-id | apps/sdkwork-mall-pc/src/bootstrap/billing-usage-records.ts |
| GET | `/app/v3/api/cart/current` | operation-id, path | apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-cart/src/cart-service.ts<br>apps/sdkwork-mall-mini-program/src/services/cart-service.ts<br>apps/sdkwork-mall-pc/src/bootstrap/cart-commerce-remote.ts |
| POST | `/app/v3/api/cart/items` | operation-id, path | apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-catalog/src/catalog-service.ts<br>apps/sdkwork-mall-h5/src/bootstrap/commerceProviders.ts<br>apps/sdkwork-mall-mini-program/src/services/cart-service.ts<br>apps/sdkwork-mall-pc/src/bootstrap/commerceProviders.ts<br>apps/sdkwork-mall-pc/src/bootstrap/storefront-commerce-remote.ts |
| DELETE | `/app/v3/api/cart/items/{cartItemId}` | operation-id, path | apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-cart/src/cart-service.ts<br>apps/sdkwork-mall-h5/src/bootstrap/commerceProviders.ts<br>apps/sdkwork-mall-mini-program/src/services/cart-service.ts<br>apps/sdkwork-mall-pc/src/bootstrap/cart-commerce-remote.ts<br>apps/sdkwork-mall-pc/src/bootstrap/commerceProviders.ts |
| PATCH | `/app/v3/api/cart/items/{cartItemId}` | operation-id, path | apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-cart/src/cart-service.ts<br>apps/sdkwork-mall-h5/src/bootstrap/commerceProviders.ts<br>apps/sdkwork-mall-mini-program/src/services/cart-service.ts<br>apps/sdkwork-mall-pc/src/bootstrap/cart-commerce-remote.ts<br>apps/sdkwork-mall-pc/src/bootstrap/commerceProviders.ts |
| GET | `/app/v3/api/catalog/categories` | operation-id, path | apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-catalog/src/catalog-service.ts<br>apps/sdkwork-mall-mini-program/src/services/catalog-service.ts<br>apps/sdkwork-mall-pc/src/bootstrap/storefront-commerce-remote.ts |
| GET | `/app/v3/api/catalog/categories/{categoryId}` | operation-id | apps/sdkwork-mall-pc/src/bootstrap/storefront-commerce-remote.ts |
| GET | `/app/v3/api/catalog/products` | operation-id | apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-search/src/search-service.ts<br>apps/sdkwork-mall-pc/src/bootstrap/storefront-commerce-remote.ts |
| GET | `/app/v3/api/catalog/skus/{skuId}` | operation-id | apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-admin-product/src/catalogService.ts |
| GET | `/app/v3/api/catalog/spus` | operation-id, path | apps/sdkwork-mall-mini-program/src/services/catalog-service.ts<br>apps/sdkwork-mall-mini-program/src/services/marketing-service.ts<br>apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-search/src/search-service.ts<br>apps/sdkwork-mall-pc/src/bootstrap/storefront-commerce-remote.ts |
| GET | `/app/v3/api/catalog/spus/{spuId}` | operation-id, path | apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-catalog/src/catalog-service.ts<br>apps/sdkwork-mall-mini-program/src/services/catalog-service.ts<br>apps/sdkwork-mall-pc/src/bootstrap/storefront-commerce-remote.ts |
| POST | `/app/v3/api/checkout/sessions` | operation-id, path | apps/sdkwork-mall-h5/src/bootstrap/commerceProviders.ts<br>apps/sdkwork-mall-mini-program/src/services/cart-service.ts<br>apps/sdkwork-mall-pc/src/bootstrap/cart-commerce-remote.ts<br>apps/sdkwork-mall-pc/src/bootstrap/commerceProviders.ts |
| POST | `/app/v3/api/checkout/sessions/{checkoutSessionId}/orders` | operation-id, path | apps/sdkwork-mall-h5/src/bootstrap/commerceProviders.ts<br>apps/sdkwork-mall-mini-program/src/services/cart-service.ts<br>apps/sdkwork-mall-pc/src/bootstrap/cart-commerce-remote.ts<br>apps/sdkwork-mall-pc/src/bootstrap/commerceProviders.ts |
| POST | `/app/v3/api/checkout/sessions/{checkoutSessionId}/quotes` | operation-id, path | apps/sdkwork-mall-h5/src/bootstrap/commerceProviders.ts<br>apps/sdkwork-mall-mini-program/src/services/cart-service.ts<br>apps/sdkwork-mall-pc/src/bootstrap/cart-commerce-remote.ts<br>apps/sdkwork-mall-pc/src/bootstrap/commerceProviders.ts |
| POST | `/app/v3/api/drive/upload_sessions/{uploadSessionId}/complete` | path | apps/sdkwork-mall-mini-program/src/services/drive-upload-service.ts |
| POST | `/app/v3/api/drive/uploader/uploads` | path | apps/sdkwork-mall-mini-program/src/services/drive-upload-service.ts |
| GET | `/app/v3/api/invoices` | path | apps/sdkwork-mall-mini-program/src/services/invoice-service.ts<br>apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-invoice/src/invoice.ts<br>apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-invoice/tests/invoice.test.ts |
| POST | `/app/v3/api/invoices` | operation-id, path | apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-buyer/src/invoices-service.ts<br>apps/sdkwork-mall-mini-program/src/services/invoice-service.ts<br>apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-invoice/src/invoice.ts<br>apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-invoice/tests/invoice.test.ts<br>apps/sdkwork-mall-pc/src/bootstrap/commerceProviders.ts<br>apps/sdkwork-mall-pc/src/bootstrap/invoice-commerce-remote.ts |
| GET | `/app/v3/api/invoices/{invoiceId}` | operation-id | apps/sdkwork-mall-pc/src/bootstrap/invoice-commerce-remote.ts |
| PATCH | `/app/v3/api/invoices/{invoiceId}` | operation-id | apps/sdkwork-mall-pc/src/bootstrap/commerceProviders.ts<br>apps/sdkwork-mall-pc/src/bootstrap/invoice-commerce-remote.ts |
| POST | `/app/v3/api/invoices/{invoiceId}/cancellations` | operation-id | apps/sdkwork-mall-pc/src/bootstrap/commerceProviders.ts<br>apps/sdkwork-mall-pc/src/bootstrap/invoice-commerce-remote.ts |
| GET | `/app/v3/api/invoices/{invoiceId}/items` | operation-id | apps/sdkwork-mall-pc/src/bootstrap/invoice-commerce-remote.ts |
| POST | `/app/v3/api/invoices/{invoiceId}/submissions` | operation-id | apps/sdkwork-mall-pc/src/bootstrap/commerceProviders.ts<br>apps/sdkwork-mall-pc/src/bootstrap/invoice-commerce-remote.ts |
| GET | `/app/v3/api/invoices/mine` | operation-id, path | apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-buyer/src/invoices-service.ts<br>apps/sdkwork-mall-mini-program/src/services/invoice-service.ts<br>apps/sdkwork-mall-pc/src/bootstrap/invoice-commerce-remote.ts |
| GET | `/app/v3/api/invoices/statistics` | operation-id | apps/sdkwork-mall-pc/src/bootstrap/invoice-commerce-remote.ts |
| GET | `/app/v3/api/memberships/current/status` | path | apps/sdkwork-mall-mini-program/src/services/account-service.ts |
| GET | `/app/v3/api/memberships/packages` | path | apps/sdkwork-mall-mini-program/src/services/account-service.ts |
| GET | `/app/v3/api/memberships/plans` | path | apps/sdkwork-mall-mini-program/src/services/account-service.ts |
| POST | `/app/v3/api/memberships/purchases` | operation-id, path | apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-membership/src/membership-service.ts<br>apps/sdkwork-mall-mini-program/src/services/account-service.ts |
| GET | `/app/v3/api/orders` | operation-id, path | apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-order/src/order-service.ts<br>apps/sdkwork-mall-mini-program/src/services/order-service.ts<br>apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-order/src/order-service.ts<br>apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-order/src/order.ts<br>apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-order/tests/order.test.ts<br>apps/sdkwork-mall-pc/src/bootstrap/buyer-commerce-remote.ts |
| POST | `/app/v3/api/orders` | operation-id, path | apps/sdkwork-mall-mini-program/src/services/order-service.ts<br>apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-order/src/order.ts<br>apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-order/tests/order.test.ts<br>apps/sdkwork-mall-pc/src/bootstrap/commerceProviders.ts |
| GET | `/app/v3/api/orders/{orderId}` | operation-id, path | apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-buyer/src/aftersales-service.ts<br>apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-order/src/order-service.ts<br>apps/sdkwork-mall-mini-program/src/services/order-service.ts<br>apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-order/src/order-service.ts<br>apps/sdkwork-mall-pc/src/bootstrap/buyer-commerce-remote.ts |
| POST | `/app/v3/api/orders/{orderId}/cancellations` | operation-id, path | apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-order/src/order-service.ts<br>apps/sdkwork-mall-mini-program/src/services/order-service.ts<br>apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-order/src/order-service.ts |
| GET | `/app/v3/api/orders/{orderId}/payment_success` | operation-id, path | apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-cart/src/cart-service.ts<br>apps/sdkwork-mall-mini-program/src/services/order-service.ts<br>apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-order/src/order-service.ts<br>apps/sdkwork-mall-pc/src/bootstrap/cart-commerce-remote.ts |
| GET | `/app/v3/api/orders/{orderId}/payments` | path | apps/sdkwork-mall-mini-program/src/services/cart-service.ts<br>apps/sdkwork-mall-mini-program/src/services/order-service.ts |
| POST | `/app/v3/api/orders/{orderId}/payments` | operation-id, path | apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-cart/src/cart-service.ts<br>apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-order/src/order-service.ts<br>apps/sdkwork-mall-h5/src/bootstrap/commerceProviders.ts<br>apps/sdkwork-mall-mini-program/src/services/cart-service.ts<br>apps/sdkwork-mall-mini-program/src/services/order-service.ts<br>apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-order/src/order-service.ts<br>apps/sdkwork-mall-pc/src/bootstrap/cart-commerce-remote.ts<br>apps/sdkwork-mall-pc/src/bootstrap/commerceProviders.ts |
| POST | `/app/v3/api/orders/{orderId}/receipt_confirmations` | operation-id, path | apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-order/src/order-service.ts<br>apps/sdkwork-mall-mini-program/src/services/order-service.ts<br>apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-order/src/order-service.ts |
| GET | `/app/v3/api/orders/{orderId}/status` | operation-id | apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-order/src/order-service.ts |
| GET | `/app/v3/api/orders/statistics` | operation-id, path | apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-order/src/order-service.ts<br>apps/sdkwork-mall-mini-program/src/services/order-service.ts<br>apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-order/src/order-service.ts |
| GET | `/app/v3/api/partner_center` | path | apps/sdkwork-mall-mini-program/src/services/partner-service.ts |
| GET | `/app/v3/api/partner_center/commissions` | path | apps/sdkwork-mall-mini-program/src/services/partner-service.ts |
| GET | `/app/v3/api/partner_center/team` | path | apps/sdkwork-mall-mini-program/src/services/partner-service.ts |
| GET | `/app/v3/api/partner_center/withdrawals` | path | apps/sdkwork-mall-mini-program/src/services/partner-service.ts |
| POST | `/app/v3/api/partner_center/withdrawals` | path | apps/sdkwork-mall-mini-program/src/services/partner-service.ts |
| GET | `/app/v3/api/partner_join` | path | apps/sdkwork-mall-mini-program/src/services/partner-service.ts |
| POST | `/app/v3/api/partner_join/applications` | path | apps/sdkwork-mall-mini-program/src/services/partner-service.ts |
| GET | `/app/v3/api/partner_join/applications/mine` | path | apps/sdkwork-mall-mini-program/src/services/partner-service.ts |
| POST | `/app/v3/api/payments` | operation-id, path | apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-payment/src/payment-service.ts<br>apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-payment/src/payment.ts<br>apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-payment/tests/payment.test.ts |
| POST | `/app/v3/api/payments/{paymentId}/close` | operation-id | apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-payment/src/payment-service.ts |
| GET | `/app/v3/api/payments/methods` | operation-id, path | apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-cart/src/cart-service.ts<br>apps/sdkwork-mall-mini-program/src/services/cart-service.ts<br>apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-payment/src/payment-service.ts<br>apps/sdkwork-mall-pc/src/bootstrap/cart-commerce-remote.ts |
| POST | `/app/v3/api/payments/reconcile` | operation-id | apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-payment/src/payment-service.ts |
| POST | `/app/v3/api/payments/reconciliations` | operation-id | apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-payment/src/payment-service.ts |
| GET | `/app/v3/api/payments/records` | operation-id | apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-payment/src/payment-service.ts |
| GET | `/app/v3/api/payments/records/{paymentId}` | operation-id | apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-payment/src/payment-service.ts |
| GET | `/app/v3/api/payments/statistics/summary` | operation-id | apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-payment/src/payment-service.ts<br>apps/sdkwork-mall-pc/src/bootstrap/commerce-buyer-hub-remote.ts |
| GET | `/app/v3/api/payments/status/{paymentId}` | operation-id | apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-payment/src/payment-service.ts |
| GET | `/app/v3/api/payments/status/out_trade_no/{outTradeNo}` | operation-id | apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-payment/src/payment-service.ts |
| POST | `/app/v3/api/promotions/codes/redemptions` | operation-id, path | apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-buyer/src/coupons-service.ts<br>apps/sdkwork-mall-h5/src/bootstrap/commerceProviders.ts<br>apps/sdkwork-mall-mini-program/src/services/promotion-service.ts<br>apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-coupon/src/coupon-service.ts |
| POST | `/app/v3/api/promotions/discount_applications` | operation-id, path | apps/sdkwork-mall-h5/src/bootstrap/commerceProviders.ts<br>apps/sdkwork-mall-mini-program/src/services/cart-service.ts<br>apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-coupon/src/coupon-service.ts<br>apps/sdkwork-mall-pc/src/bootstrap/cart-commerce-remote.ts<br>apps/sdkwork-mall-pc/src/bootstrap/commerceProviders.ts |
| POST | `/app/v3/api/promotions/discount_applications/reversals` | operation-id | apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-coupon/src/coupon-service.ts |
| GET | `/app/v3/api/promotions/offers` | operation-id, path | apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-activity/src/activity-service.ts<br>apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-buyer/src/coupons-service.ts<br>apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-catalog/src/catalog-service.ts<br>apps/sdkwork-mall-mini-program/src/services/marketing-service.ts<br>apps/sdkwork-mall-mini-program/src/services/promotion-service.ts<br>apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-coupon/src/coupon-service.ts<br>apps/sdkwork-mall-pc/src/bootstrap/cms-commerce-remote.ts<br>apps/sdkwork-mall-pc/src/bootstrap/storefront-commerce-remote.ts |
| GET | `/app/v3/api/promotions/offers/{offerId}` | operation-id, path | apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-activity/src/activity-service.ts<br>apps/sdkwork-mall-mini-program/src/services/marketing-service.ts<br>apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-coupon/src/coupon-service.ts<br>apps/sdkwork-mall-pc/src/bootstrap/storefront-commerce-remote.ts |
| POST | `/app/v3/api/promotions/user_coupon_claims` | operation-id, path | apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-buyer/src/coupons-service.ts<br>apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-catalog/src/catalog-service.ts<br>apps/sdkwork-mall-h5/src/bootstrap/commerceProviders.ts<br>apps/sdkwork-mall-mini-program/src/services/promotion-service.ts<br>apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-coupon/src/coupon-service.ts |
| GET | `/app/v3/api/promotions/user_coupons` | operation-id, path | apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-buyer/src/coupons-service.ts<br>apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-cart/src/cart-service.ts<br>apps/sdkwork-mall-mini-program/src/services/cart-service.ts<br>apps/sdkwork-mall-pc/src/bootstrap/cart-commerce-remote.ts |
| GET | `/app/v3/api/promotions/user_coupons/wallet` | operation-id | apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-coupon/src/coupon-service.ts<br>apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-subscription/src/subscription-service.ts |
| GET | `/app/v3/api/promotions/user_coupons/wallet/{userCouponId}` | operation-id | apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-coupon/src/coupon-service.ts |
| GET | `/app/v3/api/shipments/{shipmentId}` | operation-id, path | apps/sdkwork-mall-mini-program/src/services/order-service.ts<br>apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-order/src/order-service.ts |
| GET | `/app/v3/api/shipments/{shipmentId}/packages` | operation-id, path | apps/sdkwork-mall-mini-program/src/services/order-service.ts<br>apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-order/src/order-service.ts |
| GET | `/app/v3/api/shipments/{shipmentId}/tracking_events` | operation-id, path | apps/sdkwork-mall-mini-program/src/services/order-service.ts<br>apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-order/src/order-service.ts |
| GET | `/app/v3/api/shops` | operation-id | apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-shop/src/shop-service.ts<br>apps/sdkwork-mall-pc/src/bootstrap/storefront-commerce-remote.ts |
| GET | `/app/v3/api/shops/{shopId}` | operation-id, path | apps/sdkwork-mall-mini-program/src/services/marketing-service.ts<br>apps/sdkwork-mall-pc/src/bootstrap/storefront-commerce-remote.ts |
| POST | `/app/v3/api/shops/current/applications` | operation-id | apps/sdkwork-mall-pc/src/bootstrap/merchant-commerce-remote.ts |
| PATCH | `/app/v3/api/shops/current/channels/{channelId}` | operation-id | apps/sdkwork-mall-pc/src/bootstrap/merchant-commerce-remote.ts |
| PATCH | `/app/v3/api/shops/current/policies/{policyId}` | operation-id | apps/sdkwork-mall-pc/src/bootstrap/merchant-commerce-remote.ts |
| GET | `/app/v3/api/wallet/accounts/cash` | path | apps/sdkwork-mall-mini-program/src/services/account-service.ts |
| GET | `/app/v3/api/wallet/accounts/points` | operation-id, path | apps/sdkwork-mall-mini-program/src/services/account-service.ts<br>apps/sdkwork-mall-pc/src/bootstrap/cart-commerce-remote.ts |
| GET | `/app/v3/api/wallet/holds` | path | apps/sdkwork-mall-mini-program/src/services/cart-service.ts |
| POST | `/app/v3/api/wallet/holds` | operation-id, path | apps/sdkwork-mall-h5/src/bootstrap/commerceProviders.ts<br>apps/sdkwork-mall-mini-program/src/services/cart-service.ts<br>apps/sdkwork-mall-pc/src/bootstrap/cart-commerce-remote.ts<br>apps/sdkwork-mall-pc/src/bootstrap/commerceProviders.ts |
| GET | `/app/v3/api/wallet/ledger_entries/cash` | path | apps/sdkwork-mall-mini-program/src/services/account-service.ts |
| GET | `/app/v3/api/wallet/ledger_entries/points` | path | apps/sdkwork-mall-mini-program/src/services/account-service.ts |
| GET | `/app/v3/api/wallet/overview` | operation-id | apps/sdkwork-mall-pc/src/bootstrap/cart-commerce-remote.ts |
| GET | `/app/v3/api/wallet/points/lots` | path | apps/sdkwork-mall-mini-program/src/services/account-service.ts |
| GET | `/app/v3/api/wallet/points/summary` | path | apps/sdkwork-mall-mini-program/src/services/account-service.ts |
| POST | `/app/v3/api/withdrawals/requests` | operation-id | apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-wallet/src/wallet-service.ts |

## Full matrix

385 operations, one row each, ordered by path then method. The first path segment after `/app/v3/api` forms the family grouping.

### `accounts` (1)

| Method | Path | operationId | Consumed by | Published | Published source | Target | Rule | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/app/v3/api/accounts/current/summary` | accounts.current.summary.retrieve | 2 files | dual-token | manifest: sdkwork-account | `dual-token` | R4 | OK |

### `addresses` (5)

| Method | Path | operationId | Consumed by | Published | Published source | Target | Rule | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/app/v3/api/addresses` | addresses.list | 5 files | none | — | `dual-token` | R4 | MISSING-ROUTE |
| POST | `/app/v3/api/addresses` | addresses.create | 5 files | none | — | `dual-token` | R4 | MISSING-ROUTE |
| DELETE | `/app/v3/api/addresses/{addressId}` | addresses.delete | 5 files | none | — | `dual-token` | R4 | MISSING-ROUTE |
| PATCH | `/app/v3/api/addresses/{addressId}` | addresses.update | 5 files | none | — | `dual-token` | R4 | MISSING-ROUTE |
| POST | `/app/v3/api/addresses/{addressId}/default_selection` | addresses.defaultSelection.create | 5 files | none | — | `dual-token` | R4 | MISSING-ROUTE |

### `after_sales` (7)

| Method | Path | operationId | Consumed by | Published | Published source | Target | Rule | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/app/v3/api/after_sales/requests` | afterSales.requests.list | 3 files | dual-token | manifest: sdkwork-order | `dual-token` | R4 | OK |
| POST | `/app/v3/api/after_sales/requests` | afterSales.requests.create | 8 files | dual-token | manifest: sdkwork-order | `dual-token` | R4 | OK |
| GET | `/app/v3/api/after_sales/requests/{afterSalesRequestId}` | afterSales.requests.retrieve | 2 files | dual-token | manifest: sdkwork-order | `dual-token` | R4 | OK |
| PATCH | `/app/v3/api/after_sales/requests/{afterSalesRequestId}` | afterSales.requests.update | 4 files | dual-token | manifest: sdkwork-order | `dual-token` | R4 | OK |
| GET | `/app/v3/api/after_sales/requests/{afterSalesRequestId}/events` | afterSales.events.list | 3 files | dual-token | manifest: sdkwork-order | `dual-token` | R4 | OK |
| GET | `/app/v3/api/after_sales/requests/{afterSalesRequestId}/return_shipments` | afterSales.returnShipments.list | 2 files | dual-token | manifest: sdkwork-order | `dual-token` | R4 | OK |
| POST | `/app/v3/api/after_sales/requests/{afterSalesRequestId}/return_shipments` | afterSales.returnShipments.create | 3 files | dual-token | manifest: sdkwork-order | `dual-token` | R4 | OK |

### `ai` (9)

| Method | Path | operationId | Consumed by | Published | Published source | Target | Rule | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/app/v3/api/ai/dashboard/overview` | dashboard.overview.retrieve | — | dual-token | manifest: sdkwork-cloudrouter | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/ai/gateway/traces` | gateway.traces.list | — | dual-token | manifest: sdkwork-cloudrouter | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/ai/pricing/rates` | pricing.rates.list | — | anonymous | manifest: sdkwork-cloudrouter | `anonymous` | R3 | UNUSED |
| GET | `/app/v3/api/ai/routing/account_groups` | routing.accountGroups.list | — | dual-token-or-anonymous | manifest: sdkwork-cloudrouter | `dual-token` | R4 | NEEDS-TIER-CHANGE |
| GET | `/app/v3/api/ai/routing/api_keys` | routing.apiKeys.list | — | dual-token | manifest: sdkwork-cloudrouter | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/ai/routing/request_traces` | routing.requestTraces.list | — | dual-token | manifest: sdkwork-cloudrouter | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/ai/routing/usage` | routing.usage.retrieve | — | dual-token | manifest: sdkwork-cloudrouter | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/ai/settlements/dashboard` | settlements.dashboard.retrieve | — | dual-token | manifest: sdkwork-cloudrouter | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/ai/usage/logs` | usage.logs.list | — | dual-token | manifest: sdkwork-cloudrouter | `dual-token` | R4 | UNUSED |

### `app_template_orders` (2)

| Method | Path | operationId | Consumed by | Published | Published source | Target | Rule | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/app/v3/api/app_template_orders` | appTemplateOrders.list | — | dual-token | manifest: sdkwork-order | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/app_template_orders` | appTemplateOrders.create | — | dual-token | manifest: sdkwork-order | `dual-token` | R4 | UNUSED |

### `billing` (1)

| Method | Path | operationId | Consumed by | Published | Published source | Target | Rule | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/app/v3/api/billing/history` | billing.history.list | 1 file | dual-token | manifest: sdkwork-account | `dual-token` | R4 | OK |

### `cart` (4)

| Method | Path | operationId | Consumed by | Published | Published source | Target | Rule | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/app/v3/api/cart/current` | cart.current.retrieve | 3 files | none | — | `dual-token` | R4 | MISSING-ROUTE |
| POST | `/app/v3/api/cart/items` | cart.items.create | 5 files | none | — | `dual-token` | R4 | MISSING-ROUTE |
| DELETE | `/app/v3/api/cart/items/{cartItemId}` | cart.items.delete | 5 files | none | — | `dual-token` | R4 | MISSING-ROUTE |
| PATCH | `/app/v3/api/cart/items/{cartItemId}` | cart.items.update | 5 files | none | — | `dual-token` | R4 | MISSING-ROUTE |

### `cashier` (3)

| Method | Path | operationId | Consumed by | Published | Published source | Target | Rule | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/app/v3/api/cashier/{token}` | cashier.retrieve | — | anonymous | manifest: sdkwork-order | `anonymous` | R3 | UNUSED |
| POST | `/app/v3/api/cashier/{token}/payments` | cashier.payments.create | — | anonymous | manifest: sdkwork-order | `anonymous` | R3 | UNUSED |
| GET | `/app/v3/api/cashier/{token}/status` | cashier.status.retrieve | — | anonymous | manifest: sdkwork-order | `anonymous` | R3 | UNUSED |

### `catalog` (9)

| Method | Path | operationId | Consumed by | Published | Published source | Target | Rule | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/app/v3/api/catalog/attributes` | catalog.attributes.list | — | dual-token-or-anonymous | manifest: sdkwork-catalog | `dual-token-or-anonymous` | R1 | UNUSED |
| GET | `/app/v3/api/catalog/categories` | catalog.categories.list | 3 files | dual-token-or-anonymous | manifest: sdkwork-catalog | `dual-token-or-anonymous` | R1 | OK |
| GET | `/app/v3/api/catalog/categories/{categoryId}` | catalog.categories.retrieve | 1 file | dual-token-or-anonymous | manifest: sdkwork-catalog | `dual-token-or-anonymous` | R1 | OK |
| GET | `/app/v3/api/catalog/products` | catalog.products.list | 2 files | dual-token-or-anonymous | manifest: sdkwork-catalog | `dual-token-or-anonymous` | R1 | OK |
| GET | `/app/v3/api/catalog/products/{productId}` | catalog.products.retrieve | — | dual-token-or-anonymous | manifest: sdkwork-catalog | `dual-token-or-anonymous` | R1 | UNUSED |
| GET | `/app/v3/api/catalog/skus/{skuId}` | catalog.skus.retrieve | 1 file | dual-token-or-anonymous | manifest: sdkwork-catalog | `dual-token-or-anonymous` | R1 | OK |
| GET | `/app/v3/api/catalog/skus/{skuId}/prices` | catalog.skus.prices.retrieve | — | none | — | `dual-token` | R4 | MISSING-ROUTE |
| GET | `/app/v3/api/catalog/spus` | catalog.spus.list | 4 files | none | — | `dual-token-or-anonymous` | R1 | MISSING-ROUTE |
| GET | `/app/v3/api/catalog/spus/{spuId}` | catalog.spus.retrieve | 3 files | none | — | `dual-token-or-anonymous` | R1 | MISSING-ROUTE |

### `checkout` (4)

| Method | Path | operationId | Consumed by | Published | Published source | Target | Rule | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| POST | `/app/v3/api/checkout/sessions` | checkout.sessions.create | 4 files | dual-token | manifest: sdkwork-order | `dual-token` | R4 | OK |
| GET | `/app/v3/api/checkout/sessions/{checkoutSessionId}` | checkout.sessions.retrieve | — | dual-token | manifest: sdkwork-order | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/checkout/sessions/{checkoutSessionId}/orders` | checkout.sessions.orders.create | 4 files | dual-token | manifest: sdkwork-order | `dual-token` | R4 | OK |
| POST | `/app/v3/api/checkout/sessions/{checkoutSessionId}/quotes` | checkout.sessions.quotes.create | 4 files | dual-token | manifest: sdkwork-order | `dual-token` | R4 | OK |

### `drive` (101)

| Method | Path | operationId | Consumed by | Published | Published source | Target | Rule | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/app/v3/api/drive/changes` | changes.list | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/drive/changes/start_page_token` | changes.startPageToken.retrieve | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/drive/changes/watch` | changes.watch | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/drive/download_packages` | downloadPackages.create | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/drive/download_packages/{packageId}/download_url` | downloadPackages.downloadUrls.retrieve | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/drive/download_tokens/{token}` | downloadTokens.retrieve | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/drive/download_urls` | downloadUrls.create | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/drive/favorites` | favorites.list | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/drive/favorites/check` | favorites.check | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| DELETE | `/app/v3/api/drive/nodes/{nodeId}` | nodes.delete | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/drive/nodes/{nodeId}` | nodes.retrieve | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| PATCH | `/app/v3/api/drive/nodes/{nodeId}` | nodes.update | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/drive/nodes/{nodeId}/archive_entries` | archiveEntries.list | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/drive/nodes/{nodeId}/archive_entries/extract` | archiveEntries.extract | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/drive/nodes/{nodeId}/capabilities` | nodes.capabilities.list | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/drive/nodes/{nodeId}/comments` | comments.list | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/drive/nodes/{nodeId}/comments` | comments.create | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| DELETE | `/app/v3/api/drive/nodes/{nodeId}/comments/{commentId}` | comments.delete | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/drive/nodes/{nodeId}/comments/{commentId}` | comments.retrieve | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| PATCH | `/app/v3/api/drive/nodes/{nodeId}/comments/{commentId}` | comments.update | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/drive/nodes/{nodeId}/comments/{commentId}/replies` | commentReplies.list | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/drive/nodes/{nodeId}/comments/{commentId}/replies` | commentReplies.create | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| DELETE | `/app/v3/api/drive/nodes/{nodeId}/comments/{commentId}/replies/{replyId}` | commentReplies.delete | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/drive/nodes/{nodeId}/comments/{commentId}/replies/{replyId}` | commentReplies.retrieve | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| PATCH | `/app/v3/api/drive/nodes/{nodeId}/comments/{commentId}/replies/{replyId}` | commentReplies.update | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/drive/nodes/{nodeId}/content` | nodes.content.retrieve | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/drive/nodes/{nodeId}/copy` | nodes.copy | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/drive/nodes/{nodeId}/download_grants` | downloadGrants.create | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/drive/nodes/{nodeId}/download_url` | nodes.downloadUrls.retrieve | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| DELETE | `/app/v3/api/drive/nodes/{nodeId}/favorite` | favorites.delete | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| PUT | `/app/v3/api/drive/nodes/{nodeId}/favorite` | favorites.update | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/drive/nodes/{nodeId}/labels` | nodeLabels.list | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| DELETE | `/app/v3/api/drive/nodes/{nodeId}/labels/{labelId}` | nodeLabels.delete | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| PUT | `/app/v3/api/drive/nodes/{nodeId}/labels/{labelId}` | nodeLabels.update | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/drive/nodes/{nodeId}/move` | nodes.move | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/drive/nodes/{nodeId}/path` | nodes.path.retrieve | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/drive/nodes/{nodeId}/permissions` | permissions.list | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/drive/nodes/{nodeId}/permissions` | permissions.create | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| DELETE | `/app/v3/api/drive/nodes/{nodeId}/permissions/{permissionId}` | permissions.delete | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/drive/nodes/{nodeId}/permissions/{permissionId}` | permissions.retrieve | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| PATCH | `/app/v3/api/drive/nodes/{nodeId}/permissions/{permissionId}` | permissions.update | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/drive/nodes/{nodeId}/permissions/effective` | permissions.effective.list | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/drive/nodes/{nodeId}/properties` | nodeProperties.list | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| DELETE | `/app/v3/api/drive/nodes/{nodeId}/properties/{propertyKey}` | nodeProperties.delete | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| PUT | `/app/v3/api/drive/nodes/{nodeId}/properties/{propertyKey}` | nodeProperties.update | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/drive/nodes/{nodeId}/share_links` | shareLinks.list | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/drive/nodes/{nodeId}/share_links` | shareLinks.create | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/drive/nodes/{nodeId}/trash` | trash.create | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/drive/nodes/{nodeId}/versions` | versions.list | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| DELETE | `/app/v3/api/drive/nodes/{nodeId}/versions/{versionId}` | versions.delete | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/drive/nodes/{nodeId}/versions/{versionId}` | versions.retrieve | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/drive/nodes/{nodeId}/versions/{versionId}/restore` | versions.restore | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/drive/nodes/{nodeId}/watch` | nodes.watch | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/drive/nodes/files` | nodes.files.create | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/drive/nodes/folders` | nodes.folders.create | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/drive/nodes/shortcuts` | nodes.shortcuts.create | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/drive/properties/{propertyKey}/nodes` | propertyNodes.list | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/drive/quotas/summary` | quotas.retrieve | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/drive/recent` | recent.list | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/drive/sandboxes` | sandboxes.list | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/drive/sandboxes/{sandboxId}/directories` | sandboxDirectories.create | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/drive/sandboxes/{sandboxId}/entries` | sandboxEntries.list | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| PATCH | `/app/v3/api/drive/sandboxes/{sandboxId}/entries/{entryId}` | sandboxEntries.update | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/drive/sandboxes/{sandboxId}/entries/{entryId}/purge` | sandboxEntries.purge | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/drive/sandboxes/{sandboxId}/files` | sandboxFiles.create | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/drive/sandboxes/{sandboxId}/files/{entryId}/content` | sandboxFileContents.retrieve | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| PUT | `/app/v3/api/drive/sandboxes/{sandboxId}/files/{entryId}/content` | sandboxFileContents.update | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/drive/search` | search.list | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| DELETE | `/app/v3/api/drive/share_links/{shareLinkId}` | shareLinks.delete | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/drive/share_links/{shareLinkId}` | shareLinks.retrieve | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| PATCH | `/app/v3/api/drive/share_links/{shareLinkId}` | shareLinks.update | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/drive/share_links/{token}/claim` | shareLinks.claim | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/drive/shared_with_me` | sharedWithMe.list | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/drive/spaces` | spaces.list | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/drive/spaces` | spaces.create | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| DELETE | `/app/v3/api/drive/spaces/{spaceId}` | spaces.delete | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/drive/spaces/{spaceId}` | spaces.retrieve | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| PATCH | `/app/v3/api/drive/spaces/{spaceId}` | spaces.update | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/drive/spaces/{spaceId}/move_destinations` | moveDestinations.list | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/drive/spaces/{spaceId}/nodes` | nodes.list | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/drive/spaces/{spaceId}/website_roots` | websiteRoots.list | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/drive/spaces/{spaceId}/website_roots` | websiteRoots.create | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/drive/trash` | trash.list | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/drive/trash/{nodeId}/restore` | trash.restore | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/drive/trash/empty` | trash.empty | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/drive/upload_sessions` | uploadSessions.create | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/drive/upload_sessions/{uploadSessionId}` | uploadSessions.retrieve | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/drive/upload_sessions/{uploadSessionId}/abort` | uploadSessions.abort | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/drive/upload_sessions/{uploadSessionId}/complete` | uploadSessions.complete | 1 file | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | OK |
| PUT | `/app/v3/api/drive/upload_sessions/{uploadSessionId}/parts/{partNo}` | uploadSessions.parts.update | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/drive/uploader/uploads` | uploader.uploads.create | 1 file | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | OK |
| PUT | `/app/v3/api/drive/uploader/uploads/{uploadItemId}/parts/{partNo}` | uploader.uploads.parts.update | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/drive/watch_channels` | watchChannels.list | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/drive/watch_channels/{channelId}` | watchChannels.retrieve | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/drive/watch_channels/{channelId}/stop` | watchChannels.stop | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/drive/website_roots/{rootUuid}` | websiteRoots.retrieve | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/drive/website_roots/{rootUuid}/generations/{generation}/activate` | websiteRoots.generations.activate | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/drive/website_roots/{rootUuid}/syncs` | websiteRoots.syncs.create | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/drive/website_roots/{rootUuid}/syncs/{syncId}` | websiteRoots.syncs.retrieve | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/drive/website_roots/{rootUuid}/syncs/{syncId}/abort` | websiteRoots.syncs.abort | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/drive/website_roots/{rootUuid}/syncs/{syncId}/finalize` | websiteRoots.syncs.finalize | — | dual-token | manifest: sdkwork-drive | `dual-token` | R4 | UNUSED |

### `fulfillments` (2)

| Method | Path | operationId | Consumed by | Published | Published source | Target | Rule | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/app/v3/api/fulfillments` | fulfillments.list | — | dual-token | manifest: sdkwork-order | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/fulfillments/{fulfillmentId}` | fulfillments.retrieve | — | dual-token | manifest: sdkwork-order | `dual-token` | R4 | UNUSED |

### `iam` (9)

| Method | Path | operationId | Consumed by | Published | Published source | Target | Rule | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/app/v3/api/iam/api_keys` | apiKeys.list | — | dual-token | manifest: sdkwork-cloudrouter | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/iam/api_keys` | apiKeys.create | — | dual-token | manifest: sdkwork-cloudrouter | `dual-token` | R4 | UNUSED |
| DELETE | `/app/v3/api/iam/api_keys/{apiKeyId}` | apiKeys.delete | — | dual-token | manifest: sdkwork-cloudrouter | `dual-token` | R4 | UNUSED |
| PATCH | `/app/v3/api/iam/api_keys/{apiKeyId}` | apiKeys.update | — | dual-token | manifest: sdkwork-cloudrouter | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/iam/invite/policy` | invite.policy.retrieve | — | anonymous | manifest: sdkwork-cloudrouter | `anonymous` | R3 | UNUSED |
| POST | `/app/v3/api/iam/invites/claim` | invites.claim.create | — | dual-token | manifest: sdkwork-cloudrouter | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/iam/invites/validate` | invites.validate.create | — | anonymous | manifest: sdkwork-cloudrouter | `anonymous` | R3 | UNUSED |
| GET | `/app/v3/api/iam/users/settings` | users.settings.retrieve | — | dual-token | manifest: sdkwork-cloudrouter | `dual-token` | R4 | UNUSED |
| PUT | `/app/v3/api/iam/users/settings` | users.settings.update | — | dual-token | manifest: sdkwork-cloudrouter | `dual-token` | R4 | UNUSED |

### `invoices` (9)

| Method | Path | operationId | Consumed by | Published | Published source | Target | Rule | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/app/v3/api/invoices` | invoices.list | 3 files | dual-token | manifest: sdkwork-invoice | `dual-token` | R4 | OK |
| POST | `/app/v3/api/invoices` | invoices.create | 6 files | dual-token | manifest: sdkwork-invoice | `dual-token` | R4 | OK |
| GET | `/app/v3/api/invoices/{invoiceId}` | invoices.retrieve | 1 file | dual-token | manifest: sdkwork-invoice | `dual-token` | R4 | OK |
| PATCH | `/app/v3/api/invoices/{invoiceId}` | invoices.update | 2 files | dual-token | manifest: sdkwork-invoice | `dual-token` | R4 | OK |
| POST | `/app/v3/api/invoices/{invoiceId}/cancellations` | invoices.cancellations.create | 2 files | dual-token | manifest: sdkwork-invoice | `dual-token` | R4 | OK |
| GET | `/app/v3/api/invoices/{invoiceId}/items` | invoices.items.list | 1 file | dual-token | manifest: sdkwork-invoice | `dual-token` | R4 | OK |
| POST | `/app/v3/api/invoices/{invoiceId}/submissions` | invoices.submissions.create | 2 files | dual-token | manifest: sdkwork-invoice | `dual-token` | R4 | OK |
| GET | `/app/v3/api/invoices/mine` | invoices.mine.list | 3 files | dual-token | manifest: sdkwork-invoice | `dual-token` | R4 | OK |
| GET | `/app/v3/api/invoices/statistics` | invoices.statistics.retrieve | 1 file | dual-token | manifest: sdkwork-invoice | `dual-token` | R4 | OK |

### `memberships` (27)

| Method | Path | operationId | Consumed by | Published | Published source | Target | Rule | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| POST | `/app/v3/api/memberships/access/checks` | accessChecks.create | — | dual-token | authority: sdkwork-membership (build-generated manifest) | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/memberships/benefits` | benefits.list | — | anonymous | authority: sdkwork-membership (build-generated manifest) | `anonymous` | R3 | UNUSED |
| GET | `/app/v3/api/memberships/current` | current.retrieve | — | dual-token | authority: sdkwork-membership (build-generated manifest) | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/memberships/current/status` | current.status.retrieve | 1 file | dual-token | authority: sdkwork-membership (build-generated manifest) | `dual-token` | R4 | OK |
| POST | `/app/v3/api/memberships/orders` | memberships.orders.create | — | dual-token | manifest: sdkwork-order | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/memberships/package_groups` | memberships.packageGroups.list | — | dual-token-or-anonymous | authority: sdkwork-membership (build-generated manifest) | `dual-token-or-anonymous` | R1 | UNUSED |
| GET | `/app/v3/api/memberships/package_groups/{packageGroupId}` | memberships.packageGroups.retrieve | — | dual-token-or-anonymous | authority: sdkwork-membership (build-generated manifest) | `dual-token-or-anonymous` | R1 | UNUSED |
| GET | `/app/v3/api/memberships/package_groups/{packageGroupId}/packages` | memberships.packageGroups.packages.list | — | dual-token-or-anonymous | authority: sdkwork-membership (build-generated manifest) | `dual-token-or-anonymous` | R1 | UNUSED |
| GET | `/app/v3/api/memberships/packages` | memberships.packages.list | 1 file | dual-token-or-anonymous | authority: sdkwork-membership (build-generated manifest) | `dual-token-or-anonymous` | R1 | OK |
| GET | `/app/v3/api/memberships/packages/{packageId}` | memberships.packages.retrieve | — | dual-token-or-anonymous | authority: sdkwork-membership (build-generated manifest) | `dual-token-or-anonymous` | R1 | UNUSED |
| GET | `/app/v3/api/memberships/plans` | memberships.plans.list | 1 file | dual-token-or-anonymous | authority: sdkwork-membership (build-generated manifest) | `dual-token-or-anonymous` | R1 | OK |
| GET | `/app/v3/api/memberships/points/balance` | memberships.points.balance.retrieve | — | dual-token | authority: sdkwork-membership (build-generated manifest) | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/memberships/points/daily_rewards` | memberships.points.dailyRewards.create | — | dual-token | authority: sdkwork-membership (build-generated manifest) | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/memberships/points/daily_rewards/status` | memberships.points.dailyRewards.status.retrieve | — | dual-token | authority: sdkwork-membership (build-generated manifest) | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/memberships/points/history` | memberships.points.history.list | — | dual-token | authority: sdkwork-membership (build-generated manifest) | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/memberships/privileges/speed_ups` | memberships.privileges.speedUps.create | — | dual-token | authority: sdkwork-membership (build-generated manifest) | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/memberships/privileges/usage` | memberships.privileges.usage.retrieve | — | dual-token | authority: sdkwork-membership (build-generated manifest) | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/memberships/purchases` | memberships.purchases.create | 2 files | dual-token | authority: sdkwork-membership (build-generated manifest) | `dual-token` | R4 | OK |
| POST | `/app/v3/api/memberships/purchases/renew` | memberships.purchases.renew | — | dual-token | authority: sdkwork-membership (build-generated manifest) | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/memberships/purchases/upgrade` | memberships.purchases.upgrade | — | dual-token | authority: sdkwork-membership (build-generated manifest) | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/memberships/team/seats` | teamSeats.list | — | dual-token | authority: sdkwork-membership (build-generated manifest) | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/memberships/team/seats` | teamSeats.create | — | dual-token | authority: sdkwork-membership (build-generated manifest) | `dual-token` | R4 | UNUSED |
| DELETE | `/app/v3/api/memberships/team/seats/{userId}` | teamSeats.delete | — | dual-token | authority: sdkwork-membership (build-generated manifest) | `dual-token` | R4 | UNUSED |
| PATCH | `/app/v3/api/memberships/team/seats/policy` | teamSeats.policy.update | — | dual-token | authority: sdkwork-membership (build-generated manifest) | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/memberships/team/seats/reconcile` | teamSeats.reconcile | — | dual-token | authority: sdkwork-membership (build-generated manifest) | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/memberships/team/subscription` | teamSubscription.retrieve | — | dual-token | authority: sdkwork-membership (build-generated manifest) | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/memberships/team/subscription/bind` | teamSubscription.bind | — | dual-token | authority: sdkwork-membership (build-generated manifest) | `dual-token` | R4 | UNUSED |

### `notification` (3)

| Method | Path | operationId | Consumed by | Published | Published source | Target | Rule | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/app/v3/api/notification/notifications` | notifications.list | — | dual-token | manifest: sdkwork-cloudrouter | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/notification/notifications/{notificationId}/acknowledge` | notifications.acknowledge.create | — | dual-token | manifest: sdkwork-cloudrouter | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/notification/notifications/{notificationId}/popup_seen` | notifications.popupSeen.create | — | dual-token | manifest: sdkwork-cloudrouter | `dual-token` | R4 | UNUSED |

### `orders` (33)

| Method | Path | operationId | Consumed by | Published | Published source | Target | Rule | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/app/v3/api/orders` | orders.list | 6 files | dual-token | manifest: sdkwork-order | `dual-token` | R4 | OK |
| POST | `/app/v3/api/orders` | orders.create | 4 files | none | — | `dual-token` | R4 | MISSING-ROUTE |
| GET | `/app/v3/api/orders/{orderId}` | orders.retrieve | 5 files | dual-token | manifest: sdkwork-order | `dual-token` | R4 | OK |
| POST | `/app/v3/api/orders/{orderId}/cancel` | orders.cancel | — | none | — | `dual-token` | R4 | MISSING-ROUTE |
| POST | `/app/v3/api/orders/{orderId}/cancellations` | orders.cancellations.create | 3 files | dual-token | manifest: sdkwork-order | `dual-token` | R4 | OK |
| POST | `/app/v3/api/orders/{orderId}/discount` | orders.discount.create | — | dual-token | manifest: sdkwork-order | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/orders/{orderId}/events` | orders.events.list | — | dual-token | manifest: sdkwork-order | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/orders/{orderId}/payment_success` | orders.paymentSuccess.retrieve | 4 files | dual-token | manifest: sdkwork-order | `dual-token` | R4 | OK |
| GET | `/app/v3/api/orders/{orderId}/payments` | payments.orderPayments.list | 2 files | dual-token | manifest: sdkwork-order | `dual-token` | R4 | OK |
| POST | `/app/v3/api/orders/{orderId}/payments` | orders.pay | 8 files | dual-token | manifest: sdkwork-order | `dual-token` | R4 | OK |
| POST | `/app/v3/api/orders/{orderId}/receipt_confirmations` | orders.receipts.create | 3 files | dual-token | manifest: sdkwork-order | `dual-token` | R4 | OK |
| GET | `/app/v3/api/orders/{orderId}/status` | orders.status.retrieve | 1 file | dual-token | manifest: sdkwork-order | `dual-token` | R4 | OK |
| POST | `/app/v3/api/orders/coupon_redemptions` | orders.couponRedemptions.create | — | dual-token | manifest: sdkwork-order | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/orders/demand_claims` | demandClaims.list | — | dual-token | manifest: sdkwork-order | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/orders/demand_claims` | demandClaims.create | — | dual-token | manifest: sdkwork-order | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/orders/demand_claims/{claimId}` | demandClaims.retrieve | — | dual-token | manifest: sdkwork-order | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/orders/demand_claims/{claimId}/accept` | demandClaims.accept | — | dual-token | manifest: sdkwork-order | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/orders/demand_claims/{claimId}/cancel` | demandClaims.cancel | — | dual-token | manifest: sdkwork-order | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/orders/demand_claims/{claimId}/complete` | demandClaims.complete | — | dual-token | manifest: sdkwork-order | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/orders/demand_claims/{claimId}/deliver` | demandClaims.deliver | — | dual-token | manifest: sdkwork-order | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/orders/demand_claims/{claimId}/events` | demandClaims.events.list | — | dual-token | manifest: sdkwork-order | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/orders/demand_claims/{claimId}/reject` | demandClaims.reject | — | dual-token | manifest: sdkwork-order | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/orders/demand_claims/{claimId}/rework` | demandClaims.rework | — | dual-token | manifest: sdkwork-order | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/orders/demand_claims/{claimId}/shortlist` | demandClaims.shortlist | — | dual-token | manifest: sdkwork-order | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/orders/demand_claims/{claimId}/start` | demandClaims.start | — | dual-token | manifest: sdkwork-order | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/orders/demand_claims/{claimId}/withdraw` | demandClaims.withdraw | — | dual-token | manifest: sdkwork-order | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/orders/demand_claims/statistics` | demandClaims.statistics.retrieve | — | dual-token | manifest: sdkwork-order | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/orders/payments/webhooks/{providerCode}` | orders.payments.webhooks.receive | — | anonymous | manifest: sdkwork-order | `anonymous` | R3 | UNUSED |
| GET | `/app/v3/api/orders/refund_requests` | orders.refundRequests.list | — | dual-token | manifest: sdkwork-order | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/orders/refund_requests` | orders.refundRequests.create | — | dual-token | manifest: sdkwork-order | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/orders/refund_requests/{refundRequestId}` | orders.refundRequests.retrieve | — | dual-token | manifest: sdkwork-order | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/orders/refunds/webhooks/{providerCode}` | orders.refunds.webhooks.receive | — | anonymous | manifest: sdkwork-order | `anonymous` | R3 | UNUSED |
| GET | `/app/v3/api/orders/statistics` | orders.statistics.retrieve | 3 files | dual-token | manifest: sdkwork-order | `dual-token` | R4 | OK |

### `partner_center` (5)

| Method | Path | operationId | Consumed by | Published | Published source | Target | Rule | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/app/v3/api/partner_center` | partnerCenter.retrieve | 1 file | dual-token | manifest: sdkwork-partner | `dual-token` | R4 | OK |
| GET | `/app/v3/api/partner_center/commissions` | partnerCenter.commissionRecords.list | 1 file | dual-token | manifest: sdkwork-partner | `dual-token` | R4 | OK |
| GET | `/app/v3/api/partner_center/team` | partnerCenter.team.list | 1 file | dual-token | manifest: sdkwork-partner | `dual-token` | R4 | OK |
| GET | `/app/v3/api/partner_center/withdrawals` | partnerCenter.withdrawals.list | 1 file | dual-token | manifest: sdkwork-partner | `dual-token` | R4 | OK |
| POST | `/app/v3/api/partner_center/withdrawals` | partnerCenter.withdrawals.create | 1 file | dual-token | manifest: sdkwork-partner | `dual-token` | R4 | OK |

### `partner_join` (5)

| Method | Path | operationId | Consumed by | Published | Published source | Target | Rule | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/app/v3/api/partner_join` | partnerJoin.retrieve | 1 file | anonymous | manifest: sdkwork-partner | `anonymous` | R3 | OK |
| POST | `/app/v3/api/partner_join/applications` | partnerJoin.application.create | 1 file | dual-token | manifest: sdkwork-partner | `dual-token` | R4 | OK |
| POST | `/app/v3/api/partner_join/applications/{applicationId}/cancel` | partnerJoin.application.cancel | — | dual-token | manifest: sdkwork-partner | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/partner_join/applications/mine` | partnerJoin.application.list | 1 file | dual-token | manifest: sdkwork-partner | `dual-token` | R4 | OK |
| GET | `/app/v3/api/partner_join/invite_codes/{code}` | partnerJoin.inviteCode.retrieve | — | anonymous | manifest: sdkwork-partner | `anonymous` | R3 | UNUSED |

### `payments` (17)

| Method | Path | operationId | Consumed by | Published | Published source | Target | Rule | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| POST | `/app/v3/api/payments` | payments.create | 3 files | dual-token | manifest: sdkwork-payment | `dual-token` | R4 | OK |
| POST | `/app/v3/api/payments/{paymentId}/close` | payments.close | 1 file | dual-token | manifest: sdkwork-payment | `dual-token` | R4 | OK |
| GET | `/app/v3/api/payments/attempts/{paymentAttemptId}` | payments.attempts.retrieve | — | dual-token | manifest: sdkwork-payment | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/payments/checkout/{paymentId}` | payments.checkout.retrieve | — | dual-token | manifest: sdkwork-payment | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/payments/intents` | payments.intents.create | — | dual-token | manifest: sdkwork-payment | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/payments/intents/{paymentIntentId}` | payments.intents.retrieve | — | dual-token | manifest: sdkwork-payment | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/payments/intents/{paymentIntentId}/attempts` | payments.intents.attempts.create | — | dual-token | manifest: sdkwork-payment | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/payments/intents/{paymentIntentId}/cancel` | payments.intents.cancel | — | dual-token | manifest: sdkwork-payment | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/payments/methods` | payments.methods.list | 4 files | dual-token | manifest: sdkwork-payment | `dual-token` | R4 | OK |
| POST | `/app/v3/api/payments/reconcile` | payments.reconcile | 1 file | dual-token | manifest: sdkwork-payment | `dual-token` | R4 | OK |
| POST | `/app/v3/api/payments/reconciliations` | payments.reconcile | 1 file | none | — | `dual-token` | R4 | MISSING-ROUTE |
| GET | `/app/v3/api/payments/records` | payments.records.list | 1 file | dual-token | manifest: sdkwork-payment | `dual-token` | R4 | OK |
| GET | `/app/v3/api/payments/records/{paymentId}` | payments.records.retrieve | 1 file | dual-token | manifest: sdkwork-payment | `dual-token` | R4 | OK |
| GET | `/app/v3/api/payments/statistics` | payments.statistics.retrieve | — | none | — | `dual-token` | R4 | MISSING-ROUTE |
| GET | `/app/v3/api/payments/statistics/summary` | payments.statistics.summary.retrieve | 2 files | dual-token | manifest: sdkwork-payment | `dual-token` | R4 | OK |
| GET | `/app/v3/api/payments/status/{paymentId}` | payments.status.retrieve | 1 file | dual-token | manifest: sdkwork-payment | `dual-token` | R4 | OK |
| GET | `/app/v3/api/payments/status/out_trade_no/{outTradeNo}` | payments.status.outTradeNo.retrieve | 1 file | dual-token | manifest: sdkwork-payment | `dual-token` | R4 | OK |

### `promotions` (17)

| Method | Path | operationId | Consumed by | Published | Published source | Target | Rule | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| POST | `/app/v3/api/promotions/codes/redemptions` | codes.redemptions.create | 4 files | dual-token | manifest: sdkwork-promotion | `dual-token` | R4 | OK |
| POST | `/app/v3/api/promotions/codes/redemptions/preview` | codes.redemptions.preview | — | dual-token | manifest: sdkwork-promotion | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/promotions/discount_applications` | discountApplications.create | 5 files | dual-token | manifest: sdkwork-promotion | `dual-token` | R4 | OK |
| POST | `/app/v3/api/promotions/discount_applications/{applicationId}/releases` | discountApplications.releases.create | — | dual-token | manifest: sdkwork-promotion | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/promotions/discount_applications/{applicationId}/rollback` | discountApplications.rollback | — | dual-token | manifest: sdkwork-promotion | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/promotions/discount_applications/{applicationId}/settlements` | discountApplications.settlements.create | — | dual-token | manifest: sdkwork-promotion | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/promotions/discount_applications/reversals` | discountApplications.reversals.create | 1 file | dual-token | manifest: sdkwork-promotion | `dual-token` | R4 | OK |
| GET | `/app/v3/api/promotions/member_cards` | memberCards.list | — | dual-token | manifest: sdkwork-promotion | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/promotions/member_cards/{cardId}` | memberCards.retrieve | — | dual-token | manifest: sdkwork-promotion | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/promotions/member_cards/{cardId}/consumptions` | memberCards.consumptions.create | — | dual-token | manifest: sdkwork-promotion | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/promotions/offers` | offers.list | 8 files | dual-token-or-anonymous | manifest: sdkwork-promotion | `dual-token-or-anonymous` | R1 | OK |
| GET | `/app/v3/api/promotions/offers/{offerId}` | offers.retrieve | 4 files | dual-token-or-anonymous | manifest: sdkwork-promotion | `dual-token-or-anonymous` | R1 | OK |
| POST | `/app/v3/api/promotions/user_coupon_claims` | promotions.userCoupons.claims.create | 5 files | dual-token | manifest: sdkwork-promotion | `dual-token` | R4 | OK |
| GET | `/app/v3/api/promotions/user_coupons` | promotions.userCoupons.list | 4 files | dual-token | manifest: sdkwork-promotion | `dual-token` | R4 | OK |
| GET | `/app/v3/api/promotions/user_coupons/{userCouponId}` | promotions.userCoupons.retrieve | — | dual-token | manifest: sdkwork-promotion | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/promotions/user_coupons/wallet` | promotions.userCoupons.wallet.list | 2 files | dual-token | manifest: sdkwork-promotion | `dual-token` | R4 | OK |
| GET | `/app/v3/api/promotions/user_coupons/wallet/{userCouponId}` | promotions.userCoupons.wallet.retrieve | 1 file | dual-token | manifest: sdkwork-promotion | `dual-token` | R4 | OK |

### `recharges` (8)

| Method | Path | operationId | Consumed by | Published | Published source | Target | Rule | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/app/v3/api/recharges/orders` | recharges.orders.list | — | dual-token | manifest: sdkwork-order | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/recharges/orders` | recharges.orders.create | — | dual-token | manifest: sdkwork-order | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/recharges/orders/{orderId}` | recharges.orders.retrieve | — | dual-token | manifest: sdkwork-order | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/recharges/orders/{orderId}/cancel` | recharges.orders.cancel | — | dual-token | manifest: sdkwork-order | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/recharges/orders/{orderId}/cancellations` | recharges.orders.cancel | — | none | — | `dual-token` | R4 | MISSING-ROUTE |
| GET | `/app/v3/api/recharges/packages` | recharges.packages.list | — | anonymous | manifest: sdkwork-order | `anonymous` | R2 | UNUSED |
| GET | `/app/v3/api/recharges/plans` | recharges.plans.list | — | anonymous | manifest: sdkwork-order | `anonymous` | R2 | UNUSED |
| GET | `/app/v3/api/recharges/settings` | recharges.settings.retrieve | — | anonymous | manifest: sdkwork-order | `anonymous` | R2 | UNUSED |

### `refunds` (3)

| Method | Path | operationId | Consumed by | Published | Published source | Target | Rule | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/app/v3/api/refunds` | refunds.list | — | dual-token | manifest: sdkwork-payment | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/refunds` | refunds.create | — | dual-token | manifest: sdkwork-payment | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/refunds/{refundId}` | refunds.retrieve | — | dual-token | manifest: sdkwork-payment | `dual-token` | R4 | UNUSED |

### `runtime` (9)

| Method | Path | operationId | Consumed by | Published | Published source | Target | Rule | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/app/v3/api/runtime/invocations` | invocations.list | — | dual-token | manifest: sdkwork-cloudrouter | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/runtime/invocations` | invocations.create | — | dual-token | manifest: sdkwork-cloudrouter | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/runtime/invocations/{invocationId}` | invocations.retrieve | — | dual-token | manifest: sdkwork-cloudrouter | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/runtime/invocations/{invocationId}/artifacts` | invocations.artifacts.list | — | dual-token | manifest: sdkwork-cloudrouter | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/runtime/invocations/{invocationId}/artifacts` | invocations.artifacts.create | — | dual-token | manifest: sdkwork-cloudrouter | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/runtime/invocations/{invocationId}/completions` | invocations.completions.create | — | dual-token | manifest: sdkwork-cloudrouter | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/runtime/invocations/{invocationId}/events` | invocations.events.list | — | dual-token | manifest: sdkwork-cloudrouter | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/runtime/invocations/{invocationId}/events` | invocations.events.create | — | dual-token | manifest: sdkwork-cloudrouter | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/runtime/invocations/{invocationId}/events/stream` | invocations.events.stream.retrieve | — | dual-token | manifest: sdkwork-cloudrouter | `dual-token` | R4 | UNUSED |

### `shipments` (3)

| Method | Path | operationId | Consumed by | Published | Published source | Target | Rule | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/app/v3/api/shipments/{shipmentId}` | shipments.retrieve | 2 files | dual-token | manifest: sdkwork-order | `dual-token` | R4 | OK |
| GET | `/app/v3/api/shipments/{shipmentId}/packages` | shipments.packages.list | 2 files | dual-token | manifest: sdkwork-order | `dual-token` | R4 | OK |
| GET | `/app/v3/api/shipments/{shipmentId}/tracking_events` | shipments.trackingEvents.list | 2 files | dual-token | manifest: sdkwork-order | `dual-token` | R4 | OK |

### `shops` (47)

| Method | Path | operationId | Consumed by | Published | Published source | Target | Rule | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/app/v3/api/shops` | list | 2 files | dual-token-or-anonymous | manifest: sdkwork-shop | `dual-token-or-anonymous` | R1 | OK |
| GET | `/app/v3/api/shops/{shopId}` | retrieve | 2 files | dual-token-or-anonymous | manifest: sdkwork-shop | `dual-token-or-anonymous` | R1 | OK |
| GET | `/app/v3/api/shops/current` | current.retrieve | — | dual-token | manifest: sdkwork-shop | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/shops/current/applications` | current.applications.list | — | dual-token | manifest: sdkwork-shop | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/shops/current/applications` | current.applications.create | 1 file | dual-token | manifest: sdkwork-shop | `dual-token` | R4 | OK |
| GET | `/app/v3/api/shops/current/brand_authorizations` | current.brandAuthorizations.list | — | dual-token | manifest: sdkwork-shop | `dual-token` | R4 | UNUSED |
| PUT | `/app/v3/api/shops/current/brand_authorizations` | current.brandAuthorizations.update | — | dual-token | manifest: sdkwork-shop | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/shops/current/business_hours` | current.businessHours.retrieve | — | dual-token | manifest: sdkwork-shop | `dual-token` | R4 | UNUSED |
| PATCH | `/app/v3/api/shops/current/business_hours` | current.businessHours.update | — | dual-token | manifest: sdkwork-shop | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/shops/current/category_bindings` | current.categoryBindings.list | — | dual-token | manifest: sdkwork-shop | `dual-token` | R4 | UNUSED |
| PUT | `/app/v3/api/shops/current/category_bindings` | current.categoryBindings.update | — | dual-token | manifest: sdkwork-shop | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/shops/current/channels` | current.channels.list | — | dual-token | manifest: sdkwork-shop | `dual-token` | R4 | UNUSED |
| PATCH | `/app/v3/api/shops/current/channels/{channelId}` | current.channels.update | 1 file | dual-token | manifest: sdkwork-shop | `dual-token` | R4 | OK |
| GET | `/app/v3/api/shops/current/customer_services` | current.customerServices.list | — | dual-token | manifest: sdkwork-shop | `dual-token` | R4 | UNUSED |
| PUT | `/app/v3/api/shops/current/customer_services` | current.customerServices.update | — | dual-token | manifest: sdkwork-shop | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/shops/current/dashboard` | current.dashboard.retrieve | — | dual-token | manifest: sdkwork-shop | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/shops/current/deposit_account` | current.depositAccount.retrieve | — | dual-token | manifest: sdkwork-shop | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/shops/current/fulfillment_profile` | current.fulfillmentProfile.retrieve | — | dual-token | manifest: sdkwork-shop | `dual-token` | R4 | UNUSED |
| PATCH | `/app/v3/api/shops/current/fulfillment_profile` | current.fulfillmentProfile.update | — | dual-token | manifest: sdkwork-shop | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/shops/current/inventory/stocks` | shops.current.inventory.stocks.list | — | dual-token | manifest: sdkwork-inventory | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/shops/current/inventory/stocks/{stockId}/adjustments` | shops.current.inventory.stocks.adjustments.create | — | dual-token | manifest: sdkwork-inventory | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/shops/current/orders` | current.orders.list | — | dual-token | manifest: sdkwork-shop | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/shops/current/orders/{orderId}` | current.orders.retrieve | — | dual-token | manifest: sdkwork-shop | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/shops/current/orders/{orderId}/fulfillments` | current.orders.fulfillments.create | — | dual-token | manifest: sdkwork-shop | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/shops/current/policies` | current.policies.list | — | dual-token | manifest: sdkwork-shop | `dual-token` | R4 | UNUSED |
| PATCH | `/app/v3/api/shops/current/policies/{policyId}` | current.policies.update | 1 file | dual-token | manifest: sdkwork-shop | `dual-token` | R4 | OK |
| GET | `/app/v3/api/shops/current/products` | current.products.list | — | dual-token | manifest: sdkwork-shop | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/shops/current/products` | current.products.create | — | dual-token | manifest: sdkwork-shop | `dual-token` | R4 | UNUSED |
| PATCH | `/app/v3/api/shops/current/products/{productId}` | current.products.update | — | dual-token | manifest: sdkwork-shop | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/shops/current/products/{productId}/publish` | current.products.publish | — | dual-token | manifest: sdkwork-shop | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/shops/current/products/{productId}/unpublish` | current.products.unpublish | — | dual-token | manifest: sdkwork-shop | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/shops/current/qualifications` | current.qualifications.list | — | dual-token | manifest: sdkwork-shop | `dual-token` | R4 | UNUSED |
| PUT | `/app/v3/api/shops/current/qualifications` | current.qualifications.update | — | dual-token | manifest: sdkwork-shop | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/shops/current/readiness` | current.readiness.retrieve | — | dual-token | manifest: sdkwork-shop | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/shops/current/return_addresses` | current.returnAddresses.list | — | dual-token | manifest: sdkwork-shop | `dual-token` | R4 | UNUSED |
| PUT | `/app/v3/api/shops/current/return_addresses` | current.returnAddresses.update | — | dual-token | manifest: sdkwork-shop | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/shops/current/risk_signals` | current.riskSignals.list | — | dual-token | manifest: sdkwork-shop | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/shops/current/service_areas` | current.serviceAreas.list | — | dual-token | manifest: sdkwork-shop | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/shops/current/service_areas` | current.serviceAreas.create | — | dual-token | manifest: sdkwork-shop | `dual-token` | R4 | UNUSED |
| PATCH | `/app/v3/api/shops/current/service_areas/{serviceAreaId}` | current.serviceAreas.update | — | dual-token | manifest: sdkwork-shop | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/shops/current/settlement_profile` | current.settlementProfile.retrieve | — | dual-token | manifest: sdkwork-shop | `dual-token` | R4 | UNUSED |
| PATCH | `/app/v3/api/shops/current/settlement_profile` | current.settlementProfile.update | — | dual-token | manifest: sdkwork-shop | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/shops/current/settlements` | current.settlements.list | — | dual-token | manifest: sdkwork-shop | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/shops/current/shipping_templates` | current.shippingTemplates.list | — | dual-token | manifest: sdkwork-shop | `dual-token` | R4 | UNUSED |
| PUT | `/app/v3/api/shops/current/shipping_templates` | current.shippingTemplates.update | — | dual-token | manifest: sdkwork-shop | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/shops/current/status_events` | current.statusEvents.list | — | dual-token | manifest: sdkwork-shop | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/shops/current/verifications` | current.verifications.list | — | dual-token | manifest: sdkwork-shop | `dual-token` | R4 | UNUSED |

### `system` (1)

| Method | Path | operationId | Consumed by | Published | Published source | Target | Rule | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/app/v3/api/system/site/runtime` | site.runtime.retrieve | — | anonymous | manifest: sdkwork-cloudrouter | `anonymous` | R3 | UNUSED |

### `token_bank` (4)

| Method | Path | operationId | Consumed by | Published | Published source | Target | Rule | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/app/v3/api/token_bank/account` | account.retrieve | — | dual-token | manifest: sdkwork-account | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/token_bank/holds` | holds.list | — | dual-token | manifest: sdkwork-account | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/token_bank/ledger_entries` | ledgerEntries.list | — | dual-token | manifest: sdkwork-account | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/token_bank/overview` | overview.retrieve | — | dual-token | manifest: sdkwork-account | `dual-token` | R4 | UNUSED |

### `wallet` (35)

| Method | Path | operationId | Consumed by | Published | Published source | Target | Rule | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/app/v3/api/wallet/accounts` | accounts.list | — | dual-token | manifest: sdkwork-account | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/wallet/accounts/{accountId}` | wallet.accounts.retrieve | — | none | — | `dual-token` | R4 | MISSING-ROUTE |
| GET | `/app/v3/api/wallet/accounts/cash` | accounts.cash.retrieve | 1 file | dual-token | manifest: sdkwork-account | `dual-token` | R4 | OK |
| GET | `/app/v3/api/wallet/accounts/overview` | wallet.accounts.overview.retrieve | — | none | — | `dual-token` | R4 | MISSING-ROUTE |
| GET | `/app/v3/api/wallet/accounts/points` | accounts.points.retrieve | 2 files | dual-token | manifest: sdkwork-account | `dual-token` | R4 | OK |
| GET | `/app/v3/api/wallet/accounts/tokens` | wallet.accounts.tokens.retrieve | — | none | — | `dual-token` | R4 | MISSING-ROUTE |
| POST | `/app/v3/api/wallet/adjustments` | wallet.adjustments.create | — | none | — | `dual-token` | R4 | MISSING-ROUTE |
| GET | `/app/v3/api/wallet/exchange_rate` | wallet.exchangeRate.retrieve | — | anonymous | manifest: sdkwork-promotion | `anonymous` | R3 | UNUSED |
| GET | `/app/v3/api/wallet/exchange_rules` | wallet.exchangeRules.list | — | none | — | `dual-token` | R4 | MISSING-ROUTE |
| GET | `/app/v3/api/wallet/holds` | holds.list | 1 file | dual-token | manifest: sdkwork-account | `dual-token` | R4 | OK |
| POST | `/app/v3/api/wallet/holds` | wallet.holds.create | 4 files | none | — | `dual-token` | R4 | MISSING-ROUTE |
| GET | `/app/v3/api/wallet/holds/{holdId}` | holds.retrieve | — | dual-token | manifest: sdkwork-account | `dual-token` | R4 | UNUSED |
| POST | `/app/v3/api/wallet/holds/releases` | wallet.holds.releases.create | — | none | — | `dual-token` | R4 | MISSING-ROUTE |
| POST | `/app/v3/api/wallet/holds/settlements` | wallet.holds.settlements.create | — | none | — | `dual-token` | R4 | MISSING-ROUTE |
| GET | `/app/v3/api/wallet/ledger_entries` | ledgerEntries.list | — | dual-token | manifest: sdkwork-account | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/wallet/ledger_entries/{ledgerEntryId}` | ledgerEntries.retrieve | — | dual-token | manifest: sdkwork-account | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/wallet/ledger_entries/{ledgerEntryId}/allocations` | ledgerEntries.allocations.list | — | dual-token | manifest: sdkwork-account | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/wallet/ledger_entries/cash` | ledgerEntries.cash.list | 1 file | dual-token | manifest: sdkwork-account | `dual-token` | R4 | OK |
| GET | `/app/v3/api/wallet/ledger_entries/points` | ledgerEntries.points.list | 1 file | dual-token | manifest: sdkwork-account | `dual-token` | R4 | OK |
| GET | `/app/v3/api/wallet/overview` | overview.retrieve | 1 file | dual-token | manifest: sdkwork-account | `dual-token` | R4 | OK |
| POST | `/app/v3/api/wallet/point_exchanges` | wallet.pointExchanges.create | — | none | — | `dual-token` | R4 | MISSING-ROUTE |
| GET | `/app/v3/api/wallet/point_exchanges/{exchangeNo}` | wallet.pointExchanges.retrieve | — | none | — | `dual-token` | R4 | MISSING-ROUTE |
| POST | `/app/v3/api/wallet/point_transfers` | wallet.pointTransfers.create | — | none | — | `dual-token` | R4 | MISSING-ROUTE |
| GET | `/app/v3/api/wallet/points` | wallet.points.list | — | dual-token | manifest: sdkwork-promotion | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/wallet/points/exchanges/rules` | points.list | — | anonymous | manifest: sdkwork-promotion | `anonymous` | R3 | UNUSED |
| GET | `/app/v3/api/wallet/points/history` | wallet.points.list | — | dual-token | manifest: sdkwork-promotion | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/wallet/points/lots` | points.lots.list | 1 file | dual-token | manifest: sdkwork-account | `dual-token` | R4 | OK |
| GET | `/app/v3/api/wallet/points/summary` | points.summary.retrieve | 1 file | dual-token | manifest: sdkwork-account | `dual-token` | R4 | OK |
| GET | `/app/v3/api/wallet/portfolio` | list | — | dual-token | manifest: sdkwork-account | `dual-token` | R4 | UNUSED |
| GET | `/app/v3/api/wallet/requests/{requestNo}` | wallet.requests.retrieve | — | none | — | `dual-token` | R4 | MISSING-ROUTE |
| GET | `/app/v3/api/wallet/tokens` | wallet.tokens.retrieve | — | none | — | `dual-token` | R4 | MISSING-ROUTE |
| POST | `/app/v3/api/wallet/topup_transfers` | wallet.topupTransfers.create | — | none | — | `dual-token` | R4 | MISSING-ROUTE |
| GET | `/app/v3/api/wallet/transactions` | wallet.transactions.list | — | none | — | `dual-token` | R4 | MISSING-ROUTE |
| GET | `/app/v3/api/wallet/transactions/{transactionId}` | wallet.transactions.retrieve | — | none | — | `dual-token` | R4 | MISSING-ROUTE |
| POST | `/app/v3/api/wallet/withdrawal_transfers` | wallet.withdrawalTransfers.create | — | none | — | `dual-token` | R4 | MISSING-ROUTE |

### `withdrawals` (2)

| Method | Path | operationId | Consumed by | Published | Published source | Target | Rule | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| POST | `/app/v3/api/withdrawals/requests` | withdrawals.requests.create | 1 file | dual-token | manifest: sdkwork-order | `dual-token` | R4 | OK |
| GET | `/app/v3/api/withdrawals/requests/{withdrawalRequestId}` | withdrawals.requests.retrieve | — | dual-token | manifest: sdkwork-order | `dual-token` | R4 | UNUSED |

## Notes and limitations

- Consumer evidence is textual: a call made through a generated SDK method whose name differs from the operationId, with no literal path anywhere, is invisible to this scan.
- An operation that appears in several specs is one row; `operationId` shows the lexicographically first identifier and all variants live in the JSON artifact.
- `UNUSED` means "no textual reference in `apps/` or `packages/`", not "dead contract". Shared SDK families ship whole surfaces, so unused rows stay in their published tier.
- R3 never proposes a login gate for an already-anonymous operation. Machine surfaces (payment webhooks, cashier capability links) and display configuration are therefore preserved as `anonymous` instead of being forced to `dual-token` by the catch-all rule.
- Sibling repositories can be modified concurrently by other work; the snapshot table records the HEAD and working-tree state used for this run.

