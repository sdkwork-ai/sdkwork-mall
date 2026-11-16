# Mini program block integration (积木架构) map

Authority: `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` sections 6-8,
`IAM_LOGIN_INTEGRATION_SPEC.md`, `APP_SDK_INTEGRATION_SPEC.md` section 9 and the
repository `AGENTS.md` SDK-consumer rules.

The mini program composes SDKWork building blocks; it does not own transports or
domain logic. Each row below names the block that owns a surface and the
mall-side capability that projects it. "Bespoke today" marks wire paths the
mini program still hand-rolls; those are the remaining migration work.

## Blocks and owners

| Surface | Owning block | Mall projection |
| --- | --- | --- |
| SDK transport (all generated SDKs) | host `fetch` adapter over `wx.request` | installed once by `@sdkwork/mall-mp-core` runtime |
| WeChat one-tap sign-in, session restore, logout | `@sdkwork/iam-mp-core` (`session-wechat`) | `@sdkwork/mall-mp-auth` |
| Credential sign-in / password change / identity | `@sdkwork/iam-app-sdk` (`auth.sessions`, `iam.users.current`) | `@sdkwork/mall-mp-auth` |
| Notices, conversations, live messages, image parts | `@sdkwork/im-app-sdk`, `@sdkwork/im-sdk`, `@sdkwork/im-mp-chat` | `@sdkwork/mall-mp-im` |
| Drive upload / download grants | Drive app-api (uploader + `download_grants`) | `src/services/drive-*-service.ts` |
| Platform APIs (login code, storage, navigation, socket, payment) | host adapters | `@sdkwork/mall-mp-host` + `platform` facade |

### Commerce blocks (available, partially consumed)

The repository already depends on the generated commerce app SDK
(`sdks/sdkwork-commerce-app-sdk`, consumed through `@sdkwork/mall-commerce-service`)
and the T1 domain SDKs declared in `pnpm-workspace.yaml`. `@sdkwork/mall-mp-core`
now builds both clients once (over the host `fetch` adapter and the shared token
manager) and exposes them as `runtime.commerceClient` and `runtime.orderClient`.

**Migrated** (no raw wire path left): `catalog`, `orders`, `cart`, `checkout`, `payments`
(payment intent + method list), `promotions` (coupon list/apply), `addresses`
(default selection), `wallet` (holds), `shipments` (logistics trace).

| Commerce app SDK group | Replaces |
| --- | --- |
| `orders` / `payments` / `shipments` (order block) | `src/services/order-service.ts`, cart payment intent |
| `cart` | `src/services/cart-service.ts` (cart half) |
| `checkout` | `src/services/cart-service.ts` (checkout half) |
| `promotions` | `src/services/cart-service.ts` + `src/services/promotion-service.ts` |
| `addresses` | `src/services/address-service.ts` |
| `after-sales` | `src/services/aftersales-service.ts` |
| `invoices` | `src/services/invoice-service.ts` |
| `memberships` | `src/services/account-service.ts` (membership half) |
| `wallet`, `billing`, `recharges` | `src/services/account-service.ts` (wallet half) |
| `shops` | `src/services/marketing-service.ts` |
| `@sdkwork/partner-app-sdk` | `src/services/partner-service.ts` |
| `@sdkwork/account-app-sdk` (`accounts`, `wallet`) | `src/services/profile-service.ts` (membership half only; identity is IAM) |

## Migration phases

1. **Done — IAM.** Credential grants, identity and password change moved onto
   `@sdkwork/iam-app-sdk`; `verify-mp-auth-block-integration.test.mjs` fails the
   build if a mall service hand-rolls `/auth/*` or `/iam/*`.
2. **Done — SDK transport + commerce/order seams.** `installMpFetch` makes the
   generated SDKs runnable on WeChat; `createMpCommerceAppSdkClient` and
   `createMpOrderAppSdkClient` live only in `@sdkwork/mall-mp-core`.
3. **Done — cart + checkout + orders + payments.** `cart-service` and
   `order-service` project the blocks; both guards
   (`verify-mp-cart-block-integration`, `verify-mp-order-block-integration`)
   reject a reintroduced wire path, and the money-path body builder stays pure.
4. **Next — partner.** `@sdkwork/partner-app-sdk` owns the partner join/centre\n   surface; migrate `partner-service.ts` and add its guard.
5. **Done — transport retired to the storage boundary.** `src/services/transport.ts`
   now backs only `drive-upload-service` and `drive-download-service` (presigned
   storage hops + the app-api envelope); `page-info` reads its payload
   structurally instead of importing the seam. No storefront surface owns a wire
   path any more.

## Guard rules (cumulative)

- No `path: "/auth/*"` or `"/iam/*"` outside the generated SDK.
- Feature packages consume domain clients through `@sdkwork/mall-mp-core` exports
  only (`verify-repo` already forbids direct `@sdkwork/iam-app-sdk` imports from
  feature packages).
- Every new mall service must name its owning block in the file header; the
  architecture test rejects a service whose request path is not declared in this
  map.
