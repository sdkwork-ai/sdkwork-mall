/**
 * Messaging facade for the SDKWork Mall mini program.
 *
 * Authority: `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` sections 3-6. Messaging
 * belongs to `sdkwork-im`: the notice centre, inbox and conversation services
 * come from `@sdkwork/im-mp-chat/services`, and this module only projects their
 * domain types onto mall view models so pages stay capability-agnostic.
 *
 * The services take an injected client resolver; the app bootstrap supplies the
 * generated IM clients (`@sdkwork/im-app-sdk` for notices, `@sdkwork/im-sdk` for
 * conversations/messages). Nothing here constructs a client or a transport.
 */
import type { ImMpChatSdkPort } from "@sdkwork/im-mp-chat";
import {
  createImMpChatConversationService,
  createImMpChatInboxService,
  createImMpChatRealtimeService,
  createImMpNotificationsService,
  type ImMpChatConversationService,
  type ImMpChatInboxService,
  type ImMpChatRealtimeService,
  type ImMpNotificationsService,
} from "@sdkwork/im-mp-chat/services";
import { readSharedState, writeSharedState, type ImAppSdkClient, type ImChatSdkClient } from "@sdkwork/mall-mp-core";

export interface MpNotice {
  readonly body: string;
  readonly category: string;
  readonly notificationId: string;
  readonly requestedAt: string;
  readonly status: string;
  readonly title: string;
}

export interface MpNoticePage {
  readonly items: MpNotice[];
  readonly nextCursor: string;
}

export interface MpChatConversation {
  readonly agentName: string;
  readonly id: string;
  readonly lastMessage: string;
  readonly lastMessageAt: string;
  readonly title: string;
  readonly unread: number;
}

export interface MpChatMessage {
  readonly content: string;
  readonly id: string;
  readonly role: string;
  readonly sentAt: string;
  /** Drive node of an image message, when the message carries media. */
  readonly mediaNodeId?: string;
  /** Short-lived signed URL resolved for that node, when available. */
  readonly imageUrl?: string;
}

/** One picked image ready to become a media message. */
export interface MpImChatImageInput {
  readonly bytes: ArrayBuffer;
  readonly contentType: string;
  readonly fileName: string;
  readonly sizeBytes: number;
}

/** Stored Drive identity of an uploaded image (what a media part persists). */
export interface MpImChatImageUpload {
  readonly driveUri: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly nodeId: string;
  readonly sizeBytes: string;
  readonly spaceId: string;
}

/**
 * Drive uploader injected by the app bootstrap.
 *
 * Image bytes belong to the Drive plane (`DRIVE_SPEC.md` section 9), not to the
 * messaging capability, so the capability never uploads by itself: it hands the
 * bytes to this port and posts the returned identity.
 */
export type MpImImageUploader = (input: MpImChatImageInput) => Promise<MpImChatImageUpload>;

/**
 * Drive download-grant resolver injected by the app bootstrap.
 *
 * The IM message carries the persisted `drive://` identity, not a readable URL;
 * rendering exchanges the node id for a short-lived signed URL through this port.
 */
export type MpImImageUrlResolver = (nodeId: string) => Promise<string>;

/** Capability services composed by the app bootstrap. */
export interface MpImServices {
  readonly conversation: ImMpChatConversationService;
  readonly inbox: ImMpChatInboxService;
  readonly notifications: ImMpNotificationsService;
  /** Live message lease per conversation; falls back to polling when offline. */
  readonly realtime: ImMpChatRealtimeService;
  /**
   * Signed-in IAM user id, used to tell a buyer's own bubble from the agent's.
   *
   * Injected instead of read from a global so the capability stays testable and
   * has no hidden dependency on the runtime singleton.
   */
  readonly resolveCurrentUserId: () => string;
  /** Drive download grants for image bubbles. */
  readonly resolveImageUrl?: MpImImageUrlResolver;
  /** Drive uploader for image messages; absent when the surface is text-only. */
  readonly uploadImage?: MpImImageUploader;
}

/**
 * Composed services key.
 *
 * The published package is bundled per entry (app + every page); a module-local
 * registry would be initialized in the app bundle and read as `null` in every
 * page bundle. The shared cross-bundle store keeps one registry.
 */
const IM_SERVICES_GLOBAL_KEY = "__SDKWORK_MALL_MP_IM_SERVICES__";

