import type { SdkworkMallH5RouteContribution } from "@sdkwork/mall-h5-core";

export const sdkworkMallH5ShopRoutes = [
  {
    auth: "public",
    capability: "shop",
    domain: "commerce",
    id: "storefront.mall.shop",
    packageName: "@sdkwork/mall-h5-shop",
    path: "/shop/:shopId",
    screen: "shop",
    surface: "storefront",
    title: "店铺",
    titleKey: "shop.routes.shop.title",
  },
] as const satisfies readonly SdkworkMallH5RouteContribution[];
