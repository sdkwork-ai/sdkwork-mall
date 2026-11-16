/**
 * Account capability service for the SDKWork Mall mini program.
 *
 * Authority: `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` sections 7-8 and
 * `IAM_LOGIN_INTEGRATION_SPEC.md` sections 3-5. Authentication belongs to
 * `sdkwork-iam`: `@sdkwork/iam-mp-core/session-wechat` owns `wx.login()` code
 * exchange, session persistence and cold-launch revalidation. This service is
 * the capability's page-facing surface; it holds no session logic of its own.
 *
 * Two sign-in paths, one IAM-owned session:
 * - `loginWithWechat()`: production. `wx.login()` (host `platformLogin`) yields a
 *   one-time code that the IAM module exchanges for a dual-token session.
 * - `loginWithPassword()`: fallback for accounts without a WeChat binding, kept
 *   on the IAM session-create contract through the commerce request seam.
 */
import {
  type IamMpWechatSessionReason,
  type MpSessionSnapshot,
  type MallMpRuntime,
} from "@sdkwork/mall-mp-core";

export type MpPrincipalKind = "email" | "phone" | "username";

/** Session restore outcome, aligned with the IAM recovery protocol. */
export type MpAuthRestoreReason = IamMpWechatSessionReason;

export interface MpAuthRestoreResult {
  readonly authenticated: boolean;
  readonly reason: MpAuthRestoreReason;
  readonly session: MpSessionSnapshot | null;
}

export interface MpPasswordLoginInput {
  readonly account: string;
  readonly password: string;
}

export interface MpAuthService {
  /** Production sign-in: WeChat one-tap through the IAM mini-program exchange. */
  loginWithWechat(): Promise<MpSessionSnapshot>;
  /** Fallback sign-in for accounts without a WeChat identity binding. */
  loginWithPassword(input: MpPasswordLoginInput): Promise<MpSessionSnapshot>;
  logout(): Promise<void>;
  /** Cold-launch restore + re-validation. */
  restore(): Promise<MpAuthRestoreResult>;
  isAuthenticated(): boolean;
}

export function detectPrincipalKind(account: string): MpPrincipalKind {
  if (account.includes("@")) {
    return "email";
  }
  if (/^1\d{10}$/u.test(account)) {
    return "phone";
  }
  return "username";
}

function readString(record: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value) {
      return value;
    }
  }
  return "";
}

/**
 * Creates the account service over one runtime.
 *
 * @param runtime - Initialized mall runtime (host login bridge, IAM session
 *   manager, commerce request seam).
 */
export function createMpAuthService(runtime: MallMpRuntime): MpAuthService {
  const { authManager, host, request, session } = runtime;

  return {
    async loginWithWechat() {
      const jsCode = await host.loginCode.requestLoginCode();
      // The IAM module resolves the per-install device id and commits the
      // session; the mall never sees the exchange payload.
      return authManager.login({ jsCode });
    },

    async loginWithPassword({ account, password }) {
      const kind = detectPrincipalKind(account);
      const data = await request.request({
        path: "/auth/sessions",
        method: "POST",
        body: { password, [kind]: account },
      });
      const authToken = readString(data, ["authToken", "token"]);
      if (!authToken) {
        throw new Error("登录响应缺少令牌，请稍后重试");
      }
      const context = (data.context ?? {}) as Record<string, unknown>;
      return session.write({
        accessToken: readString(data, ["accessToken"]),
        authToken,
        userId: readString(context, ["userId"]),
      });
    },

    async logout() {
      await authManager.logout();
    },

    async restore() {
      const result = await authManager.restore();
      return {
        authenticated: result.authenticated,
        reason: result.reason,
        session: result.session,
      };
    },

    isAuthenticated() {
      return authManager.isAuthenticated();
    },
  };
}
