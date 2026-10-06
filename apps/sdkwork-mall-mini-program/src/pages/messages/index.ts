import { errorMessage, type MpTapEvent } from "../../types/common";
import { formatTime } from "../../utils/format";
import { listMessageRows, type MpMessageRow } from "../../services/messages-service";

interface MpMessageRowView extends MpMessageRow {
  timeText: string;
  targetUrl: string;
}

interface MessagesData {
  rows: MpMessageRowView[];
  loading: boolean;
  error: string;
}

Page({
  data: {
    rows: [],
    loading: true,
    error: "",
  } as MessagesData,

  onShow() {
    this.loadRows();
  },

  async loadRows() {
    this.setData({ loading: true, error: "" });
    try {
      const rows = await listMessageRows();
      this.setData({
        rows: rows.map((row) => ({
          ...row,
          timeText: row.occurredAt ? formatTime(row.occurredAt) : "",
          targetUrl: row.type === "order" ? "/pages/orders/index" : "/pages/aftersales/index",
        })),
        loading: false,
      });
    } catch (cause) {
      this.setData({ loading: false, error: errorMessage(cause, "消息加载失败") });
    }
  },

  openRow(event: MpTapEvent) {
    const url = String(event.currentTarget.dataset.url ?? "");
    if (url) {
      wx.navigateTo({ url });
    }
  },
});
