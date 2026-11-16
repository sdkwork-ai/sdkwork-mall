import { errorMessage, type MpInputEvent } from "../../types/common";
import { mpCapabilityUrl } from "../../routes/capabilities";
import {
  listChatMessages,
  markChatRead,
  sendChatMessage,
  type MpChatMessage,
} from "../../services/im-service";
import { isLoggedIn } from "../../services/session";
import { platform } from "@sdkwork/mall-mp-core";

const POLL_INTERVAL_MS = 5000;

interface ChatData {
  messages: MpChatMessage[];
  draft: string;
  busy: boolean;
  message: string;
  scrollInto: string;
  _conversationId: string;
  /** Newest message already acknowledged with a read receipt. */
  _acknowledgedId: string;
  /** Newest message already rendered; drives both scroll and read receipts. */
  _lastMessageId: string;
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
    _acknowledgedId: "",
    _lastMessageId: "",
    _pollTimer: null,
  } as ChatData,

  onLoad(options: Record<string, string | undefined>) {
    // The conversation list navigates with `?id=`; `conversationId` stays
    // accepted for links built by the other clients.
    this.setData({ _conversationId: options.id || options.conversationId || "" });
  },

  onShow() {
    if (!isLoggedIn()) {
      platform.navigateTo(mpCapabilityUrl("account.mall.login"));
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
      const lastId = messages.length ? messages[messages.length - 1].id : "";
      const patch: Record<string, unknown> = { message: "" };
      // Repaint only when the stream actually changed: a 5 s poll that always
      // called setData with a fresh array re-rendered the page every cycle.
      if (lastId !== this.data._lastMessageId || messages.length !== this.data.messages.length) {
        patch.messages = messages;
        patch.scrollInto = lastId ? `msg-${lastId}` : "";
        patch._lastMessageId = lastId;
      }
      this.setData(patch);
      // A read receipt per poll wrote ~720 receipts per hour; only a new
      // inbound message needs one.
      if (lastId && lastId !== this.data._acknowledgedId) {
        this.setData({ _acknowledgedId: lastId });
        void markChatRead(this.data._conversationId).catch(() => undefined);
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
    this.setData({ busy: true, message: "" });
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

  retry() {
    void this.refresh();
  },
});
