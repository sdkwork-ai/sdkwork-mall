import type { SdkworkMallPcRouteContribution } from "@sdkwork/mall-pc-core";

export const sdkworkMallPcPartnerRoutes = [
  {
    auth: "required",
    capability: "partner",
    domain: "commerce",
    id: "buyer.mall.distribution",
    packageName: "@sdkwork/mall-pc-partner",
    path: "/buyer/distribution",
    screen: "dashboard",
    surface: "buyer",
    title: "分销中心",
    titleKey: "partner.routes.dashboard.title",
  },
] as const satisfies readonly SdkworkMallPcRouteContribution[];
