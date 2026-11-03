# Mall default data (admin-product)

Environment-level default data for the SDKWORK Mall PC application.

The package owns one locale-aware dataset and everything needed to bring a mall
environment from empty to shoppable:

| Capability | Detail |
| --- | --- |
| Dataset | Category tree, shops, products with SKUs, marketing offers, membership tiers/packages and storefront CMS content, authored in `zh-CN` with an `en-US` overlay. |
| Profiles | `minimal` (production reference data), `standard` (test/staging), `demo` (development/demo showroom). |
| Provisioning | Deterministic, dependency-ordered plan; idempotent by natural keys (`MALL-CAT-*`, `MALL-SPU-*`, `MALL-SKU-*`, offer/plan/package codes). |
| Verification | Read-only coverage report per domain, proving the environment has the data each mall journey needs. |
| Admin surface | `/admin/default-data` renders the plan, runs it with live step status, and verifies the environment. |

## Environment matrix

| Environment | Profile | Categories | Shops | Products/SKUs | Offers | Membership | CMS |
| --- | --- | --- | --- | --- | --- | --- | --- |
| development | demo | all | all | all | live | all | preset |
| demo | demo | all | all | all | live | all | preset |
| test | standard | all | all | non-demo | live | non-demo packages | preset |
| staging | standard | all | all | non-demo | live | non-demo packages | preset |
| production | minimal | all | self-operated | — | — | all | preset |

`minimal` is deliberate: production receives the platform reference structure an
operator must curate (taxonomy, self-operated store, membership tiers, CMS frame)
and never demo catalog or campaigns. Override with `profile` when an operator
needs a different slice in a controlled environment.

## Guarantees

- **Idempotent.** Every entity carries a stable natural key; a rerun reads first
  and creates only what is missing. Entity identity never depends on locale or
  profile, so a `standard` environment can be upgraded to `demo` in place.
- **Dependency ordered.** Leaf categories need their parent id, SKUs need their
  product id, membership packages need both the tier and the package-group id.
  A failing step stops the run so a partial failure cannot cascade.
- **No raw transport.** Writes go through the injected `MallDefaultDataPort`; the
  app bootstrap adapts the federated commerce backend client onto it.
- **Operator-safe CMS.** The storefront CMS preset is applied once per locale via
  a local marker; later operator edits are never overwritten.
- **Locales.** `zh-CN` is the authored base, `en-US` is an overlay; a missing
  translation falls back to the authored text instead of failing a run.

## Usage

```ts
import {
  configureMallDefaultDataProvider,
  previewMallDefaultDataInitialization,
  runMallDefaultDataInitialization,
  verifyMallDefaultDataInitialization,
} from "@sdkwork/mall-pc-admin-product/default-data";

configureMallDefaultDataProvider({ port, environment: "staging", defaultLocale: "zh-CN" });

const preview = previewMallDefaultDataInitialization();
const report = await runMallDefaultDataInitialization({ dryRun: true });
const verification = await verifyMallDefaultDataInitialization();
```

The app bootstrap wires the provider once (`src/bootstrap/default-data-remote.ts`),
so UI code only calls the service functions.

## Verification

```bash
pnpm --dir apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-admin-product exec tsc --noEmit
pnpm test:vitest -- apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-admin-product/src/default-data
node scripts/verify-mall-default-data.mjs --check
```

`node scripts/verify-mall-default-data.mjs` is the offline gate: dataset
integrity, locale parity, profile coverage, plan determinism and the
environment matrix, with no backend access.

Authority: `DATABASE_FRAMEWORK_SPEC.md` §6.4 (initialization data, profiles,
locale sets), `FRONTEND_SPEC.md`, `TEST_SPEC.md`.
