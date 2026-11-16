import { t } from "../../i18n";
import { errorMessage, type MpInputEvent, type MpTapEvent } from "../../types/common";
import { mpCapabilityUrl } from "../../routes/capabilities";
import {
  listChatMessages,
  markChatRead,
  recoverRealtime,
  resolveChatImageUrl,
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

/**
 * Signed image URLs keyed by Drive node.
 *
 * A re-read of the stream returns the same nodes again; caching keeps one grant
 * per bubble per visit instead of one per refresh cycle.
 */
const chatImageUrls = new Map<string, string>();

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
      void this.resolveImageUrls();
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

  /**
   * Resolves signed URLs for image bubbles.
   *
   * The message record only carries the persisted Drive identity; rendering
   * exchanges it for a short-lived URL through the injected grant port. Fail-soft:
   * a failed grant leaves the file-name text bubble in place.
   */
  async resolveImageUrls() {
    const pending = this.data.messages.filter(
      (message) => message.mediaNodeId && !message.imageUrl && !chatImageUrls.has(message.mediaNodeId),
    );
    if (pending.length === 0) {
      const cached = this.data.messages.some(
        (message) => message.mediaNodeId && !message.imageUrl && chatImageUrls.has(message.mediaNodeId),
      );
      if (!cached) {
        return;
      }
    }
    const conversationId = this.data._conversationId;
    const resolved = new Map<string, string>(chatImageUrls);
    await Promise.all(pending.map(async (message) => {
      const nodeId = message.mediaNodeId as string;
      try {
        resolved.set(nodeId, await resolveChatImageUrl(nodeId));
      } catch {
        // keep the text fallback for this bubble
      }
    }));
    if (this.data._conversationId !== conversationId) {
      return;
    }
    for (const [nodeId, url] of resolved) {
      chatImageUrls.set(nodeId, url);
    }
    if (resolved.size === 0) {
      return;
    }
    this.setData({
      messages: this.data.messages.map((message) => {
        const url = message.mediaNodeId ? resolved.get(message.mediaNodeId) : undefined;
        return url ? { ...message, imageUrl: url } : message;
      }),
    });
  },

  /** Full-screen preview of the conversation's image bubbles. */
  previewChatImage(event: MpTapEvent) {
    const current = String(event.currentTarget.dataset.url ?? "");
    const urls = this.data.messages
      .map((message) => message.imageUrl)
      .filter((url): url is string => Boolean(url));
    if (current && urls.length > 0) {
      platform.previewImages({ current, urls });
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
