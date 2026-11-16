import { t } from "../../i18n";
import { errorMessage, type MpInputEvent } from "../../types/common";
import { mpCapabilityUrl } from "../../routes/capabilities";
import {
  listChatMessages,
  markChatRead,
  recoverRealtime,
  sendChatImage,
  sendChatMessage,
  subscribeConversationMessages,
  type MpChatMessage,
} from "../../services/im-service";
import { isLoggedIn } from "../../services/session";
import { platform } from "@sdkwork/mall-mp-core";

/** Safety-net polling; live pushes arrive through the IM realtime plane. */
const POLL_INTERVAL_MS = 15_000;
/** Collapses a burst of pushes into one re-read. */
const PUSH_DEBOUNCE_MS = 250;
/** Chat images share the after-sales evidence limit (5 MB). */
const MAX_CHAT_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Live-message lease per page instance.
 *
 * The release function is not page data (functions cannot cross `setData`) and a
 * module-level singleton would leak when two chat pages are stacked, so it is
 * keyed by the page instance.
 */
const realtimeLeases = new WeakMap<object, () => void>();

interface ChatData {
  messages: MpChatMessage[];
  draft: string;
  busy: boolean;
  message: string;
  scrollInto: string;
  imageText: string;
  sendText: string;
  emptyText: string;
  placeholder: string;
  _conversationId: string;
  /** Newest message already acknowledged with a read receipt. */
  _acknowledgedId: string;
  /** Newest message already rendered; drives both scroll and read receipts. */
  _lastMessageId: string;
  _pollTimer: number | null;
  _pushTimer: number | null;
  _realtimeConnected: boolean;
}

Page({
  data: {
    messages: [],
    draft: "",
    busy: false,
    message: "",
    scrollInto: "",
    imageText: t("chat.image"),
    sendText: t("chat.send"),
    emptyText: t("chat.empty"),
    placeholder: t("chat.placeholder"),
    _conversationId: "",
    _acknowledgedId: "",
    _lastMessageId: "",
    _pollTimer: null,
    _pushTimer: null,
    _realtimeConnected: false,
  } as ChatData,

  /** Release function of the live-message lease acquired in `onShow`. */
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
    // The realtime plane reconnects lazily after a background/foreground cycle.
    recoverRealtime();
    this.startRealtime();
    this.startPolling();
  },

  onHide() {
    this.stopPolling();
    this.stopRealtime();
  },

  onUnload() {
    this.stopPolling();
    this.stopRealtime();
  },

  /**
   * Leases live messages for the open conversation.
   *
   * IM owns the socket, subscription set and reconnect backoff; this page only
   * re-reads the stream when something arrives, so a wire payload is never
   * mapped twice. Polling stays as the offline fallback.
   */
  startRealtime() {
    this.stopRealtime();
    const conversationId = this.data._conversationId;
    if (!conversationId) {
      return;
    }
    const release = subscribeConversationMessages(conversationId, () => {
      this.setData({ _realtimeConnected: true });
      if (this.data._pushTimer != null) {
        clearTimeout(this.data._pushTimer);
      }
      this.setData({
        _pushTimer: setTimeout(() => {
          this.setData({ _pushTimer: null });
          void this.refresh();
        }, PUSH_DEBOUNCE_MS) as unknown as number,
      });
    });
    realtimeLeases.set(this as object, release);
  },

  stopRealtime() {
    const release = realtimeLeases.get(this as object);
    if (release) {
      release();
      realtimeLeases.delete(this as object);
    }
    if (this.data._pushTimer != null) {
      clearTimeout(this.data._pushTimer);
      this.setData({ _pushTimer: null });
    }
  },

  startPolling() {
    this.stopPolling();
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
      // Repaint only when the stream actually changed: a poll that always called
      // setData with a fresh array re-rendered the page every cycle.
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
      this.setData({ message: errorMessage(cause, t("chat.loadFailed")) });
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
      this.setData({ message: errorMessage(cause, t("chat.sendFailed")) });
    } finally {
      this.setData({ busy: false });
    }
  },

  /**
   * Picks one image and posts it as a media message.
   *
   * Bytes go host picker -> Drive uploader (injected into the messaging
   * capability) -> IM conversation media part; nothing is inlined into the
   * message record.
   */
  async sendImage() {
    if (this.data.busy || !this.data._conversationId) {
      return;
    }
    let chosen;
    try {
      chosen = await platform.chooseImages({ maxCount: 1, maxSizeBytes: MAX_CHAT_IMAGE_BYTES });
    } catch (cause) {
      // A dismissed picker is not an error worth a banner.
      if ((cause as { code?: string } | null)?.code !== "cancelled") {
        this.setData({ message: errorMessage(cause, t("chat.pickImageFailed")) });
      }
      return;
    }
    const image = chosen[0];
    if (!image) {
      return;
    }
    this.setData({ busy: true, message: "" });
    try {
      const bytes = await platform.readBytes(image.path);
      const fileName = image.path.split("/").pop() || "chat-image.jpg";
      await sendChatImage(this.data._conversationId, {
        bytes,
        contentType: image.contentType,
        fileName,
        sizeBytes: image.sizeBytes,
      });
      await this.refresh();
    } catch (cause) {
      this.setData({ message: errorMessage(cause, t("chat.sendImageFailed")) });
    } finally {
      this.setData({ busy: false });
    }
  },

  retry() {
    void this.refresh();
  },
});
