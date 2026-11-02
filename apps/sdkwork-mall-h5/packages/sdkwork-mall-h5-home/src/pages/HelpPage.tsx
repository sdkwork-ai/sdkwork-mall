import { Link } from "react-router-dom";
import { LifeBuoy } from "lucide-react";

interface HelpSection {
  items: readonly string[];
  title: string;
}

const HELP_SECTIONS: readonly HelpSection[] = [
  {
    title: "订单与物流",
    items: [
      "在买家中心「我的订单」查看订单状态与物流信息",
      "未发货前可联系客服尝试修改收货地址",
      "支付成功后可在「支付结果」页查看支付单号",
    ],
  },
  {
    title: "售后服务",
    items: [
      "已完成订单可在「我的评价」查看待评价商品",
      "在「售后中心」发起退款、退货或换货申请",
      "售后进度同步至「消息中心」",
    ],
  },
  {
    title: "发票与资产",
    items: [
      "「发票」页申请电子/纸质发票",
      "「优惠券」「积分」「我的钱包」统一管理优惠资产",
      "「礼品卡」页预留红包与礼品卡入口（待 SDK）",
      "会员权益在「会员中心」查看与续费",
    ],
  },
  {
    title: "账户安全",
    items: [
      "通过 IAM 认证路由修改密码与绑定手机",
      "「账户与安全」查看当前登录账户信息",
      "异常登录请及时修改密码并联系平台客服",
    ],
  },
];

const QUICK_LINKS: ReadonlyArray<{ label: string; path: string }> = [
  { label: "订单查询", path: "/buyer/orders" },
  { label: "售后服务", path: "/buyer/after-sales" },
  { label: "发票开具", path: "/buyer/invoices" },
  { label: "消息通知", path: "/buyer/messages" },
  { label: "礼品卡", path: "/buyer/gift-cards" },
  { label: "账户安全", path: "/buyer/security" },
];

export function SdkworkMallH5HelpPage() {
  return (
    <div className="sdk-h5-page">
      <h1 className="sdk-h5-visually-hidden">帮助中心</h1>

      <section className="sdk-h5-section">
        <h2>
          <LifeBuoy aria-hidden="true" size={18} /> 帮助中心
        </h2>
        <p className="sdk-h5-muted">常见问题与自助服务入口</p>
      </section>

      <section className="sdk-h5-section">
        <h2>快捷入口</h2>
        <div className="sdk-h5-quick-grid">
          {QUICK_LINKS.map((link) => (
            <Link className="sdk-h5-quick-grid-item" key={link.path} to={link.path}>
              <span>{link.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {HELP_SECTIONS.map((section) => (
        <section className="sdk-h5-section" key={section.title}>
          <h2>{section.title}</h2>
          <ul className="sdk-h5-help-list">
            {section.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}

      <section className="sdk-h5-section">
        <h2>联系客服</h2>
        <div className="sdk-h5-cell-group">
          <Link className="sdk-h5-cell" to="/buyer/chats">
            <span className="sdk-h5-cell-label">在线客服</span>
            <span className="sdk-h5-cell-value sdk-h5-muted">工作日 9:00–22:00</span>
          </Link>
          <div className="sdk-h5-cell">
            <span className="sdk-h5-cell-label">商家合作</span>
            <span className="sdk-h5-cell-value sdk-h5-muted">请联系平台招商</span>
          </div>
        </div>
      </section>
    </div>
  );
}
