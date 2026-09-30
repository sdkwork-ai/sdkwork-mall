import type { SdkworkMallH5RouteContribution } from "@sdkwork/mall-h5-core";

export const sdkworkMallH5AccountRoutes = [
  {
    auth: "required",
    capability: "account",
    domain: "commerce",
    id: "buyer.mall.wallet",
    packageName: "@sdkwork/mall-h5-account",
    path: "/buyer/wallet",
    screen: "wallet",
    surface: "buyer",
    title: "钱包",
    titleKey: "account.routes.wallet.title",
  },
  {
    auth: "required",
    capability: "account",
    domain: "commerce",
    id: "buyer.mall.points",
    packageName: "@sdkwork/mall-h5-account",
    path: "/buyer/points",
    screen: "points",
    surface: "buyer",
    title: "积分",
    titleKey: "account.routes.points.title",
  },
] as const satisfies readonly SdkworkMallH5RouteContribution[];
