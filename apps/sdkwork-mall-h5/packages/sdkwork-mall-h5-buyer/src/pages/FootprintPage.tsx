import { useState } from "react";
import { Link } from "react-router-dom";

import {
  clearMallH5Footprint,
  readMallH5Footprint,
  type MallH5FootprintItem,
} from "../favorites-service";

export function SdkworkMallH5FootprintPage() {
  const [footprint, setFootprint] = useState<MallH5FootprintItem[]>(() => readMallH5Footprint());

  function handleClear() {
    clearMallH5Footprint();
    setFootprint([]);
  }

  return (
    <div className="sdk-h5-page">
      <div className="sdk-h5-flex-between">
        <h1 className="sdk-h5-page-title">浏览足迹</h1>
        {footprint.length > 0 ? (
          <button className="sdk-h5-button sdk-h5-button-ghost" onClick={handleClear} type="button">
            清空
          </button>
        ) : null}
      </div>

      {footprint.length === 0 ? (
        <div className="sdk-h5-empty">暂无浏览足迹</div>
      ) : (
        <div className="sdk-h5-cart-list">
          {footprint.map((item) => (
            <div className="sdk-h5-cart-row" key={`${item.id}-${item.viewedAt}`}>
              <div className="sdk-h5-product-image">
                {item.imageUrl ? <img alt={item.title} loading="lazy" src={item.imageUrl} /> : null}
              </div>
              <div className="sdk-h5-cart-row-body">
                <Link className="sdk-h5-product-title" to={`/product/${item.id}`}>{item.title}</Link>
                <div className="sdk-h5-muted">浏览于 {new Date(item.viewedAt).toLocaleString("zh-CN")}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="sdk-h5-muted">足迹暂存本机（最近 50 条），账号云同步将在足迹服务上线后开放。</p>
    </div>
  );
}
