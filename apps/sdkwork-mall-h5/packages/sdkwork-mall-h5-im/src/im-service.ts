/**
 * Messaging facade for the mall H5.
 *
 * Two planes, one seam-free surface for pages:
 * - notices (system / trade notifications) go through the IM notifications
 *   port, satisfied by the generated `@sdkwork/im-app-sdk` client;
 * - customer-service chat goes through the package-local transport seam.
 */
import {
  getSdkworkImNotificationsPort,
} from "./im-remote-port";
import { chatGet, chatPost } from "./im-transport";

export interface MallH5Notice {
  notificationId: string;
  category: string;
  title: string;
  body: string;
  status: string;
  requestedAt: string;
}

export interface MallH5NoticePage {
  items: MallH5Notice[];
  nextCursor?: string;
}

export interface MallH5ChatConversation {
  agentName: string;
  id: string;
  lastMessage: string;
  lastMessageAt: string;
  title: string;
  unread: number;
}

export interface MallH5ChatMessage {
  content: string;
  id: string;
  role: string;
  sentAt: string;
}

function readString(record: Record<string, unknown>, keys: readonly string[], fallback = ""): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value) {
      return value;
    }
  }
  return fallback;
}

function asRecordList(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
    : [];
}

function mapNotice(record: Record<string, unknown>): MallH5Notice {
  return {
    body: readString(record, ["body"]),
    category: readString(record, ["category"], "system"),
    notificationId: readString(record, ["notificationId"]),
    requestedAt: readString(record, ["requestedAt"]),
    status: readString(record, ["status"], "unread"),
    title: readString(record, ["title"], "消息通知"),
  };
}

export async function listMallH5Notices(cursor?: string): Promise<MallH5NoticePage> {
  const response = await getSdkworkImNotificationsPort().listNotifications({
    cursor: cursor || undefined,
    pageSize: 20,
  });
  const payload = (response ?? {}) as {
    items?: Record<string, unknown>[];
    pageInfo?: { nextCursor?: string };
  };
  const items = asRecordList(payload.items).map(mapNotice);
  return { items, nextCursor: payload.pageInfo?.nextCursor };
}

export async function retrieveMallH5Notice(notificationId: string): Promise<MallH5Notice | null> {
  const response = await getSdkworkImNotificationsPort().retrieveNotification(notificationId);
  if (!response || typeof response !== "object") {
    return null;
  }
  return mapNotice(response as Record<string, unknown>);
}

export async function listMallH5ChatConversations(): Promise<MallH5ChatConversation[]> {
  const payload = (await chatGet("/im/chat/conversations") ?? {}) as {
    items?: Record<string, unknown>[];
  };
  return asRecordList(payload.items).map((item) => ({
    agentName: readString(item, ["agentName"], "客服"),
    id: readString(item, ["id"]),
    lastMessage: readString(item, ["lastMessage"]),
    lastMessageAt: readString(item, ["lastMessageAt"]),
    title: readString(item, ["title"], "官方客服"),
    unread: Number(item.unread ?? 0) || 0,
  }));
}

export async function listMallH5ChatMessages(conversationId: string): Promise<MallH5ChatMessage[]> {
  const payload = (await chatGet(`/im/chat/conversations/${encodeURIComponent(conversationId)}/messages`) ?? {}) as {
    items?: Record<string, unknown>[];
  };
  return asRecordList(payload.items).map((item) => ({
    content: readString(item, ["content"]),
    id: readString(item, ["id"]),
    role: readString(item, ["role"], "agent"),
    sentAt: readString(item, ["sentAt"]),
  }));
}

export async function sendMallH5ChatMessage(
  conversationId: string,
  content: string,
): Promise<void> {
  await chatPost(`/im/chat/conversations/${encodeURIComponent(conversationId)}/messages`, {
    content,
  });
}

export async function markMallH5ChatRead(conversationId: string): Promise<void> {
  await chatPost(`/im/chat/conversations/${encodeURIComponent(conversationId)}/read`, {});
}
