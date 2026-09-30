import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  loadMallH5OrderLogistics,
  type MallH5ShipmentLogistics,
} from "../order-service";

export function SdkworkMallH5LogisticsPage() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId") ?? undefined;
  const shipmentId = searchParams.get("shipmentId") ?? undefined;
  const [shipments, setShipments] = useState<MallH5ShipmentLogistics[]>([]);
  const [loading, setLoading] = useState(Boolean(orderId || shipmentId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId && !shipmentId) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    loadMallH5OrderLogistics({ orderId, shipmentId })
      .then((result) => {
        if (active) {
          setShipments(result.shipments);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "物流加载失败");
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
  }, [orderId, shipmentId]);

  return (
    <div className="sdk-h5-page">
      <div className="sdk-h5-center">
        <Link className="sdk-h5-button sdk-h5-button-ghost" to="/buyer/orders">返回订单列表</Link>
      </div>

      {!orderId && !shipmentId ? <div className="sdk-h5-notice sdk-h5-notice-warning">缺少订单参数，请从订单列表进入。</div> : null}
      {error ? <div className="sdk-h5-error" role="alert">{error}</div> : null}
      {loading ? <div className="sdk-h5-loading">加载物流...</div> : null}
      {!loading && !error && (orderId || shipmentId) && shipments.length === 0 ? (
        <div className="sdk-h5-empty">商家尚未发货，发货后可在此查看物流轨迹。</div>
      ) : null}

      {shipments.map((shipment) => (
        <section className="sdk-h5-section" key={shipment.shipmentId}>
          <h2>{shipment.shipmentNo ? `运单号：${shipment.shipmentNo}` : shipment.shipmentId}</h2>
          {shipment.carrier || shipment.statusLabel ? (
            <p className="sdk-h5-muted">
              {[shipment.carrier, shipment.statusLabel].filter(Boolean).join(" · ")}
            </p>
          ) : null}
          {shipment.packages.length > 0 ? (
            <p className="sdk-h5-muted">包裹：{shipment.packages.map((pkg) => pkg.name || pkg.id).join("、")}</p>
          ) : null}
          {shipment.trackingEvents.length === 0 ? (
            <div className="sdk-h5-empty">暂无轨迹</div>
          ) : (
            <ol className="sdk-h5-tracking">
              {shipment.trackingEvents.map((event, index) => (
                <li key={`${event.occurredAt ?? "event"}-${index}`}>
                  <div className="sdk-h5-tracking-text">{event.description}</div>
                  <div className="sdk-h5-tracking-meta">
                    {[event.status, event.occurredAt ? new Date(event.occurredAt).toLocaleString("zh-CN") : ""]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      ))}
    </div>
  );
}
