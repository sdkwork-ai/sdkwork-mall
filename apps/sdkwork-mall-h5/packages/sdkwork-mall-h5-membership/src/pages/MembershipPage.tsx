import { useEffect, useState } from "react";
import { Crown, Headphones, Percent, ShieldCheck, Star } from "lucide-react";

import {
  loadMallH5Membership,
  type MallH5MembershipPlan,
  type MallH5MembershipStatus,
} from "../membership-service";

/** 会员权益展示位（静态权益目录；开通后的动态权益随方案下发）。 */
const MEMBER_BENEFITS = [
  { icon: Percent, title: "会员专属价", description: "会员商品专属优惠价" },
  { icon: Star, title: "积分回馈", description: "下单积分多倍累计" },
  { icon: Headphones, title: "优先客服", description: "专属客服优先接入" },
  { icon: ShieldCheck, title: "售后保障", description: "会员专属售后通道" },
] as const;

export function SdkworkMallH5MembershipPage() {
  const [status, setStatus] = useState<MallH5MembershipStatus | null>(null);
  const [plans, setPlans] = useState<MallH5MembershipPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadMallH5Membership()
      .then((data) => {
        if (active) {
          setStatus(data.status);
          setPlans(data.plans);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "会员信息加载失败");
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

  if (loading) {
    return <div className="sdk-h5-page sdk-h5-loading">加载会员信息...</div>;
  }

  return (
    <div className="sdk-h5-page">
      <h1 className="sdk-h5-visually-hidden">会员中心</h1>

      {error ? <div className="sdk-h5-error" role="alert">{error}</div> : null}

      <section className="sdk-h5-banner">
        <Crown aria-hidden="true" size={22} />
        <h1>{status?.levelName ?? "普通会员"}</h1>
        <p>开通会员享专属价、积分回馈与优先客服</p>
      </section>

      <section className="sdk-h5-section">
        <h2>会员权益</h2>
        <div className="sdk-h5-benefit-grid">
          {MEMBER_BENEFITS.map((benefit) => {
            const Icon = benefit.icon;
            return (
              <div className="sdk-h5-benefit-item" key={benefit.title}>
                <span className="sdk-h5-benefit-icon" aria-hidden="true">
                  <Icon size={18} />
                </span>
                <strong>{benefit.title}</strong>
                <span className="sdk-h5-muted">{benefit.description}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="sdk-h5-section">
        <h2>会员方案</h2>
        {plans.length === 0 ? (
          <div className="sdk-h5-empty">方案即将上线，敬请期待</div>
        ) : (
          plans.map((plan) => (
            <div className="sdk-h5-coupon-row" key={plan.id}>
              <strong>{plan.title}</strong>
              <span className="sdk-h5-muted">购买入口即将开放</span>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
