# Distribution (鍒嗛攢) Capability 鈥?Cross-Client Architecture

Status: shipped end to end (join, team with per-member earnings, commission records, withdrawals).
Owner: `sdkwork-mall` presentation; `sdkwork-partner` domain and app API.
Authority: `APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md` 搂7/搂11, `APP_SDK_INTEGRATION_SPEC.md` 搂9,
`MODULE_SPEC.md`, `FRONTEND_CODE_SPEC.md`, `I18N_SPEC.md`.

## 1. What ships today

One capability, `buyer.distribution` (涓枃鏍囬銆屽垎閿€涓績銆?, is implemented on all four
client roots under the same canonical route id:

| Root | Route / page | Entry point |
| --- | --- | --- |
| PC (`pc-react`) | `buyer.mall.distribution` 鈫?`/buyer/distribution` | Buyer hub quick link |
| H5 (`h5-react`) | `buyer.mall.distribution` 鈫?`/buyer/distribution` | Buyer hub account list |
| Mini program | `pages/partner/index` | Buyer hub account list |
| Flutter | `/distribution` | Buyer hub account list |

Each surface delivers the same end-to-end slice against the partner capability's
existing app API:

- partner program catalog (levels, join fees, commission pools, benefits, settlement rules);
- join application submit / list / withdraw for the signed-in user;
- invite-code validation before applying;
- membership state derived from the application history
  (`none` / `pending` / `approved` / `rejected` / `cancelled`);
- distribution centre overview: team size, direct team, customers, invite code,
  available / frozen / lifetime-earned / withdrawn balance and minimum withdrawal;
- team management: paged subtree with each member's level, depth, direct team,
  customer count, **lifetime earnings** and **withdrawable balance**;
- earnings records: each commission allocation with source, base amount, ratio,
  amount, level offset, settlement status and time;
- withdrawal: apply against the real available balance (minimum and hold
  enforced server-side), plus paged application history with review/payment state.

The parity contract (`specs/mall-capability-parity.json`) carries the capability,
its four implementations, navigation evidence, and the centre contract note.
`tests/contract/verify-mall-capability-parity.test.mjs` proves the routes, page
files, titles and navigation entries resolve.

## 2. Layering

```
UI package (PC / H5)                     Mini program / Flutter
  page + components                        page + service adapter
        |                                         |
        v                                         v
@sdwork/mall-partner-service (headless TS)   re-implemented wire mapping
  types + pure domain rules                   (same field contract)
  SdkworkPartnerController (framework-free)
  SdkworkPartnerJoinPort  <-- adapter <-- bootstrap passes the composed client
  SdkworkPartnerCenterPort <-- adapter <-- same composed client (`center.*`)
        ^
        |
@sdwork/partner-app-sdk (composed consumer facade, generated)
        ^
sdkwork-partner app API  (/app/v3/api/partner_join, /app/v3/api/partner_center)
```

Rules enforced by `verify-repo.mjs` / `frontend-composition`:

- A feature package must not import a business SDK. The partner SDK is imported
  only by the app bootstrap (`src/bootstrap/iamRuntime.ts`); the package receives
  a structurally typed client (`SdkworkPartnerJoinWireClient`).
- No raw HTTP in the PC/H5 packages. Mini program and Flutter use their single
  documented transport seam.
- Copy lives in per-root catalogues (`partner-copy.ts`, i18n JSON fragments);
  the headless package carries no user-facing strings.

## 3. Interaction design: the join form is a modal, not page flow

The join application is a long, multi-field task. Rendering it as a card at the
bottom of the centre page buried the primary action and pushed team/earnings
content out of view. Every root now opens it as a dedicated modal surface:

| Root | Surface |
| --- | --- |
| PC | Radix `Modal` dialog (`SdkworkPartnerApplyDialog`), focus trap, ESC/backdrop close, scroll-locked body |
| H5 | Full-screen dialog on phones, centred panel on larger viewports; ESC/backdrop close, body scroll lock, focus moved into the panel |
| Mini program | Centred overlay panel with backdrop, panel-tap isolation, `scroll-view` body, masked background scroll |
| Flutter | `Dialog.fullscreen` with its own `AppBar`; back closes, successful submit returns to the centre and refreshes |

The form keeps a single implementation per root and is mounted only while open.
Withdrawal stays a compact inline command in the centre summary because it has
two fields and benefits from showing the balance it spends from.

## 4. Why the controller lives in the headless package

`createSdkworkPartnerController` is framework-free and shared by PC and H5. Both
roots wrap it with `useSyncExternalStore`; the state machine, request ordering,
error handling and membership derivation exist once. PC and H5 differ only in
presentation.

The controller exposes an explicit immutable state and a `subscribe` contract, so
a new client (for example a native desktop host) can reuse it without React.

## 5. Open/closed extension: the partner-center port

The partner capability's app API currently publishes `partnerJoin.*` only:

| Operation | Status |
| --- | --- |
| `GET /app/v3/api/partner_join` | shipped |
| `POST /app/v3/api/partner_join/applications` | shipped |
| `GET /app/v3/api/partner_join/applications/mine` | shipped |
| `POST /app/v3/api/partner_join/applications/{id}/cancel` | shipped |
| `GET /app/v3/api/partner_join/invite_codes/{code}` | shipped |
| `GET /app/v3/api/partner_center` | shipped |
| `GET /app/v3/api/partner_center/team` | shipped |
| `GET /app/v3/api/partner_center/commissions` | shipped |
| `GET /app/v3/api/partner_center/withdrawals` | shipped |
| `POST /app/v3/api/partner_center/withdrawals` | shipped |

The centre is an app boundary, not an admin proxy:

- the partner id always comes from the authenticated IAM user; no client-supplied
  partner id is accepted;
- `partner_center` joins the partner, its level, its parent and its direct
  team/customer counts, then reuses the admin stats projection for balances;
- `team` is a recursive-CTE subtree (`depth < 64`) with per-member lifetime
  commission (`SUM(partner_commission_distribution.amount)`) and the account
  settlement balance (`acct_account`);
- `commissions` exposes only the caller's own distribution rows joined to the
  settlement and its source event (never other receivers' allocations);
- withdrawals reuse the existing admin repository command, so minimum amount,
  available-balance check, account hold creation and the review/pay state
  machine have exactly one implementation.

The mall consumes the centre through `SdkworkPartnerCenterPort`. The adapter
(`createSdkworkPartnerCenterPort`) is SDK-import-free and maps the generated
`center.*` client into domain models; the apps bootstrap passes the same composed
client used by the join flow.

## 6. Is `sdkwork-partner` a complete independent distribution module?

**Yes, for the distribution self-service scope.** It now ships both planes:

| Plane | Surface |
| --- | --- |
| Administration | levels, commission config, partner tree, customer binding, commission capture/settlement, withdrawals, stats, audit (unchanged) |
| Partner self-service | join program, join applications, invite codes, centre overview, team + per-member earnings, own commission records, withdrawal apply/list |

What makes it independent:

- partner domain data is owned by `partner_*` tables plus the account settlement
  account (`owner_type=PARTNER`, `account_purpose=SETTLEMENT`);
- the commission engine and differential allocation semantics are shared by both
  planes;
- the app API resolves the current partner from the IAM user and returns
  partner-scoped projections only;
- the SDK family exposes a composed facade (`@sdkwork/partner-app-sdk`) with both
  `join.*` and `center.*` namespaces.

Residual scope: payout instrument details (bank/alipay account) are not persisted
by `partner_withdrawal`; the operator records the payout in the admin payment
step and the app shows `remark`, review state and paid time. Adding a payout
instrument is an additive schema + command change on the partner module, not a
mall change.

## 7. Is `sdkwork-order` a complete independent distribution module?

**No 鈥?and it should not own distribution.** The order app API carries one
attribution field: `CheckoutOrder.partnerId` ("Partner bound to the order's
customer at creation time"). It stamps attribution at checkout creation, but it
does not expose partner-scoped order lists, commission linkage, or team views.

Recommended split:

| Concern | Owner |
| --- | --- |
| Attribution stamp on order creation | `sdkwork-order` (already present) |
| Partner tree, customer binding, commission, settlement, withdrawal | `sdkwork-partner` |
| Partner-scoped order/commission projections | `sdkwork-partner` app API, reading order references |
| Mall presentation | mall client packages (this change) |

Putting team management into the order module would duplicate the partner
domain and break the one-capability-one-owner rule in `DOMAIN_SPEC.md`.

## 8. Verification

```bash
pnpm install
pnpm run typecheck
pnpm run typecheck:packages
pnpm run test:node
pnpm run test:vitest
node ../sdkwork-specs/tools/verify-repo.mjs --root .
node ../sdkwork-specs/tools/check-app-sdk-consumer-imports.mjs --workspace .
node ../sdkwork-specs/tools/check-api-operation-patterns.mjs --workspace .
node ../sdkwork-specs/tools/check-api-response-envelope.mjs --workspace .
node ../sdkwork-specs/tools/check-pagination.mjs --workspace .
cd apps/sdkwork-mall-flutter-mobile && flutter analyze --no-pub && flutter test --no-pub
```

Observed on this change: typecheck clean, 49 packages typechecked, 109 node
contract tests and 205 vitest tests passed, Flutter analyze clean and 35 Flutter
tests passed; the partner workspace adds 43 service unit tests plus the app-api
route-manifest tests, and `sdk:check:app` confirms the app SDK matches the
contract.

## 9. Residual risks

- The join flow is only as good as the upstream review lifecycle; the mall shows
  the server status verbatim and does not infer approval.
- `partnerId` on checkout is optional; distribution attribution is therefore
  not yet a hard order invariant. A follow-up should make it required when the
  customer is bound and add it to order read models.
- Withdrawals persist amount/status/remark but not a payout instrument; the
  operator records the payout in the admin payment step. Persisting bank/Alipay
  account details is an additive partner-module change.
- The withdrawal command is guarded client-side against double submit, but the
  partner withdrawal contract has no `Idempotency-Key` yet; a retried HTTP
  request after a lost response can create a second application while the
  balance allows. Adding an idempotency key is an additive partner-module change.
- Commission currency, minimum withdrawal and profit-margin values are rendered
  from the program catalog; a malformed upstream decimal degrades to `鈥擿 rather
  than a guessed number.
- The partner-centre `/app/v3/api/partner_center` contract is guarded by dual
  token; an anonymous request returns 401 and a signed-in non-partner returns
  404, which the UI renders as the "join first" state.

