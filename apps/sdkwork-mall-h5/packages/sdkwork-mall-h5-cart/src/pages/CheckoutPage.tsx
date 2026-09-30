import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  listMallH5Addresses,
  listMallH5PaymentMethods,
  MALL_H5_CHECKOUT_WARNINGS_STORAGE_KEY,
  submitMallH5CheckoutOrder,
  type MallH5AddressOption,
  type MallH5CheckoutQuote,
  type MallH5PaymentMethodOption,
} from "../cart-service";

export function SdkworkMallH5CheckoutPage() {
  const navigate = useNavigate();
  const [addresses, setAddresses] = useState<MallH5AddressOption[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<MallH5PaymentMethodOption[]>([]);
  const [quote, setQuote] = useState<MallH5CheckoutQuote | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [selectedMethodCode, setSelectedMethodCode] = useState("");
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
    const quoteTask = (async () => {
      const checkoutQuote = await import("../cart-service").then((module) => module.createMallH5CheckoutQuote());
      if (active) {
        setQuote(checkoutQuote);
      }
    })().catch((cause: unknown) => {
      if (active) {
        setMessage(cause instanceof Error ? cause.message : "结算报价加载失败");
      }
    });

    void Promise.allSettled([addressesTask, methodsTask, quoteTask]).finally(() => {
      if (active) {
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const payableAmount = useMemo(() => quote?.payableAmountCny ?? null, [quote]);

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
