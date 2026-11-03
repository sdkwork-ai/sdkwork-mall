# PLAN-20261103 Mall default data initialization

Status: implemented
Owner: mall application
Scope: `apps/sdkwork-mall-pc` (PC backend-admin + bootstrap + offline gate)

## Problem

Every mall environment must start with a professional, complete dataset: category
taxonomy, stores, products with SKUs, marketing campaigns, membership tiers and a
storefront CMS frame. Without it the storefront renders empty states, checkout has
nothing to buy, membership has no plans, and regression rounds cannot tell a code
defect from an empty database.

The repository authors no Rust crates and no database assets (see `crates/README.md`):
commerce APIs and physical schemas are owned by T1 capability repositories. The mall
application is therefore the composition root that must own the *application-level*
default dataset and provision it through the federated commerce APIs, in every
environment.

## Decision

1. **One authored dataset, projected by profile.** `zh-CN` is the authored base and
   `en-US` is an overlay. `minimal` / `standard` / `demo` slice the same entities by
   `demoOnly`, so identity is stable across profiles and a `standard` environment can
   be upgraded in place.
2. **Natural keys, not synthetic ids.** `MALL-CAT-*`, `MALL-SPU-*`, `MALL-SKU-*`,
   offer/plan/group/package codes and shop names make provisioning idempotent without
   a local ledger.
3. **Dependency-ordered plan, stop on failure.** Leaf categories need the parent id,
   SKUs need the product id, packages need both tier and group id. A failing step
   leaves the remainder `pending` instead of cascading writes with missing foreign keys.
4. **Port injection, no raw transport.** The engine writes only through
   `MallDefaultDataPort`; `src/bootstrap/default-data-remote.ts` adapts the federated
   commerce backend client, reusing the existing command-port adapter for idempotency.
5. **Read-first operator surface.** `/admin/default-data` always shows the plan and the
   dataset size, offers a dry run, and can verify the environment without writing.
6. **Production is never demo.** `minimal` ships reference structure only, and any
   campaign created in production is forced to `draft` even when a richer profile is
   requested explicitly.
7. **No new workspace package.** The capability lives in
   `@sdkwork/mall-pc-admin-product` under `src/default-data/`, next to the catalog
   admin that owns the same create operations. Adding a package would have required a
   lockfile regeneration that this workspace cannot currently perform (an unrelated
   sibling workspace package is out of sync), so the change stays installable and
   CI-reproducible.
8. **Demo-ready by construction (second pass).** Initialization is only useful if an
   operator can then show the whole application, so:
   - every leaf category and every shop carries at least one non-demo product
     (`catalog.coverage`), removing empty-state dead ends from the storefront;
   - the verification report is projected onto 13 ordered journeys
     (`journeys.ts`) with readiness badges and mounted-route links;
   - a successful run re-verifies automatically and the flow guide refreshes without
     a second click;
   - transactional journeys (orders, after-sales) are explicit: their rows come from
     a real purchase and are never fabricated by initialization.

## Regression findings fixed in the same change

| Finding | Impact | Fix |
| --- | --- | --- |
| `demo` was a declared lifecycle environment but the PC app had no `build:demo` / `build:demo:cloud` scripts | `bin/lib/module.sh` and the browser build-script gate would fail for demo | Added both scripts and demo runtime-config examples (browser/desktop/server/container) |
| `SdkworkMallPcEnvironment` did not model `demo`, so a demo build reported `development` | Wrong environment/profile in telemetry and default-data profile selection | Added `demo` to the environment union, mode map and profile map |
| `config/validate-runtime-config` skipped demo entirely | No preflight coverage for the demo environment | Demo added to `--all` and validated |
| Backend admin port was adapted from the federated client root instead of its `commerce` namespace | Every backend-admin data page threw on the first data call | Adapted `commerceBackendClient.commerce` |

## Verification

- `pnpm check:default-data` — dataset integrity, locale parity, profile matrix,
  environment assets and build scripts (offline).
- `pnpm test:vitest` — 49 package and bootstrap tests: dataset rules, catalog
  coverage, journey mapping, plan order, payload builders, dry run, idempotent rerun,
  failure isolation, production draft policy, verification coverage, CMS preset
  marking, the SDK port adapter and the admin page's plan/dry-run/verify/flow-guide
  states.
- `pnpm verify` — typecheck, architecture contract, composition, CORS, parity, i18n
  catalogues/baseline and the default-data gate.

The i18n readiness ratchet (`specs/i18n-readiness.baseline.json`) was refreshed in
this change: the PC root gains the operator page, its copy map and the flow guide
(+73 user-facing literals, 1610 → 1683). The dataset itself is JSON, which the audit
classifies as locale data rather than copy, so only page copy is counted.

### Pre-existing gate failure (not introduced here)

`pnpm check:cors-standard` fails on three tracked, unreferenced topology fragments
whose file names are not `<environment>.env` or `<deployment-profile>.<environment>.env`:
`etc/topology/base.env`, `etc/topology/cloud.base.env`,
`etc/topology/standalone.base.env`. The files are unmodified by this change
(`git status` clean) and no spec or config references them; removing them requires an
explicit human decision because they are tracked. Until then `pnpm verify` stops at
that gate. Every other gate in the change passes.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Backend rejects a command payload shape the app has not exercised yet | Payloads reuse the exact shapes the admin UI already sends (`ProductCreatePage`, `AdminMarketingPage`, membership admin, shop DTOs); failures are surfaced per step, not swallowed |
| Large catalogs make the idempotency lookup page-bound | Lookups read one bounded page of 200; datasets are far below it and a defect surfaces as a verification warning |
| Operators rerun provisioning over curated data | Provisioning only creates missing entities; CMS presets are applied once per locale |
| Production accidentally receives demo catalog | `minimal` profile plus the production draft rule for campaigns |

## Out of scope

- Server-owned reference seeds (T1 repositories `database/seeds/**`), which remain with
  their owning capabilities.
- Payment channel credentials, risk rules and settlement profiles: environment
  secrets and finance configuration, not application default data.
