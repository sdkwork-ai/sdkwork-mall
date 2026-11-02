import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, ShieldCheck } from "lucide-react";

import { loadMallH5SecuritySnapshot, type MallH5SecuritySnapshot } from "../profile-service";

export function SdkworkMallH5SecurityPage() {
  const [snapshot, setSnapshot] = useState<MallH5SecuritySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setSnapshot(await loadMallH5SecuritySnapshot());
  }, []);

  useEffect(() => {
    let active = true;
    reload()
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "账户安全信息加载失败");
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
  }, [reload]);

  if (loading) {
    return <div className="sdk-h5-page sdk-h5-loading">加载账户信息...</div>;
  }

  const sessionFacts = [
    { label: "当前登录", value: snapshot?.accountLabel ?? "账户" },
    { label: "用户 ID", value: snapshot?.userId ?? "-" },
    { label: "租户 ID", value: snapshot?.tenantId ?? "-" },
    { label: "会话 ID", value: snapshot?.sessionId ?? "-" },
  ];

  return (
    <div className="sdk-h5-page">
      <h1 className="sdk-h5-visually-hidden">账户与安全</h1>

      {error ? <div className="sdk-h5-error" role="alert">{error}</div> : null}

      <section className="sdk-h5-section">
        <h2>
          <ShieldCheck aria-hidden="true" size={18} /> 登录信息
        </h2>
        <div className="sdk-h5-cell-group">
          {sessionFacts.map((fact) => (
            <div className="sdk-h5-cell" key={fact.label}>
              <span className="sdk-h5-cell-label">{fact.label}</span>
              <span className="sdk-h5-cell-value">{fact.value}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="sdk-h5-section">
        <h2>安全设置</h2>
        <div className="sdk-h5-cell-group">
          <Link className="sdk-h5-cell" to="/auth/login">
            <span className="sdk-h5-cell-label">修改密码</span>
            <span className="sdk-h5-cell-value sdk-h5-muted">前往 IAM 认证路由</span>
            <ChevronRight aria-hidden="true" className="sdk-h5-cell-chevron" size={16} />
          </Link>
          <div className="sdk-h5-cell">
            <span className="sdk-h5-cell-label">绑定手机</span>
            <span className="sdk-h5-cell-value sdk-h5-muted">由 IAM 认证路由提供</span>
          </div>
          <div className="sdk-h5-cell">
            <span className="sdk-h5-cell-label">登录保护</span>
            <span className="sdk-h5-cell-value sdk-h5-muted">遵循平台安全策略</span>
          </div>
        </div>
      </section>

      <p className="sdk-h5-footnote">
        设备管理与二次验证由 IAM 账户中心统一受理；发现异常登录请立即修改密码。
      </p>
    </div>
  );
}
