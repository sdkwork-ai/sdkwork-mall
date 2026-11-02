import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, StatusNotice } from "@sdkwork/ui-pc-react";
import { clearMallFootprint } from "@sdkwork/mall-pc-reviews/footprint-service";

import { clearMallFavorites } from "../favorites-service";

/**
 * 设置：与 H5 / 小程序 / Flutter 同一职能域——本机数据清理 + 账号退出。
 *
 * 刻意不引入本端独有的偏好项：设置页的内容差异会让"同一能力"在四端产生
 * 不同预期，通知偏好一类跨端配置需要先有服务端偏好契约。
 */
export function SdkworkMallSettingsPage() {
  const navigate = useNavigate();
  const [message, setMessage] = useState<string | null>(null);

  function handleClearFootprint() {
    clearMallFootprint();
    setMessage("已清空浏览足迹");
  }

  function handleClearFavorites() {
    clearMallFavorites();
    setMessage("已清空收藏");
  }

  function handleLogout() {
    navigate("/auth/login");
  }

  return (
    <div className="sdkwork-mall-pc-settings-page">
      <h1>设置</h1>

      {message ? <StatusNotice tone="default">{message}</StatusNotice> : null}

      <section>
        <h2>本机数据</h2>
        <ul className="sdkwork-mall-pc-settings-list">
          <li>
            <div>
              <strong>清空浏览足迹</strong>
              <p>移除本机保存的浏览记录</p>
            </div>
            <Button onClick={handleClearFootprint} type="button">
              清空
            </Button>
          </li>
          <li>
            <div>
              <strong>清空收藏</strong>
              <p>移除本机保存的全部收藏</p>
            </div>
            <Button onClick={handleClearFavorites} type="button">
              清空
            </Button>
          </li>
        </ul>
      </section>

      <section>
        <h2>账号</h2>
        <p>
          退出后需要重新登录才能查看订单与售后记录。也可以从
          <Link to="/buyer"> 买家中心 </Link>
          退出。
        </p>
        <Button onClick={handleLogout} type="button" variant="danger">
          退出登录
        </Button>
      </section>

      <p>本机数据清理不会影响账号已同步的订单与售后记录。</p>
    </div>
  );
}
