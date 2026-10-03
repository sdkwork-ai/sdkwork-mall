import { useState, useSyncExternalStore, type ReactNode } from "react";
import { matchPath, useLocation, useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  Home,
  LayoutGrid,
  MessageCircle,
  Search,
  ShoppingCart,
  User,
  type LucideIcon,
} from "lucide-react";
import type { SdkworkMallH5RouteContribution } from "@sdkwork/mall-h5-core";
import {
  readMallH5CartCount,
  subscribeMallH5CartCount,
} from "@sdkwork/mall-h5-commons";

export interface SdkworkMallH5ShellRuntime {
  readonly config: {
    readonly appDisplayName: string;
    readonly environment: string;
    readonly version: string;
  };
  readonly routes: readonly SdkworkMallH5RouteContribution[];
}

export interface SdkworkMallH5MobileShellProps {
  children: ReactNode;
  runtime: SdkworkMallH5ShellRuntime;
}

interface ShellTab {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly match: (pathname: string) => boolean;
  readonly path: string;
}

/**
 * JD-order five-tab bar: 首页 / 分类 / 消息 / 购物车 / 我的.
 * Per APP_MOBILE_REACT_UI_SPEC §5 the selected tab must be distinguishable
 * beyond color alone: the same stroke glyph is rendered filled when active
 * (fill="currentColor") on top of the outline form.
 */
const SHELL_TABS: readonly ShellTab[] = [
  {
    icon: Home,
    label: "首页",
    match: (pathname) => pathname === "/" || pathname.startsWith("/activity"),
    path: "/",
  },
  {
    icon: LayoutGrid,
    label: "分类",
    match: (pathname) => pathname.startsWith("/categories") || pathname.startsWith("/product/") || pathname.startsWith("/search"),
    path: "/categories",
  },
  {
    icon: MessageCircle,
    label: "消息",
    match: (pathname) =>
      pathname.startsWith("/buyer/chats") ||
      pathname.startsWith("/buyer/chat") ||
      pathname.startsWith("/buyer/notices") ||
      pathname.startsWith("/buyer/messages"),
    path: "/buyer/chats",
  },
  {
    icon: ShoppingCart,
    label: "购物车",
    match: (pathname) => pathname === "/cart" || pathname.startsWith("/checkout"),
    path: "/cart",
  },
  {
    icon: User,
    label: "我的",
    match: (pathname) =>
      pathname === "/buyer" ||
      (pathname.startsWith("/buyer/") &&
        !pathname.startsWith("/buyer/chats") &&
        !pathname.startsWith("/buyer/chat") &&
        !pathname.startsWith("/buyer/notices") &&
        !pathname.startsWith("/buyer/messages")),
    path: "/buyer",
  },
];

/**
 * Routes that keep the bottom tab bar — exactly the five tab roots above.
 * Per spec, tab-bar visibility is decided once here at shell-layout time,
 * never inside individual screens.
 */
export function isSdkworkMallH5TabBarSurface(pathname: string): boolean {
  return SHELL_TABS.some((tab) => tab.path === pathname);
}

/**
 * Shared secondary-screen navigation bar: back affordance + route title.
 * Titles resolve from the route registry at shell-layout time; pages never
 * assemble their own headers.
 */
export function SdkworkMallH5NavBar({
  onBack,
  right,
  title,
}: {
  onBack?: () => void;
  right?: ReactNode;
  title: string;
}) {
  const navigate = useNavigate();
  return (
    <header className="sdk-h5-navbar">
      <button
        aria-label="返回"
        className="sdk-h5-navbar-back"
        onClick={onBack ?? (() => navigate(-1))}
        type="button"
      >
        <ChevronLeft aria-hidden="true" size={22} />
      </button>
      <strong className="sdk-h5-navbar-title">{title}</strong>
      {right ? <span className="sdk-h5-navbar-right">{right}</span> : null}
    </header>
  );
}

export function SdkworkMallH5MobileShell({ children, runtime }: SdkworkMallH5MobileShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState("");
  const cartRoute = runtime.routes.find((route) => route.id === "storefront.mall.cart");
  const cartTabBadge = useSyncExternalStore(subscribeMallH5CartCount, readMallH5CartCount, () => 0);

  // Chrome is decided once here at shell-layout time (APP_MOBILE_REACT_UI_SPEC §5):
  // - product detail owns a full-bleed surface with floating page chrome;
  // - tab roots keep the search header;
  // - every other (secondary) screen gets the shared back navigation bar.
  const isProductDetail = location.pathname.startsWith("/product/");
  const isTabRoot = isSdkworkMallH5TabBarSurface(location.pathname);
  const matchedRoute = runtime.routes.find((route) =>
    matchPath(route.path, location.pathname),
  );
  const navbarTitle = matchedRoute?.title ?? runtime.config.appDisplayName;

  function handleSearchSubmit() {
    const trimmed = keyword.trim();
    navigate(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search");
  }

  const showTabBar = isTabRoot;

  return (
    <div className="sdk-h5-app">
      {isProductDetail ? null : isTabRoot ? (
        <header className="sdk-h5-topbar">
          <button
            aria-label={runtime.config.appDisplayName}
            className="sdk-h5-topbar-brand"
            onClick={() => navigate("/")}
            type="button"
          >
            商城
          </button>
          <div className="sdk-h5-topbar-search">
            <Search aria-hidden="true" size={16} />
            <input
              aria-label="搜索商品"
              enterKeyHint="search"
              onChange={(event) => setKeyword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleSearchSubmit();
                }
              }}
              placeholder="搜索商品 / 品牌 / 店铺"
              type="search"
              value={keyword}
            />
          </div>
        </header>
      ) : (
        <SdkworkMallH5NavBar title={navbarTitle} />
      )}

      <main className={showTabBar ? "sdk-h5-main" : "sdk-h5-main sdk-h5-main-without-tabbar"}>{children}</main>

      {showTabBar ? (
        <nav aria-label="底部导航" className="sdk-h5-tabbar">
          {SHELL_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = tab.match(location.pathname);
            return (
              <button
                aria-current={active ? "page" : undefined}
                className={active ? "sdk-h5-tab sdk-h5-tab-active" : "sdk-h5-tab"}
                key={tab.path}
                onClick={() => navigate(tab.path)}
                type="button"
              >
                <span className="sdk-h5-tab-icon">
                  <Icon aria-hidden="true" size={22} fill={active ? "currentColor" : "none"} />
                  {tab.path === (cartRoute?.path ?? "/cart") && cartTabBadge > 0 ? (
                    <span className="sdk-h5-tab-badge">{cartTabBadge > 99 ? "99+" : cartTabBadge}</span>
                  ) : null}
                </span>
                {tab.label}
              </button>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}
