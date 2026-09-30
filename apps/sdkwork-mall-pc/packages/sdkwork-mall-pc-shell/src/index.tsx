import type { ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  Crown,
  FileBarChart2,
  Flag,
  Heart,
  HelpCircle,
  KeyRound,
  LayoutDashboard,
  MapPin,
  Megaphone,
  Package,
  ScrollText,
  Search,
  ShieldAlert,
  ShoppingCart,
  Store,
  User,
  Users,
  Wallet,
} from "lucide-react";
import type { SdkworkMallPcRouteContribution } from "@sdkwork/mall-pc-core";
import type { LucideIcon } from "lucide-react";
import {
  sdkworkMallPcBrand,
} from "@sdkwork/mall-pc-commons";
import { sdkworkMallPcCategoryNav } from "@sdkwork/mall-pc-commons/category-nav";

export interface SdkworkMallPcShellRuntime {
  readonly config: {
    readonly appDisplayName: string;
    readonly environment: string;
    readonly version: string;
  };
  readonly routes: readonly SdkworkMallPcRouteContribution[];
}

export interface SdkworkMallPcShellProps {
  readonly children: ReactNode;
  readonly isAuthenticated?: boolean;
  readonly runtime: SdkworkMallPcShellRuntime;
}

export function SdkworkMallPcStorefrontShell({
  children,
  isAuthenticated = false,
  runtime,
}: SdkworkMallPcShellProps) {
  const brandName = runtime.config.appDisplayName || sdkworkMallPcBrand.name;
  const navigate = useNavigate();

  return (
    <div className="sdkwork-mall-pc-storefront">
      <header className="sdkwork-mall-pc-topbar">
        <div className="sdkwork-mall-pc-topbar-inner">
          <Link className="sdkwork-mall-pc-logo" to="/">
            <span className="sdkwork-mall-pc-brand-mark">{sdkworkMallPcBrand.mark}</span>
            <span>{brandName}</span>
          </Link>

          <form
            className="sdkwork-mall-pc-search-form"
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              const query = String(formData.get("q") ?? "").trim();
              navigate(query ? `/search?q=${encodeURIComponent(query)}` : "/search");
            }}
          >
            <Search aria-hidden="true" size={18} />
            <input name="q" placeholder="搜索商品、品牌、店铺" type="search" />
            <button type="submit">搜索</button>
          </form>

          <nav aria-label="用户快捷入口" className="sdkwork-mall-pc-topnav">
            <Link to="/buyer">买家中心</Link>
            <Link to="/buyer/membership">会员中心</Link>
            <Link to="/activity">活动会场</Link>
            <Link to="/buyer/orders">我的订单</Link>
            <Link to="/cart">
              <ShoppingCart aria-hidden="true" size={16} />
              购物车
            </Link>
            <Link to="/buyer/favorites">
              <Heart aria-hidden="true" size={16} />
              收藏
            </Link>
            <Link to="/merchant">商家入驻</Link>
            <Link to="/help">
              <HelpCircle aria-hidden="true" size={16} />
              客服
            </Link>
            {isAuthenticated ? (
              <Link to="/buyer">
                <User aria-hidden="true" size={16} />
                我的账户
              </Link>
            ) : (
              <Link to="/auth/login">
                <User aria-hidden="true" size={16} />
                登录
              </Link>
            )}
          </nav>
        </div>
      </header>

      <div className="sdkwork-mall-pc-category-bar">
        <div className="sdkwork-mall-pc-category-inner">
          <Link className="sdkwork-mall-pc-all-categories" to="/categories">
            <MapPin aria-hidden="true" size={16} />
            全部类目
          </Link>
          {sdkworkMallPcCategoryNav.map((category) => (
            <Link key={category} to={`/search?q=${encodeURIComponent(category)}`}>
              {category}
            </Link>
          ))}
        </div>
      </div>

      <main className="sdkwork-mall-pc-storefront-main">{children}</main>

      <footer className="sdkwork-mall-pc-footer">
        <div className="sdkwork-mall-pc-footer-inner">
          <span>{brandName}</span>
          <span>{runtime.config.environment}</span>
          <span>{runtime.config.version}</span>
        </div>
      </footer>
    </div>
  );
}

