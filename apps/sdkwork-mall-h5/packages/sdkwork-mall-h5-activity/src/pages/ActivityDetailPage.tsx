import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  getMallH5ActivityPhase,
  getMallH5ActivityTypeLabel,
  retrieveMallH5Activity,
  type MallH5Activity,
} from "../activity-service";

export function SdkworkMallH5ActivityDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [activity, setActivity] = useState<MallH5Activity | null>(null);
  const [loading, setLoading] = useState(Boolean(eventId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    retrieveMallH5Activity(eventId)
      .then((record) => {
        if (active) {
          setActivity(record);
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
  }, [eventId]);

  if (loading) {
    return <div className="sdk-h5-page sdk-h5-loading">加载活动...</div>;
  }

  if (error || !activity) {
    return (
      <div className="sdk-h5-page">
        <div className="sdk-h5-error" role="alert">{error ?? "活动不存在或已结束"}</div>
        <div className="sdk-h5-center">
          <Link className="sdk-h5-button sdk-h5-button-ghost" to="/activity">返回活动会场</Link>
        </div>
      </div>
    );
  }

  const phase = getMallH5ActivityPhase(activity);

  return (
    <div className="sdk-h5-page">
      <div className="sdk-h5-center">
        <Link className="sdk-h5-button sdk-h5-button-ghost" to="/activity">返回活动会场</Link>
      </div>

      <section className="sdk-h5-banner">
        <h1>{activity.title}</h1>
        {activity.highlight ? <p>{activity.highlight}</p> : null}
      </section>

      <section className="sdk-h5-section">
        <h2>活动信息</h2>
        <dl className="sdk-h5-spec-list">
          <div>
            <dt>类型</dt>
            <dd>{getMallH5ActivityTypeLabel(activity.type)}</dd>
          </div>
          <div>
            <dt>状态</dt>
            <dd>{phase === "upcoming" ? "即将开始" : phase === "ended" ? "已结束" : "进行中"}</dd>
          </div>
          {activity.startAt ? (
            <div>
              <dt>开始</dt>
              <dd>{new Date(activity.startAt).toLocaleString("zh-CN")}</dd>
            </div>
          ) : null}
          {activity.endAt ? (
            <div>
              <dt>结束</dt>
              <dd>{new Date(activity.endAt).toLocaleString("zh-CN")}</dd>
            </div>
          ) : null}
          {activity.discountText ? (
            <div>
              <dt>优惠</dt>
              <dd>{activity.discountText}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {activity.description ? (
        <section className="sdk-h5-section">
          <h2>活动说明</h2>
          <p className="sdk-h5-pdp-description">{activity.description}</p>
        </section>
      ) : null}

      <div className="sdk-h5-center">
        <Link className="sdk-h5-button sdk-h5-button-primary" to="/categories">去逛好物</Link>
      </div>
    </div>
  );
}
