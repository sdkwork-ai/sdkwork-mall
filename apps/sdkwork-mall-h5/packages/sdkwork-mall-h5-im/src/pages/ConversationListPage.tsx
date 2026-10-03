import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

import {
  listMallH5ChatConversations,
  type MallH5ChatConversation,
} from "../im-service";

/** Mirrors the im-h5 ChatList time formatting (today/yesterday/date). */
function formatConversationTime(value: string): string {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const now = new Date();
  const pad = (part: number) => String(part).padStart(2, "0");
  const isToday = date.toDateString() === now.toDateString();
  const isYesterday = new Date(now.getTime() - 86400_000).toDateString() === date.toDateString();
  if (isToday) {
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
  if (isYesterday) {
    return "昨天";
  }
  if (now.getFullYear() === date.getFullYear()) {
    return `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Conversation list for the mall messages tab, following the sdkwork-im
 * h5 chat list form (avatar + unread badge + last message + divider).
 */
export function SdkworkMallH5ConversationListPage() {
  const [conversations, setConversations] = useState<MallH5ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setConversations(await listMallH5ChatConversations());
      setError(null);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "会话加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="sdk-h5-page sdk-h5-conv-page">
      <nav aria-label="消息入口" className="sdk-h5-conv-entry-row">
        <Link className="sdk-h5-conv-entry" to="/buyer/notices">
          <span aria-hidden="true" className="sdk-h5-conv-entry-icon sdk-h5-conv-entry-icon-notice">🔔</span>
          <span className="sdk-h5-conv-entry-label">消息通知</span>
          <span className="sdk-h5-muted">交易提醒 / 系统通知</span>
          <ChevronRight aria-hidden="true" size={14} />
        </Link>
      </nav>

      {loading ? <div className="sdk-h5-loading">加载会话...</div> : null}
      {error ? <div className="sdk-h5-error" role="alert">{error}</div> : null}
      {!loading && !error && conversations.length === 0 ? (
        <div className="sdk-h5-empty">暂无会话</div>
      ) : null}

      <div className="sdk-h5-conv-list" role="list">
        {conversations.map((conversation, index) => (
          <Link
            className="sdk-h5-conv-row"
            key={conversation.id}
            role="listitem"
            to={`/buyer/chat?conversationId=${encodeURIComponent(conversation.id)}`}
          >
            <span className="sdk-h5-conv-avatar" aria-hidden="true">
              {(conversation.agentName || conversation.title || "客").slice(0, 1)}
              {conversation.unread > 0 ? (
                <b className="sdk-h5-conv-unread">{conversation.unread > 99 ? "99+" : conversation.unread}</b>
              ) : null}
            </span>
            <span className="sdk-h5-conv-main">
              <span className="sdk-h5-conv-title-row">
                <strong>{conversation.title}</strong>
                <time>{formatConversationTime(conversation.lastMessageAt)}</time>
              </span>
              <span className="sdk-h5-conv-preview">{conversation.lastMessage || "开始对话吧"}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
