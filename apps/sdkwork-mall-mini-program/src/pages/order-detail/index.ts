import { errorMessage, type MpTapEvent } from "../../types/common";
import { mpCapabilityUrl } from "../../routes/capabilities";
import { formatCny, formatTime, statusLabel } from "../../utils/format";
import {
  cancelOrder,
  confirmReceipt,
  getOrderDetail,
  type MpOrderDetail,
} from "../../services/order-service";

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
}

Page({
  data: {
    detail: null,
    loading: true,
    error: "",
    _orderId: "",
  } as OrderDetailData,

  onLoad(options: Record<string, string | undefined>) {
    this.setData({ _orderId: options.id || "" });
  },

  onShow() {
    this.loadDetail();
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
          paidText: detail.paidAmountCny != null ? formatCny(detail.paidAmountCny) : "未支付",
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
      wx.navigateTo({ url: mpCapabilityUrl("storefront.mall.product-detail", { id: spuId }) });
    }
  },

  pay() {
    // The cashier owns the real channel handoff (wx.requestPayment / link
    // copy), so every pay entry funnels through the same page.
    const paymentMethod = this.data.detail?.paymentMethod || "";
    wx.navigateTo({
      url: mpCapabilityUrl("storefront.mall.payment-cashier", {
        orderId: this.data._orderId,
        ...(paymentMethod ? { paymentMethod } : {}),
      }),
    });
  },

  async cancel() {
    try {
      await cancelOrder(this.data._orderId);
      wx.showToast({ title: "已取消", icon: "success" });
      this.loadDetail();
    } catch (cause) {
      wx.showToast({ title: errorMessage(cause, "取消失败"), icon: "none" });
    }
  },

  goAfterSales() {
    wx.navigateTo({ url: mpCapabilityUrl("buyer.mall.after-sales", { orderId: this.data._orderId }) });
  },

  goLogistics() {
    wx.navigateTo({ url: mpCapabilityUrl("buyer.mall.orders.logistics", { orderId: this.data._orderId }) });
  },

  async confirmReceipt() {
    try {
      await confirmReceipt(this.data._orderId);
      wx.showToast({ title: "已确认收货", icon: "success" });
      this.loadDetail();
    } catch (cause) {
      wx.showToast({ title: errorMessage(cause, "确认收货失败"), icon: "none" });
    }
  },

  goOrders() {
    wx.navigateBack({
      fail() {
        wx.redirectTo({ url: mpCapabilityUrl("buyer.mall.orders") });
      },
    });
  },
});
