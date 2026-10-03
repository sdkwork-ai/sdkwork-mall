/**
 * Session storage for the mini-program.
 *
 * Speaks the IAM session contract: the login exchange returns dual tokens
 * (`authToken` for the Authorization header, `accessToken` for Access-Token)
 * plus the user context, persisted through wx storage. wx.login/
 * code2session replaces the password exchange once the MP identity contract
 * lands (see docs/decisions.md); the dev token-paste entry remains on the
 * login page as a fallback.
 */

interface MpSessionSnapshot {
  authToken: string;
  accessToken: string;
  userId: string;
}

const STORAGE_KEY = "sdkwork-mall-mp-session";
const LEGACY_TOKEN_KEY = "sdkwork-mall-mp-session-token";

function readSession(): MpSessionSnapshot | null {
  try {
    const stored = wx.getStorageSync(STORAGE_KEY);
    if (stored && typeof stored === "object") {
      const record = stored as Record<string, unknown>;
      return {
        authToken: String(record.authToken ?? ""),
        accessToken: String(record.accessToken ?? ""),
        userId: String(record.userId ?? ""),
      };
    }
  } catch (error) {
    // storage unavailable
  }
  return null;
}

export function getToken(): string {
  const stored = readSession();
  if (stored && stored.authToken !== "") {
    return stored.authToken;
  }
  // Pre-dual-token storage held a bare token string.
  try {
    return String(wx.getStorageSync(LEGACY_TOKEN_KEY) || "");
  } catch (error) {
    return "";
  }
}

export function getAccessToken(): string {
  const stored = readSession();
  return stored ? stored.accessToken : "";
}

export function setSession(snapshot: MpSessionSnapshot): void {
  try {
    wx.setStorageSync(STORAGE_KEY, snapshot);
  } catch (error) {
    // storage unavailable: keep the session in memory only
  }
}

export function setToken(token: string): void {
  setSession({ authToken: token, accessToken: "", userId: "" });
}

export function clearSession(): void {
  try {
    wx.removeStorageSync(STORAGE_KEY);
    wx.removeStorageSync(LEGACY_TOKEN_KEY);
  } catch (error) {
    // ignore
  }
}

export function isLoggedIn(): boolean {
  return Boolean(getToken());
}
