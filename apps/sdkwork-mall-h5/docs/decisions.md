# H5 Decisions

- 2026-09-30: v1 ships browser runtime only (no Capacitor host package yet).
  Adoption follows APP_H5_ARCHITECTURE_SPEC §8.2 as a follow-up.
- 2026-09-30: console/admin packages are not part of v1; the PC root owns
  operator surfaces.
- 2026-09-30: auth reuses @sdkwork/auth-pc-react + @sdkwork/auth-runtime-pc-react
  (already workspace members). Migrating to sdkwork-iam-h5 auth packages is a
  follow-up.
- 2026-09-30: shop/activity mobile pages are follow-ups; the routes registry
  keeps their ids reserved for parity with the PC root.
- 2026-09-30: buyer mobile surfaces landed for the JD core loop
  (订单/物流/地址/优惠券/售后/发票). Remaining buyer surfaces are tracked
  here: 收藏/足迹 (needs a server-side favorites API; PC root keeps local
  storage today), 会员/钱包/积分 (needs Tier-1 account/membership service
  wiring on mobile), 消息中心 (needs a notification API). Each lands as its
  own change with route ids aligned to the PC registry.
