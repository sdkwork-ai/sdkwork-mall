import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button, EmptyState, LoadingBlock, StatusNotice } from "@sdkwork/ui-pc-react";
import {
  createSdkworkOrderBackdropStyle,
  createSdkworkOrderHeroStyle,
  createSdkworkOrderHeroTextStyle,
  createSdkworkOrderPanelStyle,
} from "../order-appearance";
import {
  createSdkworkOrderService,
  type SdkworkOrderDetail,
} from "../order-service";
import { SdkworkOrderIntlProvider, useSdkworkOrderIntl } from "../order-intl";

async function loadSdkworkOrderDetail(orderId: string): Promise<SdkworkOrderDetail> {
  const service = createSdkworkOrderService({});
  return service.getOrderDetail(orderId);
}

function SdkworkOrderDetailPageContent() {
  const { orderId = "" } = useParams<{ orderId: string }>();
  const {
    formatCurrencyCny,
    formatStatus,
    formatTimestamp,
  } = useSdkworkOrderIntl();
  const [detail, setDetail] = useState<SdkworkOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    const data = await loadSdkworkOrderDetail(orderId);
    setDetail(data);
  }, [orderId]);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    reload()
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "订单加载失败");
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
  }, [orderId, reload]);

  async function runAction(action: () => Promise<unknown>) {
    setMutating(true);
    setError(null);
    try {
      await action();
      await reload();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "操作失败");
    } finally {
      setMutating(false);
    }
  }

  async function handlePay() {
    if (!detail) {
      return;
    }
    const service = createSdkworkOrderService({});
    const payment = await service.payOrder({ orderId: detail.id });
    const query = new URLSearchParams({ orderId: detail.id, status: "pending" });
    if (payment.paymentId) {
      query.set("paymentId", payment.paymentId);
    }
    if (payment.paymentMethod) {
      query.set("paymentMethod", payment.paymentMethod);
    }
    window.location.assign(`/payment/result?${query.toString()}`);
  }

  if (loading) {
    return <LoadingBlock label="加载订单详情..." />;
  }

  if (!detail) {
    return (
      <div className="sdkwork-mall-pc-order-detail">
        <EmptyState
          description={error ?? "订单不存在或已被删除"}
          title="订单详情不可用"
        />
        <div className="sdkwork-mall-pc-payment-actions">
          <Link to="/buyer/orders">
            <Button type="button" variant="ghost">返回订单列表</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="sdkwork-mall-pc-order-detail" style={createSdkworkOrderBackdropStyle()}>
      <header className="sdkwork-mall-pc-order-detail-hero" style={createSdkworkOrderHeroStyle()}>
        <h1 style={createSdkworkOrderHeroTextStyle()}>{formatStatus(detail.status)}</h1>
        <p style={createSdkworkOrderHeroTextStyle()}>{detail.subject}</p>
      </header>

      {error ? <StatusNotice tone="danger">{error}</StatusNotice> : null}

      <section className="sdkwork-mall-pc-order-detail-section" style={createSdkworkOrderPanelStyle("neutral")}>
        <h2>商品清单</h2>
        {detail.items.length === 0 ? (
          <p>暂无商品明细</p>
        ) : (
          <table className="sdkwork-mall-pc-order-detail-items">
            <thead>
              <tr>
                <th>商品</th>
                <th>单价</th>
                <th>数量</th>
                <th>小计</th>
              </tr>
            </thead>
            <tbody>
              {detail.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{formatCurrencyCny(item.unitPriceCny)}</td>
                  <td>x{item.quantity}</td>
                  <td>{formatCurrencyCny(item.totalAmountCny)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="sdkwork-mall-pc-order-detail-section" style={createSdkworkOrderPanelStyle("neutral")}>
        <h2>订单信息</h2>
        <dl className="sdkwork-mall-pc-order-detail-meta">
          <div>
            <dt>订单号</dt>
            <dd>{detail.orderSn || detail.id}</dd>
          </div>
          <div>
            <dt>下单时间</dt>
            <dd>{formatTimestamp(detail.createdAt)}</dd>
          </div>
          <div>
            <dt>订单总额</dt>
            <dd>{formatCurrencyCny(detail.totalAmountCny)}</dd>
          </div>
          <div>
            <dt>实付金额</dt>
            <dd>{detail.paidAmountCny != null ? formatCurrencyCny(detail.paidAmountCny) : "未支付"}</dd>
          </div>
          {detail.paymentMethod ? (
            <div>
              <dt>支付方式</dt>
              <dd>{detail.paymentMethod}</dd>
            </div>
          ) : null}
          {detail.payTime ? (
            <div>
              <dt>支付时间</dt>
              <dd>{formatTimestamp(detail.payTime)}</dd>
            </div>
          ) : null}
          {detail.remark ? (
            <div>
              <dt>买家留言</dt>
              <dd>{detail.remark}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <div className="sdkwork-mall-pc-payment-actions">
        {detail.status === "pending-payment" ? (
          <Button
            disabled={mutating}
            onClick={() => void handlePay()}
            size="lg"
            type="button"
            variant="primary"
          >
            去支付
          </Button>
        ) : null}
        {detail.status === "pending-payment" ? (
          <Button
            disabled={mutating}
            onClick={() => void runAction(() => createSdkworkOrderService({}).cancelOrder({ orderId: detail.id }))}
            size="lg"
            type="button"
            variant="ghost"
          >
            取消订单
          </Button>
        ) : null}
        {detail.status === "pending-receipt" ? (
          <>
            <Link to={`/buyer/logistics?orderId=${encodeURIComponent(detail.id)}`}>
              <Button type="button" variant="outline">查看物流</Button>
            </Link>
            <Button
              disabled={mutating}
              onClick={() => void runAction(() => createSdkworkOrderService({}).confirmReceipt({ orderId: detail.id }))}
              size="lg"
              type="button"
              variant="primary"
            >
              确认收货
            </Button>
          </>
        ) : null}
        {detail.status === "completed" ? (
          <Link to={`/buyer/after-sales?orderId=${encodeURIComponent(detail.id)}`}>
            <Button type="button" variant="outline">申请售后</Button>
          </Link>
        ) : null}
        <Link to="/buyer/orders">
          <Button type="button" variant="ghost">返回订单列表</Button>
        </Link>
      </div>
    </div>
  );
}

export function SdkworkOrderDetailPage() {
  return (
    <SdkworkOrderIntlProvider>
      <SdkworkOrderDetailPageContent />
    </SdkworkOrderIntlProvider>
  );
}
