import { errorMessage, type MpTapEvent } from "../../types/common";
import { formatCny, formatTime, statusLabel } from "../../utils/format";
import {
  listOrders,
  payOrder,
  cancelOrder,
  confirmReceipt,
  type MpOrderSummary,
} from "../../services/order-service";
import { isLoggedIn } from "../../services/session";

const TABS: Array<{ code: string; label: string }> = [
  { code: "all", label: "全部" },
  { code: "PENDING_PAYMENT", label: "待付款" },
  { code: "PENDING_SHIPMENT", label: "待发货" },
  { code: "PENDING_RECEIPT", label: "待收货" },
  { code: "COMPLETED", label: "已完成" },
];

type MpOrderRow = MpOrderSummary & {
  statusText: string;
  totalText: string;
  timeText: string;
};

interface OrdersData {
  tabs: Array<{ code: string; label: string }>;
  activeTab: string;
  orders: MpOrderRow[];
  page: number;
  total: number;
  loading: boolean;
  loadingMore: boolean;
  error: string;
}

Page({
  data: {
    tabs: TABS,
    activeTab: "all",
    orders: [],
    page: 1,
    total: 0,
    loading: true,
    loadingMore: false,
    error: "",
  } as OrdersData,

  onLoad(options: Record<string, string | undefined>) {
    const status = options.status && options.status !== "all" ? options.status : "all";
    this.setData({ activeTab: status });
  },

  onShow() {
    if (!isLoggedIn()) {
      wx.navigateTo({ url: "/pages/login/index" });
      return;
    }
    this.loadOrders(1);
  },

  async loadOrders(nextPage: number) {
    const { activeTab } = this.data;
    this.setData(nextPage === 1 ? { loading: true, error: "" } : { loadingMore: true });
    try {
      const result = await listOrders({
        page: nextPage,
        pageSize: 20,
        status: activeTab,
      });
      const orders = result.orders.map((order) => ({
        ...order,
        statusText: statusLabel(order.status),
        totalText: formatCny(order.totalAmountCny),
        timeText: formatTime(order.createdAt),
      }));
      this.setData({
        orders: nextPage === 1 ? orders : this.data.orders.concat(orders),
        total: result.total,
        page: nextPage,
        loading: false,
        loadingMore: false,
      });
    } catch (cause) {
      this.setData({
        loading: false,
        loadingMore: false,
        error: errorMessage(cause, "订单加载失败"),
      });
    }
  },

  selectTab(event: MpTapEvent) {
    const code = String(event.currentTarget.dataset.code ?? "");
    if (code === this.data.activeTab) {
      return;
    }
    this.setData({ activeTab: code, orders: [] });
    this.loadOrders(1);
  },

  goDetail(event: MpTapEvent) {
    wx.navigateTo({ url: `/pages/order-detail/index?id=${String(event.currentTarget.dataset.id ?? "")}` });
  },

  goLogistics(event: MpTapEvent) {
    wx.navigateTo({ url: `/pages/logistics/index?orderId=${String(event.currentTarget.dataset.id ?? "")}` });
  },

  async payOrder(event: MpTapEvent) {
    const orderId = String(event.currentTarget.dataset.id ?? "");
    try {
      const paymentId = await payOrder(orderId, "WECHAT");
      wx.redirectTo({
        url: `/pages/payment-result/index?orderId=${orderId}&paymentId=${paymentId}&status=pending`,
      });
    } catch (cause) {
      wx.showToast({ title: errorMessage(cause, "发起支付失败"), icon: "none" });
    }
  },

  async cancelOrder(event: MpTapEvent) {
    const orderId = String(event.currentTarget.dataset.id ?? "");
    try {
      await cancelOrder(orderId);
      wx.showToast({ title: "已取消", icon: "success" });
      this.loadOrders(1);
    } catch (cause) {
      wx.showToast({ title: errorMessage(cause, "取消失败"), icon: "none" });
    }
  },

  async confirmReceipt(event: MpTapEvent) {
    const orderId = String(event.currentTarget.dataset.id ?? "");
    try {
      await confirmReceipt(orderId);
      wx.showToast({ title: "已确认收货", icon: "success" });
      this.loadOrders(1);
    } catch (cause) {
      wx.showToast({ title: errorMessage(cause, "确认收货失败"), icon: "none" });
    }
  },

  loadMore() {
    if (this.data.loadingMore || this.data.orders.length >= this.data.total) {
      return;
    }
    this.loadOrders(this.data.page + 1);
  },
});
