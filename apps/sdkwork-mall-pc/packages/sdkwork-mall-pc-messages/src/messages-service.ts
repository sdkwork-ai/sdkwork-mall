import { getSdkworkMessagesNotificationsPort } from "./messages-remote-port";

export type MallMessageCategory = "notice" | "other" | "system" | "trade";

export interface MallMessageRow {
  body: string;
  category: MallMessageCategory;
  id: string;
  requestedAt?: string;
  status: string;
  title: string;
}

export interface MallMessagePage {
  items: MallMessageRow[];
  nextCursor?: string;
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

function normalizeCategory(value: string): MallMessageCategory {
  const normalized = value.toLowerCase();
  return normalized === "system" || normalized === "trade" || normalized === "notice"
    ? normalized
    : "other";
}

function mapRow(record: Record<string, unknown>): MallMessageRow {
  return {
    body: readString(record, ["body"]),
    category: normalizeCategory(readString(record, ["category"], "system")),
    id: readString(record, ["notificationId", "id"]),
    requestedAt: readString(record, ["requestedAt"]) || undefined,
    status: readString(record, ["status"], "read"),
    title: readString(record, ["title"], "消息通知"),
  };
}

/**
 * Loads the buyer's notifications from the real notifications plane.
 *
 * No local synthesis: rows come straight from `GET /notifications` through the
 * generated IM client, so titles, categories, bodies and unread state are
 * server-owned.
 */
export async function loadMallMessageCenterPage(cursor?: string): Promise<MallMessagePage> {
  const response = await getSdkworkMessagesNotificationsPort().listNotifications({
    cursor: cursor || undefined,
    pageSize: 20,
  });
  const payload = (response ?? {}) as {
    items?: unknown;
    pageInfo?: { nextCursor?: string };
  };
  const items = Array.isArray(payload.items)
    ? payload.items.filter(
        (entry): entry is Record<string, unknown> =>
          Boolean(entry) && typeof entry === "object",
      )
    : [];
  return {
    items: items.map(mapRow).filter((row) => row.id !== ""),
    nextCursor: typeof payload.pageInfo?.nextCursor === "string" ? payload.pageInfo.nextCursor : undefined,
  };
}

export async function retrieveMallMessage(notificationId: string): Promise<MallMessageRow | null> {
  const record = await getSdkworkMessagesNotificationsPort().retrieveNotification(notificationId);
  return record && typeof record === "object"
    ? mapRow(record as Record<string, unknown>)
    : null;
}
