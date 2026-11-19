import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button, EmptyState, LoadingBlock } from "@sdkwork/ui-pc-react";
import { unwrapSdkworkPaymentResponse } from "@sdkwork/payment-service";
import { getSdkworkMerchantRemotePort } from "../merchant-remote-port";

export function SdkworkMallMerchantDashboardPage() {
  const [metrics, setMetrics] = useState<Record<string, unknown> | null>(null);
  const [readiness, setReadiness] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const service = getSdkworkMerchantRemotePort();
        const [dashboardResult, readinessResult] = await Promise.allSettled([
          service.shops.current.dashboard.retrieve({}),
          service.shops.current.readiness.retrieve({}),
        ]);
        if (active) {
          if (dashboardResult.status === "fulfilled") {
            setMetrics(unwrapSdkworkPaymentResponse(dashboardResult.value) as Record<string, unknown>);
          }
          if (readinessResult.status === "fulfilled") {
            setReadiness(unwrapSdkworkPaymentResponse(readinessResult.value) as Record<string, unknown>);
          }
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <LoadingBlock label="加载商家工作台..." />;
  }

  return (
    <div className="sdkwork-mall-pc-merchant-dashboard">
      <h1>商家工作台</h1>
      {readiness ? (
        <section className="sdkwork-mall-pc-readiness-banner">
          <p>
            开店就绪：
            {String(readiness.ready ?? readiness.isReady ?? readiness.status ?? "待完善")}
          </p>
          {Array.isArray(readiness.blockers) && readiness.blockers.length > 0 ? (
            <ul>
              {(readiness.blockers as unknown[]).slice(0, 3).map((item, index) => (
                <li key={index}>{String(item)}</li>
              ))}
            </ul>
          ) : null}
          <Link to="/merchant/onboarding">查看入驻与就绪状态</Link>
        </section>
      ) : null}
      <div className="sdkwork-mall-pc-stat-grid">
        <article><span>今日销售额</span><strong>{String(metrics?.todaySales ?? metrics?.todaySalesAmountCny ?? metrics?.salesAmountCny ?? "-")}</strong></article>
        <article><span>待发货</span><strong>{String(metrics?.pendingShipment ?? metrics?.pendingShipmentCount ?? "-")}</strong></article>
        <article><span>售后处理中</span><strong>{String(metrics?.pendingAfterSales ?? metrics?.pendingAfterSalesCount ?? "-")}</strong></article>
        <article><span>商品预警</span><strong>{String(metrics?.productAlerts ?? metrics?.lowStockProducts ?? metrics?.lowStockCount ?? "-")}</strong></article>
      </div>
      <nav className="sdkwork-mall-pc-quick-links">
        <Link to="/merchant/onboarding">入驻申请</Link>
        <Link to="/merchant/shop">店铺装修</Link>
        <Link to="/merchant/products">发布商品</Link>
        <Link to="/merchant/inventory">库存管理</Link>
        <Link to="/merchant/orders">处理订单</Link>
        <Link to="/merchant/fulfillment">发货履约</Link>
        <Link to="/merchant/after-sales">售后处理</Link>
        <Link to="/merchant/service">客服中心</Link>
        <Link to="/merchant/marketing">营销中心</Link>
        <Link to="/merchant/settlement">查看结算</Link>
        <Link to="/merchant/data">数据中心</Link>
        <Link to="/merchant/settings">设置中心</Link>
      </nav>
    </div>
  );
}

