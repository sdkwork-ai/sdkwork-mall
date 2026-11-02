import { errorMessage, type MpTapEvent } from "../../types/common";
import { mpCapabilityUrl } from "../../routes/capabilities";
import { formatCny } from "../../utils/format";
import {
  listPendingReviewOrders,
  type MpPendingReviewOrder,
} from "../../services/reviews-service";

interface ReviewRow extends MpPendingReviewOrder {
  amountText: string;
}

interface ReviewsData {
  loading: boolean;
  error: string;
  orders: ReviewRow[];
}

Page({
  data: {
    loading: true,
    error: "",
    orders: [],
  } as ReviewsData,

  onShow() {
    // onShow so returning from the order detail refreshes review candidates.
    void this.load();
  },

  onPullDownRefresh() {
    void this.load().finally(() => wx.stopPullDownRefresh());
  },

  async load() {
    try {
      const orders = await listPendingReviewOrders();
      this.setData({
        error: "",
        loading: false,
        orders: orders.map((order) => ({
          ...order,
          amountText: order.paidAmountCny != null ? formatCny(order.paidAmountCny) : "",
        })),
      });
    } catch (cause: unknown) {
      this.setData({ error: errorMessage(cause, "评价加载失败"), loading: false });
    }
  },

  goOrder(event: MpTapEvent) {
    const id = String(event.currentTarget.dataset.id ?? "");
    if (id) {
      wx.navigateTo({ url: mpCapabilityUrl("buyer.mall.orders.detail", { orderId: id }) });
    }
  },

  goAfterSales(event: MpTapEvent) {
    const id = String(event.currentTarget.dataset.id ?? "");
    wx.navigateTo({
      url: id ? mpCapabilityUrl("buyer.mall.after-sales", { orderId: id }) : mpCapabilityUrl("buyer.mall.after-sales"),
    });
  },

  goOrders() {
    wx.navigateTo({ url: mpCapabilityUrl("buyer.mall.orders") });
  },
});
