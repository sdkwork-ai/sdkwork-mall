import { useEffect, useState } from "react";
import { Button, EmptyState, LoadingBlock } from "@sdkwork/ui-pc-react";
import { unwrapSdkworkPaymentResponse } from "@sdkwork/payment-service";
import { getSdkworkAdminRemotePort } from "@sdkwork/mall-pc-admin-core/admin-remote-port";

interface RiskSignalRow {
  id: string;
  level: string;
  shopId: string;
  shopName: string;
  status: string;
  type: string;
}

const RISK_PAGE_SIZE = 20;

export function SdkworkMallAdminRiskPage() {
  const [signals, setSignals] = useState<RiskSignalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [busySignalId, setBusySignalId] = useState<string | null>(null);

  async function refresh(nextPage = page) {
    setLoading(true);
    const service = getSdkworkAdminRemotePort();
    const shopsResponse = await service.admin.shops.management.list({
      page: nextPage,
      page_size: RISK_PAGE_SIZE,
    });
    const shopsPayload = unwrapSdkworkPaymentResponse(shopsResponse) as { items?: Record<string, unknown>[] };
    const shops = shopsPayload.items ?? [];

    // Fetch each shop's risk signals concurrently; a missing endpoint in dev
    // environments degrades that shop to zero rows instead of failing the page.
    const perShopRows = await Promise.all(
      shops.map(async (shop) => {
        const shopId = String(shop.id ?? "");
        if (!shopId) {
          return [];
        }
        try {
          const riskResponse = await service.admin.shops.riskSignals.list({
            page: 1,
            page_size: RISK_PAGE_SIZE,
            shopId,
          });
          const riskPayload = unwrapSdkworkPaymentResponse(riskResponse) as {
            items?: Record<string, unknown>[];
          };
          return (riskPayload.items ?? []).map((signal) => ({
            id: String(signal.id ?? ""),
            shopId,
            shopName: String(shop.name ?? shop.title ?? shopId),
            type: String(signal.signalType ?? signal.type ?? "risk"),
            level: String(signal.riskLevel ?? signal.level ?? "medium"),
            status: String(signal.signalStatus ?? signal.status ?? "open"),
          }));
        } catch {
          return [];
        }
      }),
    );

    setSignals(perShopRows.flat());
    setHasMore(shops.length >= RISK_PAGE_SIZE);
    setPage(nextPage);
    setLoading(false);
  }

  useEffect(() => {
    void refresh(1);
  }, []);

  async function resolveSignal(signal: RiskSignalRow) {
    setBusySignalId(signal.id);
    try {
      const service = getSdkworkAdminRemotePort();
      await service.admin.shops.riskSignals.resolve(signal.shopId, signal.id, {
        resolution: "reviewed",
      });
      await refresh();
    } finally {
      setBusySignalId(null);
    }
  }

  if (loading) {
    return <LoadingBlock label="加载风控信号..." />;
  }

  return (
    <div>
      <h1>风控中心</h1>
      <p>监控异常订单、高风险商家与待处理风险信号。</p>
      {signals.length === 0 ? (
        <EmptyState description="当前无活跃风险信号" title="风控状态良好" />
      ) : (
        <table className="sdkwork-mall-pc-table">
          <thead>
            <tr>
              <th>店铺</th>
              <th>类型</th>
              <th>等级</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {signals.map((signal) => (
              <tr key={signal.id}>
                <td>{signal.shopName}</td>
                <td>{signal.type}</td>
                <td>{signal.level}</td>
                <td>{signal.status}</td>
                <td>
                  {signal.status !== "resolved" ? (
                    <Button
                      disabled={busySignalId === signal.id}
                      onClick={() => void resolveSignal(signal)}
                      type="button"
                    >
                      标记已处理
                    </Button>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="sdkwork-mall-pc-pagination">
        <Button
          disabled={loading || page <= 1}
          onClick={() => void refresh(page - 1)}
          type="button"
          variant="outline"
        >
          上一页
        </Button>
        <span>第 {page} 页</span>
        <Button
          disabled={loading || !hasMore}
          onClick={() => void refresh(page + 1)}
          type="button"
          variant="outline"
        >
          下一页
        </Button>
      </div>
    </div>
  );
}
