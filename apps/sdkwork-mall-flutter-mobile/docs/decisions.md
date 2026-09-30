# Flutter Decisions

- 2026-09-30: v1 ships the spec-shaped Flutter mobile root (flutter create
  android/ios, thin lib bootstrap with typed dart-define environment, bottom
  tab shell covering 首页/分类/购物车/我的) with commerce surfaces intentionally
  inert: the federated transport requires a generated Dart SDK family for the
  mall commerce authority which the ecosystem has not produced yet (the
  TypeScript cloudrouter domains client cannot run in Dart). Surfaces fail
  fast with guidance instead of raw HTTP.
- Follow-ups: generate `sdkwork_mall_*` Dart SDK family, implement
  services/screens per FLUTTER_APP_MOBILE_ARCHITECTURE_SPEC + APP_FLUTTER_UI_SPEC,
  add console/admin packages, wire store signing profiles.
