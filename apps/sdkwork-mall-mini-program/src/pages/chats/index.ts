import { errorMessage, type MpTapEvent } from "../../types/common";
import { mpCapabilityUrl } from "../../routes/capabilities";
import {
  listChatConversationPage,
  type MpChatConversation,
} from "../../services/im-service";
import { platform } from "@sdkwork/mall-mp-core";
import { requireSignedIn } from "../../utils/auth-gate";
import { setMessageTabBadge } from "../../services/tab-bar-service";

interface ConversationRow {
  id: string;
  title: string;
  lastMessage: string;
  unread: number;
  timeText: string;
}

interface ChatsData {
  loading: boolean;
  loadingMore: boolean;
  message: string;
  conversations: ConversationRow[];
  hasMore: boolean;
  _cursor: string;
}

function formatTime(iso: string): string {
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) {
    return "";
  }
  const at = new Date(timestamp);
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${pad(at.getMonth() + 1)}-${pad(at.getDate())} ${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

function toRow(conversation: MpChatConversation): ConversationRow {
  return {
    id: conversation.id,
    title: conversation.title,
    lastMessage: conversation.lastMessage,
    unread: conversation.unread,
    timeText: formatTime(conversation.lastMessageAt),
  };
}

Page({
  data: {
    loading: true,
    loadingMore: false,
    message: "",
    conversations: [],
    hasMore: true,
    _cursor: "",
  } as ChatsData,

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
      const page = await listChatConversationPage();
      // The 消息 tab badge mirrors the unread客服 count (H5 shell parity).
      setMessageTabBadge(page.items.reduce((sum, conversation) => sum + (Number(conversation.unread) || 0), 0));
      this.setData({
        conversations: page.items.map(toRow),
        hasMore: page.hasMore,
        _cursor: page.nextCursor,
        loading: false,
      });
    } catch (cause) {
      this.setData({ loading: false, message: errorMessage(cause, "会话加载失败") });
    }
  },

  /** Inbox rows are cursor-paginated; older conversations must stay reachable. */
  async loadMore() {
    if (this.data.loading || this.data.loadingMore || !this.data.hasMore || !this.data._cursor) {
      return;
    }
    this.setData({ loadingMore: true });
    try {
      const page = await listChatConversationPage(this.data._cursor);
      const seen = new Set(this.data.conversations.map((row) => row.id));
      const appended = page.items.map(toRow).filter((row) => !seen.has(row.id));
      const conversations = this.data.conversations.concat(appended);
      setMessageTabBadge(conversations.reduce((sum, conversation) => sum + (Number(conversation.unread) || 0), 0));
      this.setData({
        conversations,
        hasMore: page.hasMore,
        _cursor: page.nextCursor,
        loadingMore: false,
      });
    } catch (cause) {
      this.setData({ loadingMore: false });
      platform.toast(errorMessage(cause, "会话加载失败"), "none");
    }
  },

  goChat(event: MpTapEvent) {
    const id = String(event.currentTarget.dataset.id ?? "");
    if (id) {
      platform.navigateTo(mpCapabilityUrl("buyer.mall.im.chat", { id: id }));
    }
  },

  goNotices() {
    platform.navigateTo(mpCapabilityUrl("buyer.mall.im.notices"));
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
