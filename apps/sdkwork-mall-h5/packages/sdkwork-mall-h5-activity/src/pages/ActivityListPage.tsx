import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Clock } from "lucide-react";

import {
  getMallH5ActivityPhase,
  getMallH5ActivityTypeLabel,
  listMallH5Activities,
  type MallH5Activity,
} from "../activity-service";

export function SdkworkMallH5ActivityListPage() {
  const [activities, setActivities] = useState<MallH5Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listMallH5Activities()
      .then((rows) => {
        if (active) {
          setActivities(rows);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "活动加载失败");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <div className="sdk-h5-page sdk-h5-loading">加载活动...</div>;
  }

  return (
    <div className="sdk-h5-page">
      <h1 className="sdk-h5-page-title">活动会场</h1>

      {error ? <div className="sdk-h5-error" role="alert">{error}</div> : null}

      {activities.length === 0 ? (
        <div className="sdk-h5-empty">暂无进行中的活动</div>
      ) : (
        <div className="sdk-h5-activity-list">
          {activities.map((activity) => {
            const phase = getMallH5ActivityPhase(activity);
            return (
              <Link className="sdk-h5-activity-card" key={activity.id} to={`/activity/${activity.id}`}>
                <div className="sdk-h5-activity-head">
                  <span className={phase === "active" ? "sdk-h5-activity-tag sdk-h5-activity-tag-active" : "sdk-h5-activity-tag"}>
                    {getMallH5ActivityTypeLabel(activity.type)}
                  </span>
                  <strong>{activity.title}</strong>
                </div>
                {activity.highlight ? <p className="sdk-h5-activity-highlight">{activity.highlight}</p> : null}
                <div className="sdk-h5-activity-meta">
                  {activity.discountText ? <span className="sdk-h5-activity-discount">{activity.discountText}</span> : null}
                  <span className="sdk-h5-muted">
                    <Clock aria-hidden="true" size={12} />
                    {phase === "upcoming" ? "即将开始" : phase === "ended" ? "已结束" : "进行中"}
                    {activity.endAt ? ` · ${new Date(activity.endAt).toLocaleDateString("zh-CN")} 截止` : ""}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
