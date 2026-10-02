import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import {
  listMallH5Addresses,
  listMallH5PaymentMethods,
  listMallH5SelectableCoupons,
  MALL_H5_CHECKOUT_WARNINGS_STORAGE_KEY,
  submitMallH5CheckoutOrder,
  type MallH5AddressOption,
  type MallH5CheckoutQuote,
  type MallH5PaymentMethodOption,
  type MallH5SelectableCoupon,
} from "../cart-service";

function parseCartItemIds(rawItems: string | null): string[] {
  if (!rawItems) {
    return [];
  }
  return rawItems
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export function SdkworkMallH5CheckoutPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const cartItemIds = useMemo(() => parseCartItemIds(searchParams.get("items")), [searchParams]);
  const [addresses, setAddresses] = useState<MallH5AddressOption[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<MallH5PaymentMethodOption[]>([]);
  const [coupons, setCoupons] = useState<MallH5SelectableCoupon[]>([]);
  const [quote, setQuote] = useState<MallH5CheckoutQuote | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [selectedMethodCode, setSelectedMethodCode] = useState("");
  const [selectedCouponId, setSelectedCouponId] = useState("");
  const [useWallet, setUseWallet] = useState(false);
  const [usePoints, setUsePoints] = useState(false);
  const [buyerRemark, setBuyerRemark] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const addressesTask = listMallH5Addresses()
      .then((rows) => {
        if (!active) {
          return;
        }
        setAddresses(rows);
        const fallback = rows.find((row) => row.isDefault) ?? rows[0];
        if (fallback) {
          setSelectedAddressId(fallback.id);
        }
      })
      .catch(() => {
        // 地址为可选增强，失败时允许不选。
      });
    const methodsTask = listMallH5PaymentMethods()
      .then((rows) => {
        if (!active) {
          return;
        }
        setPaymentMethods(rows);
        if (rows[0]) {
          setSelectedMethodCode(rows[0].code);
        }
      })
      .catch(() => {
        // 支付方式加载失败时提交前再校验。
      });
    const couponsTask = listMallH5SelectableCoupons()
      .then((rows) => {
        if (active) {
          setCoupons(rows);
        }
      })
      .catch(() => {
        // 优惠券为可选增强，加载失败时不阻塞结算。
      });
    const quoteTask = import("../cart-service")
      .then((module) => module.createMallH5CheckoutQuote({ cartItemIds }))
      .then((checkoutQuote) => {
        if (active) {
          setQuote(checkoutQuote);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setMessage(cause instanceof Error ? cause.message : "结算报价加载失败");
        }
      });

    void Promise.allSettled([addressesTask, methodsTask, couponsTask, quoteTask]).finally(() => {
      if (active) {
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [cartItemIds]);

  const payableAmount = useMemo(() => quote?.payableAmountCny ?? null, [quote]);
  const selectedCoupon = coupons.find((coupon) => coupon.id === selectedCouponId) ?? null;

  async function handleSubmit() {
    if (!selectedAddressId) {
      setMessage("请选择收货地址");
      return;
    }
    if (!selectedMethodCode) {
      setMessage("请选择支付方式");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const result = await submitMallH5CheckoutOrder({
        addressId: selectedAddressId,
        buyerRemark: buyerRemark.trim() || undefined,
        cartItemIds: cartItemIds.length ? cartItemIds : undefined,
        couponId: selectedCouponId || undefined,
        paymentMethodCode: selectedMethodCode,
        usePoints,
        useWallet,
      });
      if (result.warnings.length > 0 && typeof window !== "undefined") {
        window.sessionStorage.setItem(MALL_H5_CHECKOUT_WARNINGS_STORAGE_KEY, JSON.stringify(result.warnings));
      }
      navigate(result.nextUrl, { replace: true });
    } catch (cause: unknown) {
      setMessage(cause instanceof Error ? cause.message : "提交订单失败");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="sdk-h5-page sdk-h5-loading">加载结算信息...</div>;
  }

  if (addresses.length === 0) {
    return (
      <div className="sdk-h5-page">
        <div className="sdk-h5-empty">请先在「我的」中添加收货地址</div>
        <div className="sdk-h5-center">
          <button className="sdk-h5-button sdk-h5-button-primary" onClick={() => navigate("/buyer")} type="button">
            去添加地址
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sdk-h5-page">
      <h1 className="sdk-h5-page-title">确认订单</h1>
      {cartItemIds.length > 0 ? (
        <p className="sdk-h5-muted">已选择 {cartItemIds.length} 件购物车商品参与结算</p>
      ) : null}

      <section className="sdk-h5-section">
        <h2>收货地址</h2>
        {addresses.map((address) => (
          <label className="sdk-h5-address-row" key={address.id}>
            <input
              checked={selectedAddressId === address.id}
              name="address"
              onChange={() => setSelectedAddressId(address.id)}
              type="radio"
            />
            <span>
              {address.receiverName} {address.receiverPhone}
              {address.isDefault ? <em className="sdk-h5-address-default">默认</em> : null}
              <br />
              <small>{address.addressLine}</small>
            </span>
          </label>
        ))}
      </section>

      {paymentMethods.length > 0 ? (
        <section className="sdk-h5-section">
          <h2>支付方式</h2>
          {paymentMethods.map((method) => (
            <label className="sdk-h5-address-row" key={method.id}>
              <input
                checked={selectedMethodCode === method.code}
                name="paymentMethod"
                onChange={() => setSelectedMethodCode(method.code)}
                type="radio"
              />
              <span>{method.label}</span>
            </label>
          ))}
        </section>
      ) : null}

      <section className="sdk-h5-section">
        <h2>优惠券</h2>
        <label className="sdk-h5-address-row">
          <input
            checked={!selectedCouponId}
            name="coupon"
            onChange={() => setSelectedCouponId("")}
            type="radio"
          />
          <span>不使用优惠券</span>
        </label>
        {coupons.map((coupon) => (
          <label className="sdk-h5-address-row" key={coupon.id}>
            <input
              checked={selectedCouponId === coupon.id}
              name="coupon"
              onChange={() => setSelectedCouponId(coupon.id)}
              type="radio"
            />
            <span>
              {coupon.title}
              {coupon.discountAmountCny != null ? <strong> ¥{coupon.discountAmountCny.toFixed(2)}</strong> : null}
              {coupon.minSpendCny != null ? (
                <small>{coupon.minSpendCny > 0 ? `（满 ¥${coupon.minSpendCny.toFixed(2)} 可用）` : "（无门槛）"}</small>
              ) : null}
            </span>
          </label>
        ))}
        {coupons.length === 0 ? <p className="sdk-h5-muted">暂无可用优惠券，可到领券中心领取。</p> : null}
      </section>

      <section className="sdk-h5-section">
        <h2>抵扣</h2>
        <label className="sdk-h5-address-row">
          <input checked={useWallet} onChange={(event) => setUseWallet(event.target.checked)} type="checkbox" />
          <span>钱包余额抵扣</span>
        </label>
        <label className="sdk-h5-address-row">
          <input checked={usePoints} onChange={(event) => setUsePoints(event.target.checked)} type="checkbox" />
          <span>积分抵扣</span>
        </label>
      </section>

      <section className="sdk-h5-section">
        <h2>买家留言</h2>
        <textarea
          aria-label="买家留言"
          maxLength={200}
          onChange={(event) => setBuyerRemark(event.target.value)}
          placeholder="选填，给商家留言"
          rows={2}
          value={buyerRemark}
        />
      </section>

      <section className="sdk-h5-checkout-summary">
        {quote?.discountAmountCny ? <p>优惠：-¥{quote.discountAmountCny.toFixed(2)}</p> : null}
        {selectedCoupon?.discountAmountCny != null ? (
          <p>已选优惠券：{selectedCoupon.title}（-¥{selectedCoupon.discountAmountCny.toFixed(2)}）</p>
        ) : null}
        <p>
          应付：<strong>¥{payableAmount != null ? payableAmount.toFixed(2) : "--"}</strong>
        </p>
      </section>

      {message ? <div className="sdk-h5-error" role="alert">{message}</div> : null}

      <button
        className="sdk-h5-button sdk-h5-button-primary sdk-h5-button-block"
        disabled={busy}
        onClick={() => void handleSubmit()}
        type="button"
      >
        {busy ? "提交中..." : "提交订单"}
      </button>
    </div>
  );
}