export function SdkworkMallPcBuyerShell({
  children,
  runtime,
}: SdkworkMallPcShellProps) {
  const buyerRoutes = runtime.routes.filter((route) => route.surface === "buyer");

  return (
    <div className="sdkwork-mall-pc-console">
      <aside aria-label="买家工作台导航" className="sdkwork-mall-pc-console-rail">
        <Link className="sdkwork-mall-pc-console-brand" to="/">
          <Store aria-hidden="true" size={18} />
          返回商城
        </Link>
        <nav className="sdkwork-mall-pc-console-nav">
          {buyerRoutes.map((route) => (
            <NavLink
              className={({ isActive }) =>
                isActive
                  ? "sdkwork-mall-pc-console-link sdkwork-mall-pc-console-link-active"
                  : "sdkwork-mall-pc-console-link"}
              end
              key={route.id}
              to={route.path}
            >
              {route.title}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="sdkwork-mall-pc-console-main">{children}</main>
    </div>
  );
}

export function SdkworkMallPcMerchantShell({
  children,
  runtime,
}: SdkworkMallPcShellProps) {
  const merchantRoutes = runtime.routes.filter((route) => route.surface === "merchant");

  return (
    <div className="sdkwork-mall-pc-console">
      <aside aria-label="商家工作台导航" className="sdkwork-mall-pc-console-rail sdkwork-mall-pc-merchant-rail">
        <div className="sdkwork-mall-pc-console-brand">
          <Store aria-hidden="true" size={18} />
          商家工作台
        </div>
        <nav className="sdkwork-mall-pc-console-nav">
          {merchantRoutes.map((route) => (
            <NavLink
              className={({ isActive }) =>
                isActive
                  ? "sdkwork-mall-pc-console-link sdkwork-mall-pc-console-link-active"
                  : "sdkwork-mall-pc-console-link"}
              end
              key={route.id}
              to={route.path}
            >
              {route.title}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="sdkwork-mall-pc-console-main">{children}</main>
    </div>
  );
}

interface SdkworkAdminMenuSection {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly routeIds: readonly string[];
}

const SDKWORK_ADMIN_MENU_SECTIONS: readonly SdkworkAdminMenuSection[] = [
  {
    icon: LayoutDashboard,
    label: "总览",
    routeIds: ["admin.mall.dashboard", "admin.mall.reports", "admin.mall.audit"],
  },
  {
    icon: ScrollText,
    label: "内容",
    routeIds: ["admin.mall.cms"],
  },
  {
    icon: Package,
    label: "商品",
    routeIds: ["admin.commerce.product-admin.catalog", "admin.mall.brands"],
  },
  {
    icon: ShoppingCart,
    label: "交易",
    routeIds: ["admin.mall.orders", "admin.mall.after-sales"],
  },
  {
    icon: Megaphone,
    label: "营销",
    routeIds: ["admin.mall.marketing", "admin.commerce.membership-admin.dashboard"],
  },
  {
    icon: Store,
    label: "商家",
    routeIds: ["admin.mall.shops", "admin.mall.settlement"],
  },
  {
    icon: ShieldAlert,
    label: "治理",
    routeIds: [
      "admin.mall.risk",
      "admin.mall.moderation",
      "admin.mall.users",
      "admin.mall.permissions",
    ],
  },
];

const SDKWORK_ADMIN_ROUTE_ICONS: Readonly<Record<string, LucideIcon>> = {
  "admin.mall.dashboard": LayoutDashboard,
  "admin.mall.reports": FileBarChart2,
  "admin.mall.audit": ScrollText,
  "admin.mall.cms": ScrollText,
  "admin.commerce.product-admin.catalog": Package,
  "admin.mall.brands": Package,
  "admin.mall.orders": ShoppingCart,
  "admin.mall.after-sales": ShoppingCart,
  "admin.mall.marketing": Megaphone,
  "admin.commerce.membership-admin.dashboard": Crown,
  "admin.mall.shops": Store,
  "admin.mall.settlement": Wallet,
  "admin.mall.risk": ShieldAlert,
  "admin.mall.moderation": Flag,
  "admin.mall.users": Users,
  "admin.mall.permissions": KeyRound,
};

export function SdkworkMallPcAdminShell({
  children,
  runtime,
}: SdkworkMallPcShellProps) {
  const adminRoutes = runtime.routes.filter((route) => route.surface === "backend-admin");
  const routesById = new Map(adminRoutes.map((route) => [route.id, route]));
  const groupedIds = new Set(SDKWORK_ADMIN_MENU_SECTIONS.flatMap((section) => [...section.routeIds]));
  const ungroupedRoutes = adminRoutes.filter((route) => !groupedIds.has(route.id));

  return (
    <div className="sdkwork-mall-pc-app">
      <aside aria-label="平台管理导航" className="sdkwork-mall-pc-rail">
        <div className="sdkwork-mall-pc-brand">
          <span className="sdkwork-mall-pc-brand-mark">Admin</span>
          <span>平台管理</span>
        </div>
        <nav className="sdkwork-mall-pc-nav">
          {ungroupedRoutes.map((route) => (
            <NavLink
              className={({ isActive }) =>
                isActive
                  ? "sdkwork-mall-pc-nav-link sdkwork-mall-pc-nav-link-active"
                  : "sdkwork-mall-pc-nav-link"}
              end
              key={route.id}
              to={route.path}
            >
              {route.title}
            </NavLink>
          ))}
          {SDKWORK_ADMIN_MENU_SECTIONS.map((section) => {
            const sectionRoutes = section.routeIds
              .map((routeId) => routesById.get(routeId))
              .filter((route): route is SdkworkMallPcRouteContribution => Boolean(route));
            if (sectionRoutes.length === 0) {
              return null;
            }
            const SectionIcon = section.icon;
            return (
              <div className="sdkwork-mall-pc-nav-section" key={section.label}>
                <div
                  className="sdkwork-mall-pc-nav-section-label"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    margin: "0.9rem 0 0.35rem",
                    fontSize: "0.68rem",
                    fontWeight: 600,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "var(--sdk-color-text-muted)",
                  }}
                >
                  <SectionIcon aria-hidden="true" size={13} />
                  {section.label}
                </div>
                {sectionRoutes.map((route) => {
                  const RouteIcon = SDKWORK_ADMIN_ROUTE_ICONS[route.id];
                  return (
                    <NavLink
                      className={({ isActive }) =>
                        isActive
                          ? "sdkwork-mall-pc-nav-link sdkwork-mall-pc-nav-link-active"
                          : "sdkwork-mall-pc-nav-link"}
                      end
                      key={route.id}
                      to={route.path}
                    >
                      {RouteIcon ? (
                        <RouteIcon
                          aria-hidden="true"
                          size={14}
                          style={{ flexShrink: 0, verticalAlign: "-0.18em", marginRight: "0.45rem" }}
                        />
                      ) : null}
                      {route.title}
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </aside>
      <main className="sdkwork-mall-pc-main">{children}</main>
    </div>
  );
}

/** @deprecated Use SdkworkMallPcStorefrontShell */
export function SdkworkMallPcShell(props: SdkworkMallPcShellProps) {
  return <SdkworkMallPcStorefrontShell {...props} />;
}

export function resolveSdkworkMallPcShellKind(pathname: string) {
  if (pathname.startsWith("/admin")) {
    return "backend-admin" as const;
  }
  if (pathname.startsWith("/merchant")) {
    return "merchant" as const;
  }
  if (pathname.startsWith("/buyer")) {
    return "buyer" as const;
  }
  return "storefront" as const;
}

export function SdkworkMallPcSurfaceShell({
  children,
  isAuthenticated = false,
  runtime,
  pathname,
}: SdkworkMallPcShellProps & { readonly pathname: string }) {
  const kind = resolveSdkworkMallPcShellKind(pathname);
  if (kind === "backend-admin") {
    return <SdkworkMallPcAdminShell runtime={runtime}>{children}</SdkworkMallPcAdminShell>;
  }
  if (kind === "merchant") {
    return <SdkworkMallPcMerchantShell runtime={runtime}>{children}</SdkworkMallPcMerchantShell>;
  }
  if (kind === "buyer") {
    return <SdkworkMallPcBuyerShell runtime={runtime}>{children}</SdkworkMallPcBuyerShell>;
  }
  return (
    <SdkworkMallPcStorefrontShell isAuthenticated={isAuthenticated} runtime={runtime}>
      {children}
    </SdkworkMallPcStorefrontShell>
  );
}
