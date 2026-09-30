# Mini-program Decisions

- 2026-09-30: v1 ships the spec-shaped WeChat MP root (manifest, app shell,
  tab pages, runtime-env seam) with surfaces intentionally inert: the
  federated commerce transport for mini-programs is a generated SDK family
  that the ecosystem has not produced for mall yet (PC/H5 consume
  `@sdkwork/cloudrouter-app-sdk/domains`, which cannot run inside the MP
  runtime). Pages fail fast with guidance instead of raw wx.request.
- Follow-ups: generate `sdkwork-mall-mp-*` SDK family from the commerce
  authority, wire `createMallMpCommerceClient`, then implement
  home/category/cart/buyer data flows per APP_MINI_PROGRAM_UI_SPEC.
