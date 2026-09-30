import type { SdkworkMallH5RouteContribution } from "@sdkwork/mall-h5-core";

export const sdkworkMallH5ActivityRoutes = [
  {
    auth: "public",
    capability: "activity",
    domain: "commerce",
    id: "storefront.mall.activity-list",
    packageName: "@sdkwork/mall-h5-activity",
    path: "/activity",
    screen: "activity-list",
    surface: "storefront",
    title: "活动会场",
    titleKey: "activity.routes.list.title",
  },
  {
    auth: "public",
    capability: "activity",
    domain: "commerce",
    id: "storefront.mall.activity-detail",
    packageName: "@sdkwork/mall-h5-activity",
    path: "/activity/:eventId",
    screen: "activity-detail",
    surface: "storefront",
    title: "活动详情",
    titleKey: "activity.routes.detail.title",
  },
] as const satisfies readonly SdkworkMallH5RouteContribution[];