export function SdkworkMallMerchantOnboardingPage() {
  const [step, setStep] = useState(1);
  const [shopName, setShopName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [category, setCategory] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [readiness, setReadiness] = useState<Record<string, unknown> | null>(null);
  const [latestApplication, setLatestApplication] = useState<{ id: string; status: string } | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      const service = getSdkworkMerchantRemotePort();
      const [readinessResult, appsResult] = await Promise.allSettled([
        service.shops.current.readiness.retrieve({}),
        service.shops.current.applications.list({ page: 1, page_size: 1 }),
      ]);
      if (!active) {
        return;
      }
      if (readinessResult.status === "fulfilled") {
        setReadiness(unwrapSdkworkPaymentResponse(readinessResult.value) as Record<string, unknown>);
      }
      if (appsResult.status === "fulfilled") {
        const payload = unwrapSdkworkPaymentResponse(appsResult.value) as { items?: Record<string, unknown>[] };
        const first = payload.items?.[0];
        if (first) {
          setLatestApplication({
            id: String(first.id ?? first.applicationNo ?? ""),
            status: String(first.reviewStatus ?? first.status ?? "pending"),
          });
          setStep(4);
        }
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit() {
    setBusy(true);
    setMessage(null);
    try {
      const service = getSdkworkMerchantRemotePort();
      await service.shops.current.applications.create({
        shopName,
        contactName,
        contactPhone,
        category,
      });
      setMessage("入驻申请已提交，请等待平台审核");
      setStep(4);
    } catch (cause: unknown) {
      setMessage(cause instanceof Error ? cause.message : "提交失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>商家入驻</h1>
      <ol className="sdkwork-mall-pc-onboarding-steps">
        <li className={step >= 1 ? "active" : ""}>主体与联系人</li>
        <li className={step >= 2 ? "active" : ""}>店铺与类目</li>
        <li className={step >= 3 ? "active" : ""}>协议与提交</li>
        <li className={step >= 4 ? "active" : ""}>平台审核</li>
      </ol>

      {step === 1 ? (
        <section className="sdkwork-mall-pc-form-grid">
          <label>
            联系人
            <input onChange={(event) => setContactName(event.target.value)} value={contactName} />
          </label>
          <label>
            联系电话
            <input onChange={(event) => setContactPhone(event.target.value)} value={contactPhone} />
          </label>
          <Button disabled={!contactName || !contactPhone} onClick={() => setStep(2)} type="button">
            下一步
          </Button>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="sdkwork-mall-pc-form-grid">
          <label>
            店铺名称
            <input onChange={(event) => setShopName(event.target.value)} value={shopName} />
          </label>
          <label>
            主营类目
            <input onChange={(event) => setCategory(event.target.value)} placeholder="例如：数码家电" value={category} />
          </label>
          <div className="sdkwork-mall-pc-form-actions">
            <Button onClick={() => setStep(1)} type="button">上一步</Button>
            <Button disabled={!shopName} onClick={() => setStep(3)} type="button">下一步</Button>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="sdkwork-mall-pc-form-grid">
          <p>提交即表示同意平台商家服务协议与保证金规则。资质材料上传与多步审核流待 shops.applications 扩展字段落地。</p>
          <ul>
            <li>店铺：{shopName || "-"}</li>
            <li>联系人：{contactName || "-"}</li>
            <li>电话：{contactPhone || "-"}</li>
            <li>类目：{category || "-"}</li>
          </ul>
          <div className="sdkwork-mall-pc-form-actions">
            <Button onClick={() => setStep(2)} type="button">上一步</Button>
            <Button disabled={busy || !shopName} onClick={() => void handleSubmit()} type="button">
              提交入驻申请
            </Button>
          </div>
        </section>
      ) : null}

      {step === 4 ? (
        <section>
          <p>申请已提交，平台将在 1–3 个工作日内完成审核。审核进度可在商家工作台查看。</p>
          {latestApplication ? (
            <p>最新申请：{latestApplication.id} — 状态 {latestApplication.status}</p>
          ) : null}
          {readiness ? (
            <p>开店就绪：{String(readiness.ready ?? readiness.isReady ?? readiness.status ?? "-")}</p>
          ) : null}
          <Link to="/merchant">返回商家工作台</Link>
        </section>
      ) : null}

      {message ? <p>{message}</p> : null}
    </div>
  );
}

export function SdkworkMallMerchantProductsPage() {
  const [products, setProducts] = useState<Array<{ id: string; status: string; title: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    setMessage(null);
    try {
      const service = getSdkworkMerchantRemotePort();
      const response = await service.shops.current.products.list({ page: 1, page_size: 50 });
      const payload = unwrapSdkworkPaymentResponse(response) as { items?: Record<string, unknown>[] };
      setProducts(
        payload.items?.map((item) => ({
          id: String(item.id ?? ""),
          title: String(item.title ?? item.name ?? "商品"),
          // The authority may emit UPPER_SNAKE statuses; the action buttons
          // compare lowercase lifecycle names.
          status: String(item.status ?? "draft").toLowerCase(),
        })) ?? [],
      );
    } catch (cause: unknown) {
      setMessage(cause instanceof Error ? cause.message : "商品加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function handlePublish(productId: string, action: "publish" | "unpublish") {
    setBusyId(productId);
    setMessage(null);
    try {
      const service = getSdkworkMerchantRemotePort();
      if (action === "publish") {
        await service.shops.current.products.publish(productId, {});
      } else {
        await service.shops.current.products.unpublish(productId, {});
      }
      setMessage(action === "publish" ? "商品已提交上架" : "商品已下架");
      await reload();
    } catch {
      setMessage("操作失败，请确认商品状态与平台审核结果");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <LoadingBlock label="加载商品..." />;
  }

  return (
    <div>
      <h1>商品中心</h1>
      {message ? (
        <div>
          <p>{message}</p>
          <Button onClick={() => void reload()} type="button">重试</Button>
        </div>
      ) : null}
      <Button
        onClick={async () => {
          const service = getSdkworkMerchantRemotePort();
          await service.shops.current.products.create({ title: "新商品草稿" });
          await reload();
        }}
        type="button"
      >
        新建商品草稿
      </Button>
      {products.length === 0 ? (
        <EmptyState description="创建商品草稿并提交平台审核" title="暂无商品" />
      ) : (
        <table className="sdkwork-mall-pc-table">
          <thead>
            <tr>
              <th>商品</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                <td>{product.title}</td>
                <td>{product.status}</td>
                <td className="sdkwork-mall-pc-table-actions">
                  {product.status === "draft" || product.status === "unpublished" ? (
                    <Button
                      disabled={busyId === product.id}
                      onClick={() => void handlePublish(product.id, "publish")}
                      type="button"
                    >
                      上架
                    </Button>
                  ) : null}
                  {product.status === "published" || product.status === "active" ? (
                    <Button
                      disabled={busyId === product.id}
                      onClick={() => void handlePublish(product.id, "unpublish")}
                      type="button"
                    >
                      下架
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function SdkworkMallMerchantOrdersPage() {
  const [orders, setOrders] = useState<Array<{ id: string; status: string; subject?: string }>>([]);
  const [filter, setFilter] = useState<"all" | "paid" | "pending_shipment" | "completed">("all");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orderDetail, setOrderDetail] = useState<Record<string, unknown> | null>(null);

  async function reload() {
    setLoading(true);
    try {
      const service = getSdkworkMerchantRemotePort();
      const response = await service.shops.current.orders.list({
        page: 1,
        page_size: 50,
        status: filter === "all" ? undefined : filter,
      });
      const payload = unwrapSdkworkPaymentResponse(response) as { items?: Record<string, unknown>[] };
      setOrders(
        payload.items?.map((item) => ({
          id: String(item.id ?? ""),
          subject: typeof item.subject === "string" ? item.subject : undefined,
          status: String(item.status ?? "unknown").toLowerCase(),
        })) ?? [],
      );
    } catch (cause: unknown) {
      setMessage(cause instanceof Error ? cause.message : "订单加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, [filter]);

  useEffect(() => {
    if (!selectedOrderId) {
      setOrderDetail(null);
      return;
    }
    const orderId = selectedOrderId;
    let active = true;
    async function loadDetail() {
      const service = getSdkworkMerchantRemotePort();
      const response = await service.shops.current.orders.retrieve(orderId);
      if (active) {
        setOrderDetail(unwrapSdkworkPaymentResponse(response) as Record<string, unknown>);
      }
    }
    void loadDetail();
    return () => {
      active = false;
    };
  }, [selectedOrderId]);

  async function handleShip(orderId: string) {
    setBusyId(orderId);
    setMessage(null);
    try {
      const service = getSdkworkMerchantRemotePort();
      await service.shops.current.orders.fulfillments.create(orderId, {
        carrierCode: "default",
        trackingNumber: `SF${Date.now()}`,
      });
      setMessage(`订单 ${orderId} 已创建发货单`);
      await reload();
    } catch {
      setMessage("发货失败，请确认订单状态");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <LoadingBlock label="加载订单..." />;
  }

  return (
    <div>
      <h1>订单中心</h1>
      <nav className="sdkwork-mall-pc-chip-row">
        <button onClick={() => setFilter("all")} type="button">全部</button>
        <button onClick={() => setFilter("paid")} type="button">待发货</button>
        <button onClick={() => setFilter("pending_shipment")} type="button">履约中</button>
        <button onClick={() => setFilter("completed")} type="button">已完成</button>
      </nav>
      {message ? <p>{message}</p> : null}
      {orders.length === 0 ? (
        <EmptyState description="买家下单后将在此展示" title="暂无订单" />
      ) : (
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
                <td>{order.subject ?? order.id}</td>
                <td>{order.status}</td>
                <td className="sdkwork-mall-pc-table-actions">
                  <Button onClick={() => setSelectedOrderId(order.id)} type="button">详情</Button>
                  {order.status === "paid" || order.status === "pending_shipment" ? (
                    <Button disabled={busyId === order.id} onClick={() => void handleShip(order.id)} type="button">
                      发货
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {selectedOrderId && orderDetail ? (
        <section className="sdkwork-mall-pc-form-grid">
          <h2>订单详情</h2>
          <p>订单号：{selectedOrderId}</p>
          <p>状态：{String(orderDetail.status ?? "-")}</p>
          <p>金额：{String(orderDetail.payAmount ?? orderDetail.totalAmount ?? "-")}</p>
          <p>买家备注：{String(orderDetail.buyerRemark ?? orderDetail.remark ?? "-")}</p>
          <Button onClick={() => setSelectedOrderId(null)} type="button">关闭</Button>
        </section>
      ) : null}
    </div>
  );
}

export function SdkworkMallMerchantInventoryPage() {
  const [stocks, setStocks] = useState<Array<{ available: string; id: string; skuId: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adjustQty, setAdjustQty] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const service = getSdkworkMerchantRemotePort();
      const response = await service.shops.current.inventory.stocks.list({ page: 1, page_size: 50 });
      const payload = unwrapSdkworkPaymentResponse(response) as { items?: Record<string, unknown>[] };
      setStocks(
        payload.items?.map((item) => ({
          id: String(item.id ?? item.stockId ?? ""),
          skuId: String(item.skuId ?? item.sku_id ?? "-"),
          available: String(item.availableQuantity ?? item.available ?? item.availableStock ?? "-"),
        })) ?? [],
      );
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "库存加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function handleAdjust(stockId: string) {
    const delta = Number(adjustQty[stockId] ?? 0);
    if (!Number.isFinite(delta) || delta === 0) {
      return;
    }
    setBusyId(stockId);
    try {
      const service = getSdkworkMerchantRemotePort();
      await service.shops.current.inventory.stocks.adjustments.create(stockId, {
        deltaQuantity: delta,
        reason: "merchant-adjustment",
      });
      await reload();
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <LoadingBlock label="加载库存..." />;
  }

  return (
    <div>
      <h1>库存管理</h1>
      {error ? (
        <div>
          <p>{error}</p>
          <Button onClick={() => void reload()} type="button">重试</Button>
        </div>
      ) : null}
      {stocks.length === 0 ? (
        <EmptyState description="商品 SKU 入库后将在此展示库存" title="暂无库存记录" />
      ) : (
        <table className="sdkwork-mall-pc-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>可用库存</th>
              <th>调整数量</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {stocks.map((stock) => (
              <tr key={stock.id}>
                <td>{stock.skuId}</td>
                <td>{stock.available}</td>
                <td>
                  <input
                    onChange={(event) => setAdjustQty((current) => ({ ...current, [stock.id]: event.target.value }))}
                    placeholder="+/-"
                    type="number"
                    value={adjustQty[stock.id] ?? ""}
                  />
                </td>
                <td>
                  <Button disabled={busyId === stock.id} onClick={() => void handleAdjust(stock.id)} type="button">
                    调整
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function SdkworkMallMerchantFulfillmentPage() {
  const [orders, setOrders] = useState<Array<{ id: string; status: string; subject?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    try {
      const service = getSdkworkMerchantRemotePort();
      const response = await service.shops.current.orders.list({ status: "paid", page: 1, page_size: 20 });
      const payload = unwrapSdkworkPaymentResponse(response) as { items?: Record<string, unknown>[] };
      setOrders(
        payload.items?.map((item) => ({
          id: String(item.id ?? ""),
          subject: typeof item.subject === "string" ? item.subject : undefined,
          status: String(item.status ?? "unknown").toLowerCase(),
        })) ?? [],
      );
    } catch (cause: unknown) {
      setMessage(cause instanceof Error ? cause.message : "待发货订单加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function handleShip(orderId: string) {
    setBusyId(orderId);
    setMessage(null);
    try {
      const service = getSdkworkMerchantRemotePort();
      await service.shops.current.orders.fulfillments.create(orderId, {
        carrierCode: "default",
        trackingNumber: `SF${Date.now()}`,
      });
      setMessage(`订单 ${orderId} 已创建发货单`);
      await reload();
    } catch {
      setMessage("发货失败，请确认订单状态");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <LoadingBlock label="加载待发货订单..." />;
  }

  return (
    <div>
      <h1>发货履约</h1>
      <p>待发货订单可直接在此创建发货单，也可前往订单中心处理。</p>
      {message ? <p>{message}</p> : null}
      {orders.length === 0 ? (
        <EmptyState description="已付款待发货订单将在此展示" title="暂无待发货订单" />
      ) : (
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
                <td>{order.subject ?? order.id}</td>
                <td>{order.status}</td>
                <td>
                  <Button disabled={busyId === order.id} onClick={() => void handleShip(order.id)} type="button">
                    发货
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function SdkworkMallMerchantSettlementPage() {
  const [settlements, setSettlements] = useState<Array<{ amount: string; id: string; status: string }>>([]);
  const [deposit, setDeposit] = useState<Record<string, unknown> | null>(null);
  const [settlementProfile, setSettlementProfile] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const service = getSdkworkMerchantRemotePort();
      const [settlementsResult, depositResult, profileResult] = await Promise.allSettled([
        service.shops.current.settlements.list({ page: 1, page_size: 10 }),
        service.shops.current.depositAccount.retrieve({}),
        service.shops.current.settlementProfile.retrieve({}),
      ]);
      if (!active) {
        return;
      }
      if (settlementsResult.status === "fulfilled") {
        const payload = unwrapSdkworkPaymentResponse(settlementsResult.value) as { items?: Record<string, unknown>[] };
        setSettlements(
          payload.items?.map((item) => ({
            id: String(item.id ?? ""),
            status: String(item.status ?? "pending"),
            amount: String(item.amount ?? item.settlementAmount ?? "-"),
          })) ?? [],
        );
      }
      if (depositResult.status === "fulfilled") {
        setDeposit(unwrapSdkworkPaymentResponse(depositResult.value) as Record<string, unknown>);
      }
      if (profileResult.status === "fulfilled") {
        setSettlementProfile(unwrapSdkworkPaymentResponse(profileResult.value) as Record<string, unknown>);
      }
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <LoadingBlock label="加载结算单..." />;
  }

  return (
    <div>
      <h1>结算中心</h1>
      <p>账单、佣金、保证金与提现账户</p>
      <section className="sdkwork-mall-pc-stat-grid">
        <article>
          <span>保证金余额</span>
          <strong>{String(deposit?.balance ?? deposit?.availableBalance ?? "-")}</strong>
        </article>
        <article>
          <span>结算账户</span>
          <strong>{String(settlementProfile?.accountName ?? settlementProfile?.bankAccountNo ?? "-")}</strong>
        </article>
        <article>
          <span>结算状态</span>
          <strong>{String(settlementProfile?.status ?? settlementProfile?.reviewStatus ?? "-")}</strong>
        </article>
      </section>
      {settlements.length === 0 ? (
        <EmptyState description="订单完成后将生成结算单" title="暂无结算单" />
      ) : (
        <table className="sdkwork-mall-pc-table">
          <thead>
            <tr>
              <th>结算单</th>
              <th>金额</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            {settlements.map((row) => (
              <tr key={row.id}><td>{row.id}</td><td>{row.amount}</td><td>{row.status}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function SdkworkMallMerchantShopPage() {
  const [shopName, setShopName] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [channelTheme, setChannelTheme] = useState("default");
  const [policyId, setPolicyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      const service = getSdkworkMerchantRemotePort();
      try {
        const shopResponse = await service.shops.current.retrieve({});
        const shop = unwrapSdkworkPaymentResponse(shopResponse) as Record<string, unknown>;
        if (active) {
          setShopName(String(shop.name ?? shop.shopName ?? ""));
        }

        const channelsResponse = await service.shops.current.channels.list({ page: 1, page_size: 5 });
        const channelsPayload = unwrapSdkworkPaymentResponse(channelsResponse) as {
          items?: Record<string, unknown>[];
        };
        const channel = channelsPayload.items?.[0];
        if (channel && active) {
          const config = channel.channelConfigJson ?? channel.channel_config_json;
          if (typeof config === "object" && config !== null && "theme" in config) {
            setChannelTheme(String((config as { theme?: unknown }).theme ?? "default"));
          }
        }

        const policiesResponse = await service.shops.current.policies.list({ page: 1, page_size: 5 });
        const policiesPayload = unwrapSdkworkPaymentResponse(policiesResponse) as {
          items?: Record<string, unknown>[];
        };
        const announcementPolicy = policiesPayload.items?.find(
          (policy) => String(policy.policyType ?? policy.policy_type ?? "") === "announcement",
        );
        if (announcementPolicy && active) {
          setPolicyId(String(announcementPolicy.id ?? ""));
          const policyJson = announcementPolicy.policyJson ?? announcementPolicy.policy_json;
          if (typeof policyJson === "object" && policyJson !== null && "content" in policyJson) {
            setAnnouncement(String((policyJson as { content?: unknown }).content ?? ""));
          }
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  async function handleSave() {
    setBusy(true);
    setMessage(null);
    try {
      const service = getSdkworkMerchantRemotePort();
      const channelsResponse = await service.shops.current.channels.list({ page: 1, page_size: 1 });
      const channelsPayload = unwrapSdkworkPaymentResponse(channelsResponse) as {
        items?: Record<string, unknown>[];
      };
      const channel = channelsPayload.items?.[0];
      if (channel?.id) {
        await service.shops.current.channels.update(String(channel.id), {
          channelConfigJson: { theme: channelTheme },
        });
      }

      if (policyId) {
        await service.shops.current.policies.update(policyId, {
          policyJson: { content: announcement },
        });
      }

      setMessage("店铺装修已保存");
    } catch (cause: unknown) {
      setMessage(cause instanceof Error ? cause.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <LoadingBlock label="加载店铺信息..." />;
  }

  return (
    <div>
      <h1>店铺中心</h1>
      <p>管理店铺公告、主题风格与首页展示模块</p>
      <section className="sdkwork-mall-pc-form-grid">
        <label>
          店铺名称
          <input readOnly value={shopName} />
        </label>
        <label>
          店铺公告
          <textarea onChange={(event) => setAnnouncement(event.target.value)} value={announcement} />
        </label>
        <label>
          主题风格
          <select onChange={(event) => setChannelTheme(event.target.value)} value={channelTheme}>
            <option value="default">默认主题</option>
            <option value="brand">品牌主题</option>
            <option value="festival">活动主题</option>
          </select>
        </label>
      </section>
      {message ? <p>{message}</p> : null}
      <Button disabled={busy} onClick={() => void handleSave()} type="button">
        保存装修
      </Button>
    </div>
  );
}

export function SdkworkMallMerchantMarketingPage() {
  const [offers, setOffers] = useState<Array<{ id: string; status: string; title: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const service = getSdkworkMerchantRemotePort();
      const response = await service.promotions.offers.list({ page: 1, page_size: 20, status: "active" });
      const payload = unwrapSdkworkPaymentResponse(response) as { items?: Record<string, unknown>[] };
      if (active) {
        setOffers(
          payload.items?.map((item) => ({
            id: String(item.id ?? ""),
            title: String(item.title ?? item.name ?? "活动"),
            status: String(item.status ?? "active"),
          })) ?? [],
        );
        setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <LoadingBlock label="加载营销中心..." />;
  }

  return (
    <div>
      <h1>营销中心</h1>
      <p>平台可报名活动与店铺优惠券（店铺自主创建活动需等待 merchant promotions 专用 API）</p>
      <ul>
        <li>店铺优惠券与满减活动</li>
        <li>限时秒杀与特价促销</li>
        <li>组合购与加价购活动</li>
      </ul>
      {offers.length === 0 ? (
        <EmptyState description="可报名或创建店铺级活动后将在此展示" title="暂无进行中的活动" />
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
      <p>以下为平台级可报名活动列表。店铺自主创建活动需等待 merchant promotions 专用 API 合约落地。</p>
    </div>
  );
}

export function SdkworkMallMerchantDataPage() {
  const [metrics, setMetrics] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      const service = getSdkworkMerchantRemotePort();
      const response = await service.shops.current.dashboard.retrieve({});
      if (active) {
        setMetrics(unwrapSdkworkPaymentResponse(response) as Record<string, unknown>);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div>
      <h1>数据中心</h1>
      <div className="sdkwork-mall-pc-stat-grid">
        <article><span>访客数</span><strong>{String(metrics?.visitors ?? "-")}</strong></article>
        <article><span>转化率</span><strong>{String(metrics?.conversionRate ?? "-")}</strong></article>
        <article><span>销售额</span><strong>{String(metrics?.todaySales ?? metrics?.todaySalesAmountCny ?? metrics?.salesAmountCny ?? "-")}</strong></article>
        <article><span>退款率</span><strong>{String(metrics?.refundRate ?? "-")}</strong></article>
      </div>
    </div>
  );
}

export function SdkworkMallMerchantServicePage() {
  const [orders, setOrders] = useState<Array<{ id: string; status: string; total?: string }>>([]);
  const [afterSales, setAfterSales] = useState<Array<{ id: string; orderId?: string; status: string; type: string }>>([]);
  const [customerServices, setCustomerServices] = useState<Array<{ channel: string; contact: string; status: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const service = getSdkworkMerchantRemotePort();
      const [ordersResult, afterSalesResult, servicesResult] = await Promise.allSettled([
        service.shops.current.orders.list({ page: 1, page_size: 8 }),
        service.afterSales.requests.list({ page: 1, page_size: 8 }),
        service.shops.current.customerServices.list({ page: 1, page_size: 5 }),
      ]);

      if (!active) {
        return;
      }

      if (ordersResult.status === "fulfilled") {
        const payload = unwrapSdkworkPaymentResponse(ordersResult.value) as { items?: Record<string, unknown>[] };
        setOrders(
          payload.items?.map((item) => ({
            id: String(item.id ?? item.orderNo ?? ""),
            status: String(item.status ?? "pending"),
            total: item.payAmount != null ? String(item.payAmount) : undefined,
          })) ?? [],
        );
      }

      if (afterSalesResult.status === "fulfilled") {
        const payload = unwrapSdkworkPaymentResponse(afterSalesResult.value) as { items?: Record<string, unknown>[] };
        setAfterSales(
          payload.items?.map((item) => ({
            id: String(item.id ?? ""),
            orderId: typeof item.orderId === "string" ? item.orderId : undefined,
            type: String(item.type ?? item.requestType ?? "售后"),
            status: String(item.status ?? "pending"),
          })) ?? [],
        );
      }

      if (servicesResult.status === "fulfilled" && active) {
        const payload = unwrapSdkworkPaymentResponse(servicesResult.value) as { items?: Record<string, unknown>[] };
        setCustomerServices(
          payload.items?.map((item) => ({
            channel: String(item.serviceChannel ?? item.service_channel ?? "在线客服"),
            contact: String(item.contactValue ?? item.contact_value ?? item.contact ?? "-"),
            status: String(item.serviceStatus ?? item.service_status ?? "active"),
          })) ?? [],
        );
      }

      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <LoadingBlock label="加载客服工作台..." />;
  }

  return (
    <div>
      <h1>客服中心</h1>
      <p>订单咨询、售后接待与快捷处理入口</p>
      <nav className="sdkwork-mall-pc-quick-links">
        <Link to="/merchant/orders">订单中心</Link>
        <Link to="/merchant/after-sales">售后处理</Link>
      </nav>

      <section className="sdkwork-mall-pc-form-grid">
        <h2>客服渠道</h2>
        {customerServices.length === 0 ? (
          <EmptyState description="在设置中心配置客服联系方式" title="暂无客服渠道" />
        ) : (
          <table className="sdkwork-mall-pc-table">
            <thead>
              <tr>
                <th>渠道</th>
                <th>联系方式</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {customerServices.map((row, index) => (
                <tr key={`${row.channel}-${index}`}>
                  <td>{row.channel}</td>
                  <td>{row.contact}</td>
                  <td>{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p>实时 IM 会话需等待 commerce 客服消息 API 合约落地。</p>
      </section>

      <section className="sdkwork-mall-pc-form-grid">
        <h2>待处理订单</h2>
        {orders.length === 0 ? (
          <EmptyState description="买家订单将在此展示" title="暂无订单" />
        ) : (
          <table className="sdkwork-mall-pc-table">
            <thead>
              <tr>
                <th>订单号</th>
                <th>状态</th>
                <th>金额</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((row) => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>{row.status}</td>
                  <td>{row.total ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="sdkwork-mall-pc-form-grid">
        <h2>售后咨询</h2>
        {afterSales.length === 0 ? (
          <EmptyState description="买家售后申请将在此展示" title="暂无售后单" />
        ) : (
          <table className="sdkwork-mall-pc-table">
            <thead>
              <tr>
                <th>类型</th>
                <th>状态</th>
                <th>关联订单</th>
              </tr>
            </thead>
            <tbody>
              {afterSales.map((row) => (
                <tr key={row.id}>
                  <td>{row.type}</td>
                  <td>{row.status}</td>
                  <td>{row.orderId ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

export function SdkworkMallMerchantAfterSalesPage() {
  const [rows, setRows] = useState<Array<{ id: string; orderId?: string; status: string; type: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);

  async function reload() {
    setLoading(true);
    const service = getSdkworkMerchantRemotePort();
    const response = await service.afterSales.requests.list({});
    const payload = unwrapSdkworkPaymentResponse(response) as { items?: Record<string, unknown>[] };
    setRows(
      payload.items?.map((item) => ({
        id: String(item.id ?? ""),
        orderId: typeof item.orderId === "string" ? item.orderId : undefined,
        type: String(item.type ?? item.requestType ?? "售后"),
        status: String(item.status ?? "pending"),
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
    const detailId = selectedId;
    let active = true;
    async function loadDetail() {
      const service = getSdkworkMerchantRemotePort();
      const response = await service.afterSales.requests.retrieve(detailId);
      if (active) {
        setDetail(unwrapSdkworkPaymentResponse(response) as Record<string, unknown>);
      }
    }
    void loadDetail();
    return () => {
      active = false;
    };
  }, [selectedId]);

  if (loading) {
    return <LoadingBlock label="加载售后..." />;
  }

  return (
    <div>
      <h1>售后处理</h1>
      {rows.length === 0 ? (
        <EmptyState description="买家售后申请将在此展示" title="暂无售后单" />
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
                <td>
                  <Button onClick={() => setSelectedId(row.id)} type="button">查看</Button>
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
          <p>类型：{String(detail.type ?? detail.requestType ?? "-")}</p>
          <p>状态：{String(detail.status ?? "-")}</p>
          <p>原因：{String(detail.reasonCode ?? detail.reason ?? "-")}</p>
          <p>平台审核操作需通过 Admin 后台 `afterSales.reviews.create` 完成。</p>
        </section>
      ) : null}
    </div>
  );
}

export function SdkworkMallMerchantSettingsPage() {
  const [shop, setShop] = useState<Record<string, unknown> | null>(null);
  const [applications, setApplications] = useState<Array<{ id: string; status: string; type: string }>>([]);
  const [bindings, setBindings] = useState<Array<{ category: string; status: string }>>([]);
  const [brands, setBrands] = useState<Array<{ brand: string; status: string }>>([]);
  const [qualifications, setQualifications] = useState<Array<{ status: string; type: string }>>([]);
  const [shippingTemplates, setShippingTemplates] = useState<Array<{ id: string; name: string; status: string }>>([]);
  const [returnAddresses, setReturnAddresses] = useState<Array<{ id: string; label: string; status: string }>>([]);
  const [fulfillmentProfile, setFulfillmentProfile] = useState<Record<string, unknown> | null>(null);
  const [businessHours, setBusinessHours] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const service = getSdkworkMerchantRemotePort();
      const [
        shopResult,
        appsResult,
        bindingsResult,
        brandsResult,
        qualificationsResult,
        shippingResult,
        returnResult,
        fulfillmentResult,
        hoursResult,
      ] = await Promise.allSettled([
        service.shops.current.retrieve({}),
        service.shops.current.applications.list({ page: 1, page_size: 5 }),
        service.shops.current.categoryBindings.list({ page: 1, page_size: 10 }),
        service.shops.current.brandAuthorizations.list({ page: 1, page_size: 10 }),
        service.shops.current.qualifications.list({ page: 1, page_size: 10 }),
        service.shops.current.shippingTemplates.list({ page: 1, page_size: 5 }),
        service.shops.current.returnAddresses.list({ page: 1, page_size: 5 }),
        service.shops.current.fulfillmentProfile.retrieve({}),
        service.shops.current.businessHours.retrieve({}),
      ]);

      if (shopResult.status === "fulfilled" && active) {
        setShop(unwrapSdkworkPaymentResponse(shopResult.value) as Record<string, unknown>);
      }
      if (appsResult.status === "fulfilled" && active) {
        const payload = unwrapSdkworkPaymentResponse(appsResult.value) as { items?: Record<string, unknown>[] };
        setApplications(
          payload.items?.map((item) => ({
            id: String(item.id ?? item.applicationNo ?? ""),
            type: String(item.applicationType ?? item.type ?? "入驻"),
            status: String(item.reviewStatus ?? item.status ?? "pending"),
          })) ?? [],
        );
      }
      if (bindingsResult.status === "fulfilled" && active) {
        const payload = unwrapSdkworkPaymentResponse(bindingsResult.value) as { items?: Record<string, unknown>[] };
        setBindings(
          payload.items?.map((item) => ({
            category: String(item.platformCategoryName ?? item.platform_category_name ?? item.shopCategoryCode ?? "类目"),
            status: String(item.reviewStatus ?? item.categoryStatus ?? "pending"),
          })) ?? [],
        );
      }
      if (brandsResult.status === "fulfilled" && active) {
        const payload = unwrapSdkworkPaymentResponse(brandsResult.value) as { items?: Record<string, unknown>[] };
        setBrands(
          payload.items?.map((item) => ({
            brand: String(item.brandName ?? item.brand_name ?? item.brandCode ?? "品牌"),
            status: String(item.authorizationStatus ?? item.authorization_status ?? "pending"),
          })) ?? [],
        );
      }
      if (qualificationsResult.status === "fulfilled" && active) {
        const payload = unwrapSdkworkPaymentResponse(qualificationsResult.value) as { items?: Record<string, unknown>[] };
        setQualifications(
          payload.items?.map((item) => ({
            type: String(item.qualificationType ?? item.qualification_type ?? "资质"),
            status: String(item.qualificationStatus ?? item.qualification_status ?? "pending"),
          })) ?? [],
        );
      }
      if (shippingResult.status === "fulfilled" && active) {
        const payload = unwrapSdkworkPaymentResponse(shippingResult.value) as { items?: Record<string, unknown>[] };
        setShippingTemplates(
          payload.items?.map((item) => ({
            id: String(item.id ?? ""),
            name: String(item.templateName ?? item.name ?? "运费模板"),
            status: String(item.templateStatus ?? item.status ?? "active"),
          })) ?? [],
        );
      }
      if (returnResult.status === "fulfilled" && active) {
        const payload = unwrapSdkworkPaymentResponse(returnResult.value) as { items?: Record<string, unknown>[] };
        setReturnAddresses(
          payload.items?.map((item) => ({
            id: String(item.id ?? ""),
            label: String(item.contactName ?? item.addressLabel ?? item.fullAddress ?? "退货地址"),
            status: String(item.addressStatus ?? item.status ?? "active"),
          })) ?? [],
        );
      }
      if (fulfillmentResult.status === "fulfilled" && active) {
        setFulfillmentProfile(unwrapSdkworkPaymentResponse(fulfillmentResult.value) as Record<string, unknown>);
      }
      if (hoursResult.status === "fulfilled" && active) {
        setBusinessHours(unwrapSdkworkPaymentResponse(hoursResult.value) as Record<string, unknown>);
      }
      if (active) {
        setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <LoadingBlock label="加载店铺设置..." />;
  }

  return (
    <div>
      <h1>设置中心</h1>
      <section className="sdkwork-mall-pc-form-grid">
        <h2>店铺信息</h2>
        <p>店铺名称：{String(shop?.name ?? shop?.shopName ?? "-")}</p>
        <p>经营状态：{String(shop?.operationStatus ?? shop?.status ?? "-")}</p>
        <p>默认币种：{String(shop?.defaultCurrencyCode ?? "CNY")}</p>
        <p>履约模式：{String(fulfillmentProfile?.fulfillmentMode ?? fulfillmentProfile?.mode ?? "-")}</p>
        <p>营业时间：{String(businessHours?.summary ?? businessHours?.timezone ?? "-")}</p>
      </section>

      <section className="sdkwork-mall-pc-form-grid">
        <h2>入驻申请记录</h2>
        {applications.length === 0 ? (
          <EmptyState description="提交入驻后将在此展示进度" title="暂无申请记录" />
        ) : (
          <ul>
            {applications.map((app) => (
              <li key={app.id}>{app.type} — {app.status}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="sdkwork-mall-pc-form-grid">
        <h2>类目资质</h2>
        {bindings.length === 0 ? (
          <EmptyState description="平台类目绑定与资质审核将在此展示" title="暂无类目绑定" />
        ) : (
          <table className="sdkwork-mall-pc-table">
            <thead>
              <tr>
                <th>类目</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {bindings.map((row, index) => (
                <tr key={`${row.category}-${index}`}>
                  <td>{row.category}</td>
                  <td>{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="sdkwork-mall-pc-form-grid">
        <h2>品牌授权</h2>
        {brands.length === 0 ? (
          <EmptyState description="提交品牌授权后将在此展示审核进度" title="暂无品牌授权" />
        ) : (
          <table className="sdkwork-mall-pc-table">
            <thead>
              <tr>
                <th>品牌</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {brands.map((row, index) => (
                <tr key={`${row.brand}-${index}`}>
                  <td>{row.brand}</td>
                  <td>{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="sdkwork-mall-pc-form-grid">
        <h2>经营资质</h2>
        {qualifications.length === 0 ? (
          <EmptyState description="营业执照等资质审核将在此展示" title="暂无资质记录" />
        ) : (
          <table className="sdkwork-mall-pc-table">
            <thead>
              <tr>
                <th>类型</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {qualifications.map((row, index) => (
                <tr key={`${row.type}-${index}`}>
                  <td>{row.type}</td>
                  <td>{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="sdkwork-mall-pc-form-grid">
        <h2>运费模板</h2>
        {shippingTemplates.length === 0 ? (
          <EmptyState description="配置运费模板后将在此展示" title="暂无运费模板" />
        ) : (
          <table className="sdkwork-mall-pc-table">
            <thead>
              <tr>
                <th>模板</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {shippingTemplates.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="sdkwork-mall-pc-form-grid">
        <h2>退货地址</h2>
        {returnAddresses.length === 0 ? (
          <EmptyState description="配置退货地址后将在此展示" title="暂无退货地址" />
        ) : (
          <table className="sdkwork-mall-pc-table">
            <thead>
              <tr>
                <th>地址</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {returnAddresses.map((row) => (
                <tr key={row.id}>
                  <td>{row.label}</td>
                  <td>{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <p>子账号与角色权限需等待 shops.current.members 专用 API 合约落地。</p>
    </div>
  );
}
