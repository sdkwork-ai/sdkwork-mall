import type { SdkworkMallH5RouteContribution } from "@sdkwork/mall-h5-core";

export const sdkworkMallH5BuyerRoutes = [
  {
    auth: "required",
    capability: "buyer",
    domain: "commerce",
    id: "buyer.mall.dashboard",
    packageName: "@sdkwork/mall-h5-buyer",
    path: "/buyer",
    screen: "dashboard",
    surface: "buyer",
    title: "我的",
    titleKey: "buyer.routes.dashboard.title",
  },
] as const satisfies readonly SdkworkMallH5RouteContribution[];
