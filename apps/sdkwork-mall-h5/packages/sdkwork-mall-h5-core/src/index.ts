export interface SdkworkMallH5RouteContribution {
  auth: "public" | "required";
  capability: string;
  domain: string;
  id: string;
  packageName: string;
  path: string;
  screen: string;
  surface: "storefront" | "buyer";
  title: string;
  titleKey?: string;
}

export interface SdkworkMallH5RouteRegistry {
  routes: readonly SdkworkMallH5RouteContribution[];
}

export function createSdkworkMallH5RouteRegistry(
  contributions: readonly SdkworkMallH5RouteContribution[],
): SdkworkMallH5RouteRegistry {
  const seenPaths = new Set<string>();
  const seenIds = new Set<string>();
  const routes: SdkworkMallH5RouteContribution[] = [];
  for (const contribution of contributions) {
    if (seenIds.has(contribution.id)) {
      throw new Error(`Duplicate mall H5 route id: ${contribution.id}`);
    }
    if (seenPaths.has(contribution.path)) {
      throw new Error(`Duplicate mall H5 route path: ${contribution.path}`);
    }
    seenIds.add(contribution.id);
    seenPaths.add(contribution.path);
    routes.push(contribution);
  }
  return { routes };
}

export const SDKWORK_MALL_H5_BOTTOM_TAB_ROUTES = [
  { icon: "home", label: "首页", path: "/" },
  { icon: "category", label: "分类", path: "/categories" },
  { icon: "cart", label: "购物车", path: "/cart" },
  { icon: "user", label: "我的", path: "/buyer" },
] as const;
