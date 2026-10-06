# Docs

Architecture notes, runbooks, and developer guides for the mall application repository.

## Canon Documents

| Document | Path |
| --- | --- |
| Product PRD | [product/prd/PRD.md](product/prd/PRD.md) |
| Technical architecture | [architecture/tech/TECH_ARCHITECTURE.md](architecture/tech/TECH_ARCHITECTURE.md) |

## Application Surfaces

| Surface | App root | Notes |
| --- | --- | --- |
| PC storefront + console | `apps/sdkwork-mall-pc` | 68 routes: buyer chain, admin (14 groups), merchant workbench, billing/subscription |
| H5 storefront | `apps/sdkwork-mall-h5` | 30 routes: full buyer chain, after-sales evidence upload |
| WeChat mini-program | `apps/sdkwork-mall-mini-program` | 30 pages mirroring H5, single transport seam (contract-tested) |
| Flutter mobile | `apps/sdkwork-mall-flutter-mobile` | 24 routes mirroring H5, pure-function service layer (15 tests) |

## Capability Status (buyer chain, all four surfaces)

- Browse: home / categories / search / product detail / shop / activity.
- Trade: cart → checkout (address, delivery, coupons, gift card, balance & points deduction)
  → cashier → payment result → orders → order detail.
- Logistics: shipment tracking timeline from order or order list.
- After sales: contract create (evidence snapshot), revoke, tracking; evidence image
  upload backed by the Drive uploader on every surface
  (PC/H5 via `drive-upload-image-core`, MP via the four-hop service + pure-TS sha256,
  Flutter via `crypto` + `transport.rawPut`).
- Buyer engagement: favorites, footprint, wallet, points, membership, coupons, invoices,
  settings; IM chats / notices on H5, MP, and Flutter.
- Messages center: order + after-sales progress feed (H5, MP, Flutter, PC).

## Local Development

```bash
node scripts/dev/mock-commerce-gateway.mjs   # federation gateway dev double (port 3900)
pnpm --dir apps/sdkwork-mall-pc dev          # PC (port 5175, proxies /app/v3/api)
pnpm --dir apps/sdkwork-mall-h5 dev          # H5 (port 5176, proxies /app/v3/api)
```

The gateway dev double covers commerce, order, after-sales, promotion, wallet, IM, and the
Drive uploader (prepare → presigned part → storage PUT sink with ETag → register → complete).

## Verification

```bash
pnpm verify                                  # typecheck + architecture contract + vitest + composition + CORS
pnpm --filter sdkwork-mall-mini-program typecheck
node --test apps/sdkwork-mall-mini-program/tests/mp-standard-architecture.test.mjs
cd apps/sdkwork-mall-flutter-mobile && flutter analyze && flutter test
```
