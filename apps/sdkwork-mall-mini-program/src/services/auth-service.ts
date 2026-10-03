/**
 * IAM login over the shared transport seam.
 *
 * The exchange posts the IAM session-create contract
 * (`POST /auth/sessions`): one principal field plus the password; the
 * response data carries the dual tokens and session context. The dev
 * token-paste entry stays on the login page as a fallback.
 */
import { clearSession, setSession } from "./session";
import { request } from "./transport";

export interface MpLoginResult {
  accessToken: string;
  authToken: string;
  userId: string;
}

export function detectPrincipalKind(account: string): "email" | "phone" | "username" {
  if (account.includes("@")) {
    return "email";
  }
  if (/^1\d{10}$/.test(account)) {
    return "phone";
  }
  return "username";
}

export async function loginWithPassword(account: string, password: string): Promise<MpLoginResult> {
  const kind = detectPrincipalKind(account);
  const body: Record<string, unknown> = { password, [kind]: account };
  const data = await request({ path: "/auth/sessions", method: "POST", body });
  const authToken = String(data.authToken ?? data.token ?? "");
  if (!authToken) {
    throw new Error("登录响应缺少令牌，请稍后重试");
  }
  const context = (data.context ?? {}) as Record<string, unknown>;
  const result: MpLoginResult = {
    authToken,
    accessToken: String(data.accessToken ?? ""),
    userId: String(context.userId ?? ""),
  };
  setSession(result);
  return result;
}

export async function logout(): Promise<void> {
  try {
    await request({ path: "/auth/sessions/current", method: "DELETE" });
  } catch (error) {
    // The server session may already be gone; local sign-out proceeds.
  }
  clearSession();
}
