import { useEffect, useState } from "react";
import { Button, EmptyState, LoadingBlock } from "@sdkwork/ui-pc-react";
import { unwrapSdkworkPaymentResponse } from "@sdkwork/payment-service";
import { getSdkworkAdminRemotePort } from "@sdkwork/mall-pc-admin-core/admin-remote-port";

const REPORT_PAGE_SIZE = 20;

export function SdkworkMallAdminReportsPage() {
  const [revenue, setRevenue] = useState<Array<{ period: string; amount: string }>>([]);
  const [refunds, setRefunds] = useState<Array<{ period: string; amount: string; count: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [revenuePage, setRevenuePage] = useState(1);
  const [revenueHasNextPage, setRevenueHasNextPage] = useState(false);

  useEffect(() => {
    let active = true;
    async function load(targetPage: number) {
      const service = getSdkworkAdminRemotePort();
      const timeRange = {
        start_time: startDate || undefined,
        end_time: endDate || undefined,
      };
      const [revenueResult, refundsResult] = await Promise.allSettled([
        service.admin.commerceReports.orderRevenue.list({
          page: targetPage,
          page_size: REPORT_PAGE_SIZE,
          ...timeRange,
        }),
        service.admin.commerceReports.refunds.list({ page: 1, page_size: 10 }),
      ]);
      if (!active) {
        return;
      }
      setRevenuePage(targetPage);
      if (revenueResult.status === "fulfilled") {
        const payload = unwrapSdkworkPaymentResponse(revenueResult.value) as { items?: Record<string, unknown>[] };
        const rows = payload.items ?? [];
        setRevenue(
          rows.map((item) => ({
            period: String(item.period ?? item.date ?? "-"),
            amount: String(item.amount ?? item.revenue ?? "-"),
          })) ?? [],
        );
        setRevenueHasNextPage(rows.length >= REPORT_PAGE_SIZE);
      }
      if (refundsResult.status === "fulfilled") {
        const payload = unwrapSdkworkPaymentResponse(refundsResult.value) as { items?: Record<string, unknown>[] };
        setRefunds(
          payload.items?.map((item) => ({
            period: String(item.period ?? item.date ?? "-"),
            amount: String(item.amount ?? item.refundAmount ?? "-"),
            count: String(item.count ?? item.refundCount ?? "-"),
          })) ?? [],
        );
      }
      setLoading(false);
    }
    void load(revenuePage);
    return () => {
      active = false;
    };
  }, [revenuePage, startDate, endDate]);

  if (loading) {
    return <LoadingBlock label="加载报表..." />;
  }

  const hasData = revenue.length > 0 || refunds.length > 0;

  return (
    <div>
      <h1>数据报表</h1>

      <section className="sdkwork-mall-pc-filter-bar">
        <label>
          起始日期{' '}
          <input
            aria-label="起始日期"
            onChange={(event) => {
              setStartDate(event.target.value);
              setRevenuePage(1);
            }}
            type="date"
            value={startDate}
          />
        </label>
        <label>
          截止日期{' '}
          <input
            aria-label="截止日期"
            onChange={(event) => {
              setEndDate(event.target.value);
              setRevenuePage(1);
            }}
            type="date"
            value={endDate}
          />
        </label>
      </section>

      {!hasData ? (
        <EmptyState description="营收与退款报表将在此展示" title="暂无报表数据" />
      ) : (
        <>
          <section>
            <h2>订单营收</h2>
            {revenue.length === 0 ? (
              <EmptyState description="暂无营收数据" title="订单营收" />
            ) : (
              <table className="sdkwork-mall-pc-table">
                <thead><tr><th>周期</th><th>营收</th></tr></thead>
                <tbody>
                  {revenue.map((row, index) => (
                    <tr key={`${row.period}-${index}`}><td>{row.period}</td><td>{row.amount}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="sdkwork-mall-pc-pager">
              <Button
                disabled={loading || revenuePage <= 1}
                onClick={() => setRevenuePage((current) => Math.max(1, current - 1))}
                type="button"
                variant="outline"
              >
                上一页
              </Button>
              <span>第 {revenuePage} 页</span>
              <Button
                disabled={loading || !revenueHasNextPage}
                onClick={() => setRevenuePage((current) => current + 1)}
                type="button"
                variant="outline"
              >
                下一页
              </Button>
            </div>
          </section>
          <section>
            <h2>退款统计</h2>
            {refunds.length === 0 ? (
              <EmptyState description="暂无退款数据" title="退款统计" />
            ) : (
              <table className="sdkwork-mall-pc-table">
                <thead><tr><th>周期</th><th>退款金额</th><th>笔数</th></tr></thead>
                <tbody>
                  {refunds.map((row, index) => (
                    <tr key={`${row.period}-${index}`}>
                      <td>{row.period}</td>
                      <td>{row.amount}</td>
                      <td>{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  );
}