function readImServices(): MpImServices | null {
  return readSharedState<MpImServices | null>(IM_SERVICES_GLOBAL_KEY) ?? null;
}

/** Installs the composed services; called once from `app.onLaunch`. */
export function configureMpImServices(next: MpImServices | null): void {
  writeSharedState(IM_SERVICES_GLOBAL_KEY, next);
}

function requireServices(): MpImServices {
  const services = readImServices();
  if (!services) {
    throw new Error("IM services are not configured; wire them from app bootstrap");
  }
  return services;
}

/**
 * Builds the capability services from the runtime's generated IM clients.
 *
 * @param clients - IM app SDK client (notices) and IM chat client (conversations).
 * @param options - `resolveCurrentUserId` identifies the signed-in buyer.
 */
export function createMpImServices(
  clients: {
    readonly imAppClient: ImAppSdkClient;
    readonly imChatClient: ImChatSdkClient;
  },
  options: {
    resolveCurrentUserId?: () => string;
    resolveImageUrl?: MpImImageUrlResolver;
    uploadImage?: MpImImageUploader;
  } = {},
): MpImServices {
  // The generated IM runtime client is the structural `ImMpChatSdkPort` the chat
  // services consume; the cast documents that the port type belongs to IM.
  const resolveChat = () => clients.imChatClient as unknown as ImMpChatSdkPort;
  return {
    notifications: createImMpNotificationsService(() => clients.imAppClient),
    inbox: createImMpChatInboxService(resolveChat),
    conversation: createImMpChatConversationService(resolveChat),
    realtime: createImMpChatRealtimeService(resolveChat),
    resolveCurrentUserId: options.resolveCurrentUserId ?? (() => ""),
    ...(options.resolveImageUrl ? { resolveImageUrl: options.resolveImageUrl } : {}),
    ...(options.uploadImage ? { uploadImage: options.uploadImage } : {}),
  };
}

export async function listNotices(cursor?: string): Promise<MpNoticePage> {
  const page = await requireServices().notifications.listPage({
    pageSize: 20,
    ...(cursor ? { cursor } : {}),
  });
  return {
    items: page.items.map((notice) => ({
      notificationId: notice.notificationId,
      category: notice.category,
      title: notice.title,
      body: notice.body,
      status: notice.status,
      requestedAt: notice.requestedAt,
    })),
    nextCursor: page.nextCursor ?? "",
  };
}

export async function retrieveNotice(notificationId: string): Promise<MpNotice | null> {
  const notice = await requireServices().notifications.retrieve(notificationId);
  if (!notice) {
    return null;
  }
  return {
    notificationId: notice.notificationId,
    category: notice.category,
    title: notice.title,
    body: notice.body,
    status: notice.status,
    requestedAt: notice.requestedAt,
  };
}

function toChatConversation(item: {
  conversationId: string;
  displayName?: string;
  lastActivityAt: string;
  lastSummary?: string;
  unreadCount: number;
}): MpChatConversation {
  return {
    id: item.conversationId,
    title: item.displayName || "官方客服",
    agentName: item.displayName || "客服",
    lastMessage: item.lastSummary ?? "",
    lastMessageAt: item.lastActivityAt,
    unread: item.unreadCount,
  };
}

/** One cursor page of the客服 inbox, so older conversations stay reachable. */
export async function listChatConversationPage(
  cursor?: string,
): Promise<{ hasMore: boolean; items: MpChatConversation[]; nextCursor: string }> {
  const page = await requireServices().inbox.listPage({
    pageSize: 20,
    ...(cursor ? { cursor } : {}),
  });
  return {
    hasMore: page.hasMore,
    items: page.items.filter((item) => item.conversationId).map(toChatConversation),
    nextCursor: page.nextCursor ?? "",
  };
}

export async function listChatConversations(): Promise<MpChatConversation[]> {
  return (await listChatConversationPage()).items;
}

