# SDKWork Mall
repository-kind: application

Independent SDKWork application repository for the **Mall PC** e-commerce platform (storefront, buyer console, merchant console, platform admin).

## Architecture

| Repository | Responsibility |
| --- | --- |
| **sdkwork-mall** (this repo) | Mall application UI, routes, packages under `apps/sdkwork-mall-pc/`, mall-owned commerce transport SDKs under `sdks/`, and `@sdkwork/mall-commerce-service` |
| **T1 capability repos** | Individual commerce capability backends: `sdkwork-shop`, `sdkwork-order`, `sdkwork-payment`, `sdkwork-merchandise`, `sdkwork-membership`, `sdkwork-promotion`, `sdkwork-account` |
| **sdkwork-appbase** | IAM login/session, runtime bootstrap |
| **sdkwork-utils** | Cross-cutting TypeScript utilities |

Mall consumes T1 domain service packages (`@sdkwork/account-service`, `@sdkwork/order-service`, …) for migrated PC packages and uses mall-owned generated commerce transport SDKs plus `@sdkwork/mall-commerce-service` for remaining federated storefront/admin remote ports. Do not fork generated SDK output, reference deleted sibling repositories, or call raw HTTP transport.

## Application root

- Manifest: `apps/sdkwork-mall-pc/agent.app.config.json`
- Dev: `pnpm dev`
- Build: `pnpm build`
- Verify: `pnpm verify`

## Standards

Follow `../sdkwork-specs/README.md`. Agent entrypoint: `AGENTS.md`.

## Documentation Canon

- [docs/README.md](docs/README.md)
- [docs/product/prd/PRD.md](docs/product/prd/PRD.md)
- [docs/architecture/tech/TECH_ARCHITECTURE.md](docs/architecture/tech/TECH_ARCHITECTURE.md)

## Application Roots

- [apps directory index](apps/README.md)
