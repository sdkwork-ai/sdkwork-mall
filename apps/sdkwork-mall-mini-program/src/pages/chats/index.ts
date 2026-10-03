import { errorMessage, type MpTapEvent } from "../../types/common";
import {
  listChatConversations,
  type MpChatConversation,
} from "../../services/im-service";

interface ConversationRow {
  id: string;
  title: string;
  lastMessage: string;
  unread: number;
  timeText: string;
}

interface ChatsData {
  loading: boolean;
  message: string;
  conversations: ConversationRow[];
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

Page({
  data: {
    loading: true,
    message: "",
    conversations: [],
  } as ChatsData,

  onShow() {
    void this.load();
  },

  async load() {
    this.setData({ loading: true, message: "" });
    try {
      const conversations = await listChatConversations();
      this.setData({
        conversations: conversations.map((conversation: MpChatConversation) => ({
          id: conversation.id,
          title: conversation.title,
          lastMessage: conversation.lastMessage,
          unread: conversation.unread,
          timeText: formatTime(conversation.lastMessageAt),
        })),
        loading: false,
      });
    } catch (cause) {
      this.setData({ loading: false, message: errorMessage(cause, "会话加载失败") });
    }
  },

  goChat(event: MpTapEvent) {
    const id = String(event.currentTarget.dataset.id ?? "");
    if (id) {
      wx.navigateTo({ url: `/pages/chat/index?id=${id}` });
    }
  },

  goNotices() {
    wx.navigateTo({ url: "/pages/notices/index" });
  },
});
