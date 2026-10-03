# H5 Decisions

- 2026-09-30: v1 ships browser runtime only (no Capacitor host package yet).
  Adoption follows APP_H5_ARCHITECTURE_SPEC §8.2 as a follow-up.
- 2026-09-30: console/admin packages are not part of v1; the PC root owns
  operator surfaces.
- 2026-09-30: auth reuses @sdkwork/auth-pc-react + @sdkwork/auth-runtime-pc-react
  (already workspace members). Migrating to sdkwork-iam-h5 auth packages is a
  follow-up.
- 2026-09-30 (updated): shop and activity mobile pages have landed
  (storefront.mall.shop / storefront.mall.activity-list / -detail), closing
  the public storefront parity with the PC root.
- 2026-09-30: buyer mobile surfaces landed for the JD core loop
  (订单/物流/地址/优惠券/售后/发票). Remaining buyer surfaces are tracked
  here: 收藏/足迹 (needs a server-side favorites API; PC root keeps local
  storage today), 会员/钱包/积分 (needs Tier-1 account/membership service
  wiring on mobile), 消息中心 (needs a notification API). Each lands as its
  own change with route ids aligned to the PC registry.
- 2026-10-03: messaging lands on the sdkwork-im capability. The
  `@sdkwork/im-app-sdk` notifications plane (cursor-paged list + retrieve +
  request submission) is consumed through the generated client created in the
  H5 bootstrap (same dual-token token manager as every other family); a new
  `sdkwork-mall-h5-im` package owns the notices page, customer-service
  conversation list (form follows the im-h5 chat list) and chat room.
  Customer-service message streams ride a single package-local transport seam
  (`im-transport.ts`) over the federation gateway chat endpoints until the IM
  realtime CCP connection is adopted for the mall — adopting it swaps
  send/receive to the websocket without touching pages. Trade events
  (order created / paid / cancelled / received) are delivered as IM
  notifications so 通知与提醒统一走消息管道.
