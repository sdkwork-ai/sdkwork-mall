import { errorMessage } from "../../types/common";
import { formatTime } from "../../utils/format";
import {
  getOrderLogistics,
  type MpShipmentLogistics,
} from "../../services/order-service";

interface MpTrackingEventView {
  description: string;
  metaText: string;
  latest: boolean;
}

interface MpShipmentLogisticsView {
  shipmentId: string;
  titleText: string;
  metaText: string;
  packagesText: string;
  events: MpTrackingEventView[];
}

interface LogisticsData {
  shipments: MpShipmentLogisticsView[];
  loading: boolean;
  error: string;
  missingOrder: boolean;
}

Page({
  data: {
    shipments: [],
    loading: true,
    error: "",
    missingOrder: false,
  } as LogisticsData,

  onLoad(options: Record<string, string | undefined>) {
    this.loadLogistics(options.orderId || "", options.shipmentId || "");
  },

  async loadLogistics(orderId: string, shipmentId: string) {
    if (!orderId && !shipmentId) {
      this.setData({ loading: false, missingOrder: true });
      return;
    }
    this.setData({ loading: true, error: "", missingOrder: false });
    try {
      const shipments = await getOrderLogistics({ orderId, shipmentId });
      this.setData({
        shipments: shipments.map((shipment) => this.toView(shipment)),
        loading: false,
      });
    } catch (cause) {
      this.setData({ loading: false, error: errorMessage(cause, "物流加载失败") });
    }
  },

  toView(shipment: MpShipmentLogistics): MpShipmentLogisticsView {
    return {
      shipmentId: shipment.shipmentId,
      titleText: shipment.shipmentNo ? `运单号：${shipment.shipmentNo}` : shipment.shipmentId,
      metaText: [shipment.carrier, shipment.statusLabel].filter(Boolean).join(" · "),
      packagesText: shipment.packages.length > 0
        ? `包裹：${shipment.packages.map((entry) => entry.name || entry.id).join("、")}`
        : "",
      events: shipment.trackingEvents.map((event, index) => ({
        description: event.description,
        metaText: [event.status, event.occurredAt ? formatTime(event.occurredAt) : ""]
          .filter(Boolean)
          .join(" · "),
        latest: index === 0,
      })),
    };
  },

  goOrders() {
    wx.navigateBack({
      fail() {
        wx.redirectTo({ url: "/pages/orders/index" });
      },
    });
  },
});
