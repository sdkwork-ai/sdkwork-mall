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

## IAM auth surface (login / register / recovery)

- `@sdkwork/auth-pc-react` owns the flows; the app owns presentation only:
  `src/bootstrap/authAppearance.tsx` (brand header, commerce theme tokens,
  desktop QR/highlight rail hidden) and the `.sdk-mall-auth-*` rules in
  `src/index.css` (full-bleed mobile layout, safe-area padding, segmented
  method switcher, 48px primary action, 16px inputs).
- `src/index.css` must keep `@source` roots for `@sdkwork/auth-pc-react` and
  the UI packages it renders: Tailwind v4 only scans this app root, so removing
  them silently strips every utility class of the auth surface and the screens
  render with no layout. The H5 contract test pins this.
- The QR rail is disabled (`qrLoginEnabled: false`): a phone cannot scan its
  own screen. Do not re-enable it without a desktop hand-off design.