export async function listChatMessages(conversationId: string): Promise<MpChatMessage[]> {
  const { conversation, resolveCurrentUserId } = requireServices();
  const page = await conversation.listMessages(conversationId, { pageSize: 50 });
  const currentUserId = resolveCurrentUserId();
  return page.items
    .filter((item) => item.messageId)
    .map((item) => ({
      id: item.messageId,
      content: item.text,
      role: currentUserId && item.senderId === currentUserId ? "user" : "agent",
      sentAt: item.occurredAt,
      ...(item.media?.nodeId ? { mediaNodeId: item.media.nodeId } : {}),
      // int64 wire field kept as a decimal string; never parsed to a double.
      seq: item.messageSeq,
    }))
    // The IM services own history paging and may return newest-first; the mall
    // chat stream renders oldest-first and scrolls to the newest bubble.
    .sort((left, right) => {
      const seqOrder = compareDecimalSeq(left.seq, right.seq);
      if (seqOrder !== 0) {
        return seqOrder;
      }
      const leftTime = Date.parse(left.sentAt);
      const rightTime = Date.parse(right.sentAt);
      return (Number.isFinite(leftTime) ? leftTime : 0) - (Number.isFinite(rightTime) ? rightTime : 0);
    })
    .map(({ seq: _seq, ...message }) => message);
}

/**
 * Compares two int64 decimal strings without converting them to a double.
 *
 * `Number("...")` collapses precision past 2^53 and can reorder two adjacent
 * messages; comparing sign, length and then lexicographically is exact for the
 * non-negative sequence ids the IM plane issues.
 */
function compareDecimalSeq(left: string | null | undefined, right: string | null | undefined): number {
  const a = left ? left.replace(/^0+(?=\d)/u, "") : "";
  const b = right ? right.replace(/^0+(?=\d)/u, "") : "";
  if (a === b) {
    return 0;
  }
  if (!a) {
    return -1;
  }
  if (!b) {
    return 1;
  }
  if (a.length !== b.length) {
    return a.length - b.length;
  }
  return a < b ? -1 : 1;
}

/**
 * Resolves the signed URL for one image message node.
 *
 * @param nodeId - Drive node referenced by the message.
 */
export async function resolveChatImageUrl(nodeId: string): Promise<string> {
  const resolve = requireServices().resolveImageUrl;
  if (!resolve) {
    throw new Error("IM image URL resolver is not configured; wire it from app bootstrap");
  }
  return resolve(nodeId);
}

export async function sendChatMessage(conversationId: string, content: string): Promise<void> {
  await requireServices().conversation.sendText(conversationId, content);
}

export async function markChatRead(conversationId: string): Promise<void> {
  // The IM service advances the per-principal read cursor and clears the
  // marked-unread flag; mall has no read state of its own.
  await requireServices().conversation.markConversationRead(conversationId);
}

/**
 * Leases live messages for one conversation.
 *
 * The IM realtime service owns the socket, the subscription set and the
 * reconnect backoff; mall only reacts to "something arrived" and re-reads the
 * page, so a decoded wire payload never has to be mapped twice.
 *
 * @param conversationId - Open conversation.
 * @param onMessage - Called for each delivered message.
 * @returns The release function; call it from `onHide`/`onUnload`.
 */
export function subscribeConversationMessages(
  conversationId: string,
  onMessage: () => void,
): () => void {
  return requireServices().realtime.subscribeConversation(conversationId, () => {
    onMessage();
  });
}

/** Reconnects after the app returns to the foreground; no-op while connected. */
export function recoverRealtime(): void {
  requireServices().realtime.recover();
}

/** True while the IM realtime plane is connected. */
export function isRealtimeConnected(): boolean {
  return requireServices().realtime.isLiveConnected();
}

/** Tears the realtime plane down (logout / account switch). */
export function disposeRealtime(): void {
  requireServices().realtime.dispose();
}

/**
 * Sends one image message.
 *
 * Two planes, one call: the bytes go through the injected Drive uploader, and the
 * resulting identity is posted through the IM conversation service as a media
 * part. Nothing is base64'd into the message record (`DRIVE_SPEC.md` section 10).
 *
 * @param conversationId - Open conversation.
 * @param image - Picked image bytes plus its declared metadata.
 */
export async function sendChatImage(
  conversationId: string,
  image: MpImChatImageInput,
): Promise<void> {
  const services = requireServices();
  if (!services.uploadImage) {
    throw new Error("IM image uploader is not configured; wire it from app bootstrap");
  }
  const stored = await services.uploadImage(image);
  await services.conversation.sendImage(conversationId, {
    driveUri: stored.driveUri,
    fileName: stored.fileName,
    mimeType: stored.mimeType,
    nodeId: stored.nodeId,
    sizeBytes: stored.sizeBytes,
    spaceId: stored.spaceId,
  });
}
