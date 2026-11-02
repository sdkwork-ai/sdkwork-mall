import type { SdkworkMallPcRouteContribution } from "@sdkwork/mall-pc-core";

export const sdkworkMallPcWalletRoutes = [
  {
    auth: "required",
    capability: "wallet",
    domain: "commerce",
    id: "buyer.mall.wallet",
    packageName: "@sdkwork/mall-pc-wallet",
    path: "/buyer/wallet",
    screen: "dashboard",
    surface: "buyer",
    title: "钱包",
    titleKey: "wallet.routes.dashboard.title",
  },
] as const satisfies readonly SdkworkMallPcRouteContribution[];
