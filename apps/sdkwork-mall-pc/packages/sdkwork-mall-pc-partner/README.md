# @sdkwork/mall-pc-partner

PC distribution centre (分销中心) for the mall buyer surface.

- Route: `buyer.mall.distribution` → `/buyer/distribution` (auth required).
- Data: `@sdkwork/mall-partner-service` over the composed
  `@sdkwork/partner-app-sdk`; the runtime service is injected by the app
  bootstrap through `configureSdkworkPartnerServiceProvider`.
- Presentation: status hero, team/earnings projection (optional port), invite
  validation and share link, level catalogue, join application form, and
  application history.
- Copy: bilingual typed catalogue in `src/partner-copy.ts`; components never
  hard-code user-facing strings.

## Extension point

When the partner app API publishes self-service read models, supply a
`SdkworkPartnerCenterPort` to `createSdkworkMallPartnerService`. The
`SdkworkPartnerCenterSection` already renders the projection; no component
change is required.

## Verification

```bash
pnpm --filter @sdkwork/mall-pc-partner typecheck
```
