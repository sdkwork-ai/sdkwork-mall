import { t } from "../../i18n";
import { errorMessage, type MpInputEvent } from "../../types/common";
import { mpCapabilityUrl } from "../../routes/capabilities";
import { getMallMpRuntime, platform } from "@sdkwork/mall-mp-core";
import { loginWithPassword, loginWithWechat } from "../../services/auth-service";
import { clearSession, getToken, isLoggedIn, setToken } from "../../services/session";
import { bindPendingInvite } from "../../services/invite-service";

interface LoginData {
  account: string;
  password: string;
  token: string;
  /** Remembered account so a returning buyer does not retype it. */
  lastAccount: string;
  loggedIn: boolean;
  displayName: string;
  /** Terms gate: both sign-in paths require an explicit opt-in. */
  agreementAccepted: boolean;
  showPassword: boolean;
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
  accountLabel: string;
  accountPlaceholder: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  showPasswordText: string;
  hidePasswordText: string;
  submitText: string;
  submittingText: string;
  devToggleText: string;
  devHintText: string;
  tokenLabel: string;
  tokenPlaceholder: string;
  logoutText: string;
}

const LAST_ACCOUNT_KEY = "sdkwork-mall-mp-last-account";

function goBackAfterLogin(): void {
  setTimeout(() => {
    platform.back({ tab: true, url: mpCapabilityUrl("buyer.mall.dashboard") });
  }, 600);
}

Page({
  data: {
    account: "",
    password: "",
    token: "",
    lastAccount: "",
    loggedIn: false,
    displayName: "已登录用户",
    agreementAccepted: false,
    showPassword: false,
    useTokenFallback: false,
    devFallbackVisible: true,
    wechatAvailable: true,
    busy: false,
    error: "",
    titleText: t("auth.title"),
    hintText: t("auth.hint"),
    wechatLoginText: t("auth.wechatLogin"),
    wechatLoginBusyText: t("auth.wechatLoginBusy"),
    accountLabel: t("auth.accountLabel"),
    accountPlaceholder: t("auth.accountPlaceholder"),
    passwordLabel: t("auth.passwordLabel"),
    passwordPlaceholder: t("auth.passwordPlaceholder"),
    showPasswordText: "显示",
    hidePasswordText: "隐藏",
    submitText: t("auth.submit"),
    submittingText: t("auth.submitting"),
    devToggleText: t("auth.devToggle"),
    devHintText: t("auth.devHint"),
    tokenLabel: t("auth.tokenLabel"),
    tokenPlaceholder: t("auth.tokenPlaceholder"),
    logoutText: t("auth.logout"),
  } as LoginData,

  onLoad() {
    const lastAccount = platform.storage.get(LAST_ACCOUNT_KEY) ?? "";
    this.setData({ lastAccount, account: lastAccount });
  },

  onShow() {
    const runtime = getMallMpRuntime();
    const token = getToken();
    this.setData({
      token,
      loggedIn: isLoggedIn() && token !== "",
      // `platformLogin` is the WeChat capability; a host profile without it must
      // not show a button that can only fail.
      wechatAvailable: runtime.host.hasCapability("platformLogin"),
      devFallbackVisible: runtime.environment.environment !== "production",
    });
  },

  onAccountInput(event: MpInputEvent) {
    this.setData({ account: event.detail.value, error: "" });
  },

  onPasswordInput(event: MpInputEvent) {
    this.setData({ password: event.detail.value, error: "" });
  },

  onTokenInput(event: MpInputEvent) {
    this.setData({ token: event.detail.value });
  },

  togglePassword() {
    this.setData({ showPassword: !this.data.showPassword });
  },

  toggleAgreement() {
    this.setData({ agreementAccepted: !this.data.agreementAccepted, error: "" });
  },

  toggleFallback() {
    this.setData({ useTokenFallback: !this.data.useTokenFallback, error: "" });
  },

  goBuyer() {
    platform.switchTab(mpCapabilityUrl("buyer.mall.dashboard"));
  },

  openTerms() {
    platform.navigateTo(mpCapabilityUrl("storefront.mall.help"));
  },

  openPrivacy() {
    platform.navigateTo(mpCapabilityUrl("storefront.mall.help"));
  },

  /** Blocks sign-in until the buyer opts in; returns false when blocked. */
  requireAgreement(): boolean {
    if (this.data.agreementAccepted) {
      return true;
    }
    this.setData({ error: "请先阅读并同意《用户协议》与《隐私政策》" });
    return false;
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
    if (!this.requireAgreement()) {
      return;
    }
    this.setData({ busy: true, error: "" });
    try {
      await loginWithWechat();
      await bindPendingInvite();
      this.setData({ busy: false, loggedIn: true });
      platform.toast(t("auth.success"), "success");
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
    if (!this.requireAgreement()) {
      return;
    }
    this.setData({ busy: true, error: "" });
    try {
      await loginWithPassword(account, password);
      await bindPendingInvite();
      platform.storage.set(LAST_ACCOUNT_KEY, account);
      this.setData({
        busy: false,
        loggedIn: true,
        lastAccount: account,
        password: "",
      });
      platform.toast(t("auth.success"), "success");
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
    if (!this.requireAgreement()) {
      return;
    }
    setToken(token);
    platform.toast(t("auth.success"), "success");
    goBackAfterLogin();
  },

  logout() {
    clearSession();
    this.setData({ token: "", password: "", loggedIn: false, error: "" });
    platform.toast(t("auth.loggedOut"), "success");
  },
});
