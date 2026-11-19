import { errorMessage, type MpTapEvent } from "../../types/common";
import {
  listNotices,
  retrieveNotice,
  type MpNotice,
} from "../../services/im-service";
import { platform } from "@sdkwork/mall-mp-core";

interface NoticeRow extends MpNotice {
  timeText: string;
}

interface NoticesData {
  loading: boolean;
  message: string;
  notices: NoticeRow[];
}

function formatTime(iso: string): string {
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) {
    return "";
  }
  return new Date(timestamp).toLocaleString("zh-CN");
}

Page({
  data: {
    loading: true,
    message: "",
    notices: [],
  } as NoticesData,

  onShow() {
    void this.load();
  },

  async load() {
    this.setData({ loading: true, message: "" });
    try {
      const page = await listNotices();
      this.setData({
        notices: page.items.map((notice) => ({
          ...notice,
          timeText: formatTime(notice.requestedAt),
        })),
        loading: false,
      });
    } catch (cause) {
      this.setData({ loading: false, message: errorMessage(cause, "通知加载失败") });
    }
  },

  async openNotice(event: MpTapEvent) {
    const id = String(event.currentTarget.dataset.id ?? "");
    const index = Number(event.currentTarget.dataset.index ?? -1);
    if (!id || index < 0) {
      return;
    }
    const detail = await retrieveNotice(id).catch(() => null);
    const current = this.data.notices[index];
    const notices = [...this.data.notices];
    notices[index] = {
      ...current,
      // Only mirror a status the server reported. The client has no mark-read
      // command, so claiming "read" locally made the dot return on every visit.
      status: detail?.status || current.status,
      body: detail?.body || current.body,
    };
    this.setData({ notices });
  },

  retry() {
    void this.load();
  },

  onPullDownRefresh() {
    void this.load().finally(() => platform.stopPullDownRefresh());
  },
});
