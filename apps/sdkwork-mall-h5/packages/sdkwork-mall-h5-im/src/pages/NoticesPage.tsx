import { useCallback, useEffect, useState } from "react";

import {
  listMallH5Notices,
  retrieveMallH5Notice,
  type MallH5Notice,
} from "../im-service";
import { formatMallH5Timestamp } from "@sdkwork/mall-h5-commons";

const CATEGORY_LABELS: Record<string, string> = {
  system: "系统",
  trade: "交易",
  notice: "提醒",
};

function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? "通知";
}

export function SdkworkMallH5NoticesPage() {
  const [notices, setNotices] = useState<MallH5Notice[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (cursor?: string) => {
    if (cursor) {
      setLoadingMore(true);
    }
    try {
      const page = await listMallH5Notices(cursor);
      setNotices((current) => (cursor ? [...current, ...page.items] : page.items));
      setNextCursor(page.nextCursor);
      setError(null);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "消息加载失败");
    } finally {
      setLoadingMore(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleExpand(notice: MallH5Notice) {
    if (expandedId === notice.notificationId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(notice.notificationId);
    setNotices((current) =>
      current.map((entry) =>
        entry.notificationId === notice.notificationId
          ? { ...entry, status: "read" }
          : entry,
      ),
    );
    try {
      const detail = await retrieveMallH5Notice(notice.notificationId);
      if (detail) {
        setNotices((current) =>
          current.map((entry) =>
            entry.notificationId === notice.notificationId
              ? { ...entry, ...detail }
              : entry,
          ),
        );
      }
    } catch {
      // 已读标记失败不影响展示。
    }
  }

  if (loading) {
    return <div className="sdk-h5-page sdk-h5-loading">加载消息...</div>;
  }

  return (
    <div className="sdk-h5-page">
      <h1 className="sdk-h5-page-title">消息中心</h1>

      {error ? <div className="sdk-h5-error" role="alert">{error}</div> : null}

      {notices.length === 0 ? (
        <div className="sdk-h5-empty">暂无消息，订单动态与优惠提醒都会出现在这里</div>
      ) : (
        notices.map((notice) => (
          <button
            className="sdk-h5-notice-row"
            key={notice.notificationId}
            onClick={() => void toggleExpand(notice)}
            type="button"
          >
            <span className={`sdk-h5-notice-badge sdk-h5-notice-badge-${notice.category}`}>
              {categoryLabel(notice.category)}
            </span>
            <span className="sdk-h5-notice-body">
              <span className="sdk-h5-notice-title-row">
                {notice.status === "unread" ? <em className="sdk-h5-notice-dot" aria-label="未读" /> : null}
                <strong>{notice.title}</strong>
              </span>
              {expandedId === notice.notificationId ? (
                <span className="sdk-h5-notice-detail">{notice.body || "（无正文）"}</span>
              ) : (
                <span className="sdk-h5-notice-preview">{notice.body || "点击查看详情"}</span>
              )}
              <span className="sdk-h5-notice-time">{formatMallH5Timestamp(notice.requestedAt)}</span>
            </span>
          </button>
        ))
      )}

      {nextCursor ? (
        <div className="sdk-h5-center">
          <button
            className="sdk-h5-button sdk-h5-button-secondary"
            disabled={loadingMore}
            onClick={() => void load(nextCursor)}
            type="button"
          >
            {loadingMore ? "加载中..." : "加载更多"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
