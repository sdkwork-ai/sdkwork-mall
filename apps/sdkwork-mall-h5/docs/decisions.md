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
- 2026-11-04: the IAM login/register/recovery screens are rendered as a native
  H5 surface instead of a desktop card squeezed into a phone viewport.
  `@sdkwork/auth-pc-react` still owns the flows (controller, validation,
  verification codes, organization selection), but three things are app-owned:
  (1) `src/index.css` declares `@source` roots for the shared auth and UI
  packages — Tailwind v4 only scans this app root, so without them every
  utility class of the auth surface is missing and the screens render with no
  layout at all (the defect this change fixes); (2) `src/bootstrap/
  authAppearance.tsx` binds the mall appearance — brand header, commerce color
  tokens, `--sdk-color-brand-primary`, and the desktop QR/highlight rail hidden
  (`qrLoginEnabled: false`, `leftRailMode: "highlights-only"`) because a phone
  cannot scan its own screen; (3) the `.sdk-mall-auth-*` rules own the mobile
  layout: full-bleed single column with safe-area padding, segmented method
  switcher, inline resend action on the code field, 48px primary action, 16px
  inputs (no iOS focus zoom), focus/invalid field states, a compact rhythm
  under 720px height and a centered card from 640px width up. Migrating to the
  native `@sdkwork/iam-h5-auth` package stays a follow-up; a full login round
  trip in dev additionally needs the bootstrap credential (`SDKWORK_ACCESS_TOKEN`)
  that the dev runner injects, otherwise sign-in fails before dispatch.

