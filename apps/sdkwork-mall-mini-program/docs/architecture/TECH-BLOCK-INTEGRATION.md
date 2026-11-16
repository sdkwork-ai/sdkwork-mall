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
| WeChat one-tap sign-in, session restore, logout | `@sdkwork/iam-mp-core` (`session-wechat`) | `@sdkwork/mall-mp-auth` |
| Credential sign-in / password change / identity | `@sdkwork/iam-app-sdk` (`auth.sessions`, `iam.users.current`) | `@sdkwork/mall-mp-auth` |
| Notices, conversations, live messages, image parts | `@sdkwork/im-app-sdk`, `@sdkwork/im-sdk`, `@sdkwork/im-mp-chat` | `@sdkwork/mall-mp-im` |
| Drive upload / download grants | Drive app-api (uploader + `download_grants`) | `src/services/drive-*-service.ts` |
| Platform APIs (login code, storage, navigation, socket, payment) | host adapters | `@sdkwork/mall-mp-host` + `platform` facade |

### Commerce blocks (available, partially consumed)

The repository already depends on the generated commerce app SDK
(`sdks/sdkwork-commerce-app-sdk`, consumed through `@sdkwork/mall-commerce-service`)
and the T1 domain SDKs declared in `pnpm-workspace.yaml`. Their operation groups
are the intended owners of the surfaces the mini program still reaches through
`src/services/transport.ts`:

| Commerce app SDK group | Will replace |
| --- | --- |
| `catalog` | `src/services/catalog-service.ts` |
| `cart` | `src/services/cart-service.ts` (cart half) |
| `checkout` | `src/services/cart-service.ts` (checkout half) |
| `orders` | `src/services/order-service.ts` |
| `addresses` | `src/services/address-service.ts` |
| `after-sales` | `src/services/aftersales-service.ts` |
| `invoices` | `src/services/invoice-service.ts` |
| `memberships` | `src/services/account-service.ts` (membership half) |
| `wallet`, `billing`, `recharges` | `src/services/account-service.ts` (wallet half) |
| `promotions` | `src/services/promotion-service.ts` |
| `shops` | `src/services/marketing-service.ts` |
| `payments` | `src/services/cart-service.ts` (payment-method list) |
| `@sdkwork/partner-app-sdk` | `src/services/partner-service.ts` |
| `@sdkwork/account-app-sdk` (`accounts`, `wallet`) | `src/services/profile-service.ts` (membership half only; identity is IAM) |

## Migration phases

1. **Done — IAM.** Credential grants, identity and password change moved onto
   `@sdkwork/iam-app-sdk`; `verify-mp-auth-block-integration.test.mjs` fails the
   build if a mall service hand-rolls `/auth/*` or `/iam/*`.
2. **Next — commerce client seam.** Construct the commerce app client in
   `@sdkwork/mall-mp-core` (same pattern as the IAM/IM clients, over the host
   `MpHttpClient`) and expose it on the runtime. No service may construct its own
   client or read the SDK directly.
3. **Then — order + cart.** Move `cart-service` and `order-service` onto
   `cart`/`checkout`/`orders`/`payments`; keep the money-path payload builders
   (`buildCheckoutOrderBody`-style) as pure projections so their vitest contracts
   keep guarding them.
4. **Then — catalog + promotion + addresses + after-sales + invoices + wallet +
   membership + shops + partner.** Each migration deletes one raw-request service
   and adds one block-ownership guard.
5. **Finally — retire `src/services/transport.ts`.** Raw request remains only for
   surfaces with no composed block (nothing today) and the app-api envelope helper
   used by the Drive uploader.

## Guard rules (cumulative)

- No `path: "/auth/*"` or `"/iam/*"` outside the generated SDK.
- Feature packages consume domain clients through `@sdkwork/mall-mp-core` exports
  only (`verify-repo` already forbids direct `@sdkwork/iam-app-sdk` imports from
  feature packages).
- Every new mall service must name its owning block in the file header; the
  architecture test rejects a service whose request path is not declared in this
  map.
