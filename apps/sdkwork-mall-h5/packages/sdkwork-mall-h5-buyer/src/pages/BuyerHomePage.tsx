import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Bell,
  ChevronRight,
  Crown,
  FileText,
  Gift,
  Heart,
  History,
  LifeBuoy,
  LogOut,
  MapPin,
  MessageSquare,
  PackageSearch,
  PenLine,
  Receipt,
  Settings,
  ShieldCheck,
  Star,
  Ticket,
  UserRound,
  Wallet,
} from "lucide-react";

import {
  loadMallH5BuyerDashboard,
  type MallH5OrderDashboard,
  type MallH5OrderStatus,
} from "../buyer-service";
import {
  getSdkworkMallH5SessionStore,
  readSdkworkMallH5SessionDisplayName,
  type SdkworkMallH5SessionSnapshot,
} from "@sdkwork/mall-h5-core/session";

const EMPTY_SESSION: SdkworkMallH5SessionSnapshot = {};

const ORDER_ENTRIES: Array<{ code: "all" | MallH5OrderStatus; label: string }> = [
  { code: "all", label: "全部订单" },
  { code: "pending-payment", label: "待付款" },
  { code: "pending-shipment", label: "待发货" },
  { code: "pending-receipt", label: "待收货" },
  { code: "completed", label: "已完成" },
];

/** 我的资产：钱包 / 积分 / 会员 — list rows with chevrons (JD-order parity
 * with the Flutter 我的资产 card). */
const ASSET_ENTRIES = [
  { icon: Wallet, label: "钱包", path: "/buyer/wallet" },
  { icon: Star, label: "积分", path: "/buyer/points" },
  { icon: Crown, label: "会员", path: "/buyer/membership" },
] as const;

/** 常用服务：clean 2×4 grid (the flat 11-item grid wrapped awkwardly). */
const TOOL_LINKS = [
  { icon: MapPin, label: "地址管理", path: "/buyer/addresses" },
  { icon: Ticket, label: "领券中心", path: "/buyer/coupons" },
  { icon: FileText, label: "售后", path: "/buyer/after-sales" },
  { icon: Receipt, label: "发票", path: "/buyer/invoices" },
  { icon: Heart, label: "收藏", path: "/buyer/favorites" },
  { icon: History, label: "足迹", path: "/buyer/footprint" },
  { icon: Bell, label: "消息中心", path: "/buyer/messages" },
  { icon: MessageSquare, label: "客服会话", path: "/buyer/chats" },
] as const;

/** 账户：personal data, reviews, gift cards, security, support (PC parity). */
const ACCOUNT_ENTRIES = [
  { icon: UserRound, label: "个人资料", path: "/buyer/profile" },
  { icon: PenLine, label: "我的评价", path: "/buyer/reviews" },
  { icon: Gift, label: "礼品卡与红包", path: "/buyer/gift-cards" },
  { icon: ShieldCheck, label: "账户与安全", path: "/buyer/security" },
  { icon: Settings, label: "设置", path: "/buyer/settings" },
  { icon: LifeBuoy, label: "帮助中心", path: "/help" },
] as const;

export function SdkworkMallH5BuyerHomePage() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<MallH5OrderDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sessionStore = getSdkworkMallH5SessionStore();
  const session = useSyncExternalStore(
    sessionStore?.subscribe ?? (() => () => {}),
    sessionStore?.getSnapshot ?? (() => EMPTY_SESSION),
    () => EMPTY_SESSION,
  );
  const displayName = readSdkworkMallH5SessionDisplayName(session);
  const userId = session.context?.userId ?? "";

  const reload = useCallback(async () => {
    const data = await loadMallH5BuyerDashboard();
    setDashboard(data);
  }, []);

  useEffect(() => {
    let active = true;
    reload()
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "加载失败");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [reload]);

  const entryCount = (code: "all" | MallH5OrderStatus): number => {
    const statistics = dashboard?.statistics;
    if (!statistics) {
      return 0;
    }
    switch (code) {
      case "pending-payment": return statistics.pendingPayment;
      case "pending-shipment": return statistics.pendingShipment;
      case "pending-receipt": return statistics.pendingReceipt;
      case "completed": return statistics.completed;
      default: return statistics.totalOrders;
    }
  };

  function handleLogout() {
    sessionStore?.clearSession();
    navigate("/auth/login");
  }

  return (
    <div className="sdk-h5-page">
      <section className="sdk-h5-buyer-hero">
        <div className="sdk-h5-buyer-avatar" aria-hidden="true">{displayName.slice(0, 1)}</div>
        <div>
          <strong>{displayName}</strong>
          <p>{loading ? "加载中..." : error ? "登录后同步订单信息" : "欢迎回来"}</p>
        </div>
        <button className="sdk-h5-buyer-logout" onClick={handleLogout} type="button">
          <LogOut aria-hidden="true" size={14} /> 退出登录
        </button>
      </section>

      {error ? <div className="sdk-h5-error" role="alert">{error}</div> : null}

      <section className="sdk-h5-section">
        <h2>我的订单</h2>
        <div className="sdk-h5-order-entries">
          {ORDER_ENTRIES.map((entry) => (
            <Link
              className="sdk-h5-order-entry"
              key={entry.code}
              to={entry.code === "all" ? "/buyer/orders" : `/buyer/orders?status=${entry.code}`}
            >
              <PackageSearch aria-hidden="true" size={18} />
              <span>{entry.label}</span>
              <strong>{entryCount(entry.code)}</strong>
            </Link>
          ))}
        </div>
      </section>

      <section className="sdk-h5-section">
        <h2>我的资产</h2>
        <div className="sdk-h5-asset-list">
          {ASSET_ENTRIES.map((entry) => {
            const Icon = entry.icon;
            return (
              <Link className="sdk-h5-asset-row" key={entry.label} to={entry.path}>
                <span className="sdk-h5-asset-icon" aria-hidden="true">
                  <Icon size={18} />
                </span>
                <span className="sdk-h5-asset-label">{entry.label}</span>
                <ChevronRight aria-hidden="true" size={16} />
              </Link>
            );
          })}
        </div>
      </section>

      <section className="sdk-h5-section">
        <h2>常用服务</h2>
        <div className="sdk-h5-quick-grid">
          {TOOL_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <Link className="sdk-h5-quick-grid-item" key={link.label} to={link.path}>
                <Icon aria-hidden="true" size={20} />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="sdk-h5-section">
        <h2>账户</h2>
        <div className="sdk-h5-asset-list">
          {ACCOUNT_ENTRIES.map((entry) => {
            const Icon = entry.icon;
            return (
              <Link className="sdk-h5-asset-row" key={entry.label} to={entry.path}>
                <span className="sdk-h5-asset-icon" aria-hidden="true">
                  <Icon size={18} />
                </span>
                <span className="sdk-h5-asset-label">{entry.label}</span>
                <ChevronRight aria-hidden="true" size={16} />
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
