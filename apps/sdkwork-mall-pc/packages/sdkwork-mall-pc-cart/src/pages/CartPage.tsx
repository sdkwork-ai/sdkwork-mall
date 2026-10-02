import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Badge, Button, Checkbox, EmptyState, LoadingBlock, StatusNotice } from "@sdkwork/ui-pc-react";
import { formatSdkworkPaymentCurrencyCny as formatSdkworkCommerceCurrencyCny } from "@sdkwork/payment-service";
import { searchMallProducts } from "@sdkwork/mall-pc-search/search-service";
import {
  createMallCheckoutQuote,
  listMallPaymentMethods,
  loadMallCart,
  loadMallCheckoutContext,
  MALL_CHECKOUT_WARNINGS_STORAGE_KEY,
  removeMallCartItem,
  retrieveMallOrderPaymentSuccess,
  retryMallOrderPayment,
  submitMallCheckoutOrder,
  updateMallCartItem,
  type MallCartLine,
  type MallCartSnapshot,
  type MallCheckoutContext,
  type MallCheckoutInvoiceForm,
  type MallCheckoutQuote,
} from "../cart-service";

interface CartItemSelection {
  selected: Set<string>;
}

function buildShopGroups(items: MallCartLine[]): Map<string, MallCartLine[]> {
  return items.reduce<Map<string, MallCartLine[]>>((groups, item) => {
    const shopName = item.shopName ?? "平台自营";
    const existing = groups.get(shopName) ?? [];
    groups.set(shopName, [...existing, item]);
    return groups;
  }, new Map());
}

function computeSelectedTotals(
  items: MallCartLine[],
  selected: Set<string>,
): { amount: number; count: number; quantity: number } {
  let count = 0;
  let quantity = 0;
  let amount = 0;
  for (const item of items) {
    if (selected.has(item.id)) {
      count += 1;
      quantity += item.quantity;
      amount += item.lineTotalCny ?? 0;
    }
  }
  return { amount, count, quantity };
}

