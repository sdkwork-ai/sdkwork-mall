import { Link } from "react-router-dom";
import { Clock, Gift, Share2, Star, Ticket, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge, EmptyState, LoadingBlock, Progress, Separator } from "@sdkwork/ui-pc-react";
import { loadMallBuyerDashboardSnapshot } from "../buyer-hub-service";
import {
  formatCny,
  formatDate,
  getOrderStatusLabel,
  orderStatusBadgeVariant,
} from "./buyer-dashboard-shared";

export function SdkworkMallBuyerDashboardPage() {
  const [snapshot, setSnapshot] = useState<Awaited<ReturnType<typeof loadMallBuyerDashboardSnapshot>> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void loadMallBuyerDashboardSnapshot()
      .then((data) => {
        if (active) {
          setSnapshot(data);
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
  }, []);

  if (loading || !snapshot) {
    return <LoadingBlock label="加载买家中心..." />;
  }

  const { activities, availableCoupons, membership, orderStats, pendingAfterSales, recentOrders } = snapshot;
  const growthPercent =
    membership.growthValue != null && membership.nextLevelGrowth != null && membership.nextLevelGrowth > 0
      ? Math.min(100, Math.round((membership.growthValue / membership.nextLevelGrowth) * 100))
      : null;

  return (
    <div className="sdkwork-mall-pc-buyer-dashboard">
      <h1>买家中心</h1>

      <div className="sdkwork-mall-pc-stat-grid">
        <Link to="/buyer/orders?status=pending_payment">
          <span>待付款</span><strong>{orderStats.pendingPayment}</strong>
        </Link>
        <Link to="/buyer/orders?status=pending_shipment">
          <span>待发货</span><strong>{orderStats.pendingShipment}</strong>
        </Link>
        <Link to="/buyer/orders?status=pending_receipt">
          <span>待收货</span><strong>{orderStats.pendingReceipt}</strong>
        </Link>
        <Link to="/buyer/orders?status=completed">
          <span>已完成</span><strong>{orderStats.completed}</strong>
        </Link>
        <Link to="/buyer/orders">
          <span>全部订单</span><strong>{orderStats.totalOrders}</strong>
        </Link>
        <Link to="/buyer/after-sales">
          <span>售后处理中</span><strong>{pendingAfterSales}</strong>
        </Link>
      </div>

      <div className="sdkwork-mall-pc-dashboard-grid">
        <section className="sdkwork-mall-pc-dashboard-card">
          <div className="sdkwork-mall-pc-dashboard-card-header">
            <h2>最近订单</h2>
            <Link to="/buyer/orders">查看全部</Link>
          </div>
          {recentOrders.length === 0 ? (
            <EmptyState description="去逛逛吧" title="暂无订单" />
          ) : (
            <ul className="sdkwork-mall-pc-recent-orders">
              {recentOrders.map((order) => (
                <li key={order.id}>
                  <Link to={`/buyer/orders/${order.id}`} className="sdkwork-mall-pc-recent-order-item">
                    <div className="sdkwork-mall-pc-recent-order-info">
                      <span className="sdkwork-mall-pc-recent-order-title">{order.title}</span>
                      {order.createdAt ? (
                        <span className="sdkwork-mall-pc-recent-order-date">{formatDate(order.createdAt)}</span>
                      ) : null}
                    </div>
                    <div className="sdkwork-mall-pc-recent-order-meta">
                      {order.totalCny != null ? (
                        <span className="sdkwork-mall-pc-recent-order-amount">{formatCny(order.totalCny)}</span>
                      ) : null}
                      <Badge variant={orderStatusBadgeVariant(order.status)}>
                        {getOrderStatusLabel(order.status)}
                      </Badge>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="sdkwork-mall-pc-dashboard-card">
          <div className="sdkwork-mall-pc-dashboard-card-header">
            <h2><Ticket aria-hidden="true" size={16} /> 可用优惠券</h2>
            <Link to="/buyer/coupons">查看全部</Link>
          </div>
          {availableCoupons.length === 0 ? (
            <EmptyState description="领取优惠券后可在此查看" title="暂无可用优惠券" />
          ) : (
            <ul className="sdkwork-mall-pc-coupon-list">
              {availableCoupons.map((coupon) => (
                <li key={coupon.id} className="sdkwork-mall-pc-coupon-item">
                  <div className="sdkwork-mall-pc-coupon-info">
                    <span className="sdkwork-mall-pc-coupon-title">{coupon.title}</span>
                    {coupon.discountText ? (
                      <Badge variant="danger">{coupon.discountText}</Badge>
                    ) : null}
                  </div>
                  {coupon.expiresAt ? (
                    <span className="sdkwork-mall-pc-coupon-expires">
                      <Clock aria-hidden="true" size={12} />
                      {formatDate(coupon.expiresAt)}到期
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="sdkwork-mall-pc-dashboard-card">
          <div className="sdkwork-mall-pc-dashboard-card-header">
            <h2>会员中心</h2>
            <Link to="/buyer/membership">查看详情</Link>
          </div>
          <div className="sdkwork-mall-pc-membership-info">
            <div className="sdkwork-mall-pc-membership-level-row">
              <span className="sdkwork-mall-pc-membership-level-label">当前等级</span>
              <Badge variant="default">{membership.level ?? "普通会员"}</Badge>
            </div>
            {membership.growthValue != null ? (
              <div className="sdkwork-mall-pc-membership-growth">
                <div className="sdkwork-mall-pc-membership-growth-header">
                  <span>成长值</span>
                  <span>{membership.growthValue}{membership.nextLevelGrowth != null ? ` / ${membership.nextLevelGrowth}` : ""}</span>
                </div>
                {growthPercent != null ? (
                  <Progress value={growthPercent} />
                ) : null}
                {membership.nextLevel ? (
                  <span className="sdkwork-mall-pc-membership-next-level">
                    距 {membership.nextLevel} 还需 {Math.max(0, (membership.nextLevelGrowth ?? 0) - membership.growthValue)} 成长值
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

        <section className="sdkwork-mall-pc-dashboard-card">
          <div className="sdkwork-mall-pc-dashboard-card-header">
            <h2><TrendingUp aria-hidden="true" size={16} /> 推荐活动</h2>
            <Link to="/activity">更多活动</Link>
          </div>
          {activities.length === 0 ? (
            <EmptyState description="敬请期待" title="暂无推荐活动" />
          ) : (
            <ul className="sdkwork-mall-pc-activity-recommend-list">
              {activities.map((activity) => (
                <li key={activity.id}>
                  <Link to={`/activity/${activity.id}`} className="sdkwork-mall-pc-activity-recommend-item">
                    <div className="sdkwork-mall-pc-activity-recommend-info">
                      <span className="sdkwork-mall-pc-activity-recommend-title">{activity.title}</span>
                      {activity.description ? (
                        <span className="sdkwork-mall-pc-activity-recommend-desc">{activity.description}</span>
                      ) : null}
                    </div>
                    {activity.endAt ? (
                      <span className="sdkwork-mall-pc-activity-recommend-end">
                        <Clock aria-hidden="true" size={12} />
                        {formatDate(activity.endAt)}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <Separator />

      <div className="sdkwork-mall-pc-quick-links">
        <Link to="/buyer/orders">我的订单</Link>
        <Link to="/buyer/after-sales">售后服务</Link>
        <Link to="/buyer/addresses">收货地址</Link>
        <Link to="/buyer/wallet">我的钱包</Link>
        <Link to="/buyer/points">积分中心</Link>
        <Link to="/buyer/coupons">优惠券</Link>
        <Link to="/buyer/invoices">发票管理</Link>
        <Link to="/buyer/favorites">我的收藏</Link>
        <Link to="/buyer/footprint">浏览足迹</Link>
        <Link to="/buyer/membership">会员中心</Link>
        <Link to="/buyer/distribution"><Share2 aria-hidden="true" size={14} /> 分销中心</Link>
        <Link to="/buyer/reviews"><Star aria-hidden="true" size={14} /> 我的评价</Link>
        <Link to="/buyer/messages">消息中心</Link>
        <Link to="/buyer/profile">个人资料</Link>
        <Link to="/buyer/security">账户与安全</Link>
        <Link to="/buyer/gift-cards"><Gift aria-hidden="true" size={14} /> 礼品卡与红包</Link>
        <Link to="/buyer/settings">设置</Link>
      </div>
    </div>
  );
}
