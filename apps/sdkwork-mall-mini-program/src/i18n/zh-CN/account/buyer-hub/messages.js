// Authored zh-CN messages for the buyer hub. JavaScript (not TypeScript) so the
// copy is data, not app logic; `messages.d.ts` gives TypeScript the shape and
// `src/i18n/index.ts` resolves keys at runtime.
module.exports = {
  buyerHub: {
    orders: {
      all: "全部订单",
      pendingPayment: "待付款",
      pendingShipment: "待发货",
      pendingReceipt: "待收货",
      completed: "已完成",
    },
    assets: {
      wallet: "钱包",
      points: "我的积分",
      membership: "会员中心",
    },
    services: {
      favorites: "我的收藏",
      footprint: "浏览足迹",
      addresses: "地址管理",
      coupons: "领券中心",
      afterSales: "售后中心",
      invoices: "发票",
      messages: "消息中心",
      chats: "客服会话",
    },
    account: {
      profile: "个人资料",
      reviews: "我的评价",
      giftCards: "礼品卡与红包",
      security: "账户与安全",
      settings: "设置",
      help: "帮助中心",
    },
    others: {
      activity: "活动会场",
    },
    logout: {
      title: "退出登录",
      confirm: "确定退出当前账号？",
    },
  },
};
