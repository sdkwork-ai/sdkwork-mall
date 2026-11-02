# Distribution (分销) Capability — Cross-Client Architecture

Status: shipped for the join journey; partner-center read models pending upstream.
Owner: `sdkwork-mall`
Authority: `APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md` §7/§11, `APP_SDK_INTEGRATION_SPEC.md` §9,
`MODULE_SPEC.md`, `FRONTEND_CODE_SPEC.md`, `I18N_SPEC.md`.

## 1. What ships today

One capability, `buyer.distribution` (中文标题「分销中心」), is implemented on all four
client roots under the same canonical route id:

| Root | Route / page | Entry point |
| --- | --- | --- |
| PC (`pc-react`) | `buyer.mall.distribution` → `/buyer/distribution` | Buyer hub quick link |
| H5 (`h5-react`) | `buyer.mall.distribution` → `/buyer/distribution` | Buyer hub account list |
| Mini program | `pages/partner/index` | Buyer hub account list |
| Flutter | `/distribution` | Buyer hub account list |

Each surface delivers the same end-to-end slice against the partner capability's
existing app API:

- partner program catalog (levels, join fees, commission pools, benefits, settlement rules);
- join application submit / list / withdraw for the signed-in user;
- invite-code validation before applying;
- membership state derived from the application history
  (`none` / `pending` / `approved` / `rejected` / `cancelled`);
- team, customer, commission and withdrawal projections through an optional port
  (§4), with one explicit pending notice on every root while the upstream read
  model is absent.

The parity contract (`specs/mall-capability-parity.json`) carries the capability,
its four implementations, navigation evidence, and the shared pending-copy note.
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
  SdkworkPartnerCenterPort (optional)
        ^
        |
@sdwork/partner-app-sdk (composed consumer facade, generated)
        ^
sdkwork-partner app API  (/app/v3/api/partner_join)
```

Rules enforced by `verify-repo.mjs` / `frontend-composition`:

- A feature package must not import a business SDK. The partner SDK is imported
  only by the app bootstrap (`src/bootstrap/iamRuntime.ts`); the package receives
  a structurally typed client (`SdkworkPartnerJoinWireClient`).
- No raw HTTP in the PC/H5 packages. Mini program and Flutter use their single
  documented transport seam.
- Copy lives in per-root catalogues (`partner-copy.ts`, i18n JSON fragments);
  the headless package carries no user-facing strings.

## 3. Why the controller lives in the headless package

`createSdkworkPartnerController` is framework-free and shared by PC and H5. Both
roots wrap it with `useSyncExternalStore`; the state machine, request ordering,
error handling and membership derivation exist once. PC and H5 differ only in
presentation.

The controller exposes an explicit immutable state and a `subscribe` contract, so
a new client (for example a native desktop host) can reuse it without React.

## 4. Open/closed extension: the partner-center port

The partner capability's app API currently publishes `partnerJoin.*` only:

| Operation | Status |
| --- | --- |
| `GET /app/v3/api/partner_join` | shipped |
| `POST /app/v3/api/partner_join/applications` | shipped |
| `GET /app/v3/api/partner_join/applications/mine` | shipped |
| `POST /app/v3/api/partner_join/applications/{id}/cancel` | shipped |
| `GET /app/v3/api/partner_join/invite_codes/{code}` | shipped |

Team, customer, commission and withdrawal self-service are **not** on the app
surface. The backend (`sdkwork-partner`) has the data and the admin operations,
but the app read models are a separate contract:

| Needed app operation | Backing admin operation (exists) |
| --- | --- |
| `GET /app/v3/api/partner_center` | `stats.retrieve`, `partner.retrieve`, `ledgerEntries.list` |
| `GET /app/v3/api/partner_center/team` | `partner.tree.list` |
| `GET /app/v3/api/partner_center/customers` | `customerBindings.list` |
| `GET /app/v3/api/partner_center/commissions` | `settlements.list`, `commissionEvents.list` |
| `GET /app/v3/api/partner_center/withdrawals` | `withdrawals.list` |
| `POST /app/v3/api/partner_center/withdrawals` | `withdrawals.create` |

The mall therefore defines `SdkworkPartnerCenterPort` and renders
`SdkworkPartnerCenterSection` from it when supplied. Adding the upstream
contract is an additive change:

1. publish the six app operations and regenerate `sdkwork-partner-app-sdk`;
2. implement a `SdkworkPartnerCenterPort` adapter over the new client;
3. pass it to `createSdkworkMallPartnerService` / `createSdkworkH5PartnerService`;
4. no presentational component changes.

The mini program and Flutter pages already render the same "read model pending"
state; they can add the same projection without touching their join flow.

## 5. Is `sdkwork-partner` a complete independent distribution module?

**Today: no, for team management.** It is a complete *admin* module (levels,
configuration, partner tree, customer binding, commission capture and
settlement, withdrawals, stats, audit) plus a *join-only* app module. The
distribution team console cannot be built end-to-end on the current app API.

What is already reusable without change:

- partner domain data: `partner_partner` (tree, levels, `invite_code`),
  `partner_customer_binding`, `partner_commission_event/settlement/distribution`,
  `partner_withdrawal`, `partner_stat_snapshot`;
- admin read models for every projection the app centre needs;
- commission engine and differential allocation semantics;
- the SDK family and facade conventions.

What is missing is the partner-scoped app boundary: resolving the signed-in
user's partner record, partner-scoped list projections, and the withdrawal
command with its idempotency and hold/settle lifecycle on the app surface. Until
that exists, any "team management" UI would have to either call backend-admin
APIs (wrong auth plane) or invent data; the mall does neither.

## 6. Is `sdkwork-order` a complete independent distribution module?

**No — and it should not own distribution.** The order app API carries one
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

## 7. Verification

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
contract tests and 191 vitest tests passed, Flutter analyze clean and 34 Flutter
tests passed.

## 8. Residual risks

- The join flow is only as good as the upstream review lifecycle; the mall shows
  the server status verbatim and does not infer approval.
- `partnerId` on checkout is optional; distribution attribution is therefore
  not yet a hard order invariant. A follow-up should make it required when the
  customer is bound and add it to order read models.
- Commission currency, minimum withdrawal and profit-margin values are rendered
  from the program catalog; a malformed upstream decimal degrades to `—` rather
  than a guessed number.
