import { type MpTapEvent } from "../../types/common";
import { mpCapabilityUrl } from "../../routes/capabilities";
import {
  clearFootprint,
  readFootprint,
  type MpFootprintItem,
} from "../../services/favorites-service";
import { platform } from "@sdkwork/mall-mp-core";

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
      platform.navigateTo(mpCapabilityUrl("storefront.mall.product-detail", { id: id }));
    }
  },

  async clearAll() {
    const confirmed = await platform.confirm({
      title: "清空足迹",
      content: "确定清空全部浏览记录？",
    });
    if (!confirmed) {
      return;
    }
    clearFootprint();
    this.setData({ records: [] });
  },
});
