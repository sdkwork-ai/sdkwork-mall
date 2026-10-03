import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Trash2 } from "lucide-react";

import {
  loadMallH5Cart,
  publishMallH5CartCount,
  removeMallH5CartItem,
  updateMallH5CartItem,
  type MallH5CartLine,
  type MallH5CartSnapshot,
} from "../cart-service";

interface MallH5CartShopGroup {
  shopId: string;
  shopName: string;
  items: MallH5CartLine[];
}

function groupCartItemsByShop(items: MallH5CartLine[]): MallH5CartShopGroup[] {
  const groups = new Map<string, MallH5CartShopGroup>();
  for (const item of items) {
    const shopId = item.shopId || "shop-default";
    const group = groups.get(shopId) ?? {
      items: [],
      shopId,
      shopName: item.shopName || "SDKWork 精选",
    };
    group.items.push(item);
    if (!group.shopName && item.shopName) {
      group.shopName = item.shopName;
    }
    groups.set(shopId, group);
  }
  return [...groups.values()];
}

/**
 * Round check control: the native input stays in the tree (focusable,
 * labelled) while the visual circle is a styled sibling span.
 */
function CartCheck({
  checked,
  label,
  onToggle,
}: {
  checked: boolean;
  label: string;
  onToggle: (next: boolean) => void;
}) {
  return (
    <label className="sdk-h5-check">
      <input
        aria-label={label}
        checked={checked}
        onChange={(event) => onToggle(event.target.checked)}
        type="checkbox"
      />
      <span aria-hidden="true" />
    </label>
  );
}

