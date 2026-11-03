# sdkwork-mall-pc-admin-product

Commerce-owned PC internal admin product center package.

## Public API

- `CatalogAdmin`
- `CommerceProductAdmin`
- `createCommerceProductAdminService`
- `createCommerceProductAdminWorkspaceManifest`
- product, category, SKU, attribute, and price-list admin page components
- `@sdkwork/mall-pc-admin-product/default-data`: mall default data dataset,
  environment profiles, provisioning plan, executor and verification service
- `@sdkwork/mall-pc-admin-product/default-data-admin-page`: the
  `/admin/default-data` operator surface

## Default data

The package owns the mall's environment-level default dataset (categories, shops,
products with SKUs, marketing offers, membership tiers and CMS content) because it
already owns the catalog admin that performs the same create operations manually.
Provisioning is idempotent by natural key, dependency ordered, and never destructive.

```ts
import {
  configureMallDefaultDataProvider,
  previewMallDefaultDataInitialization,
  runMallDefaultDataInitialization,
  verifyMallDefaultDataInitialization,
} from "@sdkwork/mall-pc-admin-product/default-data";
```

See [docs/default-data.md](docs/default-data.md) for the environment matrix,
guarantees and verification commands, and
[`docs/guides/operator/default-data.md`](../../../../docs/guides/operator/default-data.md)
for the operator runbook.

## Integration

Hosts import this package through its public root export. Services use `@sdkwork/mall-commerce-service`, which must be configured by the host bootstrap with Commerce app/backend SDK clients.

Cloud Router may keep a compatibility package that re-exports this package during the migration window, but Cloud Router must not call its own product/catalog backend SDK methods for product center administration.
