# Mall Technical Architecture

Status: draft (content filled 2026-09-30)
Owner: SDKWork maintainers
Updated: 2026-09-30
Specs: ARCHITECTURE_DECISION_SPEC.md, DOCUMENTATION_SPEC.md

## Document Map

- Add `TECH-<topic>.md` shards in this directory when the architecture grows beyond one reviewable screen.

## 1. Architecture Overview

SDKWork Mall is a federated commerce application module. It owns client
application roots (browser PC, browser H5, and — planned — mini-program and
Flutter mobile) plus a thin Rust API assembly shell. Commerce domain
capabilities (catalog, cart, checkout, orders, payments, promotions,
memberships, accounts, shops, wallet, invoices) are NOT implemented in this
repository: they are federated from sibling T1 capability repositories
(`sdkwork-shop`, `sdkwork-merchandise`, `sdkwork-order`, `sdkwork-payment`,
`sdkwork-promotion`, `sdkwork-membership`, `sdkwork-account`, `sdkwork-search`,
`sdkwork-cms`) and consumed over HTTP through generated, composed TypeScript
SDK facades.

## 2. Technology Choices

| Concern | Choice |
| --- | --- |
| Browser clients | React 19 + TypeScript (strict) + Vite 8 + Tailwind CSS v4 |
| PC root | `apps/sdkwork-mall-pc` (`APP_PC_ARCHITECTURE_SPEC`) |
| H5 root | `apps/sdkwork-mall-h5` (`APP_H5_ARCHITECTURE_SPEC`); Capacitor host deferred |
| Mini-program / Flutter | `apps/sdkwork-mall-mini-program` / `apps/sdkwork-mall-flutter-mobile` per their respective architecture specs |
| TV | Deferred by `APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md` §2.3; see `../decisions/0001-tv-client-deferred.md` |
| Transport SDKs | `@sdkwork/cloudrouter-app-sdk/domains` + `@sdkwork/cloudrouter-backend-sdk/domains` (composed federated facades; the `commerce` domain groups the generated commerce transports) |
| Domain services | `@sdkwork/order-service`, `@sdkwork/payment-service`, `@sdkwork/promotion-service`, `@sdkwork/membership-service`, `@sdkwork/account-service` (sibling repo packages) |
| Shared headless | `@sdkwork/mall-commerce-sdk-ports` (method trees) + `@sdkwork/mall-commerce-service` (commerce service provider) — consumed by every client root |
| Backend runtime | axum + sqlx/PostgreSQL through `sdkwork-web-framework`; the mall repo embeds no domain services |

## 3. System Boundaries And Modules

- `apps/sdkwork-mall-pc` — single SPA owning four surfaces: storefront (`/`),
  buyer console (`/buyer/*`), merchant console (`/merchant/*`), platform admin
  (`/admin/*`). Surface selection is pathname-prefix based in
  `packages/sdkwork-mall-pc-shell`.
- `apps/sdkwork-mall-h5` — mobile web storefront + buyer surfaces with a
  bottom-tab shell.
- `crates/sdkwork-api-mall-assembly` — host-neutral WebModule assembly shell
  (`API_ASSEMBLY_SPEC.md` §4.1.1). `apiMode: "none"` with an empty
  `routeCrates` list is the declared state: the mall embeds no domain route
  crates and proxies everything through the federation gateway.
- Domain bricks (routes/service/repository-sqlx/service-host/database-host per
  domain) live in the sibling T1 repositories and compose into their own
  assemblies there; this repository must not fork them.

## 4. Directory And Package Layout

Client roots follow `APP_PC_ARCHITECTURE_SPEC` / `APP_H5_ARCHITECTURE_SPEC`:
thin root `src/` (entry + `bootstrap/{environment,runtime,sdkClients,iamRuntime,routes}`),
reusable packages `sdkwork-mall-<segment>-core/-commons/-shell/-<capability>`
(plus `-console-*` / `-admin-*` where a root ships operator surfaces).
`UI -> services -> injected generated SDK clients` layering is mandatory;
components never construct SDK clients or raw HTTP.

## 5. API, SDK, And Data Ownership

- This repository owns no OpenAPI authority. `apis/` is intentionally empty;
  authorities live in the T1 repositories.
- `sdks/sdkwork-commerce-*` families are archived, generator-produced
  snapshots of the pre-cutover federated commerce API. They are kept
  generator-owned inside this repository during the cloudrouter cutover
  (`sdks/README.md`); consumer imports of them are forbidden
  (`check-app-sdk-consumer-imports.mjs`).
- The federated commerce surface is consumed through
  `@sdkwork/cloudrouter-app-sdk/domains` (`client.commerce.*`) and
  `@sdkwork/cloudrouter-backend-sdk/domains` (`client.commerce.*` admin), with
  per-domain T1 SDKs for order/payment/promotion/membership/account flows.
- Generated output under `sdks/**` is generator-owned; fix contracts upstream
  and regenerate, never hand-edit.

## 6. Security, Privacy, And Observability

- One global TokenManager per client root; IAM session bridging through the
  appbase auth runtime; session snapshots in localStorage with legacy
  sessionStorage migration.
- All commands carry idempotency keys through the composition-root command
  adapter; business failures surface as typed messages through copy modules.
- Health/readiness for the assembly defaults to the host-neutral readiness
  check until route crates are embedded.

## 7. Deployment And Runtime Topology

- Browser bundles build through `../sdkwork-specs/tools/build-browser-client.mjs`
  into `dist/<standalone|cloud>/<dev|test|staging|prod>/` per
  `APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md` §2.1.
- `bin/lib/module.sh` declares `SDKWORK_APP_TYPES="server,pc,h5"`; `pc`/`h5`
  build and package hooks are wired to the pnpm build scripts and tar the
  matching dist directory (`MODULE_BIN_SPEC.md` §4.3–4.4).
- Deployments publish static bundles to the webserver static roots/CDN via
  `bin/apps-deploy.sh` once a delivery channel is attached; the backend
  federation (cloud router gateway + T1 services) is owned outside this repo.

## 8. Architecture Decision Index

- `../decisions/0001-tv-client-deferred.md` — TV client root stays unregistered
  until an ADR adds the standard.

## 9. Verification

- `pnpm verify` (typecheck + contract tests + vitest + composition + CORS
  gates) from the repository root.
- `pnpm test:node` — `tests/contract/verify-mall-standard-architecture.test.mjs`.
- Spec tools: `check-app-sdk-consumer-imports`, `check-workspace-member-protocol`,
  `check-dependency-list-completeness`, `check-application-layering`,
  `check-vite-workspace-aliases`, `check-browser-dist-layout`,
  `check-browser-build-scripts`, `check-browser-runtime-env-standard`.
- `bin/doctor.sh` for bin-family wiring health.
