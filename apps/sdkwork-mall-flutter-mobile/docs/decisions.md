# Flutter Decisions

- 2026-09-30: v1 ships the spec-shaped Flutter mobile root (flutter create
  android/ios, thin lib bootstrap with typed dart-define environment, bottom
  tab shell covering 首页/分类/购物车/我的) with commerce surfaces intentionally
  inert: the federated transport requires a generated Dart SDK family for the
  mall commerce authority which the ecosystem has not produced yet (the
  TypeScript cloudrouter domains client cannot run in Dart). Surfaces fail
  fast with guidance instead of raw HTTP.
- 2026-10-02 (supersedes the inert-surface stance above; user-directed): the
  Flutter app now implements the JD-style commerce flows for real against the
  same commerce app-api contract as H5/PC/MP — home floors (banner carousel /
  quick entries / category chips / seckill countdown / product grid), two-pane
  category rail, search (hot words, history, sorts, infinite scroll), product
  detail (gallery PageView, SKU chips with stock caps, quantity stepper, buy
  now), shop-grouped cart with selection + reactive badge, checkout (address,
  coupon picker, wallet/points holds), cashier (channel selection), payment
  result with polling, order center with status tabs and actions, order
  detail, address book (province/city dropdowns), coupon center, buyer center
  with order statistics, and a token login page pending the IAM Dart family.
  Architecture keeps the building-block rule: `bootstrap/commerce_transport.dart`
  is the single transport seam (envelope unwrap, ProblemDetail mapping, bearer
  auth, bounded timeouts via dart:io HttpClient — zero external deps),
  `services/*` holds one class per domain, `services/commerce.dart` is the
  composition root, and pages consume only the domain service they need.
  When the generated Dart SDK family lands, each service swaps its transport
  calls for the generated client without page changes.
- Follow-ups: generate `sdkwork_mall_*` Dart SDK family, swap services over,
  persist the session in secure storage, wire `wx`-equivalent native pay
  channels, add console/admin packages, wire store signing profiles
  (applicationId still `com.example.sdkwork_mall_flutter_mobile`).
