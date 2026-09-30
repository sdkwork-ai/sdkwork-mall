import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, ShoppingCart } from "lucide-react";

import {
  loadMallH5MessageRows,
  type MallH5MessageRow,
} from "../messages-service";

export function SdkworkMallH5MessagesPage() {
  const [rows, setRows] = useState<MallH5MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadMallH5MessageRows()
      .then((data) => {
        if (active) {
          setRows(data);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "消息加载失败");
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
    return <div className="sdk-h5-page sdk-h5-loading">加载消息...</div>;
  }

  return (
    <div className="sdk-h5-page">
      <h1 className="sdk-h5-page-title">消息中心</h1>

      {error ? <div className="sdk-h5-error" role="alert">{error}</div> : null}

      {rows.length === 0 ? (
        <div className="sdk-h5-empty">暂无消息</div>
      ) : (
        <div className="sdk-h5-cart-list">
          {rows.map((row) => (
            <div className="sdk-h5-cart-row" key={row.id}>
              <span className="sdk-h5-message-icon" aria-hidden="true">
                {row.type === "order" ? <ShoppingCart size={18} /> : <FileText size={18} />}
              </span>
              <div className="sdk-h5-cart-row-body">
                <div className="sdk-h5-product-title">{row.title}</div>
                <div className="sdk-h5-muted">{row.summary}</div>
                {row.occurredAt ? (
                  <div className="sdk-h5-muted">{new Date(row.occurredAt).toLocaleString("zh-CN")}</div>
                ) : null}
              </div>
              <Link
                className="sdk-h5-button sdk-h5-button-ghost"
                to={row.type === "order" ? "/buyer/orders" : "/buyer/after-sales"}
              >
                查看
              </Link>
            </div>
          ))}
        </div>
      )}

      <p className="sdk-h5-muted">消息由订单与售后进度即时合成；推送通知将在消息服务上线后开放。</p>
    </div>
  );
}
