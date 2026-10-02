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
  {
    auth: "public",
    capability: "tv",
    domain: "commerce",
    id: "storefront.mall.tv",
    packageName: "@sdkwork/mall-h5-home",
    path: "/tv",
    screen: "tv",
    surface: "storefront",
    title: "电视购物",
    titleKey: "home.routes.tv.title",
  },
] as const satisfies readonly SdkworkMallH5RouteContribution[];
