import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, LoadingBlock } from "@sdkwork/ui-pc-react";

import { createSdkworkMallMessagesCopy } from "../messages-copy";
import {
  loadMallMessageCenterPage,
  retrieveMallMessage,
  type MallMessageCategory,
  type MallMessageRow,
} from "../messages-service";

type MessageTab = "all" | MallMessageCategory;

const TAB_ORDER: MessageTab[] = ["all", "trade", "system", "notice"];

export interface SdkworkMallMessagesPageProps {
  locale?: string | null;
}

export function SdkworkMallMessagesPage({ locale }: SdkworkMallMessagesPageProps = {}) {
  const copy = createSdkworkMallMessagesCopy(locale);
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
      setError(cause instanceof Error ? cause.message : copy.error.description);
    } finally {
      setLoadingMore(false);
      setLoading(false);
    }
  }, [copy.error.description]);

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
    return <LoadingBlock label={copy.actions.loading} />;
  }

  return (
    <div className="sdkwork-mall-pc-messages-page">
      <h1>{copy.title}</h1>
      <p>{copy.intro}</p>
      <nav className="sdkwork-mall-pc-chip-row">
        {TAB_ORDER.map((entry) => (
          <button
            aria-pressed={tab === entry}
            key={entry}
            onClick={() => setTab(entry)}
            type="button"
          >
            {entry === "all" ? copy.tabs.all : copy.categories[entry]}
          </button>
        ))}
      </nav>

      {error ? (
        <div>
          <EmptyState description={error} title={copy.error.title} />
          <button onClick={() => void load()} type="button">{copy.actions.retry}</button>
        </div>
      ) : visibleMessages.length === 0 ? (
        <EmptyState description={copy.empty.description} title={copy.empty.title} />
      ) : (
        <ul className="sdkwork-mall-pc-message-list">
          {visibleMessages.map((message) => (
            <li key={message.id}>
              <button onClick={() => void toggleExpand(message)} type="button">
                <span className="sdkwork-mall-pc-message-category">
                  {copy.categories[message.category]}
                </span>
                {message.status === "unread" ? (
                  <span aria-label={copy.status.unread} className="sdkwork-mall-pc-message-unread" />
                ) : null}
                <strong>{message.title}</strong>
              </button>
              {expandedId === message.id ? <p>{message.body || copy.noBody}</p> : null}
              {message.requestedAt ? (
                <span>{new Date(message.requestedAt).toLocaleString(locale || undefined)}</span>
              ) : null}
              {message.category === "trade" ? (
                <Link to="/buyer/orders">{copy.actions.viewOrders}</Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {nextCursor ? (
        <button disabled={loadingMore} onClick={() => void load(nextCursor)} type="button">
          {loadingMore ? copy.actions.loading : copy.actions.loadMore}
        </button>
      ) : null}
    </div>
  );
}
