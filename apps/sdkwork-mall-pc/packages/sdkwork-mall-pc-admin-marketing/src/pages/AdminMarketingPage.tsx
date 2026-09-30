import { useCallback, useEffect, useState } from "react";
import { Button, EmptyState, LoadingBlock } from "@sdkwork/ui-pc-react";
import { unwrapSdkworkPaymentResponse } from "@sdkwork/payment-service";
import { getSdkworkAdminRemotePort } from "@sdkwork/mall-pc-admin-core/admin-remote-port";
import { MALL_CMS_OFFER_MARKER } from "@sdkwork/mall-pc-cms/cms-service";

interface MallCampaignRow {
  id: string;
  status: string;
  title: string;
}

function isCmsConfigOffer(item: Record<string, unknown>): boolean {
  const marker = [item.code, item.offerCode, item.offer_code, item.title, item.name]
    .map((value) => String(value ?? ""))
    .join(" ")
    .toLowerCase();
  return marker.includes(MALL_CMS_OFFER_MARKER);
}

interface MallCouponStockRow {
  id: string;
  name: string;
  remaining: string;
  total: string;
}

interface MallUserCouponRow {
  id: string;
  status: string;
  title: string;
  userId: string;
}

interface MallCouponLedgerRow {
  id: string;
  change: string;
  occurredAt: string;
  reason: string;
}

function readRemoteRows(payload: unknown): Record<string, unknown>[] {
  const rows = payload as { content?: Record<string, unknown>[]; items?: Record<string, unknown>[] } | null;
  return rows?.items ?? rows?.content ?? [];
}

function readRemoteString(record: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value);
    }
  }
  return "--";
}

