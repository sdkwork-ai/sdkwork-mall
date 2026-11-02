import { Link } from "react-router-dom";
import { Gift } from "lucide-react";

export function SdkworkMallH5GiftCardsPage() {
  return (
    <div className="sdk-h5-page">
      <h1 className="sdk-h5-visually-hidden">礼品卡与红包</h1>

      <section className="sdk-h5-section">
        <h2>
          <Gift aria-hidden="true" size={18} /> 功能说明
        </h2>
        <div className="sdk-h5-empty">礼品卡购买、赠送、兑换与红包领取需 commerce gift-cards API</div>
        <p className="sdk-h5-muted">
          当前版本仅预留入口。待 commerce gift-cards / red-packet API 合约落地后，
          将在此接入余额、领取记录与兑换流程。
        </p>
      </section>

      <div className="sdk-h5-action-row">
        <Link className="sdk-h5-button sdk-h5-button-secondary" to="/buyer/wallet">
          查看我的钱包
        </Link>
      </div>
    </div>
  );
}
