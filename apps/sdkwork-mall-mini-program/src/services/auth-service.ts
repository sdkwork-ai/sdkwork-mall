/**
 * IAM login surface consumed by the login page.
 *
 * Authority: `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` section 7. The real logic is
 * `@sdkwork/mall-mp-auth`; this module keeps the imports the page already uses
 * and exposes the WeChat one-tap entry that replaces the credential form.
 */
import {
  createMpAuthService,
  detectPrincipalKind as detectPrincipalKindFromPackage,
  type MpAuthRestoreResult,
  type MpPrincipalKind,
} from "@sdkwork/mall-mp-auth";
import { getMallMpRuntime, type MpSessionSnapshot } from "@sdkwork/mall-mp-core";

export interface MpLoginResult {
  accessToken: string;
  authToken: string;
  userId: string;
}

export type { MpAuthRestoreResult, MpPrincipalKind };

export function detectPrincipalKind(account: string): MpPrincipalKind {
  return detectPrincipalKindFromPackage(account);
}

/** Production sign-in: `wx.login()` exchanged for an IAM dual-token session. */
export async function loginWithWechat(): Promise<MpLoginResult> {
  const snapshot = await createMpAuthService(getMallMpRuntime()).loginWithWechat();
  return toLoginResult(snapshot);
}

/** Fallback sign-in for accounts without a WeChat identity binding. */
export async function loginWithPassword(account: string, password: string): Promise<MpLoginResult> {
  const snapshot = await createMpAuthService(getMallMpRuntime()).loginWithPassword({ account, password });
  return toLoginResult(snapshot);
}

export async function logout(): Promise<void> {
  await createMpAuthService(getMallMpRuntime()).logout();
}

/** Cold-launch recovery; the app entry calls it once per launch. */
export async function restoreSession(): Promise<MpAuthRestoreResult> {
  return createMpAuthService(getMallMpRuntime()).restore();
}

function toLoginResult(snapshot: MpSessionSnapshot): MpLoginResult {
  return {
    accessToken: snapshot.accessToken,
    authToken: snapshot.authToken,
    userId: snapshot.userId ?? "",
  };
}
