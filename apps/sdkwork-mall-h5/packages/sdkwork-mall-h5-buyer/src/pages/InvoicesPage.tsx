import { useCallback, useEffect, useState } from "react";

import {
  createMallH5Invoice,
  listMallH5Invoices,
  type MallH5Invoice,
} from "../invoices-service";

import { SdkworkMallH5SelectCell } from "../components/ActionSheet";

export function SdkworkMallH5InvoicesPage() {
  const [invoices, setInvoices] = useState<MallH5Invoice[]>([]);
  const [titleType, setTitleType] = useState("personal");
  const [title, setTitle] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [email, setEmail] = useState("");
  const [orderId, setOrderId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setInvoices(await listMallH5Invoices());
  }, []);

  useEffect(() => {
    let active = true;
    reload()
      .catch((cause: unknown) => {
        if (active) {
          setMessage(cause instanceof Error ? cause.message : "发票加载失败");
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

  async function handleSubmit() {
    if (!title.trim()) {
      setMessage("请填写发票抬头");
      return;
    }
    if (titleType === "company" && !taxNumber.trim()) {
      setMessage("企业抬头需要填写税号");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await createMallH5Invoice({
        email: email.trim() || undefined,
        orderId: orderId.trim() || undefined,
        taxNumber: titleType === "company" ? taxNumber.trim() : undefined,
        title: title.trim(),
        titleType,
      });
      setTitle("");
      setTaxNumber("");
      setMessage("开票申请已提交");
      await reload();
    } catch (cause: unknown) {
      setMessage(cause instanceof Error ? cause.message : "开票申请失败");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="sdk-h5-page sdk-h5-loading">加载发票...</div>;
  }

  return (
    <div className="sdk-h5-page">
      <h1 className="sdk-h5-page-title">发票</h1>

      {message ? <div className="sdk-h5-notice sdk-h5-notice-warning">{message}</div> : null}

      <section className="sdk-h5-section">
        <h2>申请开票</h2>
        <SdkworkMallH5SelectCell
          label="抬头类型"
          onChange={setTitleType}
          options={[
            { label: "个人", value: "personal" },
            { label: "企业", value: "company" },
          ]}
          value={titleType}
        />
        <label className="sdk-h5-field">
          发票抬头
          <input onChange={(event) => setTitle(event.target.value)} value={title} />
        </label>
        {titleType === "company" ? (
          <label className="sdk-h5-field">
            税号
            <input onChange={(event) => setTaxNumber(event.target.value)} value={taxNumber} />
          </label>
        ) : null}
        <label className="sdk-h5-field">
          接收邮箱
          <input inputMode="email" onChange={(event) => setEmail(event.target.value)} value={email} />
        </label>
        <label className="sdk-h5-field">
          关联订单号（选填）
          <input onChange={(event) => setOrderId(event.target.value)} value={orderId} />
        </label>
        <button
          className="sdk-h5-button sdk-h5-button-primary sdk-h5-button-block"
          disabled={busy}
          onClick={() => void handleSubmit()}
          type="button"
        >
          {busy ? "提交中..." : "提交开票申请"}
        </button>
      </section>

      <section className="sdk-h5-section">
        <h2>我的发票</h2>
        {invoices.length === 0 ? (
          <div className="sdk-h5-empty">暂无发票</div>
        ) : (
          invoices.map((invoice) => (
            <div className="sdk-h5-coupon-row" key={invoice.id}>
              <div>
                <strong>{invoice.title}</strong>
                {invoice.amountCny != null ? <div className="sdk-h5-muted">¥{invoice.amountCny.toFixed(2)}</div> : null}
              </div>
              <span className="sdk-h5-muted">{invoice.status}</span>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
