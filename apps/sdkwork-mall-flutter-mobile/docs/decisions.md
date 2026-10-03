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
- 2026-10-03: identity and after-sales close the buyer loop. Login posts the
  IAM session contract (`POST /auth/sessions`) through the same transport seam
  (password form; the token paste stays as a dev fallback) and the session
  persists the returned dual tokens via `shared_preferences` (the first
  flutter.dev plugin dep — restore() runs before the first frame). The
  transport now sends Authorization + Access-Token. An after-sales center
  (`/after-sales`, entries from order detail for PAID/PENDING_RECEIPT/
  COMPLETED and the buyer hub) builds the wire-contract create body
  (`CreateAfterSalesRequest`: orderId/afterSalesType/reasonCode/
  requestedAmount decimal string/CNY/items) from the live order snapshot and
  revokes pending requests via PATCH. applicationId/bundleId aligned to the
  manifest identity `com.sdkwork.mall.flutter`.
- 2026-10-03: full-bleed audit against APP_FLUTTER_UI_SPEC v1.1 — every page
  scroll body already carries vertical-only (or zero) EdgeInsets, cards span
  full width with vertical-only margins, and all remaining horizontal insets
  are content-level (text rows, action bars, badges) inside their own
  surfaces, which the spec permits. No code change required; recorded as the
  conformance baseline for the mandate.
- Follow-ups: generate `sdkwork_mall_*` Dart SDK family, swap services over,
  upgrade session persistence to secure storage (Keystore/Keychain), wire
  `wx`-equivalent native pay channels, add console/admin packages, wire store
  signing profiles.
