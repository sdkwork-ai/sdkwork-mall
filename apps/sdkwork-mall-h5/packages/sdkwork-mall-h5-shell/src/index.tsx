import { useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  LayoutGrid,
  Search,
  ShoppingCart,
  User,
  type LucideIcon,
} from "lucide-react";
import type { SdkworkMallH5RouteContribution } from "@sdkwork/mall-h5-core";

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
    icon: ShoppingCart,
    label: "购物车",
    match: (pathname) => pathname.startsWith("/cart") || pathname.startsWith("/checkout") || pathname.startsWith("/payment/"),
    path: "/cart",
  },
  {
    icon: User,
    label: "我的",
    match: (pathname) => pathname.startsWith("/buyer"),
    path: "/buyer",
  },
];

export function SdkworkMallH5MobileShell({ children, runtime }: SdkworkMallH5MobileShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState("");
  const cartRoute = runtime.routes.find((route) => route.id === "storefront.mall.cart");
  const cartTabBadge = readCartBadge();

  function handleSearchSubmit() {
    const trimmed = keyword.trim();
    navigate(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search");
  }

  return (
    <div className="sdk-h5-app">
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

      <main className="sdk-h5-main">{children}</main>

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
                <Icon aria-hidden="true" size={22} />
                {tab.path === (cartRoute?.path ?? "/cart") && cartTabBadge > 0 ? (
                  <span className="sdk-h5-tab-badge">{cartTabBadge > 99 ? "99+" : cartTabBadge}</span>
                ) : null}
              </span>
              {tab.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

const SDKWORK_MALL_H5_CART_COUNT_STORAGE_KEY = "sdkwork-mall-h5-cart-count";

function readCartBadge(): number {
  if (typeof window === "undefined") {
    return 0;
  }
  const raw = window.localStorage.getItem(SDKWORK_MALL_H5_CART_COUNT_STORAGE_KEY);
  if (!raw) {
    return 0;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}
