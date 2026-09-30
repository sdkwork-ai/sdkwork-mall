# sdkwork-mall-h5

H5 (mobile web) storefront and buyer console for SDKWork Mall, per
`APP_H5_ARCHITECTURE_SPEC.md`. Consume federated commerce through
`@sdkwork/cloudrouter-app-sdk/domains` (client.commerce.*) and the T1 domain
services; the shared headless anchors are
`@sdkwork/mall-commerce-sdk-ports` / `@sdkwork/mall-commerce-service`.

v1 scope: storefront + buyer surfaces (home, catalog/search, product detail,
cart, checkout, payment result, orders, logistics, my). Console/admin and the
Capacitor host package are follow-ups recorded in `docs/decisions.md`.
Auth reuses the already-workspaced IAM React packages (`@sdkwork/auth-pc-react`
+ `@sdkwork/auth-runtime-pc-react`); switching to `sdkwork-iam-h5` auth is a
recorded follow-up.