export function SdkworkMallAdminMarketingPage() {
  const [offers, setOffers] = useState<MallCampaignRow[]>([]);
  const [couponStocks, setCouponStocks] = useState<MallCouponStockRow[]>([]);
  const [userCoupons, setUserCoupons] = useState<MallUserCouponRow[]>([]);
  const [couponLedger, setCouponLedger] = useState<MallCouponLedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const service = getSdkworkAdminRemotePort();
    const offersResponse = await service.admin.promotions.offers.management.list({ page: 1, page_size: 50 });
    const offersPayload = unwrapSdkworkPaymentResponse(offersResponse) as { items?: Record<string, unknown>[] };
    setOffers(
      offersPayload.items
        ?.filter((item) => !isCmsConfigOffer(item))
        .map((item) => ({
          id: String(item.id ?? ""),
          title: String(item.title ?? item.name ?? "活动"),
          status: String(item.status ?? "draft"),
        })) ?? [],
    );

    const [stocksResult, userCouponsResult, ledgerResult] = await Promise.allSettled([
      service.admin.promotions.couponStocks.list({ page: 1, page_size: 20 }),
      service.admin.promotions.userCoupons.management.list({ page: 1, page_size: 20 }),
      service.admin.promotions.couponLedgerEntries.list({ page: 1, page_size: 20 }),
    ]);
    if (stocksResult.status === "fulfilled") {
      const payload = unwrapSdkworkPaymentResponse(stocksResult.value) as unknown;
      setCouponStocks(
        readRemoteRows(payload).map((item) => ({
          id: readRemoteString(item, ["id", "couponStockId", "stockId"]),
          name: readRemoteString(item, ["name", "title", "couponName"]),
          remaining: readRemoteString(item, ["remainingQuantity", "remaining", "leftQuantity"]),
          total: readRemoteString(item, ["totalQuantity", "total", "issuedQuantity"]),
        })),
      );
    }
    if (userCouponsResult.status === "fulfilled") {
      const payload = unwrapSdkworkPaymentResponse(userCouponsResult.value) as unknown;
      setUserCoupons(
        readRemoteRows(payload).map((item) => ({
          id: readRemoteString(item, ["id", "userCouponId"]),
          status: readRemoteString(item, ["status", "statusName"]),
          title: readRemoteString(item, ["title", "name", "couponName"]),
          userId: readRemoteString(item, ["userId", "buyerId", "accountId"]),
        })),
      );
    }
    if (ledgerResult.status === "fulfilled") {
      const payload = unwrapSdkworkPaymentResponse(ledgerResult.value) as unknown;
      setCouponLedger(
        readRemoteRows(payload).map((item) => ({
          id: readRemoteString(item, ["id", "entryId"]),
          change: readRemoteString(item, ["changeQuantity", "quantity", "amount", "change"]),
          occurredAt: readRemoteString(item, ["occurredAt", "createdAt", "entryTime"]),
          reason: readRemoteString(item, ["reason", "reasonCode", "entryType", "remark"]),
        })),
      );
    }
  }, []);

  useEffect(() => {
    let active = true;
    reload()
      .catch(() => undefined)
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [reload]);

  async function handleCreate() {
    if (!title.trim()) {
      setMessage("请填写活动名称");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const service = getSdkworkAdminRemotePort();
      await service.admin.promotions.offers.create({
        code: code.trim() || undefined,
        description: "平台营销活动",
        status: "draft",
        title: title.trim(),
      });
      setTitle("");
      setCode("");
      setMessage("活动草稿已创建");
      await reload();
    } catch {
      setMessage("创建失败，请检查后台 API 与权限");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <LoadingBlock label="加载营销活动..." />;
  }

  return (
    <div className="sdkwork-mall-pc-admin-marketing">
      <header className="sdkwork-mall-pc-page-header">
        <div>
          <h1>营销平台</h1>
          <p>平台券、跨店促销、秒杀会场与首页资源位</p>
        </div>
      </header>

      <section className="sdkwork-mall-pc-form-grid">
        <h2>新建活动</h2>
        <label>
          活动名称
          <input onChange={(event) => setTitle(event.target.value)} value={title} />
        </label>
        <label>
          活动编码（可选）
          <input onChange={(event) => setCode(event.target.value)} placeholder="例如 SPRING_SALE" value={code} />
        </label>
        <Button disabled={busy} onClick={() => void handleCreate()} type="button">
          创建草稿
        </Button>
        {message ? <p>{message}</p> : null}
      </section>

      <section>
        <h2>活动列表</h2>
        {offers.length === 0 ? (
          <EmptyState description="在此创建平台级营销活动" title="暂无活动" />
        ) : (
          <table className="sdkwork-mall-pc-table">
            <thead>
              <tr>
                <th>活动</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {offers.map((offer) => (
                <tr key={offer.id}>
                  <td>{offer.title}</td>
                  <td>{offer.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2>平台优惠券</h2>
        <h3>券库存</h3>
        {couponStocks.length === 0 ? (
          <EmptyState description="券批次创建后在此展示库存" title="暂无券库存" />
        ) : (
          <table className="sdkwork-mall-pc-table">
            <thead>
              <tr>
                <th>券批次</th>
                <th>名称</th>
                <th>剩余 / 总量</th>
              </tr>
            </thead>
            <tbody>
              {couponStocks.map((stock) => (
                <tr key={stock.id}>
                  <td>{stock.id}</td>
                  <td>{stock.name}</td>
                  <td>{stock.remaining} / {stock.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <h3>用户领券</h3>
        {userCoupons.length === 0 ? (
          <EmptyState description="用户领取平台券后在此展示" title="暂无领券记录" />
        ) : (
          <table className="sdkwork-mall-pc-table">
            <thead>
              <tr>
                <th>券</th>
                <th>用户</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {userCoupons.map((coupon) => (
                <tr key={coupon.id}>
                  <td>{coupon.title}</td>
                  <td>{coupon.userId}</td>
                  <td>{coupon.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <h3>券流水</h3>
        {couponLedger.length === 0 ? (
          <EmptyState description="发放、核销与过期流水在此展示" title="暂无券流水" />
        ) : (
          <table className="sdkwork-mall-pc-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>变动</th>
                <th>原因</th>
              </tr>
            </thead>
            <tbody>
              {couponLedger.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.occurredAt}</td>
                  <td>{entry.change}</td>
                  <td>{entry.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
