import { t } from "../../i18n";
import { errorMessage, type MpInputEvent } from "../../types/common";
import { mpCapabilityUrl } from "../../routes/capabilities";
import { getMallMpRuntime } from "@sdkwork/mall-mp-core";
import { loginWithPassword, loginWithWechat } from "../../services/auth-service";
import { clearSession, getToken, setToken } from "../../services/session";

interface LoginData {
  account: string;
  password: string;
  token: string;
  /** Account/password fallback panel; WeChat sign-in is the primary path. */
  showCredentialForm: boolean;
  /** Development-only token paste; hidden in production builds. */
  useTokenFallback: boolean;
  devFallbackVisible: boolean;
  wechatAvailable: boolean;
  busy: boolean;
  error: string;
  titleText: string;
  hintText: string;
  wechatLoginText: string;
  wechatLoginBusyText: string;
  credentialToggleText: string;
  credentialCollapseText: string;
  accountLabel: string;
  accountPlaceholder: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  submitText: string;
  submittingText: string;
  devToggleText: string;
  devHintText: string;
  tokenLabel: string;
  tokenPlaceholder: string;
  logoutText: string;
}

function goBackAfterLogin(): void {
  setTimeout(() => {
    wx.navigateBack({
      fail() {
        wx.switchTab({ url: mpCapabilityUrl("buyer.mall.dashboard") });
      },
    });
  }, 600);
}

Page({
  data: {
    account: "",
    password: "",
    token: "",
    showCredentialForm: false,
    useTokenFallback: false,
    devFallbackVisible: true,
    wechatAvailable: true,
    busy: false,
    error: "",
    titleText: t("auth.title"),
    hintText: t("auth.hint"),
    wechatLoginText: t("auth.wechatLogin"),
    wechatLoginBusyText: t("auth.wechatLoginBusy"),
    credentialToggleText: t("auth.credentialToggle"),
    credentialCollapseText: t("auth.credentialCollapse"),
    accountLabel: t("auth.accountLabel"),
    accountPlaceholder: t("auth.accountPlaceholder"),
    passwordLabel: t("auth.passwordLabel"),
    passwordPlaceholder: t("auth.passwordPlaceholder"),
    submitText: t("auth.submit"),
    submittingText: t("auth.submitting"),
    devToggleText: t("auth.devToggle"),
    devHintText: t("auth.devHint"),
    tokenLabel: t("auth.tokenLabel"),
    tokenPlaceholder: t("auth.tokenPlaceholder"),
    logoutText: t("auth.logout"),
  } as LoginData,

  onShow() {
    const runtime = getMallMpRuntime();
    this.setData({
      token: getToken(),
      // `platformLogin` is the WeChat capability; a host profile without it must
      // not show a button that can only fail.
      wechatAvailable: runtime.host.hasCapability("platformLogin"),
      devFallbackVisible: runtime.environment.environment !== "production",
    });
  },

  onAccountInput(event: MpInputEvent) {
    this.setData({ account: event.detail.value });
  },

  onPasswordInput(event: MpInputEvent) {
    this.setData({ password: event.detail.value });
  },

  onTokenInput(event: MpInputEvent) {
    this.setData({ token: event.detail.value });
  },

  toggleCredentialForm() {
    this.setData({ showCredentialForm: !this.data.showCredentialForm, error: "" });
  },

  toggleFallback() {
    this.setData({ useTokenFallback: !this.data.useTokenFallback, error: "" });
  },

  /** Production path: one tap, no credential typing (mini-program review expects it). */
  async loginWithWechat() {
    if (this.data.busy) {
      return;
    }
    if (!this.data.wechatAvailable) {
      this.setData({ error: t("auth.wechatUnsupported") });
      return;
    }
    this.setData({ busy: true, error: "" });
    try {
      await loginWithWechat();
      this.setData({ busy: false });
      wx.showToast({ title: t("auth.success"), icon: "success" });
      goBackAfterLogin();
    } catch (cause) {
      this.setData({ busy: false, error: errorMessage(cause, t("auth.failed")) });
    }
  },

  /** Fallback path for accounts without a WeChat identity binding. */
  async login() {
    const account = this.data.account.trim();
    const password = this.data.password;
    if (!account || !password) {
      this.setData({ error: t("auth.missingCredential") });
      return;
    }
    if (this.data.busy) {
      return;
    }
    this.setData({ busy: true, error: "" });
    try {
      await loginWithPassword(account, password);
      this.setData({ busy: false });
      wx.showToast({ title: t("auth.success"), icon: "success" });
      goBackAfterLogin();
    } catch (cause) {
      this.setData({ busy: false, error: errorMessage(cause, t("auth.failed")) });
    }
  },

  loginWithToken() {
    const token = this.data.token.trim();
    if (!token) {
      this.setData({ error: t("auth.missingToken") });
      return;
    }
    setToken(token);
    wx.showToast({ title: t("auth.success"), icon: "success" });
    goBackAfterLogin();
  },

  logout() {
    clearSession();
    this.setData({ token: "", account: "", password: "" });
    wx.showToast({ title: t("auth.loggedOut"), icon: "success" });
  },
});
