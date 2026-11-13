import type { ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  ChevronRight,
  Crown,
  FileBarChart2,
  Flag,
  Flame,
  Grid2x2,
  Headphones,
  Headset,
  KeyRound,
  LayoutDashboard,
  MapPin,
  Megaphone,
  Package,
  RotateCcw,
  ScrollText,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  Store,
  Truck,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import type { SdkworkMallPcRouteContribution } from "@sdkwork/mall-pc-core";
import type { LucideIcon } from "lucide-react";
import {
  sdkworkMallPcBrand,
} from "@sdkwork/mall-pc-commons";

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

const SDKWORK_MALL_PC_HOT_KEYWORDS = [
  "手机",
  "笔记本",
  "冰箱",
  "跑步机",
  "精华液",
  "坚果",
] as const;

const SDKWORK_MALL_PC_FOOTER_COLUMNS: ReadonlyArray<{
  readonly links: ReadonlyArray<{ readonly label: string; readonly to: string }>;
  readonly title: string;
}> = [
  {
    title: "购物指南",
    links: [
      { label: "购物流程", to: "/help" },
      { label: "会员权益", to: "/buyer/membership" },
      { label: "领券中心", to: "/buyer/coupons" },
      { label: "常见问题", to: "/help" },
    ],
  },
  {
    title: "配送与售后",
    links: [
      { label: "配送说明", to: "/help" },
      { label: "订单查询", to: "/buyer/orders" },
      { label: "退换货服务", to: "/buyer/after-sales" },
      { label: "价格保护", to: "/help" },
    ],
  },
  {
    title: "我的资产",
    links: [
      { label: "我的订单", to: "/buyer/orders" },
      { label: "优惠券", to: "/buyer/coupons" },
      { label: "积分商城", to: "/buyer/points" },
      { label: "发票管理", to: "/buyer/invoices" },
    ],
  },
  {
    title: "商家服务",
    links: [
      { label: "商家入驻", to: "/merchant" },
      { label: "商品管理", to: "/merchant/products" },
      { label: "商家结算", to: "/merchant/settlement" },
      { label: "平台招商", to: "/merchant/onboarding" },
    ],
  },
];

export function SdkworkMallPcStorefrontShell({
  children,
  isAuthenticated = false,
  runtime,
}: SdkworkMallPcShellProps) {
  const brandName = runtime.config.appDisplayName || sdkworkMallPcBrand.name;
  const navigate = useNavigate();

  return (
    <div className="sdkwork-mall-pc-storefront">
      <header className="sdkwork-mall-pc-masthead">
        <div className="sdkwork-mall-pc-masthead-util">
          <div className="sdkwork-mall-pc-container sdkwork-mall-pc-masthead-util-inner">
            <div className="sdkwork-mall-pc-masthead-util-left">
              <MapPin aria-hidden="true" size={13} />
              <span>配送至：全国</span>
              {isAuthenticated ? (
                <span>Hi，欢迎回来</span>
              ) : (
                <>
                  <span>你好，请登录</span>
                  <Link className="sdkwork-mall-pc-masthead-util-accent" to="/auth/login">
                    免费注册
                  </Link>
                </>
              )}
            </div>
            <nav aria-label="快捷服务" className="sdkwork-mall-pc-masthead-util-right">
              <Link to="/buyer/orders">我的订单</Link>
              <Link to="/buyer">买家中心</Link>
              <Link to="/buyer/membership">会员中心</Link>
              <Link to="/merchant">商家入驻</Link>
              <Link to="/help">帮助中心</Link>
              <Link to="/help">
                <Headset aria-hidden="true" size={13} />
                客户服务
              </Link>
            </nav>
          </div>
        </div>

        <div className="sdkwork-mall-pc-masthead-main">
          <div className="sdkwork-mall-pc-container sdkwork-mall-pc-masthead-main-inner">
            <Link aria-label={`${brandName}首页`} className="sdkwork-mall-pc-masthead-brand" to="/">
              <span aria-hidden="true" className="sdkwork-mall-pc-masthead-brand-mark">
                商
              </span>
              <span className="sdkwork-mall-pc-masthead-brand-copy">
                <strong>SDKWork</strong>
                <span>商城</span>
              </span>
            </Link>

            <div className="sdkwork-mall-pc-masthead-search">
              <form
                className="sdkwork-mall-pc-masthead-search-box"
                onSubmit={(event) => {
                  event.preventDefault();
                  const formData = new FormData(event.currentTarget);
                  const query = String(formData.get("q") ?? "").trim();
                  navigate(query ? `/search?q=${encodeURIComponent(query)}` : "/search");
                }}
                role="search"
              >
                <Search aria-hidden="true" size={17} />
                <input
                  aria-label="搜索商品、品牌、店铺"
                  autoComplete="off"
                  name="q"
                  placeholder="搜索商品 / 品牌 / 店铺"
                  type="search"
                />
                <button type="submit">搜索</button>
              </form>
              <div className="sdkwork-mall-pc-masthead-search-hints">
                <span>热搜</span>
                {SDKWORK_MALL_PC_HOT_KEYWORDS.map((keyword) => (
                  <Link key={keyword} to={`/search?q=${encodeURIComponent(keyword)}`}>
                    {keyword}
                  </Link>
                ))}
              </div>
            </div>

            <div className="sdkwork-mall-pc-masthead-actions">
              <Link className="sdkwork-mall-pc-masthead-cart" to="/cart">
                <ShoppingCart aria-hidden="true" size={16} />
                <span>购物车</span>
                <ChevronRight aria-hidden="true" size={13} />
              </Link>
              <Link
                className="sdkwork-mall-pc-masthead-account"
                to={isAuthenticated ? "/buyer" : "/auth/login"}
              >
                <UserRound aria-hidden="true" size={16} />
                <span>{isAuthenticated ? "我的账户" : "登录 / 注册"}</span>
              </Link>
            </div>
          </div>
        </div>

        <div className="sdkwork-mall-pc-masthead-nav">
          <div className="sdkwork-mall-pc-container sdkwork-mall-pc-masthead-nav-inner">
            <Link className="sdkwork-mall-pc-masthead-all" to="/categories">
              <Grid2x2 aria-hidden="true" size={16} />
              全部商品分类
            </Link>
            <nav aria-label="商品频道" className="sdkwork-mall-pc-masthead-links">
              <Link to="/activity">
                <Flame aria-hidden="true" size={14} />
                限时秒杀
              </Link>
              <Link to="/search?q=brand">品牌闪购</Link>
              <Link to="/buyer/membership">
                <Crown aria-hidden="true" size={14} />
                会员日
              </Link>
              <Link to="/search?q=new">新品首发</Link>
              <Link to="/search?q=家电">家电馆</Link>
              <Link to="/search?q=生鲜">生鲜直供</Link>
              <Link to="/merchant">商家服务</Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="sdkwork-mall-pc-storefront-main">{children}</main>

      <footer className="sdkwork-mall-pc-footer">
        <div className="sdkwork-mall-pc-footer-promise">
          <div className="sdkwork-mall-pc-container sdkwork-mall-pc-footer-promise-inner">
            {[
              { icon: ShieldCheck, title: "正品保障", desc: "官方自营 · 品牌直供" },
              { icon: Truck, title: "极速配送", desc: "多仓直发 · 次日可达" },
              { icon: RotateCcw, title: "无忧退换", desc: "7 天无理由退换货" },
              { icon: Headphones, title: "专属客服", desc: "7×24 小时在线答疑" },
            ].map((item) => (
              <div className="sdkwork-mall-pc-footer-promise-item" key={item.title}>
                <span className="sdkwork-mall-pc-footer-promise-icon">
                  <item.icon aria-hidden="true" size={20} />
                </span>
                <span className="sdkwork-mall-pc-footer-promise-copy">
                  <strong>{item.title}</strong>
                  <span>{item.desc}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="sdkwork-mall-pc-container sdkwork-mall-pc-footer-main-inner">
          <div className="sdkwork-mall-pc-footer-brand">
            <div className="sdkwork-mall-pc-footer-brand-lockup">
              <span aria-hidden="true" className="sdkwork-mall-pc-footer-brand-mark">
                商
              </span>
              <span className="sdkwork-mall-pc-footer-brand-name">
                <strong>SDKWork</strong>
                <span>商城</span>
              </span>
            </div>
            <p>
              面向品质生活消费者，聚合平台自营与品牌旗舰商家，提供正品保障、
              极速配送与 7 天无理由退换服务。
            </p>
            <div className="sdkwork-mall-pc-footer-badges">
              <span>
                <ShieldCheck aria-hidden="true" size={12} />
                正品保障
              </span>
              <span>
                <Truck aria-hidden="true" size={12} />
                极速发货
              </span>
            </div>
          </div>

          {SDKWORK_MALL_PC_FOOTER_COLUMNS.map((column) => (
            <nav
              aria-label={column.title}
              className="sdkwork-mall-pc-footer-col"
              key={column.title}
            >
              <h3>{column.title}</h3>
              {column.links.map((link) => (
                <Link key={`${column.title}-${link.label}`} to={link.to}>
                  {link.label}
                </Link>
              ))}
            </nav>
          ))}
        </div>

        <div className="sdkwork-mall-pc-footer-bottom">
          <div className="sdkwork-mall-pc-container sdkwork-mall-pc-footer-bottom-inner">
            <span>
              © {new Date().getFullYear()} SDKWork 商城 · 品质生活，一站购齐
            </span>
            <span className="sdkwork-mall-pc-footer-bottom-meta">
              <span>{runtime.config.environment}</span>
              <span>v{runtime.config.version}</span>
            </span>
          </div>
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
