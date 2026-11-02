import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { getSdkworkMallH5SessionStore } from "@sdkwork/mall-h5-core/session";

import { clearMallH5Favorites, clearMallH5Footprint } from "../favorites-service";

/**
 * 设置：与小程序 / Flutter 同一职能域——本机数据清理 + 账号退出。
 *
 * 不引入新的偏好项，避免四个端出现"某端设置页更丰富"的内容漂移；
 * 通知偏好一类跨端能力需要先有服务端偏好契约。
 */
export function SdkworkMallH5SettingsPage() {
  const navigate = useNavigate();
  const [message, setMessage] = useState<string | null>(null);

  function handleClearFootprint() {
    clearMallH5Footprint();
    setMessage("已清空浏览足迹");
  }

  function handleClearFavorites() {
    clearMallH5Favorites();
    setMessage("已清空收藏");
  }

  function handleLogout() {
    getSdkworkMallH5SessionStore()?.clearSession();
    navigate("/auth/login");
  }

  return (
    <div className="sdk-h5-page">
      <h1 className="sdk-h5-visually-hidden">设置</h1>

      {message ? (
        <div className="sdk-h5-notice sdk-h5-notice-success" role="status">
          {message}
        </div>
      ) : null}

      <section className="sdk-h5-section">
        <h2>本机数据</h2>
        <div className="sdk-h5-cell-group">
          <button className="sdk-h5-cell" onClick={handleClearFootprint} type="button">
            <span className="sdk-h5-cell-label">清空浏览足迹</span>
            <span className="sdk-h5-cell-value sdk-h5-muted">移除本机保存的浏览记录</span>
          </button>
          <button className="sdk-h5-cell" onClick={handleClearFavorites} type="button">
            <span className="sdk-h5-cell-label">清空收藏</span>
            <span className="sdk-h5-cell-value sdk-h5-muted">移除本机保存的全部收藏</span>
          </button>
        </div>
      </section>

      <section className="sdk-h5-section">
        <h2>账号</h2>
        <button
          className="sdk-h5-button sdk-h5-button-danger sdk-h5-button-block"
          onClick={handleLogout}
          type="button"
        >
          退出登录
        </button>
      </section>

      <p className="sdk-h5-footnote">本机数据清理不会影响账号已同步的订单与售后记录。</p>
    </div>
  );
}
