import {
  createSdkworkMallH5RouteRegistry,
  type SdkworkMallH5RouteContribution,
} from "@sdkwork/mall-h5-core";
import { sdkworkMallH5HomeRoutes } from "@sdkwork/mall-h5-home/routes";
import { sdkworkMallH5CatalogRoutes } from "@sdkwork/mall-h5-catalog/routes";
import { sdkworkMallH5CartRoutes } from "@sdkwork/mall-h5-cart/routes";
import { sdkworkMallH5OrderRoutes } from "@sdkwork/mall-h5-order/routes";
import { sdkworkMallH5AccountRoutes } from "@sdkwork/mall-h5-account/routes";
import { sdkworkMallH5BuyerRoutes } from "@sdkwork/mall-h5-buyer/routes";
import { sdkworkMallH5MembershipRoutes } from "@sdkwork/mall-h5-membership/routes";

const registry = createSdkworkMallH5RouteRegistry([
  ...sdkworkMallH5HomeRoutes,
  ...sdkworkMallH5CatalogRoutes,
  ...sdkworkMallH5CartRoutes,
  ...sdkworkMallH5OrderRoutes,
  ...sdkworkMallH5BuyerRoutes,
  ...sdkworkMallH5AccountRoutes,
  ...sdkworkMallH5MembershipRoutes,
] satisfies readonly SdkworkMallH5RouteContribution[]);

export const sdkworkMallH5Routes = registry.routes;
export type { SdkworkMallH5RouteContribution };
