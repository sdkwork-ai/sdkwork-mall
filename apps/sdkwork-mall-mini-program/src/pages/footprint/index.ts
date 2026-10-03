import { type MpTapEvent } from "../../types/common";
import {
  clearFootprint,
  readFootprint,
  type MpFootprintItem,
} from "../../services/favorites-service";

interface FootprintRow extends MpFootprintItem {
  viewedText: string;
}

interface FootprintData {
  records: FootprintRow[];
}

function formatViewedAt(iso: string): string {
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) {
    return "";
  }
  const at = new Date(timestamp);
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

function toRows(records: MpFootprintItem[]): FootprintRow[] {
  return records.map((item) => ({ ...item, viewedText: formatViewedAt(item.viewedAt) }));
}

Page({
  data: {
    records: [],
  } as FootprintData,

  onShow() {
    this.setData({ records: toRows(readFootprint()) });
  },

  goProduct(event: MpTapEvent) {
    const id = String(event.currentTarget.dataset.id ?? "");
    if (id) {
      wx.navigateTo({ url: `/pages/product/index?id=${id}` });
    }
  },

  clearAll() {
    wx.showModal({
      title: "清空足迹",
      content: "确定清空全部浏览记录？",
      success: (result) => {
        if (result.confirm) {
          clearFootprint();
          this.setData({ records: [] });
        }
      },
    });
  },
});
