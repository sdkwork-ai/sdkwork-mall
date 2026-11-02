// Authored zh-CN messages for the payment result page; see buyer-hub/messages.js
// for the storage rationale (JS data + sibling .d.ts).
module.exports = {
  paymentResult: {
    orderNo: "订单号：{{id}}",
    paymentNo: "支付单号：{{id}}",
    loading: "查询支付结果...",
    status: {
      pending: {
        title: "支付处理中",
        description: "支付正在处理，请稍后查看订单状态。"
      },
      success: {
        title: "支付成功",
        description: "商家将尽快为您发货。"
      },
      failed: {
        title: "支付失败",
        description: "支付未成功，可重新支付或联系客服。"
      }
    },
    pollTimeout: "支付结果确认超时，请到订单列表查看最新状态。",
    actions: {
      orders: "查看订单",
      refresh: "刷新状态",
      retryPay: "重新支付",
      continueShopping: "继续购物"
    }
  }
};
