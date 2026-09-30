import type { SdkworkMallH5RouteContribution } from "@sdkwork/mall-h5-core";

export const sdkworkMallH5MembershipRoutes = [
  {
    auth: "required",
    capability: "membership",
    domain: "commerce",
    id: "buyer.mall.membership",
    packageName: "@sdkwork/mall-h5-membership",
    path: "/buyer/membership",
    screen: "membership",
    surface: "buyer",
    title: "会员中心",
    titleKey: "membership.routes.membership.title",
  },
] as const satisfies readonly SdkworkMallH5RouteContribution[];
