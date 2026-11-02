# @sdkwork/mall-h5-partner

Mobile-web distribution centre (分销中心) for the mall buyer surface.

- Route: `buyer.mall.distribution` → `/buyer/distribution` (auth required).
- Data: the same `@sdkwork/mall-partner-service` port and controller as the PC
  root, injected by the H5 bootstrap through
  `configureSdkworkH5PartnerServiceProvider`.
- Copy: `apps/sdkwork-mall-h5/src/i18n/zh-CN/account/partner/messages.json`,
  resolved by the H5 i18next runtime.

The page renders the partner-center projection when the optional port is
available and an explicit "read model pending" state otherwise; it never fakes
team or commission data.

## Verification

```bash
pnpm --filter @sdkwork/mall-h5-partner typecheck
```
