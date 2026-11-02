import { t } from "../../i18n";
import { errorMessage, type MpTapEvent } from "../../types/common";
import { mpCapabilityUrl } from "../../routes/capabilities";
import { formatCny, formatTime, statusLabel } from "../../utils/format";
import {
  listOrders,
  cancelOrder,
  confirmReceipt,
  type MpOrderSummary,
} from "../../services/order-service";
import { isLoggedIn } from "../../services/session";

type OrderTab = { code: string; labelKey: string };

const TAB_DEFINITIONS: OrderTab[] = [
  { code: "all", labelKey: "orderList.tabs.all" },
  { code: "PENDING_PAYMENT", labelKey: "orderList.tabs.pendingPayment" },
  { code: "PENDING_SHIPMENT", labelKey: "orderList.tabs.pendingShipment" },
  { code: "PENDING_RECEIPT", labelKey: "orderList.tabs.pendingReceipt" },
  { code: "COMPLETED", labelKey: "orderList.tabs.completed" },
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
  loadingText: string;
  emptyText: string;
  loadMoreText: string;
  allShownText: string;
  viewDetailText: string;
  payText: string;
  cancelText: string;
  confirmReceiptText: string;
  logisticsText: string;
}

Page({
  data: {
    tabs: TAB_DEFINITIONS.map((tab) => ({ code: tab.code, label: t(tab.labelKey) })),
    activeTab: "all",
    orders: [],
    page: 1,
    total: 0,
    loading: true,
    loadingMore: false,
    error: "",
    loadingText: t("orderList.loading"),
    emptyText: t("orderList.empty"),
    loadMoreText: t("orderList.loadMore"),
    allShownText: t("orderList.allShown"),
    viewDetailText: t("orderList.viewDetail"),
    payText: t("orderList.actions.pay"),
    cancelText: t("orderList.actions.cancel"),
    confirmReceiptText: t("orderList.actions.confirmReceipt"),
    logisticsText: t("orderList.actions.logistics"),
  } as OrdersData,

  onLoad(options: Record<string, string | undefined>) {
    const status = options.status && options.status !== "all" ? options.status : "all";
    this.setData({ activeTab: status });
  },

  onShow() {
    if (!isLoggedIn()) {
      wx.navigateTo({ url: mpCapabilityUrl("account.mall.login") });
      return;
    }
    void this.loadOrders(1);
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
        error: errorMessage(cause, t("orderList.errors.loadFailed")),
      });
    }
  },

  onReachBottom() {
    this.loadMore();
  },

  onPullDownRefresh() {
    void this.loadOrders(1).finally(() => wx.stopPullDownRefresh());
  },

  selectTab(event: MpTapEvent) {
    const code = String(event.currentTarget.dataset.code ?? "");
    if (code === this.data.activeTab) {
      return;
    }
    this.setData({ activeTab: code, orders: [] });
    void this.loadOrders(1);
  },

  goDetail(event: MpTapEvent) {
    wx.navigateTo({ url: mpCapabilityUrl("buyer.mall.orders.detail", { id: String(event.currentTarget.dataset.id ?? "") }) });
  },

  goLogistics(event: MpTapEvent) {
    wx.navigateTo({ url: mpCapabilityUrl("buyer.mall.orders.logistics", { orderId: String(event.currentTarget.dataset.id ?? "") }) });
  },

  payOrder(event: MpTapEvent) {
    // The cashier owns the real channel handoff, so every pay entry funnels
    // through the same page.
    const orderId = String(event.currentTarget.dataset.id ?? "");
    wx.navigateTo({
      url: mpCapabilityUrl("storefront.mall.payment-cashier", { orderId }),
    });
  },

  async cancelOrder(event: MpTapEvent) {
    const orderId = String(event.currentTarget.dataset.id ?? "");
    try {
      await cancelOrder(orderId);
      wx.showToast({ title: t("orderList.toasts.cancelled"), icon: "success" });
      void this.loadOrders(1);
    } catch (cause) {
      wx.showToast({
        title: errorMessage(cause, t("orderList.errors.cancelFailed")),
        icon: "none",
      });
    }
  },

  async confirmReceipt(event: MpTapEvent) {
    const orderId = String(event.currentTarget.dataset.id ?? "");
    try {
      await confirmReceipt(orderId);
      wx.showToast({ title: t("orderList.toasts.receiptConfirmed"), icon: "success" });
      void this.loadOrders(1);
    } catch (cause) {
      wx.showToast({
        title: errorMessage(cause, t("orderList.errors.receiptFailed")),
        icon: "none",
      });
    }
  },

  loadMore() {
    if (this.data.loadingMore || this.data.orders.length >= this.data.total) {
      return;
    }
    void this.loadOrders(this.data.page + 1);
  },
});
