import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, LoadingBlock } from "@sdkwork/ui-pc-react";

import {
  loadMallMessageCenterPage,
  retrieveMallMessage,
  type MallMessageCategory,
  type MallMessageRow,
} from "../messages-service";

type MessageTab = "all" | MallMessageCategory;

const TABS: Array<{ id: MessageTab; label: string }> = [
  { id: "all", label: "全部" },
  { id: "trade", label: "交易" },
  { id: "system", label: "系统" },
  { id: "notice", label: "提醒" },
];

const CATEGORY_LABELS: Record<MallMessageCategory, string> = {
  notice: "提醒",
  other: "通知",
  system: "系统",
  trade: "交易",
};

export function SdkworkMallMessagesPage() {
  const [messages, setMessages] = useState<MallMessageRow[]>([]);
  const [tab, setTab] = useState<MessageTab>("all");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async (cursor?: string) => {
    if (cursor) {
      setLoadingMore(true);
    }
    try {
      const page = await loadMallMessageCenterPage(cursor);
      setMessages((current) => (cursor ? [...current, ...page.items] : page.items));
      setNextCursor(page.nextCursor);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "消息加载失败");
    } finally {
      setLoadingMore(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleMessages = useMemo(
    () => (tab === "all" ? messages : messages.filter((message) => message.category === tab)),
    [messages, tab],
  );

  async function toggleExpand(message: MallMessageRow) {
    if (expandedId === message.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(message.id);
    try {
      const detail = await retrieveMallMessage(message.id);
      if (detail) {
        setMessages((current) =>
          current.map((entry) => (entry.id === message.id ? { ...entry, ...detail } : entry)),
        );
      }
    } catch {
      // Detail fetch failure keeps the list row usable.
    }
  }

  if (loading) {
    return <LoadingBlock label="加载消息..." />;
  }

  return (
    <div className="sdkwork-mall-pc-messages-page">
      <h1>消息中心</h1>
      <p>来自通知服务的系统、交易与提醒消息，点击可展开详情。</p>
      <nav className="sdkwork-mall-pc-chip-row">
        {TABS.map((entry) => (
          <button
            aria-pressed={tab === entry.id}
            key={entry.id}
            onClick={() => setTab(entry.id)}
            type="button"
          >
            {entry.label}
          </button>
        ))}
      </nav>

      {error ? (
        <div>
          <EmptyState description={error} title="消息加载失败" />
          <button onClick={() => void load()} type="button">重试</button>
        </div>
      ) : visibleMessages.length === 0 ? (
        <EmptyState description="订单动态、售后进度与系统提醒将在此展示" title="暂无消息" />
      ) : (
        <ul className="sdkwork-mall-pc-message-list">
          {visibleMessages.map((message) => (
            <li key={message.id}>
              <button onClick={() => void toggleExpand(message)} type="button">
                <span className="sdkwork-mall-pc-message-category">
                  {CATEGORY_LABELS[message.category]}
                </span>
                {message.status === "unread" ? (
                  <span aria-label="未读" className="sdkwork-mall-pc-message-unread" />
                ) : null}
                <strong>{message.title}</strong>
              </button>
              {expandedId === message.id ? <p>{message.body || "（无正文）"}</p> : null}
              {message.requestedAt ? (
                <span>{new Date(message.requestedAt).toLocaleString()}</span>
              ) : null}
              {message.category === "trade" ? <Link to="/buyer/orders">查看订单</Link> : null}
            </li>
          ))}
        </ul>
      )}

      {nextCursor ? (
        <button disabled={loadingMore} onClick={() => void load(nextCursor)} type="button">
          {loadingMore ? "加载中..." : "加载更多"}
        </button>
      ) : null}
    </div>
  );
}
