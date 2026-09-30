import { useState } from "react";
import { Link } from "react-router-dom";
import { Trash2 } from "lucide-react";

import {
  removeMallH5Favorite,
  useMallH5Favorites,
} from "../favorites-service";

export function SdkworkMallH5FavoritesPage() {
  const favorites = useMallH5Favorites();
  const [removingId, setRemovingId] = useState<string | null>(null);

  function handleRemove(productId: string) {
    setRemovingId(productId);
    try {
      removeMallH5Favorite(productId);
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="sdk-h5-page">
      <h1 className="sdk-h5-page-title">我的收藏</h1>

      {favorites.length === 0 ? (
        <div className="sdk-h5-empty">还没有收藏的商品</div>
      ) : (
        <div className="sdk-h5-cart-list">
          {favorites.map((item) => (
            <div className="sdk-h5-cart-row" key={item.id}>
              <div className="sdk-h5-product-image">
                {item.imageUrl ? <img alt={item.title} loading="lazy" src={item.imageUrl} /> : null}
              </div>
              <div className="sdk-h5-cart-row-body">
                <Link className="sdk-h5-product-title" to={`/product/${item.id}`}>{item.title}</Link>
                <div className="sdk-h5-product-meta">
                  <strong>{item.priceCny != null ? `¥${item.priceCny.toFixed(2)}` : "询价"}</strong>
                </div>
              </div>
              <button
                aria-label={`取消收藏 ${item.title}`}
                className="sdk-h5-cart-remove"
                disabled={removingId === item.id}
                onClick={() => handleRemove(item.id)}
                type="button"
              >
                <Trash2 aria-hidden="true" size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="sdk-h5-muted">收藏暂存本机，登录账号云同步将在收藏服务上线后开放。</p>
    </div>
  );
}
