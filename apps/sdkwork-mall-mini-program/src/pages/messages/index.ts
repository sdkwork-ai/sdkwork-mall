import { t } from "../../i18n";
import { errorMessage, type MpTapEvent } from "../../types/common";
import { formatTime } from "../../utils/format";
import { listNotices, retrieveNotice } from "../../services/im-service";

interface MpMessageRowView {
  id: string;
  body: string;
  categoryText: string;
  expanded: boolean;
  summary: string;
  timeText: string;
  title: string;
  unread: boolean;
}

interface MessagesData {
  rows: MpMessageRowView[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string;
  loadingText: string;
  retryText: string;
  emptyText: string;
  viewText: string;
  collapseText: string;
  loadMoreText: string;
  allShownText: string;
  footnoteText: string;
  _cursor: string;
  _busyRowId: string;
}

function categoryLabel(category: string): string {
  switch (category) {
    case "trade":
      return t("messages.categories.trade");
    case "system":
      return t("messages.categories.system");
    case "notice":
      return t("messages.categories.notice");
    default:
      return t("messages.categories.other");
  }
}

Page({
  data: {
    rows: [],
    loading: true,
    loadingMore: false,
    hasMore: false,
    error: "",
    loadingText: t("messages.loading"),
    retryText: t("messages.retry"),
    emptyText: t("messages.empty"),
    viewText: t("messages.view"),
    collapseText: t("messages.collapse"),
    loadMoreText: t("messages.loadMore"),
    allShownText: t("messages.allShown"),
    footnoteText: t("messages.footnote"),
    _cursor: "",
    _busyRowId: "",
  } as MessagesData,

  onShow() {
    void this.loadRows();
  },

  onReachBottom() {
    void this.loadMore();
  },

  async loadRows() {
    this.setData({ loading: true, error: "" });
    try {
      const page = await listNotices();
      this.setData({
        rows: page.items.map((notice) => ({
          id: notice.notificationId,
          body: "",
          categoryText: categoryLabel(notice.category),
          expanded: false,
          summary: notice.body,
          timeText: notice.requestedAt ? formatTime(notice.requestedAt) : "",
          title: notice.title,
          unread: notice.status === "unread",
        })),
        hasMore: Boolean(page.nextCursor),
        _cursor: page.nextCursor,
        loading: false,
      });
    } catch (cause) {
      this.setData({
        loading: false,
        error: errorMessage(cause, t("messages.errors.loadFailed")),
      });
    }
  },

  async loadMore() {
    if (this.data.loadingMore || !this.data.hasMore || !this.data._cursor) {
      return;
    }
    this.setData({ loadingMore: true });
    try {
      const page = await listNotices(this.data._cursor);
      const existing = new Set(this.data.rows.map((row) => row.id));
      const appended = page.items
        .filter((notice) => !existing.has(notice.notificationId))
        .map((notice) => ({
          id: notice.notificationId,
          body: "",
          categoryText: categoryLabel(notice.category),
          expanded: false,
          summary: notice.body,
          timeText: notice.requestedAt ? formatTime(notice.requestedAt) : "",
          title: notice.title,
          unread: notice.status === "unread",
        }));
      this.setData({
        rows: this.data.rows.concat(appended),
        hasMore: Boolean(page.nextCursor),
        _cursor: page.nextCursor,
        loadingMore: false,
      });
    } catch (cause) {
      this.setData({
        loadingMore: false,
        error: errorMessage(cause, t("messages.errors.loadFailed")),
      });
    }
  },

  /**
   * Expands a notice in place.
   *
   * The previous handler navigated to the notice centre without an id, which
   * stacked a second copy of the same list and never showed the message.
   */
  async openRow(event: MpTapEvent) {
    const id = String(event.currentTarget.dataset.id ?? "");
    const row = this.data.rows.find((entry) => entry.id === id);
    if (!row || this.data._busyRowId) {
      return;
    }
    if (row.expanded) {
      this.patchRow(id, { expanded: false });
      return;
    }
    if (row.body) {
      this.patchRow(id, { expanded: true, unread: false });
      return;
    }
    this.setData({ _busyRowId: id });
    try {
      const notice = await retrieveNotice(id);
      this.patchRow(id, {
        body: notice ? notice.body : row.summary,
        expanded: true,
        unread: false,
      });
    } catch (cause) {
      this.setData({ error: errorMessage(cause, t("messages.errors.loadFailed")) });
    } finally {
      this.setData({ _busyRowId: "" });
    }
  },

  patchRow(id: string, patch: Partial<MpMessageRowView>) {
    this.setData({
      rows: this.data.rows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    });
  },

  retry() {
    void this.loadRows();
  },

  onPullDownRefresh() {
    void this.loadRows().finally(() => wx.stopPullDownRefresh());
  },
});
