// Authored zh-CN messages for the cashier; see buyer-hub/messages.js for the
// storage rationale (JS data + sibling .d.ts).
module.exports = {
  cashier: {
    loading: "加载收银台...",
    retry: "重试",
    title: "收银台",
    orderNo: "订单号：{{id}}",
    methodsTitle: "选择支付方式",
    methodsEmpty: "暂无可用支付渠道，请稍后重试。",
    pay: "立即支付",
    paying: "支付中...",
    later: "稍后支付",
    browserHintTitle: "支付链接已复制",
    browserHint: "请在浏览器中打开该链接完成支付，完成后返回订单列表查看状态。",
    errors: {
      missingOrder: "缺少订单参数",
      methodsLoadFailed: "支付方式加载失败",
      methodRequired: "请选择支付方式",
      payFailed: "发起支付失败，请稍后再试",
      cancelled: "已取消支付"
    }
  }
};
