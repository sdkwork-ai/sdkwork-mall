import { errorMessage, type MpTapEvent } from "../../types/common";
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
      wx.navigateTo({ url: `/pages/order-detail/index?orderId=${id}` });
    }
  },

  goAfterSales(event: MpTapEvent) {
    const id = String(event.currentTarget.dataset.id ?? "");
    wx.navigateTo({
      url: id ? `/pages/aftersales/index?orderId=${id}` : "/pages/aftersales/index",
    });
  },

  goOrders() {
    wx.navigateTo({ url: "/pages/orders/index" });
  },
});
