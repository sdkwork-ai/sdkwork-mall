import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";

import {
  createMallH5CheckoutQuote,
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
import { SdkworkMallH5ErrorState } from "@sdkwork/mall-h5-commons/error-state";

/** Delivery options; labels/descriptions come from the i18n catalogue. */
const DELIVERY_METHODS = [
  { code: "standard", descriptionKey: "checkout.delivery.standard.description", labelKey: "checkout.delivery.standard.label" },
  { code: "express", descriptionKey: "checkout.delivery.express.description", labelKey: "checkout.delivery.express.label" },
  { code: "sf", descriptionKey: "checkout.delivery.sf.description", labelKey: "checkout.delivery.sf.label" },
] as const;

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
  const { t } = useTranslation();
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
  const [selectedDeliveryMethod, setSelectedDeliveryMethod] = useState<string>("standard");
  const [giftCardCode, setGiftCardCode] = useState("");
  const [giftCardApplied, setGiftCardApplied] = useState<string | null>(null);
  const [giftCardError, setGiftCardError] = useState<string | null>(null);
  const [buyerRemark, setBuyerRemark] = useState("");
  const [needInvoice, setNeedInvoice] = useState(false);
  const [invoiceTitleType, setInvoiceTitleType] = useState<"company" | "personal">("personal");
  const [invoiceTitle, setInvoiceTitle] = useState("");
  const [invoiceTaxNumber, setInvoiceTaxNumber] = useState("");
  const [invoiceEmail, setInvoiceEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const loadCheckout = useCallback(async () => {
    // Address / payment-channel / coupon lookups are enrichments: losing one
    // must not deny the buyer a payable amount.
    const [addressRows, methodRows, couponRows] = await Promise.all([
      listMallH5Addresses().catch(() => [] as MallH5AddressOption[]),
      listMallH5PaymentMethods().catch(() => [] as MallH5PaymentMethodOption[]),
      listMallH5SelectableCoupons().catch(() => [] as MallH5SelectableCoupon[]),
    ]);
    setAddresses(addressRows);
    setPaymentMethods(methodRows);
    setCoupons(couponRows);
    setSelectedAddressId((current) =>
      current || addressRows.find((row) => row.isDefault)?.id || addressRows[0]?.id || "",
    );
    setSelectedMethodCode((current) => current || methodRows[0]?.code || "");
    // The quote is the authoritative payable amount: a failed quote blocks
    // submission instead of letting the buyer order an unknown total.
    setQuote(await createMallH5CheckoutQuote({ cartItemIds }));
  }, [cartItemIds]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setQuoteError(null);
    loadCheckout()
      .catch((cause: unknown) => {
        if (active) {
          setQuoteError(cause instanceof Error ? cause.message : t("checkout.errors.quote"));
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
  }, [loadCheckout, t]);

  const retryLoadCheckout = useCallback(() => {
    setLoading(true);
    setQuoteError(null);
    loadCheckout()
      .catch((cause: unknown) => {
        setQuoteError(cause instanceof Error ? cause.message : t("checkout.errors.quote"));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [loadCheckout, t]);

  const payableAmount = useMemo(() => quote?.payableAmountCny ?? null, [quote]);
  const selectedCoupon = coupons.find((coupon) => coupon.id === selectedCouponId) ?? null;

  function handleApplyGiftCard() {
    setGiftCardError(null);
    const code = giftCardCode.trim();
    if (!code) {
      setGiftCardError(t("checkout.giftCard.required"));
      return;
    }
    if (code.length < 8) {
      setGiftCardError(t("checkout.giftCard.invalid"));
      return;
    }
    setGiftCardApplied(code);
    setGiftCardCode("");
  }

  function handleRemoveGiftCard() {
    setGiftCardApplied(null);
    setGiftCardCode("");
    setGiftCardError(null);
  }

  async function handleSubmit() {
    if (!selectedAddressId) {
      setMessage(t("checkout.errors.addressRequired"));
      return;
    }
    if (!selectedMethodCode) {
      setMessage(t("checkout.errors.paymentRequired"));
      return;
    }
    if (!quote) {
      setMessage(t("checkout.errors.quoteNotReady"));
      return;
    }
    if (needInvoice) {
      if (!invoiceTitle.trim()) {
        setMessage(
          invoiceTitleType === "company"
            ? t("checkout.invoice.titleRequiredCompany")
            : t("checkout.invoice.titleRequiredPersonal"),
        );
        return;
      }
      if (invoiceTitleType === "company") {
        if (!invoiceTaxNumber.trim()) {
          setMessage(t("checkout.invoice.taxRequired"));
          return;
        }
        if (!/^[A-Z0-9]{15,20}$/u.test(invoiceTaxNumber.trim())) {
          setMessage(t("checkout.invoice.taxInvalid"));
          return;
        }
      }
    }
    setBusy(true);
    setMessage(null);
    try {
      const result = await submitMallH5CheckoutOrder({
        addressId: selectedAddressId,
        buyerRemark: buyerRemark.trim() || undefined,
        cartItemIds: cartItemIds.length ? cartItemIds : undefined,
        couponId: selectedCouponId || undefined,
        deliveryMethod: selectedDeliveryMethod,
        giftCardCode: giftCardApplied ?? undefined,
        invoiceForm: needInvoice
          ? {
              email: invoiceEmail.trim() || undefined,
              taxNumber: invoiceTitleType === "company" ? invoiceTaxNumber.trim() : undefined,
              title: invoiceTitle.trim(),
              titleType: invoiceTitleType,
            }
          : undefined,
        needInvoice,
        paymentMethodCode: selectedMethodCode,
        usePoints,
        useWallet,
      });
      if (result.warnings.length > 0 && typeof window !== "undefined") {
        window.sessionStorage.setItem(MALL_H5_CHECKOUT_WARNINGS_STORAGE_KEY, JSON.stringify(result.warnings));
      }
      navigate(result.nextUrl, { replace: true });
    } catch (cause: unknown) {
      setMessage(cause instanceof Error ? cause.message : t("checkout.errors.submit"));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="sdk-h5-page sdk-h5-loading">{t("checkout.loading")}</div>;
  }

  if (addresses.length === 0) {
    return (
      <div className="sdk-h5-page">
        <div className="sdk-h5-empty">{t("checkout.address.empty")}</div>
        <div className="sdk-h5-center">
          <button className="sdk-h5-button sdk-h5-button-primary" onClick={() => navigate("/buyer")} type="button">
            {t("checkout.address.add")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sdk-h5-page">
      <h1 className="sdk-h5-visually-hidden">{t("checkout.title")}</h1>
      {quoteError ? <SdkworkMallH5ErrorState message={quoteError} onRetry={retryLoadCheckout} /> : null}
      {cartItemIds.length > 0 ? (
        <p className="sdk-h5-muted">{t("checkout.selectedCount", { count: cartItemIds.length })}</p>
      ) : null}

      <section className="sdk-h5-section">
        <h2>{t("checkout.address.title")}</h2>
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
              {address.isDefault ? (
                <em className="sdk-h5-address-default">{t("checkout.address.default")}</em>
              ) : null}
              <br />
              <small>{address.addressLine}</small>
            </span>
          </label>
        ))}
      </section>

      <section className="sdk-h5-section">
        <h2>{t("checkout.delivery.title")}</h2>
        {DELIVERY_METHODS.map((method) => (
          <label className="sdk-h5-address-row" key={method.code}>
            <input
              checked={selectedDeliveryMethod === method.code}
              name="deliveryMethod"
              onChange={() => setSelectedDeliveryMethod(method.code)}
              type="radio"
            />
            <span>
              {t(method.labelKey)}
              <br />
              <small className="sdk-h5-muted">{t(method.descriptionKey)}</small>
            </span>
          </label>
        ))}
      </section>

      {paymentMethods.length > 0 ? (
        <section className="sdk-h5-section">
          <h2>{t("checkout.payment.title")}</h2>
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
        <h2>{t("checkout.coupon.title")}</h2>
        <label className="sdk-h5-address-row">
          <input
            checked={!selectedCouponId}
            name="coupon"
            onChange={() => setSelectedCouponId("")}
            type="radio"
          />
          <span>{t("checkout.coupon.none")}</span>
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
                <small>
                  {coupon.minSpendCny > 0
                    ? t("checkout.coupon.minSpend", { amount: coupon.minSpendCny.toFixed(2) })
                    : t("checkout.coupon.noThreshold")}
                </small>
              ) : null}
            </span>
          </label>
        ))}
        {coupons.length === 0 ? <p className="sdk-h5-muted">{t("checkout.coupon.empty")}</p> : null}
      </section>

      <section className="sdk-h5-section">
        <h2>{t("checkout.deduct.title")}</h2>
        <label className="sdk-h5-address-row">
          <input checked={useWallet} onChange={(event) => setUseWallet(event.target.checked)} type="checkbox" />
          <span>{t("checkout.deduct.wallet")}</span>
        </label>
        <label className="sdk-h5-address-row">
          <input checked={usePoints} onChange={(event) => setUsePoints(event.target.checked)} type="checkbox" />
          <span>{t("checkout.deduct.points")}</span>
        </label>
      </section>

      <section className="sdk-h5-section">
        <h2>{t("checkout.giftCard.title")}</h2>
        {giftCardApplied ? (
          <div className="sdk-h5-address-row">
            <span>
              {t("checkout.giftCard.applied")} <code>{giftCardApplied}</code>
            </span>
            <button className="sdk-h5-link-button" onClick={handleRemoveGiftCard} type="button">
              {t("checkout.giftCard.remove")}
            </button>
          </div>
        ) : (
          <div className="sdk-h5-redeem-row">
            <input
              aria-label={t("checkout.giftCard.label")}
              onChange={(event) => setGiftCardCode(event.target.value)}
              placeholder={t("checkout.giftCard.placeholder")}
              value={giftCardCode}
            />
            <button
              className="sdk-h5-button sdk-h5-button-secondary"
              disabled={!giftCardCode.trim()}
              onClick={handleApplyGiftCard}
              type="button"
            >
              {t("checkout.giftCard.apply")}
            </button>
          </div>
        )}
        {giftCardError ? (
          <p className="sdk-h5-notice sdk-h5-notice-danger" role="alert">
            {giftCardError}
          </p>
        ) : null}
      </section>

      <section className="sdk-h5-section">
        <h2>{t("checkout.remark.title")}</h2>
        <textarea
          aria-label={t("checkout.remark.label")}
          maxLength={200}
          onChange={(event) => setBuyerRemark(event.target.value)}
          placeholder={t("checkout.remark.placeholder")}
          rows={2}
          value={buyerRemark}
        />
      </section>

      <section className="sdk-h5-section">
        <h2>{t("checkout.invoice.title")}</h2>
        <label className="sdk-h5-address-row">
          <input
            checked={needInvoice}
            onChange={(event) => setNeedInvoice(event.target.checked)}
            type="checkbox"
          />
          <span>{t("checkout.invoice.need")}</span>
        </label>
        {needInvoice ? (
          <>
            <div className="sdk-h5-address-row">
              <label>
                <input
                  checked={invoiceTitleType === "personal"}
                  name="invoiceTitleType"
                  onChange={() => setInvoiceTitleType("personal")}
                  type="radio"
                />
                <span>{t("checkout.invoice.personal")}</span>
              </label>
              <label>
                <input
                  checked={invoiceTitleType === "company"}
                  name="invoiceTitleType"
                  onChange={() => setInvoiceTitleType("company")}
                  type="radio"
                />
                <span>{t("checkout.invoice.company")}</span>
              </label>
            </div>
            <label className="sdk-h5-field">
              {t("checkout.invoice.titleLabel")}
              <input
                aria-label={t("checkout.invoice.titleLabel")}
                onChange={(event) => setInvoiceTitle(event.target.value)}
                value={invoiceTitle}
              />
            </label>
            {invoiceTitleType === "company" ? (
              <label className="sdk-h5-field">
                {t("checkout.invoice.taxNumberLabel")}
                <input
                  aria-label={t("checkout.invoice.taxNumberLabel")}
                  onChange={(event) => setInvoiceTaxNumber(event.target.value)}
                  value={invoiceTaxNumber}
                />
              </label>
            ) : null}
            <label className="sdk-h5-field">
              {t("checkout.invoice.emailLabel")}
              <input
                aria-label={t("checkout.invoice.emailLabel")}
                inputMode="email"
                onChange={(event) => setInvoiceEmail(event.target.value)}
                value={invoiceEmail}
              />
            </label>
          </>
        ) : null}
      </section>

      <section className="sdk-h5-checkout-summary">
        {quote?.originalAmountCny != null ? (
          <p>{t("checkout.summary.goods", { amount: quote.originalAmountCny.toFixed(2) })}</p>
        ) : null}
        {quote?.discountAmountCny ? (
          <p>{t("checkout.summary.discount", { amount: quote.discountAmountCny.toFixed(2) })}</p>
        ) : null}
        {selectedCoupon?.discountAmountCny != null ? (
          <p>
            {t("checkout.summary.couponApplied", {
              amount: selectedCoupon.discountAmountCny.toFixed(2),
              title: selectedCoupon.title,
            })}
          </p>
        ) : null}
        <p>
          {t("checkout.summary.payable")}
          <strong>¥{payableAmount != null ? payableAmount.toFixed(2) : "--"}</strong>
        </p>
      </section>

      {message ? <div className="sdk-h5-notice sdk-h5-notice-danger" role="alert">{message}</div> : null}

      <button
        className="sdk-h5-button sdk-h5-button-primary sdk-h5-button-block"
        disabled={busy || !quote}
        onClick={() => void handleSubmit()}
        type="button"
      >
        {busy ? t("checkout.submitting") : t("checkout.submit")}
      </button>
    </div>
  );
}
