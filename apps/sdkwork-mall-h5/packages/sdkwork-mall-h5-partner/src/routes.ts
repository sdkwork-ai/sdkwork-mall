import type { SdkworkMallH5RouteContribution } from "@sdkwork/mall-h5-core";

export const sdkworkMallH5PartnerRoutes = [
  {
    auth: "required",
    capability: "partner",
    domain: "commerce",
    id: "buyer.mall.distribution",
    packageName: "@sdkwork/mall-h5-partner",
    path: "/buyer/distribution",
    screen: "dashboard",
    surface: "buyer",
    title: "分销中心",
    titleKey: "partner.routes.dashboard.title",
  },
] as const satisfies readonly SdkworkMallH5RouteContribution[];
