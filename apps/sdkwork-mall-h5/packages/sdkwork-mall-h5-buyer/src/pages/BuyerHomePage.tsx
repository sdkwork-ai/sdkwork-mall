import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
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
  Share2,
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
import { SdkworkMallH5ErrorState } from "@sdkwork/mall-h5-commons/error-state";

const EMPTY_SESSION: SdkworkMallH5SessionSnapshot = {};

const ORDER_ENTRIES: Array<{ code: "all" | MallH5OrderStatus; labelKey: string }> = [
  { code: "all", labelKey: "buyerHub.orders.all" },
  { code: "pending-payment", labelKey: "buyerHub.orders.pendingPayment" },
  { code: "pending-shipment", labelKey: "buyerHub.orders.pendingShipment" },
  { code: "pending-receipt", labelKey: "buyerHub.orders.pendingReceipt" },
  { code: "completed", labelKey: "buyerHub.orders.completed" },
];

/** 我的资产：钱包 / 积分 / 会员 — list rows with chevrons (JD-order parity
 * with the Flutter 我的资产 card). */
const ASSET_ENTRIES = [
  { icon: Wallet, labelKey: "buyerHub.assets.wallet", path: "/buyer/wallet" },
  { icon: Star, labelKey: "buyerHub.assets.points", path: "/buyer/points" },
  { icon: Crown, labelKey: "buyerHub.assets.membership", path: "/buyer/membership" },
] as const;

/** 常用服务：clean 2×4 grid (the flat 11-item grid wrapped awkwardly). */
const TOOL_LINKS = [
  { icon: MapPin, labelKey: "buyerHub.services.addresses", path: "/buyer/addresses" },
  { icon: Ticket, labelKey: "buyerHub.services.coupons", path: "/buyer/coupons" },
  { icon: FileText, labelKey: "buyerHub.services.afterSales", path: "/buyer/after-sales" },
  { icon: Receipt, labelKey: "buyerHub.services.invoices", path: "/buyer/invoices" },
  { icon: Heart, labelKey: "buyerHub.services.favorites", path: "/buyer/favorites" },
  { icon: History, labelKey: "buyerHub.services.footprint", path: "/buyer/footprint" },
  { icon: Bell, labelKey: "buyerHub.services.messages", path: "/buyer/messages" },
  { icon: MessageSquare, labelKey: "buyerHub.services.chats", path: "/buyer/chats" },
] as const;

/** 账户：personal data, reviews, gift cards, security, support (PC parity). */
const ACCOUNT_ENTRIES = [
  { icon: UserRound, labelKey: "buyerHub.account.profile", path: "/buyer/profile" },
  { icon: Share2, labelKey: "buyerHub.account.partner", path: "/buyer/distribution" },
  { icon: PenLine, labelKey: "buyerHub.account.reviews", path: "/buyer/reviews" },
  { icon: Gift, labelKey: "buyerHub.account.giftCards", path: "/buyer/gift-cards" },
  { icon: ShieldCheck, labelKey: "buyerHub.account.security", path: "/buyer/security" },
  { icon: Settings, labelKey: "buyerHub.account.settings", path: "/buyer/settings" },
  { icon: LifeBuoy, labelKey: "buyerHub.account.help", path: "/help" },
] as const;

export function SdkworkMallH5BuyerHomePage() {
  const { t } = useTranslation();
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
          setError(cause instanceof Error ? cause.message : t("buyerHub.loadFailed"));
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
  }, [reload, t]);

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
      <h1 className="sdk-h5-visually-hidden">{t("buyerHub.title")}</h1>
      <section className="sdk-h5-buyer-hero">
        <div className="sdk-h5-buyer-avatar" aria-hidden="true">{displayName.slice(0, 1)}</div>
        <div>
          <strong>{displayName}</strong>
          <p>
            {loading
              ? t("buyerHub.loading")
              : error
                ? t("buyerHub.loginHint")
                : t("buyerHub.greeting")}
          </p>
        </div>
        <button className="sdk-h5-buyer-logout" onClick={handleLogout} type="button">
          <LogOut aria-hidden="true" size={14} /> {t("buyerHub.logout")}
        </button>
      </section>

      {error ? <SdkworkMallH5ErrorState message={error} /> : null}

      <section className="sdk-h5-section">
        <h2>{t("buyerHub.orders.title")}</h2>
        <div className="sdk-h5-order-entries">
          {ORDER_ENTRIES.map((entry) => (
            <Link
              className="sdk-h5-order-entry"
              key={entry.code}
              to={entry.code === "all" ? "/buyer/orders" : `/buyer/orders?status=${entry.code}`}
            >
              <PackageSearch aria-hidden="true" size={18} />
              <span>{t(entry.labelKey)}</span>
              <strong>{entryCount(entry.code)}</strong>
            </Link>
          ))}
        </div>
      </section>

      <section className="sdk-h5-section">
        <h2>{t("buyerHub.assets.title")}</h2>
        <div className="sdk-h5-asset-list">
          {ASSET_ENTRIES.map((entry) => {
            const Icon = entry.icon;
            return (
              <Link className="sdk-h5-asset-row" key={entry.labelKey} to={entry.path}>
                <span className="sdk-h5-asset-icon" aria-hidden="true">
                  <Icon size={18} />
                </span>
                <span className="sdk-h5-asset-label">{t(entry.labelKey)}</span>
                <ChevronRight aria-hidden="true" size={16} />
              </Link>
            );
          })}
        </div>
      </section>

      <section className="sdk-h5-section">
        <h2>{t("buyerHub.services.title")}</h2>
        <div className="sdk-h5-quick-grid">
          {TOOL_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <Link className="sdk-h5-quick-grid-item" key={link.labelKey} to={link.path}>
                <Icon aria-hidden="true" size={20} />
                <span>{t(link.labelKey)}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="sdk-h5-section">
        <h2>{t("buyerHub.account.title")}</h2>
        <div className="sdk-h5-asset-list">
          {ACCOUNT_ENTRIES.map((entry) => {
            const Icon = entry.icon;
            return (
              <Link className="sdk-h5-asset-row" key={entry.labelKey} to={entry.path}>
                <span className="sdk-h5-asset-icon" aria-hidden="true">
                  <Icon size={18} />
                </span>
                <span className="sdk-h5-asset-label">{t(entry.labelKey)}</span>
                <ChevronRight aria-hidden="true" size={16} />
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
