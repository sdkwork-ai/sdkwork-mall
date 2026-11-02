# @sdkwork/mall-partner-service

Headless distribution (分销) domain service for every mall client root.

## Responsibility

- Owns the distribution vocabulary: partner program, level catalogue, join
  application lifecycle, invite-code preview, membership resolution.
- Owns one inbound port (`SdkworkPartnerJoinPort`) and one optional outbound
  port (`SdkworkPartnerCenterPort` for team/customer/commission/withdrawal
  projections).
- Adapts the composed `@sdkwork/partner-app-sdk` to the inbound port. No other
  package in the mall imports the partner SDK.

## Why the center port is optional

The partner capability's app API currently publishes the join program only
(`partnerJoin.*`). Team, customer, commission and withdrawal self-service read
models are a separate partner capability contract. Keeping that surface behind
an optional port means the distribution centre can ship the join journey now,
and gain team management later by supplying a port implementation — without
changing a single presentational component (open/closed principle).

## Verification

```bash
pnpm --filter @sdkwork/mall-partner-service typecheck
```
