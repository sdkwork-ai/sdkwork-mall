import { useEffect, useState } from "react";
import { Crown } from "lucide-react";

import {
  loadMallH5Membership,
  type MallH5MembershipPlan,
  type MallH5MembershipStatus,
} from "../membership-service";

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
      <h1 className="sdk-h5-page-title">会员中心</h1>

      {error ? <div className="sdk-h5-error" role="alert">{error}</div> : null}

      <section className="sdk-h5-banner">
        <Crown aria-hidden="true" size={22} />
        <h1>{status?.levelName ?? "普通会员"}</h1>
        <p>开通会员享专属价、积分回馈与优先客服</p>
      </section>

      <section className="sdk-h5-section">
        <h2>会员方案</h2>
        {plans.length === 0 ? (
          <div className="sdk-h5-empty">暂无可选方案</div>
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
