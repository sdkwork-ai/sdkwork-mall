import type { SdkworkMallPcRouteContribution } from "@sdkwork/mall-pc-core";

export const sdkworkMallPcInvoiceRoutes = [
  {
    auth: "required",
    capability: "invoice",
    domain: "commerce",
    id: "buyer.mall.invoices",
    packageName: "@sdkwork/mall-pc-invoice",
    path: "/buyer/invoices",
    screen: "dashboard",
    surface: "buyer",
    title: "发票",
    titleKey: "invoice.routes.dashboard.title",
  },
] as const satisfies readonly SdkworkMallPcRouteContribution[];
