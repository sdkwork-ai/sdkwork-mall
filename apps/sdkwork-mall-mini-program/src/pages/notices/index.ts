import { errorMessage, type MpTapEvent } from "../../types/common";
import {
  listNotices,
  retrieveNotice,
  type MpNotice,
} from "../../services/im-service";
import { platform } from "@sdkwork/mall-mp-core";
import { requireSignedIn } from "../../utils/auth-gate";

interface NoticeRow extends MpNotice {
  timeText: string;
}

interface NoticesData {
  loading: boolean;
  loadingMore: boolean;
  message: string;
  notices: NoticeRow[];
  hasMore: boolean;
  _cursor: string;
  _busyId: string;
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
    loadingMore: false,
    message: "",
    notices: [],
    hasMore: true,
    _cursor: "",
    _busyId: "",
  } as NoticesData,

  onShow() {
    if (!requireSignedIn()) {
      this.setData({ loading: false });
      return;
    }
    void this.load();
  },

  onReachBottom() {
    void this.loadMore();
  },

  async load() {
    this.setData({ loading: true, message: "", _cursor: "", hasMore: true });
    try {
      const page = await listNotices();
      this.setData({
        notices: page.items.map((notice) => ({
          ...notice,
          timeText: formatTime(notice.requestedAt),
        })),
        hasMore: Boolean(page.nextCursor),
        _cursor: page.nextCursor,
        loading: false,
      });
    } catch (cause) {
      this.setData({ loading: false, message: errorMessage(cause, "通知加载失败") });
    }
  },

  /** Notifications are cursor-paginated; older notices must stay reachable. */
  async loadMore() {
    if (this.data.loading || this.data.loadingMore || !this.data.hasMore || !this.data._cursor) {
      return;
    }
    this.setData({ loadingMore: true });
    try {
      const page = await listNotices(this.data._cursor);
      const seen = new Set(this.data.notices.map((notice) => notice.notificationId));
      const appended = page.items
        .filter((notice) => !seen.has(notice.notificationId))
        .map((notice) => ({ ...notice, timeText: formatTime(notice.requestedAt) }));
      this.setData({
        notices: this.data.notices.concat(appended),
        hasMore: Boolean(page.nextCursor),
        _cursor: page.nextCursor,
        loadingMore: false,
      });
    } catch (cause) {
      this.setData({ loadingMore: false });
      platform.toast(errorMessage(cause, "通知加载失败"), "none");
    }
  },

  async openNotice(event: MpTapEvent) {
    const id = String(event.currentTarget.dataset.id ?? "");
    const index = Number(event.currentTarget.dataset.index ?? -1);
    if (!id || index < 0 || this.data._busyId) {
      return;
    }
    this.setData({ _busyId: id });
    try {
      const detail = await retrieveNotice(id);
      const current = this.data.notices[index];
      if (!current) {
        return;
      }
      const notices = [...this.data.notices];
      notices[index] = {
        ...current,
        // Only mirror a status the server reported. The client has no mark-read
        // command, so claiming "read" locally made the dot return on every visit.
        status: detail?.status || current.status,
        body: detail?.body || current.body,
      };
      this.setData({ notices });
    } catch (cause) {
      this.setData({ message: errorMessage(cause, "通知加载失败") });
    } finally {
      this.setData({ _busyId: "" });
    }
  },

  retry() {
    if (!requireSignedIn()) {
      return;
    }
    void this.load();
  },

  onPullDownRefresh() {
    if (!requireSignedIn()) {
      platform.stopPullDownRefresh();
      return;
    }
    void this.load().finally(() => platform.stopPullDownRefresh());
  },
});