export function SdkworkMallH5CartPage() {
  const [cart, setCart] = useState<MallH5CartSnapshot | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [manageMode, setManageMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const snapshot = await loadMallH5Cart();
    setCart(snapshot);
    setSelectedIds((current) => {
      const known = new Set(snapshot.items.map((item) => item.id));
      const kept = current.filter((id) => known.has(id));
      return kept.length > 0 ? kept : snapshot.items.map((item) => item.id);
    });
    publishMallH5CartCount(snapshot.items.reduce((sum, item) => sum + item.quantity, 0));
  }, []);

  useEffect(() => {
    let active = true;
    reload()
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "购物车加载失败");
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

  const shopGroups = useMemo(
    () => (cart ? groupCartItemsByShop(cart.items) : []),
    [cart],
  );

  const selectedItems = useMemo(
    () => (cart ? cart.items.filter((item) => selectedIds.includes(item.id)) : []),
    [cart, selectedIds],
  );

  const selectedTotal = useMemo(
    () =>
      selectedItems.reduce(
        (sum, item) => sum + (item.lineTotalCny ?? (item.priceCny ?? 0) * item.quantity),
        0,
      ),
    [selectedItems],
  );

  const selectedCount = useMemo(
    () => selectedItems.reduce((sum, item) => sum + item.quantity, 0),
    [selectedItems],
  );

  const totalCount = cart?.items.length ?? 0;
  const allSelected = totalCount > 0 && selectedIds.length === totalCount;

  function toggleAll(selected: boolean) {
    if (!cart) {
      return;
    }
    setSelectedIds(selected ? cart.items.map((item) => item.id) : []);
  }

  function toggleShop(group: MallH5CartShopGroup, selected: boolean) {
    const groupIds = group.items.map((item) => item.id);
    setSelectedIds((current) =>
      selected
        ? [...new Set([...current, ...groupIds])]
        : current.filter((id) => !groupIds.includes(id)),
    );
  }

  async function handleQuantity(item: MallH5CartLine, nextQuantity: number) {
    if (nextQuantity < 1) {
      return;
    }
    setBusy(true);
    try {
      await updateMallH5CartItem({ cartItemId: item.id, quantity: nextQuantity });
      await reload();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "更新数量失败");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(item: MallH5CartLine) {
    setBusy(true);
    try {
      await removeMallH5CartItem(item.id);
      setSelectedIds((current) => current.filter((id) => id !== item.id));
      await reload();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "删除失败");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveSelected() {
    if (!cart || selectedIds.length === 0) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      for (const id of selectedIds) {
        if (cart.items.some((item) => item.id === id)) {
          await removeMallH5CartItem(id);
        }
      }
      setSelectedIds([]);
      await reload();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "删除失败");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="sdk-h5-page sdk-h5-loading">加载购物车...</div>;
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="sdk-h5-page">
        <div className="sdk-h5-cart-toolbar">
          <h1 className="sdk-h5-page-title">购物车</h1>
        </div>
        <div className="sdk-h5-cart-hero-empty">
          <div aria-hidden="true" className="sdk-h5-cart-hero-empty-icon">🛒</div>
          <div>购物车还是空的</div>
          <p className="sdk-h5-muted">去逛逛，挑选心仪的好物吧</p>
        </div>
        <div className="sdk-h5-center">
          <Link className="sdk-h5-button sdk-h5-button-primary" to="/">去逛逛</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="sdk-h5-page">
      <div className="sdk-h5-cart-toolbar">
        <h1 className="sdk-h5-page-title">
          购物车<span className="sdk-h5-cart-toolbar-count">共 {totalCount} 件</span>
        </h1>
        <button
          className="sdk-h5-cart-manage"
          disabled={busy}
          onClick={() => setManageMode((current) => !current)}
          type="button"
        >
          {manageMode ? "完成" : "管理"}
        </button>
      </div>

      {error ? <div className="sdk-h5-error" role="alert">{error}</div> : null}

      <div className="sdk-h5-cart-list">
        {shopGroups.map((group) => {
          const groupAllSelected = group.items.every((item) => selectedIds.includes(item.id));
          return (
            <section className="sdk-h5-cart-shop" key={group.shopId}>
              <div className="sdk-h5-cart-shop-header">
                <CartCheck
                  checked={groupAllSelected}
                  label={`选择店铺 ${group.shopName} 全部商品`}
                  onToggle={(next) => toggleShop(group, next)}
                />
                <Link to={`/shop/${group.shopId}`}>{group.shopName}</Link>
              </div>
              {group.items.map((item) => (
                <div className="sdk-h5-cart-row" key={item.id}>
                  <CartCheck
                    checked={selectedIds.includes(item.id)}
                    label={`选择 ${item.title}`}
                    onToggle={(next) => {
                      setSelectedIds((current) =>
                        next
                          ? [...current, item.id]
                          : current.filter((id) => id !== item.id),
                      );
                    }}
                  />
                  <Link
                    aria-label={item.title}
                    className="sdk-h5-product-image"
                    to={`/product/${item.spuId}`}
                  >
                    {item.imageUrl ? <img alt="" loading="lazy" src={item.imageUrl} /> : null}
                  </Link>
                  <div className="sdk-h5-cart-row-body">
                    <Link className="sdk-h5-cart-row-title" to={`/product/${item.spuId}`}>{item.title}</Link>
                    {item.skuName ? <span className="sdk-h5-cart-sku">{item.skuName}</span> : null}
                    <div className="sdk-h5-cart-row-pricing">
                      <strong>{item.priceCny != null ? `¥${item.priceCny.toFixed(2)}` : "询价"}</strong>
                      <div className="sdk-h5-stepper">
                        <button
                          aria-label={`减少 ${item.title} 数量`}
                          disabled={busy || item.quantity <= 1}
                          onClick={() => void handleQuantity(item, item.quantity - 1)}
                          type="button"
                        >
                          −
                        </button>
                        <span aria-live="polite">{item.quantity}</span>
                        <button
                          aria-label={`增加 ${item.title} 数量`}
                          disabled={busy}
                          onClick={() => void handleQuantity(item, item.quantity + 1)}
                          type="button"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                  <button
                    aria-label={`删除 ${item.title}`}
                    className="sdk-h5-cart-remove"
                    disabled={busy}
                    onClick={() => void handleRemove(item)}
                    type="button"
                  >
                    <Trash2 aria-hidden="true" size={16} />
                  </button>
                </div>
              ))}
            </section>
          );
        })}
      </div>

      <div className="sdk-h5-cart-footer">
        <label className="sdk-h5-cart-footer-check">
          <CartCheck checked={allSelected} label="全选商品" onToggle={toggleAll} />
          <span>全选</span>
        </label>
        <div className="sdk-h5-cart-total-block">
          <span className="sdk-h5-cart-total">
            合计：<strong>¥{selectedTotal.toFixed(2)}</strong>
          </span>
          <span className="sdk-h5-muted">已选 {selectedCount} 件</span>
        </div>
        {manageMode ? (
          <button
            className={
              selectedIds.length === 0
                ? "sdk-h5-button sdk-h5-button-danger sdk-h5-button-disabled"
                : "sdk-h5-button sdk-h5-button-danger"
            }
            disabled={busy || selectedIds.length === 0}
            onClick={() => void handleRemoveSelected()}
            type="button"
          >
            删除所选({selectedIds.length})
          </button>
        ) : (
          <Link
            className={selectedIds.length === 0 ? "sdk-h5-button sdk-h5-button-primary sdk-h5-button-disabled" : "sdk-h5-button sdk-h5-button-primary"}
            aria-disabled={selectedIds.length === 0}
            onClick={(event) => {
              if (selectedIds.length === 0) {
                event.preventDefault();
              }
            }}
            to={`/checkout?items=${encodeURIComponent(selectedIds.join(","))}`}
          >
            去结算({selectedIds.length})
          </Link>
        )}
      </div>
    </div>
  );
}
