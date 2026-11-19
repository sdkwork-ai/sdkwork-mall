import { errorMessage, type MpTapEvent } from "../../types/common";
import { mpCapabilityUrl } from "../../routes/capabilities";
import { formatCny } from "../../utils/format";
import {
  listPendingReviewOrders,
  type MpPendingReviewOrder,
} from "../../services/reviews-service";
import { platform } from "@sdkwork/mall-mp-core";
import { requireSignedIn } from "../../utils/auth-gate";

interface ReviewRow extends MpPendingReviewOrder {
  amountText: string;
}

interface ReviewsData {
  loading: boolean;
  loadingMore: boolean;
  error: string;
  orders: ReviewRow[];
  hasMore: boolean;
  _page: number;
}

function toRow(order: MpPendingReviewOrder): ReviewRow {
  return {
    ...order,
    amountText: order.paidAmountCny != null ? formatCny(order.paidAmountCny) : "",
  };
}

Page({
  data: {
    loading: true,
    loadingMore: false,
    error: "",
    orders: [],
    hasMore: true,
    _page: 0,
  } as ReviewsData,

  onShow() {
    // onShow so returning from the order detail refreshes review candidates.
    if (!requireSignedIn()) {
      this.setData({ loading: false });
      return;
    }
    void this.load();
  },

  onReachBottom() {
    void this.loadMore();
  },

  onPullDownRefresh() {
    if (!requireSignedIn()) {
      platform.stopPullDownRefresh();
      return;
    }
    void this.load().finally(() => platform.stopPullDownRefresh());
  },

  async load() {
    this.setData({ error: "", loading: true, _page: 0, hasMore: true });
    try {
      const page = await listPendingReviewOrders(1);
      this.setData({
        error: "",
        loading: false,
        orders: page.items.map(toRow),
        hasMore: page.hasMore,
        _page: 1,
      });
    } catch (cause: unknown) {
      this.setData({ error: errorMessage(cause, "评价加载失败"), loading: false });
    }
  },

  /** More than one page of completed orders must stay reachable. */
  async loadMore() {
    if (this.data.loading || this.data.loadingMore || !this.data.hasMore) {
      return;
    }
    const nextPage = this.data._page + 1;
    this.setData({ loadingMore: true });
    try {
      const page = await listPendingReviewOrders(nextPage);
      const seen = new Set(this.data.orders.map((order) => order.id));
      const appended = page.items.filter((order) => !seen.has(order.id)).map(toRow);
      this.setData({
        orders: this.data.orders.concat(appended),
        hasMore: page.hasMore,
        _page: nextPage,
        loadingMore: false,
      });
    } catch (cause: unknown) {
      this.setData({ loadingMore: false });
      platform.toast(errorMessage(cause, "评价加载失败"), "none");
    }
  },

  retry() {
    if (!requireSignedIn()) {
      return;
    }
    void this.load();
  },

  goOrder(event: MpTapEvent) {
    const id = String(event.currentTarget.dataset.id ?? "");
    if (id) {
      platform.navigateTo(mpCapabilityUrl("buyer.mall.orders.detail", { id }));
    }
  },

  goAfterSales(event: MpTapEvent) {
    const id = String(event.currentTarget.dataset.id ?? "");
    platform.navigateTo(id ? mpCapabilityUrl("buyer.mall.after-sales", { orderId: id }) : mpCapabilityUrl("buyer.mall.after-sales"));
  },

  goOrders() {
    platform.navigateTo(mpCapabilityUrl("buyer.mall.orders"));
  },
});
