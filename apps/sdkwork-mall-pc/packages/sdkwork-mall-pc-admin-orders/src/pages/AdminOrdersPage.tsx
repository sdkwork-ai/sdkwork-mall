import { useEffect, useState } from "react";
import { Button, EmptyState, LoadingBlock } from "@sdkwork/ui-pc-react";
import { unwrapSdkworkPaymentResponse } from "@sdkwork/payment-service";
import { getSdkworkAdminRemotePort } from "@sdkwork/mall-pc-admin-core/admin-remote-port";

interface AdminOrderRow {
  id: string;
  status: string;
  subject: string;
}

const ADMIN_ORDER_STATUS_OPTIONS = [
  { value: "", label: "全部状态" },
  { value: "PENDING_PAYMENT", label: "待付款" },
  { value: "PENDING_SHIPMENT", label: "待发货" },
  { value: "PENDING_RECEIPT", label: "待收货" },
  { value: "COMPLETED", label: "已完成" },
  { value: "CANCELLED", label: "已取消" },
  { value: "REFUNDING", label: "退款中" },
  { value: "REFUNDED", label: "已退款" },
] as const;

const ADMIN_ORDER_PAGE_SIZE = 30;

export function SdkworkMallAdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);

  async function reload(targetPage = page) {
    setLoading(true);
    const service = getSdkworkAdminRemotePort();
    const response = await service.admin.orders.management.list({
      page: targetPage,
      page_size: ADMIN_ORDER_PAGE_SIZE,
      q: keyword.trim() || undefined,
      status: statusFilter || undefined,
    });
    const payload = unwrapSdkworkPaymentResponse(response) as { items?: Record<string, unknown>[] };
    const rows = payload.items ?? [];
    setOrders(
      rows.map((item) => ({
        id: String(item.id ?? ""),
        subject: String(item.subject ?? item.title ?? "订单"),
        status: String(item.status ?? "unknown"),
      })) ?? [],
    );
    setHasNextPage(rows.length >= ADMIN_ORDER_PAGE_SIZE);
    setLoading(false);
  }

  useEffect(() => {
    void reload(1);
    setPage(1);
    // 重新加载由筛选条件变化触发；page 重置回第一页。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword, statusFilter]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let active = true;
    async function loadDetail() {
      const service = getSdkworkAdminRemotePort();
      const response = await service.admin.orders.management.retrieve(selectedId!);
      if (active) {
        setDetail(unwrapSdkworkPaymentResponse(response) as Record<string, unknown>);
      }
    }
    void loadDetail();
    return () => {
      active = false;
    };
  }, [selectedId]);

  async function mutateOrder(orderId: string, action: "cancel" | "close") {
    setBusyId(orderId);
    setMessage(null);
    try {
      const service = getSdkworkAdminRemotePort();
      if (action === "cancel") {
        await service.admin.orders.management.cancel(orderId, { reason: "platform-cancel" });
      } else {
        await service.admin.orders.management.close(orderId, { reason: "platform-close" });
      }
      setMessage(`订单 ${orderId} 已${action === "cancel" ? "取消" : "关闭"}`);
      await reload();
    } catch {
      setMessage("操作失败，请检查权限与订单状态");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <LoadingBlock label="加载订单..." />;
  }

  return (
    <div>
      <h1>订单监管</h1>
      {message ? <p>{message}</p> : null}

      <section className="sdkwork-mall-pc-filter-bar">
        <input
          aria-label="搜索订单"
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="按主题/编号搜索"
          type="search"
          value={keyword}
        />
        <select
          aria-label="按状态筛选"
          onChange={(event) => setStatusFilter(event.target.value)}
          value={statusFilter}
        >
          {ADMIN_ORDER_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </section>

      {orders.length === 0 ? (
        <EmptyState description="调整筛选条件或等待新订单" title="暂无订单" />
      ) : (
        <>
        <table className="sdkwork-mall-pc-table">
          <thead>
            <tr>
              <th>订单</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td>
                  <button onClick={() => setSelectedId(order.id)} type="button">
                    {order.subject}
                  </button>
                </td>
                <td>{order.status}</td>
                <td className="sdkwork-mall-pc-table-actions">
                  <Button disabled={busyId === order.id} onClick={() => setSelectedId(order.id)} type="button">
                    详情
                  </Button>
                  <Button disabled={busyId === order.id} onClick={() => void mutateOrder(order.id, "cancel")} type="button">
                    取消
                  </Button>
                  <Button disabled={busyId === order.id} onClick={() => void mutateOrder(order.id, "close")} type="button">
                    关闭
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="sdkwork-mall-pc-pager">
          <Button
            disabled={loading || page <= 1}
            onClick={() => {
              const target = page - 1;
              setPage(target);
              void reload(target);
            }}
            type="button"
            variant="outline"
          >
            上一页
          </Button>
          <span>第 {page} 页</span>
          <Button
            disabled={loading || !hasNextPage}
            onClick={() => {
              const target = page + 1;
              setPage(target);
              void reload(target);
            }}
            type="button"
            variant="outline"
          >
            下一页
          </Button>
        </div>
        </>
      )}

      {selectedId && detail ? (
        <section className="sdkwork-mall-pc-form-grid">
          <h2>订单详情</h2>
          <p>订单号：{selectedId}</p>
          <p>状态：{String(detail.status ?? "-")}</p>
          <p>金额：{String(detail.totalAmount ?? detail.payableAmount ?? "-")}</p>
          <p>买家：{String(detail.buyerId ?? detail.userId ?? "-")}</p>
          <p>店铺：{String(detail.shopId ?? detail.shopName ?? "-")}</p>
        </section>
      ) : null}
    </div>
  );
}

export function SdkworkMallAdminAfterSalesPage() {
  const [rows, setRows] = useState<Array<{ id: string; orderId?: string; status: string; type: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    const service = getSdkworkAdminRemotePort();
    const response = await service.admin.afterSales.management.list({ page: 1, page_size: 30 });
    const payload = unwrapSdkworkPaymentResponse(response) as { items?: Record<string, unknown>[] };
    setRows(
      payload.items?.map((item) => ({
        id: String(item.id ?? ""),
        orderId: typeof item.orderId === "string" ? item.orderId : undefined,
        type: String(item.type ?? item.afterSalesType ?? "售后"),
        status: String(item.status ?? "unknown"),
      })) ?? [],
    );
    setLoading(false);
  }

  useEffect(() => {
    void reload();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let active = true;
    async function loadDetail() {
      const service = getSdkworkAdminRemotePort();
      const response = await service.admin.afterSales.management.retrieve(selectedId!);
      if (active) {
        setDetail(unwrapSdkworkPaymentResponse(response) as Record<string, unknown>);
      }
    }
    void loadDetail();
    return () => {
      active = false;
    };
  }, [selectedId]);

  async function reviewAfterSales(afterSalesId: string, action: "approve" | "reject") {
    setBusyId(afterSalesId);
    setMessage(null);
    try {
      const service = getSdkworkAdminRemotePort();
      await service.admin.afterSales.reviews.create(afterSalesId, {
        action,
        approvedAmount: action === "approve" ? String(detail?.requestedAmount ?? detail?.amount ?? "0") : undefined,
      });
      setMessage(`售后单 ${afterSalesId} 已${action === "approve" ? "通过" : "驳回"}`);
      await reload();
    } catch {
      setMessage("审核失败，请检查权限与售后状态");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <LoadingBlock label="加载售后..." />;
  }

  return (
    <div>
      <h1>售后监管</h1>
      {message ? <p>{message}</p> : null}
      {rows.length === 0 ? (
        <EmptyState description="平台售后单将在此展示" title="暂无售后单" />
      ) : (
        <table className="sdkwork-mall-pc-table">
          <thead>
            <tr>
              <th>类型</th>
              <th>状态</th>
              <th>订单</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.type}</td>
                <td>{row.status}</td>
                <td>{row.orderId ?? "-"}</td>
                <td className="sdkwork-mall-pc-table-actions">
                  <Button onClick={() => setSelectedId(row.id)} type="button">详情</Button>
                  <Button disabled={busyId === row.id} onClick={() => void reviewAfterSales(row.id, "approve")} type="button">
                    通过
                  </Button>
                  <Button disabled={busyId === row.id} onClick={() => void reviewAfterSales(row.id, "reject")} type="button">
                    驳回
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selectedId && detail ? (
        <section className="sdkwork-mall-pc-form-grid">
          <h2>售后详情</h2>
          <p>售后单：{selectedId}</p>
          <p>类型：{String(detail.afterSalesType ?? detail.type ?? "-")}</p>
          <p>状态：{String(detail.status ?? "-")}</p>
          <p>申请金额：{String(detail.requestedAmount ?? detail.approvedAmount ?? "-")}</p>
          <p>原因：{String(detail.reasonCode ?? detail.reason ?? "-")}</p>
        </section>
      ) : null}
    </div>
  );
}
