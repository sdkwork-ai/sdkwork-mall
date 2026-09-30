import type { SdkworkMallH5RouteContribution } from "@sdkwork/mall-h5-core";

export const sdkworkMallH5HomeRoutes = [
  {
    auth: "public",
    capability: "home",
    domain: "commerce",
    id: "storefront.mall.home",
    packageName: "@sdkwork/mall-h5-home",
    path: "/",
    screen: "home",
    surface: "storefront",
    title: "首页",
    titleKey: "home.routes.dashboard.title",
  },
] as const satisfies readonly SdkworkMallH5RouteContribution[];
