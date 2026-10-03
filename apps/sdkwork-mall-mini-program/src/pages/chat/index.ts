import { errorMessage, type MpInputEvent } from "../../types/common";
import {
  listChatMessages,
  markChatRead,
  sendChatMessage,
  type MpChatMessage,
} from "../../services/im-service";
import { isLoggedIn } from "../../services/session";

const POLL_INTERVAL_MS = 5000;

interface ChatData {
  messages: MpChatMessage[];
  draft: string;
  busy: boolean;
  message: string;
  scrollInto: string;
  _conversationId: string;
  _pollTimer: number | null;
}

Page({
  data: {
    messages: [],
    draft: "",
    busy: false,
    message: "",
    scrollInto: "",
    _conversationId: "",
    _pollTimer: null,
  } as ChatData,

  onLoad(options: Record<string, string | undefined>) {
    this.setData({ _conversationId: options.id || "" });
  },

  onShow() {
    if (!isLoggedIn()) {
      wx.navigateTo({ url: "/pages/login/index" });
      return;
    }
    void this.refresh();
    this.startPolling();
  },

  onHide() {
    this.stopPolling();
  },

  onUnload() {
    this.stopPolling();
  },

  startPolling() {
    this.stopPolling();
    // 客服回复轮询：realtime CCP 接入前保持会话新鲜（与 H5 一致）。
    this.setData({
      _pollTimer: setInterval(() => {
        void this.refresh();
      }, POLL_INTERVAL_MS) as unknown as number,
    });
  },

  stopPolling() {
    if (this.data._pollTimer != null) {
      clearInterval(this.data._pollTimer);
      this.setData({ _pollTimer: null });
    }
  },

  async refresh() {
    if (!this.data._conversationId) {
      return;
    }
    try {
      const messages = await listChatMessages(this.data._conversationId);
      const lastId = messages.length ? `msg-${messages[messages.length - 1].id}` : "";
      this.setData({
        messages,
        scrollInto: lastId,
        message: "",
      });
      if (messages.length) {
        await markChatRead(this.data._conversationId).catch(() => undefined);
      }
    } catch (cause) {
      this.setData({ message: errorMessage(cause, "消息加载失败") });
    }
  },

  onDraftInput(event: MpInputEvent) {
    this.setData({ draft: event.detail.value });
  },

  async send() {
    const content = this.data.draft.trim();
    if (!content || this.data.busy || !this.data._conversationId) {
      return;
    }
    this.setData({ busy: true });
    try {
      await sendChatMessage(this.data._conversationId, content);
      this.setData({ draft: "" });
      await this.refresh();
    } catch (cause) {
      this.setData({ message: errorMessage(cause, "发送失败") });
    } finally {
      this.setData({ busy: false });
    }
  },
});
