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

export function SdkworkMallH5CartPage() {
  const [cart, setCart] = useState<MallH5CartSnapshot | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
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

  const selectedTotal = useMemo(() => {
    if (!cart) {
      return 0;
    }
    return cart.items
      .filter((item) => selectedIds.includes(item.id))
      .reduce((sum, item) => sum + (item.lineTotalCny ?? (item.priceCny ?? 0) * item.quantity), 0);
  }, [cart, selectedIds]);

  const allSelected = Boolean(cart) && selectedIds.length === (cart?.items.length ?? 0) && (cart?.items.length ?? 0) > 0;

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

  if (loading) {
    return <div className="sdk-h5-page sdk-h5-loading">加载购物车...</div>;
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="sdk-h5-page">
        <div className="sdk-h5-empty">购物车还是空的</div>
        <div className="sdk-h5-center">
          <Link className="sdk-h5-button sdk-h5-button-primary" to="/">去逛逛</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="sdk-h5-page">
      {error ? <div className="sdk-h5-error" role="alert">{error}</div> : null}

      <label className="sdk-h5-address-row">
        <input
          aria-label="全选商品"
          checked={allSelected}
          onChange={(event) => toggleAll(event.target.checked)}
          type="checkbox"
        />
        <span>全选</span>
      </label>

      <div className="sdk-h5-cart-list">
        {shopGroups.map((group) => {
          const groupAllSelected = group.items.every((item) => selectedIds.includes(item.id));
          return (
            <section className="sdk-h5-cart-shop" key={group.shopId}>
              <label className="sdk-h5-cart-shop-header">
                <input
                  aria-label={`选择店铺 ${group.shopName} 全部商品`}
                  checked={groupAllSelected}
                  onChange={(event) => toggleShop(group, event.target.checked)}
                  type="checkbox"
                />
                <Link to={`/shop/${group.shopId}`}>{group.shopName}</Link>
              </label>
              {group.items.map((item) => (
                <div className="sdk-h5-cart-row" key={item.id}>
                  <label className="sdk-h5-cart-select">
                    <input
                      aria-label={`选择 ${item.title}`}
                      checked={selectedIds.includes(item.id)}
                      onChange={(event) => {
                        setSelectedIds((current) =>
                          event.target.checked
                            ? [...current, item.id]
                            : current.filter((id) => id !== item.id),
                        );
                      }}
                      type="checkbox"
                    />
                  </label>
                  <div className="sdk-h5-product-image">
                    {item.imageUrl ? <img alt={item.title} loading="lazy" src={item.imageUrl} /> : null}
                  </div>
                  <div className="sdk-h5-cart-row-body">
                    <Link className="sdk-h5-product-title" to={`/product/${item.spuId}`}>{item.title}</Link>
                    {item.skuName ? <div className="sdk-h5-cart-sku">{item.skuName}</div> : null}
                    <div className="sdk-h5-product-meta">
                      <strong>{item.priceCny != null ? `¥${item.priceCny.toFixed(2)}` : "询价"}</strong>
                      <div className="sdk-h5-quantity sdk-h5-quantity-inline">
                        <button aria-label="减少" disabled={busy} onClick={() => void handleQuantity(item, item.quantity - 1)} type="button">−</button>
                        <span>{item.quantity}</span>
                        <button aria-label="增加" disabled={busy} onClick={() => void handleQuantity(item, item.quantity + 1)} type="button">+</button>
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
        <div className="sdk-h5-cart-total">
          合计：<strong>¥{selectedTotal.toFixed(2)}</strong>
        </div>
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
      </div>
    </div>
  );
}
