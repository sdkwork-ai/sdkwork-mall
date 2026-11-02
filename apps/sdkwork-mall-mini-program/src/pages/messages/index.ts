import { t } from "../../i18n";
import { errorMessage, type MpTapEvent } from "../../types/common";
import { mpCapabilityUrl } from "../../routes/capabilities";
import { formatTime } from "../../utils/format";
import { listNotices } from "../../services/im-service";

interface MpMessageRowView {
  id: string;
  categoryText: string;
  summary: string;
  timeText: string;
  title: string;
  unread: boolean;
  targetUrl: string;
}

interface MessagesData {
  rows: MpMessageRowView[];
  loading: boolean;
  error: string;
  loadingText: string;
  retryText: string;
  emptyText: string;
  viewText: string;
  footnoteText: string;
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
    error: "",
    loadingText: t("messages.loading"),
    retryText: t("messages.retry"),
    emptyText: t("messages.empty"),
    viewText: t("messages.view"),
    footnoteText: t("messages.footnote"),
  } as MessagesData,

  onShow() {
    void this.loadRows();
  },

  async loadRows() {
    this.setData({ loading: true, error: "" });
    try {
      const page = await listNotices();
      this.setData({
        rows: page.items.map((notice) => ({
          categoryText: categoryLabel(notice.category),
          id: notice.notificationId,
          summary: notice.body,
          targetUrl: mpCapabilityUrl("buyer.mall.im.notices"),
          timeText: notice.requestedAt ? formatTime(notice.requestedAt) : "",
          title: notice.title,
          unread: notice.status === "unread",
        })),
        loading: false,
      });
    } catch (cause) {
      this.setData({
        loading: false,
        error: errorMessage(cause, t("messages.errors.loadFailed")),
      });
    }
  },

  openRow(event: MpTapEvent) {
    const url = String(event.currentTarget.dataset.url ?? "");
    if (url) {
      wx.navigateTo({ url });
    }
  },

  retry() {
    void this.loadRows();
  },
});
