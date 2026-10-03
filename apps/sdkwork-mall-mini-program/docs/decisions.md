# Mini-program Decisions

- 2026-09-30: v1 ships the spec-shaped WeChat MP root (manifest, app shell,
  tab pages, runtime-env seam) with surfaces intentionally inert: the
  federated commerce transport for mini-programs is a generated SDK family
  that the ecosystem has not produced for mall yet (PC/H5 consume
  `@sdkwork/cloudrouter-app-sdk/domains`, which cannot run inside the MP
  runtime). Pages fail fast with guidance instead of raw wx.request.
- 2026-10-02 (supersedes the inert-surface stance above; user-directed): the
  mini-program now implements the JD-style commerce flows for real — home,
  category, search, product detail, cart, checkout, cashier, payment result,
  orders, order detail, addresses, coupons, buyer center, token login —
  against the same commerce app-api contract the H5/PC clients consume.
  Architecture keeps the building-block rule: every domain lives in its own
  `src/services/*` module (catalog / cart / order / address / promotion),
  all traffic funnels through the single `services/transport.js` seam (the
  contract test enforces exactly one `wx.request` call site), and
  `bootstrap/sdkClients.ts` composes the services into one typed facade.
  When the generated WeChat MP SDK family lands, each service swaps its
  transport calls for the generated client without page changes.
- Auth: the IAM SDK family for MP runtimes is still pending, so the session
  holds a platform-issued bearer token (login page). wx.login /
  code2session replaces it once the identity contract exists.
- Payment: the cashier page selects a channel and calls `orders.pay`; the
  real `wx.requestPayment` handoff (and its provider params) plugs into
  `pages/cashier/index.ts` when the WeChat pay provider contract lands.
- 2026-10-03 (user-directed): the mini-program is fully TypeScript. Every
  page, service, and the app entry are `.ts` (strict `tsc --noEmit` with
  `miniprogram-api-typings`; WeChat DevTools compile via
  `setting.useCompilerPlugins: ["typescript"]`), the architecture contract
  test enforces the single `wx.request` seam on `transport.ts`, and the
  session speaks the IAM login contract (`POST /auth/sessions`) with dual
  tokens persisted through wx storage — password login form with the token
  paste kept as a dev fallback. A new after-sales center
  (`pages/aftersales`) builds the wire-contract create body
  (`CreateAfterSalesRequest`) from the live order snapshot and revokes
  pending requests via PATCH; wx.request has no documented PATCH method, so
  the transport passes the explicit method and the caveat is documented in
  the transport seam. tsconfig uses ESNext/bundler resolution for
  type-checking only (noEmit); DevTools CommonJS output is unchanged.
- Local dev: point `commerceAppApiBaseUrl` at
  `http://127.0.0.1:3900/app/v3/api` (repo-root
  `scripts/dev/mock-commerce-gateway.mjs`) and enable "不校验合法域名" in
  DevTools.