export function SdkworkMallCartPage() {
  const [cart, setCart] = useState<MallCartSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [selection, setSelection] = useState<CartItemSelection>({ selected: new Set() });
  const [removing, setRemoving] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const snapshot = await loadMallCart();
      setCart(snapshot);
      setSelection((previous) => {
        const validIds = new Set(snapshot.items.map((item) => item.id));
        const next = new Set<string>();
        for (const id of previous.selected) {
          if (validIds.has(id)) {
            next.add(id);
          }
        }
        return { selected: next };
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const shopGroups = useMemo(
    () => (cart ? buildShopGroups(cart.items) : new Map<string, MallCartLine[]>()),
    [cart],
  );

  const allItemIds = useMemo(() => (cart ? cart.items.map((item) => item.id) : []), [cart]);
  const allSelected = allItemIds.length > 0 && allItemIds.every((id) => selection.selected.has(id));
  const someSelected = allItemIds.some((id) => selection.selected.has(id));
  const selectedTotals = useMemo(
    () => (cart ? computeSelectedTotals(cart.items, selection.selected) : { amount: 0, count: 0, quantity: 0 }),
    [cart, selection],
  );

  function toggleItem(itemId: string) {
    setSelection((previous) => {
      const next = new Set(previous.selected);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return { selected: next };
    });
  }

  function toggleShopGroup(shopItems: MallCartLine[]) {
    const groupIds = shopItems.map((item) => item.id);
    const groupAllSelected = groupIds.every((id) => selection.selected.has(id));
    setSelection((previous) => {
      const next = new Set(previous.selected);
      if (groupAllSelected) {
        for (const id of groupIds) {
          next.delete(id);
        }
      } else {
        for (const id of groupIds) {
          next.add(id);
        }
      }
      return { selected: next };
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelection({ selected: new Set() });
    } else {
      setSelection({ selected: new Set(allItemIds) });
    }
  }

  async function handleRemove(itemId: string) {
    setRemoving(itemId);
    try {
      await removeMallCartItem(itemId);
      await refresh();
      setMessage("已删除商品");
    } catch (cause: unknown) {
      setMessage(cause instanceof Error ? cause.message : "删除失败");
    } finally {
      setRemoving(null);
    }
  }

  async function handleQuantityChange(itemId: string, quantity: number) {
    if (quantity < 1) {
      return;
    }
    try {
      await updateMallCartItem(itemId, quantity);
      await refresh();
    } catch (cause: unknown) {
      setMessage(cause instanceof Error ? cause.message : "数量更新失败");
    }
  }

  if (loading) {
    return <LoadingBlock label="加载购物车..." />;
  }

  if (!cart || cart.items.length === 0) {
    return (
      <EmptyState
        actions={<Link to="/search">去逛逛</Link>}
        description="挑选心仪商品后加入购物车"
        title="购物车是空的"
      />
    );
  }

  return (
    <div className="sdkwork-mall-pc-cart-page space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">购物车</h1>
        <span className="text-sm text-[var(--sdk-color-text-muted)]">
          共 {cart.items.length} 件商品
        </span>
      </div>
      {message ? <StatusNotice tone="default">{message}</StatusNotice> : null}

      <div className="sdkwork-mall-pc-cart-list space-y-4">
        {[...shopGroups.entries()].map(([shopName, items]) => {
          const groupIds = items.map((item) => item.id);
          const groupAllSelected = groupIds.every((id) => selection.selected.has(id));
          return (
            <section
              className="sdkwork-mall-pc-cart-shop-group overflow-hidden rounded-2xl border border-[var(--sdk-color-border-default)] bg-[var(--sdk-color-surface-panel)]"
              key={shopName}
            >
              <header className="flex items-center gap-3 border-b border-[var(--sdk-color-border-subtle)] bg-[var(--sdk-color-surface-subtle)] px-5 py-3">
                <Checkbox
                  checked={groupAllSelected}
                  onCheckedChange={() => toggleShopGroup(items)}
                />
                <h2 className="text-sm font-semibold">{shopName}</h2>
                <span className="text-xs text-[var(--sdk-color-text-muted)]">
                  {items.length} 件
                </span>
              </header>
              <div className="divide-y divide-[var(--sdk-color-border-subtle)]">
                {items.map((item) => {
                  const isSelected = selection.selected.has(item.id);
                  return (
                    <article
                      className="sdkwork-mall-pc-cart-row flex items-center gap-4 px-5 py-4"
                      key={item.id}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleItem(item.id)}
                      />
                      <Link
                        className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--sdk-color-border-subtle)] bg-[var(--sdk-color-surface-subtle)]"
                        to={`/product/${encodeURIComponent(item.productId)}`}
                      >
                        {item.imageUrl ? (
                          <img
                            alt={item.title}
                            className="h-full w-full object-cover"
                            src={item.imageUrl}
                          />
                        ) : (
                          <span className="text-[0.6rem] text-[var(--sdk-color-text-muted)]">无图</span>
                        )}
                      </Link>
                      <div className="min-w-0 flex-1">
                        <Link
                          className="block truncate text-sm font-medium hover:text-[var(--sdk-color-brand-primary)]"
                          to={`/product/${encodeURIComponent(item.productId)}`}
                        >
                          {item.title}
                        </Link>
                        {item.skuName ? (
                          <p className="mt-1 text-xs text-[var(--sdk-color-text-muted)]">{item.skuName}</p>
                        ) : null}
                        <p className="mt-1 text-xs text-[var(--sdk-color-text-secondary)]">
                          单价：{formatSdkworkCommerceCurrencyCny(item.unitPriceCny)}
                        </p>
                      </div>
                      <div className="sdkwork-mall-pc-cart-controls flex items-center gap-3">
                        <div className="flex items-center rounded-lg border border-[var(--sdk-color-border-default)]">
                          <button
                            className="flex h-8 w-8 items-center justify-center text-[var(--sdk-color-text-secondary)] hover:bg-[var(--sdk-color-surface-subtle)] disabled:opacity-50"
                            disabled={item.quantity <= 1}
                            onClick={() => void handleQuantityChange(item.id, item.quantity - 1)}
                            type="button"
                          >
                            −
                          </button>
                          <input
                            className="h-8 w-12 border-x border-[var(--sdk-color-border-default)] bg-transparent text-center text-sm focus:outline-none"
                            min={1}
                            onChange={(event) => {
                              const quantity = Number(event.target.value) || 1;
                              void handleQuantityChange(item.id, Math.max(1, quantity));
                            }}
                            type="number"
                            value={item.quantity}
                          />
                          <button
                            className="flex h-8 w-8 items-center justify-center text-[var(--sdk-color-text-secondary)] hover:bg-[var(--sdk-color-surface-subtle)]"
                            onClick={() => void handleQuantityChange(item.id, item.quantity + 1)}
                            type="button"
                          >
                            +
                          </button>
                        </div>
                        <strong className="min-w-[5rem] text-right text-sm font-semibold">
                          {formatSdkworkCommerceCurrencyCny(item.lineTotalCny)}
                        </strong>
                        <Button
                          disabled={removing === item.id}
                          onClick={() => void handleRemove(item.id)}
                          type="button"
                          variant="ghost"
                        >
                          删除
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <footer className="sdkwork-mall-pc-cart-footer sticky bottom-0 flex items-center justify-between gap-4 rounded-2xl border border-[var(--sdk-color-border-default)] bg-[var(--sdk-color-surface-panel)] px-6 py-4 shadow-[var(--sdk-shadow-md)]">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={allSelected}
            onCheckedChange={toggleAll}
          />
          <span className="text-sm">
            {allSelected ? "取消全选" : "全选"}
          </span>
          {someSelected && !allSelected ? (
            <span className="text-xs text-[var(--sdk-color-text-muted)]">
              已选 {selectedTotals.count} 件
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-xs text-[var(--sdk-color-text-muted)]">
              已选 {selectedTotals.quantity} 件商品
            </div>
            <div className="text-sm">
              合计：
              <strong className="ml-1 text-lg font-semibold text-[var(--sdk-color-state-danger)]">
                {formatSdkworkCommerceCurrencyCny(selectedTotals.amount)}
              </strong>
            </div>
          </div>
          <Link to="/checkout">
            <Button
              disabled={selectedTotals.count === 0}
              type="button"
            >
              去结算（{selectedTotals.count}）
            </Button>
          </Link>
        </div>
      </footer>
    </div>
  );
}

const DELIVERY_METHODS = [
  { code: "standard", label: "普通配送", description: "3-5 天送达 · 免费", feeCny: 0 },
  { code: "express", label: "极速达", description: "次日送达 · ¥12.00", feeCny: 12 },
  { code: "sf", label: "顺丰速运", description: "当日达 · ¥22.00", feeCny: 22 },
] as const;

interface CheckoutShopGroup {
  shopName: string;
  items: MallCartLine[];
  subtotalCny: number;
}

function groupCartItemsByShop(items: MallCartLine[]): CheckoutShopGroup[] {
  const groups = new Map<string, MallCartLine[]>();
  for (const item of items) {
    const shopName = item.shopName ?? "平台自营";
    const list = groups.get(shopName) ?? [];
    list.push(item);
    groups.set(shopName, list);
  }
  return Array.from(groups.entries()).map(([shopName, list]) => ({
    shopName,
    items: list,
    subtotalCny: list.reduce((sum, item) => sum + (item.lineTotalCny ?? 0), 0),
  }));
}

function validateInvoiceForm(form: MallCheckoutInvoiceForm): string | null {
  if (!form.title.trim()) {
    return form.titleType === "company" ? "请填写发票抬头（公司名称）" : "请填写发票抬头（个人姓名）";
  }
  if (form.titleType === "company") {
    if (!form.taxNumber?.trim()) {
      return "请填写公司税号";
    }
    if (!/^[A-Z0-9]{15,20}$/.test(form.taxNumber.trim())) {
      return "税号格式不正确（15-20 位字母或数字）";
    }
  }
  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    return "邮箱格式不正确";
  }
  return null;
}

export function SdkworkMallCheckoutPage() {
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [context, setContext] = useState<MallCheckoutContext | null>(null);
  const [quote, setQuote] = useState<MallCheckoutQuote | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [selectedCouponId, setSelectedCouponId] = useState("");
  const [selectedPaymentMethodCode, setSelectedPaymentMethodCode] = useState("");
  const [selectedDeliveryMethod, setSelectedDeliveryMethod] = useState<string>("standard");
  const [useWallet, setUseWallet] = useState(false);
  const [usePoints, setUsePoints] = useState(false);
  const [buyerRemark, setBuyerRemark] = useState("");
  const [needInvoice, setNeedInvoice] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState<MallCheckoutInvoiceForm>({
    titleType: "personal",
    title: "",
    taxNumber: "",
    email: "",
  });
  const [giftCardCode, setGiftCardCode] = useState("");
  const [giftCardApplied, setGiftCardApplied] = useState<string | null>(null);
  const [giftCardError, setGiftCardError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [checkoutContext, checkoutQuote] = await Promise.all([
          loadMallCheckoutContext(),
          createMallCheckoutQuote(),
        ]);
        if (!active) {
          return;
        }
        setContext(checkoutContext);
        setQuote(checkoutQuote);
        const defaultAddress = checkoutContext.addresses.find((address) => address.isDefault)
          ?? checkoutContext.addresses[0];
        if (defaultAddress) {
          setSelectedAddressId(defaultAddress.id);
        }
        if (checkoutContext.paymentMethods[0]) {
          setSelectedPaymentMethodCode(checkoutContext.paymentMethods[0].code);
        }
      } catch (cause: unknown) {
        if (active) {
          setMessage(cause instanceof Error ? cause.message : "结算信息加载失败");
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

  const shopGroups = useMemo(
    () => (context ? groupCartItemsByShop(context.cart.items) : []),
    [context],
  );

  // 应付金额以服务端报价为准；配送费按报价口径推导展示，避免前端另算一笔。
  const deliveryFee = useMemo(() => {
    if (!quote) {
      return 0;
    }
    const merchandiseAmount = Math.max(0, quote.originalAmountCny - quote.discountAmountCny);
    return Math.max(0, quote.payableAmountCny - merchandiseAmount);
  }, [quote]);

  const payableAmount = useMemo(() => {
    const base = quote?.payableAmountCny ?? context?.cart.totalAmountCny ?? 0;
    return Math.max(0, base);
  }, [quote, context]);

  function handleApplyGiftCard() {
    setGiftCardError(null);
    const code = giftCardCode.trim();
    if (!code) {
      setGiftCardError("请输入礼品卡卡号");
      return;
    }
    if (code.length < 8) {
      setGiftCardError("礼品卡卡号格式不正确");
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

  function validateBeforeSubmit(): string | null {
    if (!context) return "结算信息加载中";
    if (context.addresses.length === 0) return "请先添加收货地址";
    if (!selectedAddressId) return "请选择收货地址";
    if (payableAmount > 0 && !selectedPaymentMethodCode) return "请选择支付方式";
    if (needInvoice) {
      const invoiceError = validateInvoiceForm(invoiceForm);
      if (invoiceError) return invoiceError;
    }
    return null;
  }

  async function handleSubmit() {
    const validationError = validateBeforeSubmit();
    if (validationError) {
      setMessage(validationError);
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const result = await submitMallCheckoutOrder({
        addressId: selectedAddressId || undefined,
        buyerRemark: buyerRemark.trim() || undefined,
        couponId: selectedCouponId || undefined,
        deliveryMethod: selectedDeliveryMethod,
        giftCardCode: giftCardApplied ?? undefined,
        invoiceForm: needInvoice ? invoiceForm : undefined,
        needInvoice,
        paymentMethodCode: selectedPaymentMethodCode || undefined,
        usePoints,
        useWallet,
      });
      if (result.warnings.length > 0 && typeof window !== "undefined") {
        window.sessionStorage.setItem(
          MALL_CHECKOUT_WARNINGS_STORAGE_KEY,
          JSON.stringify(result.warnings),
        );
      }
      window.location.assign(result.nextUrl);
    } catch (cause: unknown) {
      setMessage(cause instanceof Error ? cause.message : "提交订单失败");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <LoadingBlock label="加载结算信息..." />;
  }

  if (!context || context.cart.items.length === 0) {
    return (
      <EmptyState
        actions={<Link to="/cart">返回购物车</Link>}
        description="请先在购物车中选择商品"
        title="暂无可结算商品"
      />
    );
  }

  return (
    <div className="sdkwork-mall-pc-checkout-page">
      <h1>确认订单</h1>

      {/* 按店拆单的商品清单 */}
      <section>
        <h2>商品清单{shopGroups.length > 1 ? `（${shopGroups.length} 个店铺）` : ""}</h2>
        {shopGroups.map((group) => (
          <div className="sdkwork-mall-pc-checkout-shop-group" key={group.shopName}>
            <div className="sdkwork-mall-pc-checkout-shop-header">
              <strong>{group.shopName}</strong>
              <Badge variant="secondary">{group.items.length} 件商品</Badge>
            </div>
            <ul className="sdkwork-mall-pc-checkout-lines">
              {group.items.map((item) => (
                <li key={item.id}>
                  {item.imageUrl ? <img alt="" src={item.imageUrl} /> : null}
                  <div className="sdkwork-mall-pc-checkout-line-info">
                    <span>{item.title}</span>
                    {item.skuName ? <small>{item.skuName}</small> : null}
                  </div>
                  <span>x{item.quantity}</span>
                  <strong>{formatSdkworkCommerceCurrencyCny(item.lineTotalCny)}</strong>
                </li>
              ))}
            </ul>
            <div className="sdkwork-mall-pc-checkout-shop-subtotal">
              小计：{formatSdkworkCommerceCurrencyCny(group.subtotalCny)}
            </div>
          </div>
        ))}
      </section>

      {/* 收货地址 */}
      <section>
        <h2>收货地址</h2>
        {context.addresses.length === 0 ? (
          <p>
            请先在
            <Link to="/buyer/addresses"> 地址管理 </Link>
            中添加收货地址
          </p>
        ) : (
          <div className="sdkwork-mall-pc-checkout-address-list">
            {context.addresses.map((address) => (
              <label
                className={
                  selectedAddressId === address.id
                    ? "sdkwork-mall-pc-checkout-address is-selected"
                    : "sdkwork-mall-pc-checkout-address"
                }
                key={address.id}
              >
                <input
                  checked={selectedAddressId === address.id}
                  onChange={() => setSelectedAddressId(address.id)}
                  type="radio"
                  name="address"
                />
                <div>
                  <strong>{address.name}</strong>
                  {address.phone ? <span>{address.phone}</span> : null}
                  {address.isDefault ? <Badge variant="default">默认</Badge> : null}
                  <p>{address.fullAddress}</p>
                </div>
              </label>
            ))}
          </div>
        )}
      </section>

      {/* 配送方式 */}
      <section>
        <h2>配送方式</h2>
        <div className="sdkwork-mall-pc-checkout-delivery">
          {DELIVERY_METHODS.map((method) => (
            <label
              className={
                selectedDeliveryMethod === method.code
                  ? "sdkwork-mall-pc-checkout-delivery-option is-selected"
                  : "sdkwork-mall-pc-checkout-delivery-option"
              }
              key={method.code}
            >
              <input
                checked={selectedDeliveryMethod === method.code}
                onChange={() => setSelectedDeliveryMethod(method.code)}
                type="radio"
                name="deliveryMethod"
              />
              <div>
                <strong>{method.label}</strong>
                <small>{method.description}</small>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* 优惠券 */}
      <section>
        <h2>优惠券</h2>
        {context.coupons.length === 0 ? (
          <p>暂无可用优惠券</p>
        ) : (
          <select onChange={(event) => setSelectedCouponId(event.target.value)} value={selectedCouponId}>
            <option value="">不使用优惠券</option>
            {context.coupons.map((coupon) => (
              <option key={coupon.id} value={coupon.id}>{coupon.title}</option>
            ))}
          </select>
        )}
      </section>

      {/* 礼品卡抵扣 */}
      <section>
        <h2>礼品卡</h2>
        {giftCardApplied ? (
          <div className="sdkwork-mall-pc-checkout-giftcard-applied">
            <Badge variant="success">已使用礼品卡</Badge>
            <code>{giftCardApplied}</code>
            <Button onClick={handleRemoveGiftCard} size="sm" type="button" variant="ghost">
              移除
            </Button>
          </div>
        ) : (
          <div className="sdkwork-mall-pc-checkout-giftcard-input">
            <input
              onChange={(event) => setGiftCardCode(event.target.value)}
              placeholder="请输入礼品卡卡号"
              type="text"
              value={giftCardCode}
            />
            <Button onClick={handleApplyGiftCard} size="sm" type="button" variant="outline">
              使用
            </Button>
          </div>
        )}
        {giftCardError ? <StatusNotice tone="warning">{giftCardError}</StatusNotice> : null}
      </section>

      {/* 资产抵扣 */}
      <section>
        <h2>资产抵扣</h2>
        <label>
          <input checked={useWallet} onChange={(event) => setUseWallet(event.target.checked)} type="checkbox" />
          使用余额抵扣（可用 ¥{context.walletBalanceCny.toFixed(2)}）
        </label>
        <label>
          <input checked={usePoints} onChange={(event) => setUsePoints(event.target.checked)} type="checkbox" />
          使用积分抵扣（可用 {context.pointsBalance} 积分）
        </label>
      </section>

      {/* 买家留言 + 发票表单 */}
      <section className="sdkwork-mall-pc-form-grid">
        <h2>买家留言</h2>
        <label>
          备注（可选）
          <textarea onChange={(event) => setBuyerRemark(event.target.value)} placeholder="如有配送要求请在此说明" rows={2} value={buyerRemark} />
        </label>
        <label>
          <input checked={needInvoice} onChange={(event) => setNeedInvoice(event.target.checked)} type="checkbox" />
          需要开具发票（可在
          <Link to="/buyer/invoices"> 发票管理 </Link>
          中完善抬头）
        </label>
        {needInvoice ? (
          <div className="sdkwork-mall-pc-checkout-invoice-form">
            <h3>发票信息</h3>
            <div className="sdkwork-mall-pc-checkout-invoice-type">
              <label>
                <input
                  checked={invoiceForm.titleType === "personal"}
                  onChange={() => setInvoiceForm((current) => ({ ...current, titleType: "personal" }))}
                  type="radio"
                  name="invoiceTitleType"
                />
                个人
              </label>
              <label>
                <input
                  checked={invoiceForm.titleType === "company"}
                  onChange={() => setInvoiceForm((current) => ({ ...current, titleType: "company" }))}
                  type="radio"
                  name="invoiceTitleType"
                />
                企业
              </label>
            </div>
            <label>
              发票抬头
              <input
                onChange={(event) => setInvoiceForm((current) => ({ ...current, title: event.target.value }))}
                placeholder={invoiceForm.titleType === "company" ? "公司名称" : "个人姓名"}
                type="text"
                value={invoiceForm.title}
              />
            </label>
            {invoiceForm.titleType === "company" ? (
              <label>
                税号
                <input
                  onChange={(event) => setInvoiceForm((current) => ({ ...current, taxNumber: event.target.value }))}
                  placeholder="15-20 位纳税人识别号"
                  type="text"
                  value={invoiceForm.taxNumber ?? ""}
                />
              </label>
            ) : null}
            <label>
              接收邮箱（可选）
              <input
                onChange={(event) => setInvoiceForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="电子发票将发送至此邮箱"
                type="email"
                value={invoiceForm.email ?? ""}
              />
            </label>
          </div>
        ) : null}
      </section>

      {/* 支付方式 */}
      <section>
        <h2>支付方式</h2>
        {context.paymentMethods.length === 0 ? (
          <p>暂无可用支付方式</p>
        ) : (
          <div className="sdkwork-mall-pc-payment-methods">
            {context.paymentMethods.map((method) => (
              <label key={method.id}>
                <input
                  checked={selectedPaymentMethodCode === method.code}
                  name="paymentMethod"
                  onChange={() => setSelectedPaymentMethodCode(method.code)}
                  type="radio"
                />
                {method.label}
              </label>
            ))}
          </div>
        )}
      </section>

      {/* 应付金额汇总 */}
      <section className="sdkwork-mall-pc-checkout-summary">
        <p>商品金额：¥{(quote?.originalAmountCny ?? context.cart.totalAmountCny).toFixed(2)}</p>
        {quote && quote.discountAmountCny > 0 ? (
          <p>优惠金额：-¥{quote.discountAmountCny.toFixed(2)}</p>
        ) : null}
        {deliveryFee > 0 ? <p>配送费：¥{deliveryFee.toFixed(2)}</p> : null}
        <strong>应付金额：¥{payableAmount.toFixed(2)}</strong>
      </section>

      {message ? <StatusNotice tone="danger">{message}</StatusNotice> : null}
      <Button disabled={busy || context.addresses.length === 0} onClick={handleSubmit} type="button">
        提交订单
      </Button>
    </div>
  );
}

export function SdkworkMallPaymentResultPage() {
  const [params] = useSearchParams();
  const status = params.get("status") ?? "unknown";
  const orderId = params.get("orderId");
  const paymentId = params.get("paymentId");
  const [paymentInfo, setPaymentInfo] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(Boolean(orderId));
  const [retrying, setRetrying] = useState(false);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);
  const [checkoutWarnings, setCheckoutWarnings] = useState<string[]>([]);
  const [recommendations, setRecommendations] = useState<Awaited<ReturnType<typeof searchMallProducts>>["items"]>([]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const raw = window.sessionStorage.getItem(MALL_CHECKOUT_WARNINGS_STORAGE_KEY);
    if (!raw) {
      return;
    }
    window.sessionStorage.removeItem(MALL_CHECKOUT_WARNINGS_STORAGE_KEY);
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setCheckoutWarnings(parsed.filter((entry): entry is string => typeof entry === "string"));
      }
    } catch {
      // 忽略无法解析的警告数据。
    }
  }, []);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }
    let active = true;
    async function load() {
      try {
        const info = await retrieveMallOrderPaymentSuccess(orderId!);
        if (active) {
          setPaymentInfo(info);
        }
      } catch {
        if (active) {
          setPaymentInfo(null);
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
  }, [orderId]);

  useEffect(() => {
    let active = true;
    void searchMallProducts({ pageSize: 6, sort: "sales" })
      .then((result) => {
        if (active) {
          setRecommendations(result.items.slice(0, 6));
        }
      })
      .catch(() => {
        // 推荐商品为可选增强，失败时静默处理。
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <LoadingBlock label="查询支付结果..." />;
  }

  const paid = status === "success" || paymentInfo?.paid === true || paymentInfo?.status === "paid";
  const failed = status === "failed" || status === "cancelled" || status === "closed";
  const pending = status === "pending";

  async function handleRetryPayment() {
    if (!orderId) return;
    setRetrying(true);
    setRetryMessage(null);
    try {
      const knownMethod =
        params.get("paymentMethod")
        || (typeof paymentInfo?.paymentMethod === "string" ? paymentInfo.paymentMethod : "")
        || (typeof paymentInfo?.paymentMethodCode === "string" ? paymentInfo.paymentMethodCode : "");
      const paymentMethod =
        knownMethod
        || (await listMallPaymentMethods())[0]?.code;
      if (!paymentMethod) {
        setRetryMessage("暂无可用支付方式，请稍后再试或联系客服。");
        return;
      }
      const newPaymentId = await retryMallOrderPayment(orderId, paymentMethod);
      if (newPaymentId) {
        window.location.assign(`/payment/result?status=pending&orderId=${encodeURIComponent(orderId)}&paymentId=${encodeURIComponent(newPaymentId)}&paymentMethod=${encodeURIComponent(paymentMethod)}`);
      } else {
        setRetryMessage("支付重试已发起，请稍后查看订单状态。");
      }
    } catch (cause: unknown) {
      setRetryMessage(cause instanceof Error ? cause.message : "支付重试失败，请稍后再试。");
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="sdkwork-mall-pc-payment-result">
      <div className="sdkwork-mall-pc-payment-result-header">
        <h1>
          {paid ? "支付成功" : pending ? "支付处理中" : failed ? "支付失败" : "支付结果"}
        </h1>
        {orderId ? <p>订单号：{orderId}</p> : null}
        {paymentId ? <p>支付单号：{paymentId}</p> : null}
        {paymentInfo ? (
          <p>支付状态：{String(paymentInfo.status ?? paymentInfo.paymentStatus ?? "-")}</p>
        ) : null}
      </div>

      {paid ? (
        <StatusNotice tone="success" title="支付成功">
          您的订单已支付成功，我们将尽快为您安排发货。
        </StatusNotice>
      ) : pending ? (
        <StatusNotice tone="warning" title="支付处理中">
          支付正在处理，请稍后在订单列表查看最新状态。
        </StatusNotice>
      ) : failed ? (
        <StatusNotice tone="danger" title="支付失败">
          支付未成功，您可以重新支付或联系客服寻求帮助。
        </StatusNotice>
      ) : null}

      {retryMessage ? <StatusNotice tone="warning">{retryMessage}</StatusNotice> : null}

      {checkoutWarnings.map((warning) => (
        <StatusNotice key={warning} tone="warning" title="结算提示">
          {warning}
        </StatusNotice>
      ))}

      {/* 操作引导 */}
      <div className="sdkwork-mall-pc-payment-actions">
        {orderId ? <Link to="/buyer/orders">查看订单</Link> : null}
        {orderId && paid ? (
          <Link to={`/buyer/after-sales?orderId=${encodeURIComponent(orderId)}`}>申请售后</Link>
        ) : null}
        {orderId && paid ? (
          <Link to="/buyer/invoices">查看/申请发票</Link>
        ) : null}
        {orderId && failed ? (
          <Button disabled={retrying} onClick={handleRetryPayment} size="sm" type="button" variant="primary">
            {retrying ? "重试中..." : "重新支付"}
          </Button>
        ) : null}
        <Link to="/buyer/messages">联系客服</Link>
        <Link to="/">继续购物</Link>
      </div>

      {/* 推荐商品 */}
      {recommendations.length > 0 ? (
        <section className="sdkwork-mall-pc-payment-recommendations">
          <h2>为您推荐</h2>
          <div className="sdkwork-mall-pc-product-grid">
            {recommendations.map((product) => (
              <Link className="sdkwork-mall-pc-product-card" key={product.id} to={`/product/${product.id}`}>
                <div className="sdkwork-mall-pc-product-body">
                  <h3>{product.title}</h3>
                  <strong>{product.priceCny != null ? `¥${product.priceCny.toFixed(2)}` : "询价"}</strong>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export function SdkworkMallPaymentCashierPage() {
  const [params] = useSearchParams();
  const orderId = params.get("orderId");
  const preselectedMethod = params.get("paymentMethod") ?? "";
  const [methods, setMethods] = useState<{ code: string; id: string; label: string }[]>([]);
  const [selectedCode, setSelectedCode] = useState(preselectedMethod);
  const [loading, setLoading] = useState(Boolean(orderId));
  const [paying, setPaying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }
    let active = true;
    listMallPaymentMethods()
      .then((rows) => {
        if (!active) {
          return;
        }
        setMethods(rows);
        setSelectedCode((current) => current || rows[0]?.code || "");
      })
      .catch((cause: unknown) => {
        if (active) {
          setMessage(cause instanceof Error ? cause.message : "支付方式加载失败");
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
  }, [orderId]);

  async function handlePay() {
    if (!orderId || !selectedCode) {
      setMessage("请选择支付方式");
      return;
    }
    setPaying(true);
    setMessage(null);
    try {
      const paymentId = await retryMallOrderPayment(orderId, selectedCode);
      const query = new URLSearchParams({ orderId, status: "pending" });
      if (paymentId) {
        query.set("paymentId", paymentId);
      }
      query.set("paymentMethod", selectedCode);
      window.location.assign(`/payment/result?${query.toString()}`);
    } catch (cause: unknown) {
      setMessage(cause instanceof Error ? cause.message : "发起支付失败，请稍后再试");
      setPaying(false);
    }
  }

  if (!orderId) {
    return (
      <div className="sdkwork-mall-pc-payment-cashier">
        <EmptyState title="缺少订单参数" description="请从订单列表或结算页进入收银台。" />
        <div className="sdkwork-mall-pc-payment-actions">
          <Link to="/buyer/orders">查看订单</Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return <LoadingBlock label="加载收银台..." />;
  }

  return (
    <div className="sdkwork-mall-pc-payment-cashier">
      <div className="sdkwork-mall-pc-payment-result-header">
        <h1>收银台</h1>
        <p>订单号：{orderId}</p>
      </div>

      {methods.length > 0 ? (
        <section className="sdkwork-mall-pc-checkout-section">
          <h2>选择支付方式</h2>
          <div className="sdkwork-mall-pc-checkout-methods">
            {methods.map((method) => (
              <label key={method.id}>
                <input
                  checked={selectedCode === method.code}
                  name="cashier-payment-method"
                  onChange={() => setSelectedCode(method.code)}
                  type="radio"
                />
                {method.label}
              </label>
            ))}
          </div>
        </section>
      ) : (
        <StatusNotice tone="warning" title="暂无可用支付方式">
          未获取到可用支付渠道，请稍后重试或联系客服。
        </StatusNotice>
      )}

      {message ? <StatusNotice tone="danger">{message}</StatusNotice> : null}

      <div className="sdkwork-mall-pc-payment-actions">
        <Button
          disabled={paying || !selectedCode}
          onClick={() => void handlePay()}
          size="lg"
          type="button"
          variant="primary"
        >
          {paying ? "支付中..." : "立即支付"}
        </Button>
        <Link to={`/payment/result?status=pending&orderId=${encodeURIComponent(orderId)}`}>稍后支付</Link>
        <Link to="/buyer/orders">取消返回订单列表</Link>
      </div>
    </div>
  );
}
