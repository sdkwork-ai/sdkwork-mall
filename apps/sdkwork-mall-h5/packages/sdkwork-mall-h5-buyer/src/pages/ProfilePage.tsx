import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

import { loadMallH5Profile, type MallH5Profile } from "../profile-service";

const PROFILE_FIELDS: ReadonlyArray<{ key: keyof MallH5Profile; label: string }> = [
  { key: "displayName", label: "昵称" },
  { key: "email", label: "邮箱" },
  { key: "phone", label: "手机号" },
  { key: "membershipLevel", label: "会员等级" },
];

export function SdkworkMallH5ProfilePage() {
  const [profile, setProfile] = useState<MallH5Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setProfile(await loadMallH5Profile());
  }, []);

  useEffect(() => {
    let active = true;
    reload()
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "个人资料加载失败");
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
    return <div className="sdk-h5-page sdk-h5-loading">加载个人资料...</div>;
  }

  return (
    <div className="sdk-h5-page">
      <h1 className="sdk-h5-visually-hidden">个人资料</h1>

      {error ? <div className="sdk-h5-error" role="alert">{error}</div> : null}

      <section className="sdk-h5-section">
        <h2>基本资料</h2>
        <div className="sdk-h5-cell-group">
          {PROFILE_FIELDS.map((field) => (
            <div className="sdk-h5-cell" key={field.key}>
              <span className="sdk-h5-cell-label">{field.label}</span>
              <span className="sdk-h5-cell-value">
                {profile?.[field.key]?.trim() ? profile[field.key] : "-"}
              </span>
            </div>
          ))}
        </div>
      </section>

      <Link className="sdk-h5-cell" to="/buyer/security">
        <span className="sdk-h5-cell-label">账户与安全</span>
        <span className="sdk-h5-cell-value sdk-h5-muted">登录密码、绑定手机与设备管理</span>
        <ChevronRight aria-hidden="true" className="sdk-h5-cell-chevron" size={16} />
      </Link>

      <p className="sdk-h5-footnote">头像与实名认证等扩展资料由 IAM 账户中心提供。</p>
    </div>
  );
}
