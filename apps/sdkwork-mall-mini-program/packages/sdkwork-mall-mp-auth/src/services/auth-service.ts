/**
 * Account capability service for the SDKWork Mall mini program.
 *
 * Authority: `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` sections 7-8 and
 * `IAM_LOGIN_INTEGRATION_SPEC.md` sections 3-5. Authentication belongs to
 * `sdkwork-iam`: `@sdkwork/iam-mp-core/session-wechat` owns `wx.login()` code
 * exchange, session persistence and cold-launch revalidation, and every
 * credential operation goes through the generated `@sdkwork/iam-app-sdk`
 * (`auth.sessions`, `iam.users.current`). This capability is the page-facing
 * surface; it owns no session, credential or wire logic of its own.
 *
 * Two sign-in paths, one IAM-owned session:
 * - `loginWithWechat()`: production. `wx.login()` (host `platformLogin`) yields a
 *   one-time code that the IAM module exchanges for a dual-token session.
 * - `loginWithPassword()`: fallback for accounts without a WeChat binding, on the
 *   IAM `auth.sessions.create` contract.
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

/** Identity of the signed-in account as IAM reports it. */
export interface MpIamCurrentUser {
  readonly displayName: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly phone: string;
  readonly phoneVerified: boolean;
  readonly userId: string;
  readonly username: string;
}

/** Credential change request; IAM owns the policy checks. */
export interface MpChangePasswordInput {
  readonly confirmPassword: string;
  readonly newPassword: string;
  readonly oldPassword: string;
}

export interface MpAuthService {
  /** Production sign-in: WeChat one-tap through the IAM mini-program exchange. */
  loginWithWechat(): Promise<MpSessionSnapshot>;
  /** Fallback sign-in for accounts without a WeChat identity binding. */
  loginWithPassword(input: MpPasswordLoginInput): Promise<MpSessionSnapshot>;
  /** Current account identity (`iam.users.current`). */
  loadCurrentUser(): Promise<MpIamCurrentUser>;
  /** Changes the password (`iam.users.current.password.update`). */
  changePassword(input: MpChangePasswordInput): Promise<void>;
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

function readBoolean(record: Record<string, unknown>, keys: readonly string[]): boolean {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") {
      return value;
    }
  }
  return false;
}

/**
 * Normalizes the IAM current-user payload.
 *
 * Field names follow the IAM app-api projection (`user_to_json`): `displayName`,
 * `name`, `nickname`, `userId`/`id`, `username`, `email`, `phone` plus the
 * verification flags.
 */
export function toIamCurrentUser(payload: Record<string, unknown>): MpIamCurrentUser {
  return {
    displayName: readString(payload, ["displayName", "nickname", "name"]),
    email: readString(payload, ["email"]),
    emailVerified: readBoolean(payload, ["emailVerified"]),
    phone: readString(payload, ["phone", "mobile", "phoneNumber"]),
    phoneVerified: readBoolean(payload, ["phoneVerified"]),
    userId: readString(payload, ["userId", "id"]),
    username: readString(payload, ["username"]),
  };
}

/**
 * Creates the account service over one runtime.
 *
 * @param runtime - Initialized mall runtime (host login bridge, IAM session
 *   manager, generated IAM app client, session store).
 */
export function createMpAuthService(runtime: MallMpRuntime): MpAuthService {
  const { authManager, host, iamClient, session } = runtime;

  return {
    async loginWithWechat() {
      const jsCode = await host.loginCode.requestLoginCode();
      // The IAM module resolves the per-install device id and commits the
      // session; the mall never sees the exchange payload.
      return authManager.login({ jsCode });
    },

    async loginWithPassword({ account, password }) {
      const kind = detectPrincipalKind(account);
      const payload = await iamClient.auth.sessions.create({
        grantType: "password",
        [kind]: account,
        password,
      });
      const context = (payload.context ?? {}) as Record<string, unknown>;
      const authToken = readString(payload, ["authToken", "token"]) || readString(context, ["authToken"]);
      if (!authToken) {
        throw new Error("登录响应缺少令牌，请稍后重试");
      }
      return session.write({
        accessToken: readString(payload, ["accessToken"]) || readString(context, ["accessToken"]),
        authToken,
        userId: readString(context, ["userId"]) || readString(payload, ["userId"]),
      });
    },

    async loadCurrentUser() {
      const payload = await iamClient.iam.users.current.retrieve();
      return toIamCurrentUser(payload);
    },

    async changePassword({ confirmPassword, newPassword, oldPassword }) {
      // IAM validates the current credential, the policy and the confirmation.
      await iamClient.iam.users.current.password.update({
        confirmPassword,
        newPassword,
        oldPassword,
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
