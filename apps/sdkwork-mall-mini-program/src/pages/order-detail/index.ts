import { errorMessage, type MpTapEvent } from "../../types/common";
import { mpCapabilityUrl } from "../../routes/capabilities";
import { formatCny, formatTime, statusLabel } from "../../utils/format";
import { buildMpShareCard, buildMpTimelineCard } from "../../utils/share";
import {
  cancelOrder,
  confirmReceipt,
  getOrderDetail,
  type MpOrderDetail,
} from "../../services/order-service";
import { platform } from "@sdkwork/mall-mp-core";
import { requireSignedIn } from "../../utils/auth-gate";

type MpOrderDetailItemView = MpOrderDetail["items"][number] & { priceText: string };

interface MpOrderDetailView extends MpOrderDetail {
  statusText: string;
  totalText: string;
  paidText: string;
  timeText: string;
  items: MpOrderDetailItemView[];
}

interface OrderDetailData {
  detail: MpOrderDetailView | null;
  loading: boolean;
  error: string;
  _orderId: string;
  _acting: boolean;
}

Page({
  data: {
    detail: null,
    loading: true,
    error: "",
    _orderId: "",
    _acting: false,
  } as OrderDetailData,

  onLoad(options: Record<string, string | undefined>) {
    // `id` is the canonical query key (orders + reviews both emit it);
    // `orderId` is accepted because logistics/after-sales use that name and a
    // hand-built link should not open an empty page.
    this.setData({ _orderId: options.id || options.orderId || "" });
  },

  onShow() {
    if (!requireSignedIn()) {
      this.setData({ loading: false });
      return;
    }
    this.loadDetail();
  },

  onShareAppMessage() {
    const detail = this.data.detail;
    return buildMpShareCard({
      query: { id: this.data._orderId },
      routeId: "buyer.mall.orders.detail",
      title: detail ? `${detail.subject} · ${detail.statusText}` : undefined,
    });
  },

  onShareTimeline() {
    const detail = this.data.detail;
    return buildMpTimelineCard({
      query: { id: this.data._orderId },
      routeId: "buyer.mall.orders.detail",
      title: detail ? `${detail.subject} · ${detail.statusText}` : undefined,
    });
  },

  retry() {
    void this.loadDetail();
  },

  onPullDownRefresh() {
    void this.loadDetail().finally(() => platform.stopPullDownRefresh());
  },

  async loadDetail() {
    this.setData({ loading: true, error: "" });
    try {
      const detail = await getOrderDetail(this.data._orderId);
      this.setData({
        detail: {
          ...detail,
          statusText: statusLabel(detail.status),
          totalText: formatCny(detail.totalAmountCny),
          paidText:
            detail.paidAmountCny != null
              ? formatCny(detail.paidAmountCny)
              : detail.status === "CANCELLED"
                ? "已取消"
                : detail.status === "REFUNDED"
                  ? "已退款"
                  : "未支付",
          timeText: formatTime(detail.createdAt),
          items: detail.items.map((item) => ({
            ...item,
            priceText: formatCny(item.priceCny),
          })),
        },
        loading: false,
      });
    } catch (cause) {
      this.setData({
        loading: false,
        error: errorMessage(cause, "订单加载失败"),
      });
    }
  },

  goProduct(event: MpTapEvent) {
    const spuId = String(event.currentTarget.dataset.spu ?? "");
    if (spuId) {
      platform.navigateTo(mpCapabilityUrl("storefront.mall.product-detail", { id: spuId }));
    }
  },

  pay() {
    // The cashier owns the real channel handoff (wx.requestPayment / link
    // copy), so every pay entry funnels through the same page.
    const paymentMethod = this.data.detail?.paymentMethod || "";
    platform.navigateTo(mpCapabilityUrl("storefront.mall.payment-cashier", {
      orderId: this.data._orderId,
      ...(paymentMethod ? { paymentMethod } : {}),
    }));
  },

  async cancel() {
    if (this.data._acting) {
      return;
    }
    const confirmed = await platform.confirm({
      title: "取消订单",
      content: "取消后订单不可恢复，确定取消？",
    });
    if (!confirmed) {
      return;
    }
    this.setData({ _acting: true });
    try {
      await cancelOrder(this.data._orderId);
      platform.toast("已取消", "success");
      this.loadDetail();
    } catch (cause) {
      platform.toast(errorMessage(cause, "取消失败"));
    } finally {
      this.setData({ _acting: false });
    }
  },

  goAfterSales() {
    platform.navigateTo(mpCapabilityUrl("buyer.mall.after-sales", { orderId: this.data._orderId }));
  },

  goLogistics() {
    platform.navigateTo(mpCapabilityUrl("buyer.mall.orders.logistics", { orderId: this.data._orderId }));
  },

  async confirmReceipt() {
    if (this.data._acting) {
      return;
    }
    const confirmed = await platform.confirm({
      title: "确认收货",
      content: "请确认已收到全部商品，确认后订单完成。",
    });
    if (!confirmed) {
      return;
    }
    this.setData({ _acting: true });
    try {
      await confirmReceipt(this.data._orderId);
      platform.toast("已确认收货", "success");
      this.loadDetail();
    } catch (cause) {
      platform.toast(errorMessage(cause, "确认收货失败"));
    } finally {
      this.setData({ _acting: false });
    }
  },

  goOrders() {
    platform.back({ url: mpCapabilityUrl("buyer.mall.orders") });
  },
});
