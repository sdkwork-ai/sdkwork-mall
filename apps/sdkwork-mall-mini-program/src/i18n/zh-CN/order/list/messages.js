// Authored zh-CN messages for the order list; see buyer-hub/messages.js for the
// storage rationale (JS data + sibling .d.ts).
module.exports = {
  orderList: {
    loading: "加载订单...",
    empty: "暂无订单",
    loadMore: "上拉加载更多",
    allShown: "已展示全部",
    viewDetail: "订单详情",
    tabs: {
      all: "全部",
      pendingPayment: "待付款",
      pendingShipment: "待发货",
      pendingReceipt: "待收货",
      completed: "已完成"
    },
    actions: {
      pay: "去支付",
      cancel: "取消订单",
      confirmReceipt: "确认收货",
      logistics: "查看物流"
    },
    toasts: {
      cancelled: "已取消",
      receiptConfirmed: "已确认收货"
    },
    errors: {
      loadFailed: "订单加载失败",
      payFailed: "发起支付失败",
      cancelFailed: "取消失败",
      receiptFailed: "确认收货失败"
    }
  }
};
