import { useCallback, useEffect, useState } from "react";

import {
  claimMallH5Coupon,
  listMallH5ClaimableCoupons,
  listMallH5UserCoupons,
  redeemMallH5CouponCode,
  type MallH5ClaimableCoupon,
  type MallH5UserCoupon,
} from "../coupons-service";

export function SdkworkMallH5CouponsPage() {
  const [coupons, setCoupons] = useState<MallH5UserCoupon[]>([]);
  const [claimable, setClaimable] = useState<MallH5ClaimableCoupon[]>([]);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setCoupons(await listMallH5UserCoupons());
    setClaimable(await listMallH5ClaimableCoupons().catch(() => []));
  }, []);

  useEffect(() => {
    let active = true;
    reload()
      .catch((cause: unknown) => {
        if (active) {
          setMessage(cause instanceof Error ? cause.message : "优惠券加载失败");
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

  async function runAction(action: () => Promise<void>, successMessage: string) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage(successMessage);
      await reload();
    } catch (cause: unknown) {
      setMessage(cause instanceof Error ? cause.message : "操作失败");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="sdk-h5-page sdk-h5-loading">加载优惠券...</div>;
  }

  return (
    <div className="sdk-h5-page">
      <h1 className="sdk-h5-page-title">领券中心</h1>

      {message ? <div className="sdk-h5-notice sdk-h5-notice-warning">{message}</div> : null}

      {claimable.length > 0 ? (
        <section className="sdk-h5-section">
          <h2>可领取</h2>
          {claimable.map((coupon) => (
            <div className="sdk-h5-coupon-row" key={coupon.id}>
              <strong>{coupon.title}</strong>
              <button
                className="sdk-h5-button sdk-h5-button-primary"
                disabled={busy}
                onClick={() => void runAction(() => claimMallH5Coupon(coupon.id), "领取成功")}
                type="button"
              >
                领取
              </button>
            </div>
          ))}
        </section>
      ) : null}

      <section className="sdk-h5-section">
        <h2>兑换码</h2>
        <div className="sdk-h5-redeem-row">
          <input
            aria-label="兑换码"
            onChange={(event) => setCode(event.target.value)}
            placeholder="输入兑换码"
            value={code}
          />
          <button
            className="sdk-h5-button sdk-h5-button-secondary"
            disabled={busy || !code.trim()}
            onClick={() => {
              const trimmed = code.trim();
              void runAction(() => redeemMallH5CouponCode(trimmed), "兑换成功").then(() => setCode(""));
            }}
            type="button"
          >
            兑换
          </button>
        </div>
      </section>

      <section className="sdk-h5-section">
        <h2>我的优惠券</h2>
        {coupons.length === 0 ? (
          <div className="sdk-h5-empty">暂无优惠券</div>
        ) : (
          coupons.map((coupon) => (
            <div className="sdk-h5-coupon-row" key={coupon.id}>
              <div>
                <strong>{coupon.title}</strong>
                {coupon.validUntil ? <div className="sdk-h5-muted">有效期至 {coupon.validUntil}</div> : null}
              </div>
              <span className="sdk-h5-muted">{coupon.status}</span>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
