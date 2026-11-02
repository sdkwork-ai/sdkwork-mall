import { Link } from "react-router-dom";
import { Gift } from "lucide-react";
import { EmptyState } from "@sdkwork/ui-pc-react";

export function SdkworkMallGiftCardsPage() {
  return (
    <div className="sdkwork-mall-pc-gift-cards-page">
      <h1><Gift aria-hidden="true" size={20} /> 礼品卡与红包</h1>
      <EmptyState
        description="礼品卡购买、赠送、兑换与红包领取需 commerce gift-cards API。"
        title="礼品卡功能待 SDK 合约"
      />
      <p>
        当前版本仅预留路由与页面占位。待 commerce gift-cards / red-packet API 合约落地后，
        将在此接入余额、领取记录与兑换流程。
      </p>
      <Link to="/buyer/wallet">查看我的钱包</Link>
    </div>
  );
}
