import { Link } from "react-router-dom";
import { Button } from "@sdkwork/ui-pc-react";

import type { MallHomeSeedProfile } from "../../home-seed";
import type { MallHomeLoadIssue } from "../../home-service";

/** Client-side phase of the storefront seeding action. */
export type HomeSeedPhase = "idle" | "running" | "failed" | "succeeded";

export interface HomeSetupNoticeProps {
  /** Sections that failed on the last load; empty when every read succeeded. */
  readonly issues: readonly MallHomeLoadIssue[];
  /** Whether the runtime injected a provisioning port at all. */
  readonly seedAvailable: boolean;
  /** Whether the visitor holds credentials; false renders a sign-in action. */
  readonly signedIn: boolean;
  /** Slice the runtime writes by default; `minimal` carries no products. */
  readonly seedProfile?: MallHomeSeedProfile;
  readonly phase: HomeSeedPhase;
  readonly message?: string;
  readonly onRetry: () => void;
  readonly onSeed: () => void;
  /** Explicit demo slice (products + campaigns) for a minimal-profile install. */
  readonly onSeedDemo?: () => void;
}

/**
 * First-run and degraded-read notice for the storefront home.
 *
 * Three situations must not be confused: a catalog that has never been
 * provisioned (recoverable in one click, or automatically on non-production
 * installs), a production install whose default slice carries structure but no
 * products (offered explicitly as demo data), and a partially unreachable
 * backend (recoverable by retrying).
 */
export function HomeSetupNotice(props: HomeSetupNoticeProps) {
  if (props.issues.length > 0) {
    return (
      <div className="sdkwork-mall-pc-home-notice is-warning" role="status">
        <div className="sdkwork-mall-pc-home-notice-body">
          <strong>部分内容加载失败</strong>
          <span>{props.issues.map((issue) => issue.message).join("；")}</span>
        </div>
        <Button onClick={props.onRetry} type="button" variant="outline">
          重试
        </Button>
      </div>
    );
  }

  const running = props.phase === "running";
  const failed = props.phase === "failed";
  const structureOnly = props.seedProfile === "minimal";

  return (
    <section className="sdkwork-mall-pc-home-setup" aria-live="polite">
      <div className="sdkwork-mall-pc-home-setup-head">
        <h2>{running ? "正在初始化商城默认数据…" : "商城还没有商品数据"}</h2>
        <p>
          {running
            ? "依次写入类目、店铺、商品与 SKU、价格体系、营销活动、会员等级和首页内容，请稍候。"
            : structureOnly
              ? "这个环境的默认档位只写入平台基础结构（类目、自营店铺、会员与首页框架），不写入商品。需要完整体验商城，可载入含商品、SKU 与营销活动的演示数据；写入是幂等的，不会重复创建。"
              : "这个环境还没有写入默认数据，因此类目、商品、SKU 与店铺都是空的。初始化会把数据集完整写入后台；重复执行只补齐缺失项，不会重复创建。"}
        </p>
      </div>

      {failed ? (
        <p className="sdkwork-mall-pc-home-setup-error" role="alert">
          初始化失败：{props.message ?? "未知错误"}
        </p>
      ) : null}

      <div className="sdkwork-mall-pc-home-setup-actions">
        {props.seedAvailable ? (
          props.signedIn ? (
            <>
              <Button disabled={running} onClick={props.onSeed} type="button">
                {running
                  ? "正在写入…"
                  : failed
                    ? "重试初始化"
                    : structureOnly
                      ? "载入基础结构"
                      : "载入默认数据"}
              </Button>
              {structureOnly && props.onSeedDemo ? (
                <Button disabled={running} onClick={props.onSeedDemo} type="button" variant="outline">
                  载入演示数据（含商品）
                </Button>
              ) : null}
            </>
          ) : (
            <>
              <span className="sdkwork-mall-pc-home-setup-hint">
                初始化需要后台权限，请先登录管理员账号。
              </span>
              <Link className="sdkwork-mall-pc-home-section-more" to="/auth/login?redirect=/">
                登录并初始化
              </Link>
            </>
          )
        ) : (
          <span className="sdkwork-mall-pc-home-setup-hint">
            当前构建未接入后台 API，无法初始化默认数据。
          </span>
        )}
        <Link className="sdkwork-mall-pc-home-section-more" to="/admin/default-data">
          前往默认数据初始化
        </Link>
        <button className="sdkwork-mall-pc-home-setup-link" onClick={props.onRetry} type="button">
          刷新数据
        </button>
      </div>

      <ol className="sdkwork-mall-pc-home-setup-steps">
        <li>类目树与品牌</li>
        <li>店铺</li>
        <li>商品与 SKU</li>
        <li>价格体系</li>
        <li>营销活动</li>
        <li>会员等级与套餐</li>
        <li>首页 CMS</li>
      </ol>
    </section>
  );
}
