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
const STORAGE_KEY = "sdkwork-mall-mp-session";

function readSession() {
  try {
    const stored = wx.getStorageSync(STORAGE_KEY);
    if (stored && typeof stored === "object") {
      return stored;
    }
  } catch (error) {
    // storage unavailable
  }
  return null;
}

function getToken() {
  const stored = readSession();
  if (stored && typeof stored.authToken === "string" && stored.authToken !== "") {
    return stored.authToken;
  }
  // Pre-dual-token storage held a bare token string.
  try {
    return wx.getStorageSync("sdkwork-mall-mp-session-token") || "";
  } catch (error) {
    return "";
  }
}

function getAccessToken() {
  const stored = readSession();
  return stored && typeof stored.accessToken === "string" ? stored.accessToken : "";
}

function setSession(snapshot) {
  try {
    wx.setStorageSync(STORAGE_KEY, {
      authToken: String(snapshot.authToken || ""),
      accessToken: String(snapshot.accessToken || ""),
      userId: String(snapshot.userId || ""),
    });
  } catch (error) {
    // storage unavailable: keep the session in memory only
  }
}

function setToken(token) {
  setSession({ authToken: token, accessToken: "", userId: "" });
}

function clearSession() {
  try {
    wx.removeStorageSync(STORAGE_KEY);
    wx.removeStorageSync("sdkwork-mall-mp-session-token");
  } catch (error) {
    // ignore
  }
}

function isLoggedIn() {
  return Boolean(getToken());
}

module.exports = {
  getToken,
  getAccessToken,
  setSession,
  setToken,
  clearSession,
  clearToken: clearSession,
  isLoggedIn,
};
