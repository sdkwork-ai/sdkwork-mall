import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CreditCard,
  Crown,
  FileText,
  Heart,
  History,
  MapPin,
  MessageSquare,
  PackageSearch,
  Receipt,
  Star,
  Ticket,
} from "lucide-react";

import {
  loadMallH5BuyerDashboard,
  type MallH5OrderDashboard,
  type MallH5OrderStatus,
} from "../buyer-service";

const ORDER_ENTRIES: Array<{ code: "all" | MallH5OrderStatus; label: string }> = [
  { code: "all", label: "全部订单" },
  { code: "pending-payment", label: "待付款" },
  { code: "pending-shipment", label: "待发货" },
  { code: "pending-receipt", label: "待收货" },
  { code: "completed", label: "已完成" },
];

const QUICK_LINKS = [
  { icon: MapPin, label: "地址管理", path: "/buyer/addresses" },
  { icon: Ticket, label: "领券中心", path: "/buyer/coupons" },
  { icon: FileText, label: "售后", path: "/buyer/after-sales" },
  { icon: Receipt, label: "发票", path: "/buyer/invoices" },
  { icon: CreditCard, label: "钱包", path: "/buyer/wallet" },
  { icon: Star, label: "积分", path: "/buyer/points" },
  { icon: Crown, label: "会员", path: "/buyer/membership" },
  { icon: Heart, label: "收藏", path: "/buyer/favorites" },
  { icon: History, label: "足迹", path: "/buyer/footprint" },
  { icon: MessageSquare, label: "消息", path: "/buyer/messages" },
] as const;

export function SdkworkMallH5BuyerHomePage() {
  const [dashboard, setDashboard] = useState<MallH5OrderDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="sdk-h5-page">
      <section className="sdk-h5-buyer-hero">
        <div className="sdk-h5-buyer-avatar" aria-hidden="true">客</div>
        <div>
          <strong>SDKWork 用户</strong>
          <p>{loading ? "加载中..." : error ? "登录后同步订单信息" : "欢迎回来"}</p>
        </div>
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
        <h2>常用服务</h2>
        <div className="sdk-h5-quick-grid">
          {QUICK_LINKS.map((link) => {
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
    </div>
  );
}
