/**
 * Messaging facade for the mini-program.
 *
 * Two planes on the same app-api host, both funneled through the single
 * transport seam:
 * - notices (system / trade notifications): `GET /notifications` cursor-paged;
 * - customer-service chat: federation-gateway `/im/chat/*` convention riding
 *   the same host as H5. Freshness keeps a 5s poll in the chat page until the
 *   realtime CCP capability lands (see apps/sdkwork-mall-h5/docs/decisions.md).
 */
import { request } from "./transport";
import { asRecordList, asString, type MpRecord } from "../types/common";

export interface MpNotice {
  notificationId: string;
  category: string;
  title: string;
  body: string;
  status: string;
  requestedAt: string;
}

export interface MpChatConversation {
  id: string;
  title: string;
  agentName: string;
  lastMessage: string;
  lastMessageAt: string;
  unread: number;
}

export interface MpChatMessage {
  id: string;
  content: string;
  role: string;
  sentAt: string;
}

function mapNotice(record: MpRecord): MpNotice {
  return {
    notificationId: asString(record, ["notificationId"]),
    category: asString(record, ["category"], "system"),
    title: asString(record, ["title"], "消息通知"),
    body: asString(record, ["body"]),
    status: asString(record, ["status"], "unread"),
    requestedAt: asString(record, ["requestedAt"]),
  };
}

export async function listNotices(cursor?: string): Promise<{ items: MpNotice[]; nextCursor: string }> {
  const payload = await request({
    path: "/notifications",
    query: { page_size: 20, cursor: cursor || undefined },
  });
  const pageInfo = (payload.pageInfo ?? {}) as MpRecord;
  return {
    items: asRecordList(payload.items).map(mapNotice),
    nextCursor: asString(pageInfo, ["nextCursor"]),
  };
}

export async function retrieveNotice(notificationId: string): Promise<MpNotice | null> {
  const record = await request({ path: `/notifications/${notificationId}` }).catch(() => ({}) as MpRecord);
  return asString(record, ["notificationId"]) ? mapNotice(record) : null;
}

export async function listChatConversations(): Promise<MpChatConversation[]> {
  const payload = await request({ path: "/im/chat/conversations" });
  return asRecordList(payload.items).map((item) => ({
    id: asString(item, ["id"]),
    title: asString(item, ["title"], "官方客服"),
    agentName: asString(item, ["agentName"], "客服"),
    lastMessage: asString(item, ["lastMessage"]),
    lastMessageAt: asString(item, ["lastMessageAt"]),
    unread: Number(item.unread ?? 0) || 0,
  })).filter((conversation) => conversation.id);
}

export async function listChatMessages(conversationId: string): Promise<MpChatMessage[]> {
  const payload = await request({
    path: `/im/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
  });
  return asRecordList(payload.items).map((item) => ({
    id: asString(item, ["id"]),
    content: asString(item, ["content"]),
    role: asString(item, ["role"], "agent"),
    sentAt: asString(item, ["sentAt"]),
  }));
}

export async function sendChatMessage(conversationId: string, content: string): Promise<void> {
  await request({
    path: `/im/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
    method: "POST",
    body: { content },
  });
}

export async function markChatRead(conversationId: string): Promise<void> {
  await request({
    path: `/im/chat/conversations/${encodeURIComponent(conversationId)}/read`,
    method: "POST",
    body: {},
  });
}
