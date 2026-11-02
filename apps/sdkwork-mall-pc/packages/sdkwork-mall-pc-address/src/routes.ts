import type { SdkworkMallPcRouteContribution } from "@sdkwork/mall-pc-core";

export const sdkworkMallPcAddressRoutes = [
  {
    auth: "required",
    capability: "address",
    domain: "commerce",
    id: "buyer.mall.addresses",
    packageName: "@sdkwork/mall-pc-address",
    path: "/buyer/addresses",
    screen: "addresses",
    surface: "buyer",
    title: "地址管理",
    titleKey: "address.routes.addresses.title",
  },
] as const satisfies readonly SdkworkMallPcRouteContribution[];
