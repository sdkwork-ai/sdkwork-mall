import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ShoppingCart } from "lucide-react";

import {
  addMallH5CartItem,
  retrieveMallH5ProductDetail,
  searchMallH5Products,
  type MallH5ProductCard,
  type MallH5ProductDetail,
} from "../catalog-service";
import {
  isMallH5Favorite,
  recordMallH5Footprint,
  toggleMallH5Favorite,
} from "@sdkwork/mall-h5-buyer/favorites-service";

const CART_COUNT_STORAGE_KEY = "sdkwork-mall-h5-cart-count";

function bumpLocalCartBadge(delta: number): void {
  if (typeof window === "undefined") {
    return;
  }
  const next = Math.max(0, (Number(window.localStorage.getItem(CART_COUNT_STORAGE_KEY)) || 0) + delta);
  window.localStorage.setItem(CART_COUNT_STORAGE_KEY, String(next));
}

export function SdkworkMallH5ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<MallH5ProductDetail | null>(null);
  const [recommendations, setRecommendations] = useState<MallH5ProductCard[]>([]);
  const [selectedSkuId, setSelectedSkuId] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [favoriteFlag, setFavoriteFlag] = useState(() => (productId ? isMallH5Favorite(productId) : false));

  useEffect(() => {
    if (!productId) {
      return;
    }
    let active = true;
    setLoading(true);
    retrieveMallH5ProductDetail(productId)
      .then((record) => {
        if (!active) {
          return;
        }
        if (record) {
          recordMallH5Footprint({
            id: record.id,
            imageUrl: record.imageUrl,
            title: record.title,
          });
        }
        setDetail(record);
        setSelectedSkuId(record?.skus[0]?.id ?? "");
      })
      .catch((cause: unknown) => {
        if (active) {
          setMessage(cause instanceof Error ? cause.message : "商品加载失败");
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
  }, [productId]);

  useEffect(() => {
    let active = true;
    searchMallH5Products({ pageSize: 6, sort: "sales" })
      .then((result) => {
        if (active) {
          setRecommendations(result.items.filter((item) => item.id !== productId).slice(0, 4));
        }
      })
      .catch(() => {
        // 推荐区为可选增强。
      });
    return () => {
      active = false;
    };
  }, [productId]);

  const selectedSku = useMemo(
    () => detail?.skus.find((sku) => sku.id === selectedSkuId) ?? detail?.skus[0],
    [detail, selectedSkuId],
  );
  const displayPrice = selectedSku?.priceCny ?? detail?.priceCny ?? null;

  async function handleAddToCart() {
    if (!detail || !selectedSku) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await addMallH5CartItem({
        productId: detail.id,
        quantity: quantity,
        skuId: selectedSku.id,
      });
      bumpLocalCartBadge(quantity);
      setMessage("已加入购物车");
    } catch (cause: unknown) {
      setMessage(cause instanceof Error ? cause.message : "加入购物车失败");
    } finally {
      setBusy(false);
    }
  }

  function handleBuyNow() {
    if (!detail || !selectedSku) {
      return;
    }
    void handleAddToCart().then(() => {
      navigate("/cart");
    });
  }

  if (loading) {
    return <div className="sdk-h5-page sdk-h5-loading">加载商品...</div>;
  }

  if (!detail) {
    return (
      <div className="sdk-h5-page">
        <div className="sdk-h5-empty">商品不存在或已下架</div>
        <div className="sdk-h5-center">
          <Link className="sdk-h5-button" to="/">回到首页</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="sdk-h5-page sdk-h5-pdp">
      <section className="sdk-h5-pdp-gallery">
        {detail.imageUrl ? <img alt={detail.title} src={detail.imageUrl} /> : <div className="sdk-h5-pdp-gallery-fallback">暂无主图</div>}
      </section>

      <section className="sdk-h5-pdp-summary">
        <div className="sdk-h5-pdp-price">
          {displayPrice != null ? <>¥{displayPrice.toFixed(2)}</> : "询价"}
        </div>
        <h1 className="sdk-h5-pdp-title">
          {detail.title}
          <button
            className="sdk-h5-pdp-favorite"
            onClick={() => setFavoriteFlag(toggleMallH5Favorite({
              id: detail.id,
              imageUrl: detail.imageUrl,
              priceCny: detail.priceCny,
              title: detail.title,
            }))}
            type="button"
          >
            {favoriteFlag ? "已收藏" : "收藏"}
          </button>
        </h1>
        {detail.sales != null ? <p className="sdk-h5-pdp-sales">已售 {detail.sales}</p> : null}
      </section>

      {detail.skus.length > 0 ? (
        <section className="sdk-h5-section">
          <h2>选择规格</h2>
          <div className="sdk-h5-chip-row">
            {detail.skus.map((sku) => (
              <button
                className={sku.id === (selectedSku?.id ?? "") ? "sdk-h5-chip sdk-h5-chip-active" : "sdk-h5-chip"}
                key={sku.id}
                onClick={() => setSelectedSkuId(sku.id)}
                type="button"
              >
                {sku.title}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="sdk-h5-section">
        <h2>购买数量</h2>
        <div className="sdk-h5-quantity">
          <button
            aria-label="减少数量"
            disabled={quantity <= 1}
            onClick={() => setQuantity((value) => Math.max(1, value - 1))}
            type="button"
          >
            −
          </button>
          <span aria-live="polite">{quantity}</span>
          <button
            aria-label="增加数量"
            onClick={() => setQuantity((value) => value + 1)}
            type="button"
          >
            +
          </button>
        </div>
      </section>

      {detail.specs.length > 0 ? (
        <section className="sdk-h5-section">
          <h2>规格参数</h2>
          <dl className="sdk-h5-spec-list">
            {detail.specs.map((spec) => (
              <div key={spec.name}>
                <dt>{spec.name}</dt>
                <dd>{spec.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {detail.shopId ? (
        <section className="sdk-h5-section">
          <h2>店铺</h2>
          <Link className="sdk-h5-button sdk-h5-button-secondary" to={`/shop/${detail.shopId}`}>
            {detail.shopName || "进入店铺"}
          </Link>
        </section>
      ) : null}

      {detail.description ? (
        <section className="sdk-h5-section">
          <h2>商品介绍</h2>
          <p className="sdk-h5-pdp-description">{detail.description}</p>
        </section>
      ) : null}

      <section className="sdk-h5-section">
        <h2>评价</h2>
        <p className="sdk-h5-pdp-reviews-note">商品评价体系即将上线，敬请期待。</p>
      </section>

      {recommendations.length > 0 ? (
        <section className="sdk-h5-section">
          <h2>看了又看</h2>
          <div className="sdk-h5-chip-row">
            {recommendations.map((product) => (
              <Link key={product.id} to={`/product/${product.id}`}>{product.title}</Link>
            ))}
          </div>
        </section>
      ) : null}

      {message ? <div className="sdk-h5-toast" role="status">{message}</div> : null}

      <div className="sdk-h5-pdp-actions">
        <button
          className="sdk-h5-button sdk-h5-button-secondary"
          disabled={busy || !selectedSku}
          onClick={() => void handleAddToCart()}
          type="button"
        >
          <ShoppingCart aria-hidden="true" size={16} /> 加入购物车
        </button>
        <button
          className="sdk-h5-button sdk-h5-button-primary"
          disabled={busy || !selectedSku}
          onClick={handleBuyNow}
          type="button"
        >
          立即购买
        </button>
      </div>
    </div>
  );
}
