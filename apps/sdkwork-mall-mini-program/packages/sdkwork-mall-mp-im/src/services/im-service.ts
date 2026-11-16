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
  createImMpNotificationsService,
  type ImMpChatConversationService,
  type ImMpChatInboxService,
  type ImMpNotificationsService,
} from "@sdkwork/im-mp-chat/services";
import { type ImAppSdkClient, type ImChatSdkClient } from "@sdkwork/mall-mp-core";

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
}

/** Capability services composed by the app bootstrap. */
export interface MpImServices {
  readonly conversation: ImMpChatConversationService;
  readonly inbox: ImMpChatInboxService;
  readonly notifications: ImMpNotificationsService;
  /**
   * Signed-in IAM user id, used to tell a buyer's own bubble from the agent's.
   *
   * Injected instead of read from a global so the capability stays testable and
   * has no hidden dependency on the runtime singleton.
   */
  readonly resolveCurrentUserId: () => string;
}

let services: MpImServices | null = null;

/** Installs the composed services; called once from `app.onLaunch`. */
export function configureMpImServices(next: MpImServices | null): void {
  services = next;
}

function requireServices(): MpImServices {
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
  options: { resolveCurrentUserId?: () => string } = {},
): MpImServices {
  // The generated IM runtime client is the structural `ImMpChatSdkPort` the chat
  // services consume; the cast documents that the port type belongs to IM.
  const resolveChat = () => clients.imChatClient as unknown as ImMpChatSdkPort;
  return {
    notifications: createImMpNotificationsService(() => clients.imAppClient),
    inbox: createImMpChatInboxService(resolveChat),
    conversation: createImMpChatConversationService(resolveChat),
    resolveCurrentUserId: options.resolveCurrentUserId ?? (() => ""),
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

export async function listChatConversations(): Promise<MpChatConversation[]> {
  const page = await requireServices().inbox.listPage({});
  return page.items
    .filter((item) => item.conversationId)
    .map((item) => ({
      id: item.conversationId,
      title: item.displayName || "官方客服",
      agentName: item.displayName || "客服",
      lastMessage: item.lastSummary ?? "",
      lastMessageAt: item.lastActivityAt,
      unread: item.unreadCount,
    }));
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
      // int64 wire field; used only to order the stream.
      seq: Number(item.messageSeq) || 0,
    }))
    // The IM services own history paging and may return newest-first; the mall
    // chat stream renders oldest-first and scrolls to the newest bubble.
    .sort((left, right) => {
      if (left.seq !== right.seq) {
        return left.seq - right.seq;
      }
      return Date.parse(left.sentAt) - Date.parse(right.sentAt);
    })
    .map(({ seq: _seq, ...message }) => message);
}

export async function sendChatMessage(conversationId: string, content: string): Promise<void> {
  await requireServices().conversation.sendText(conversationId, content);
}

export async function markChatRead(conversationId: string): Promise<void> {
  // The IM service advances the per-principal read cursor and clears the
  // marked-unread flag; mall has no read state of its own.
  await requireServices().conversation.markConversationRead(conversationId);
}
