import type { SdkworkMallPcRouteContribution } from "@sdkwork/mall-pc-core";

export const sdkworkMallPcCouponRoutes = [
  {
    auth: "required",
    capability: "coupon",
    domain: "commerce",
    id: "buyer.mall.coupons",
    packageName: "@sdkwork/mall-pc-coupon",
    path: "/buyer/coupons",
    screen: "dashboard",
    surface: "buyer",
    title: "领券中心",
    titleKey: "coupon.routes.dashboard.title",
  },
] as const satisfies readonly SdkworkMallPcRouteContribution[];
