/**
 * IAM login over the shared transport seam.
 *
 * The exchange posts the IAM session-create contract
 * (`POST /auth/sessions`): one principal field plus the password; the
 * response data carries the dual tokens and session context. The dev
 * token-paste entry stays on the login page as a fallback.
 */
const session = require("./session");
const { request } = require("./transport");

function detectPrincipalKind(account) {
  if (account.includes("@")) {
    return "email";
  }
  if (/^1\d{10}$/.test(account)) {
    return "phone";
  }
  return "username";
}

async function loginWithPassword(account, password) {
  const kind = detectPrincipalKind(account);
  const body = { password, [kind]: account };
  const data = await request({ path: "/auth/sessions", method: "POST", body });
  const authToken = data.authToken || data.token || "";
  if (!authToken) {
    throw new Error("登录响应缺少令牌，请稍后重试");
  }
  const context = data.context || {};
  session.setSession({
    authToken,
    accessToken: data.accessToken || "",
    userId: context.userId || "",
  });
  return { authToken, accessToken: data.accessToken || "", userId: context.userId || "" };
}

async function logout() {
  try {
    await request({ path: "/auth/sessions/current", method: "DELETE" });
  } catch (error) {
    // The server session may already be gone; local sign-out proceeds.
  }
  session.clearSession();
}

module.exports = { loginWithPassword, logout, detectPrincipalKind };
