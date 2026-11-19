import { t } from "../../i18n";
import { errorMessage, type MpInputEvent } from "../../types/common";
import { mpCapabilityUrl } from "../../routes/capabilities";
import {
  changePassword,
  getSecuritySnapshot,
  type MpSecuritySnapshot,
} from "../../services/profile-service";
import { isLoggedIn } from "../../services/session";
import { platform } from "@sdkwork/mall-mp-core";

interface SecurityRow {
  label: string;
  value: string;
}

interface SecurityData {
  accountLabel: string;
  error: string;
  loading: boolean;
  loggedIn: boolean;
  rows: SecurityRow[];
  /** Inline credential form; IAM validates the policy and the old password. */
  passwordOpen: boolean;
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
  saving: boolean;
  formError: string;
  labels: Record<string, string>;
}

function toRows(snapshot: MpSecuritySnapshot): SecurityRow[] {
  const rows: SecurityRow[] = [
    { label: t("security.currentLogin"), value: snapshot.accountLabel || t("security.iamManaged") },
    { label: t("security.accountId"), value: snapshot.userId || "-" },
  ];
  if (snapshot.username) {
    rows.push({ label: t("security.username"), value: snapshot.username });
  }
  rows.push({
    label: t("security.phoneTitle"),
    value: snapshot.phoneVerified ? t("security.bound") : t("security.unbound"),
  });
  rows.push({
    label: t("security.emailTitle"),
    value: snapshot.emailVerified ? t("security.bound") : t("security.unbound"),
  });
  return rows;
}

Page({
  data: {
    accountLabel: "",
    error: "",
    loading: true,
    loggedIn: false,
    rows: [],
    passwordOpen: false,
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
    saving: false,
    formError: "",
    labels: {
      loading: t("security.loading"),
      loginFirst: t("security.loginFirst"),
      loginNow: t("security.loginNow"),
      loginInfoTitle: t("security.loginInfoTitle"),
      securityTitle: t("security.securityTitle"),
      passwordTitle: t("security.passwordTitle"),
      passwordHint: t("security.passwordHint"),
      protectionTitle: t("security.protectionTitle"),
      protectionNote: t("security.protectionNote"),
      helpTitle: t("security.helpTitle"),
      helpNote: t("security.helpNote"),
      relogin: t("security.relogin"),
      oldPassword: t("security.oldPassword"),
      newPassword: t("security.newPassword"),
      confirmPassword: t("security.confirmPassword"),
      submitPassword: t("security.submitPassword"),
      cancel: t("security.cancel"),
      saving: t("security.saving"),
      missing: t("security.missing"),
      mismatch: t("security.mismatch"),
      tooShort: t("security.tooShort"),
    },
  } as SecurityData,

  onShow() {
    void this.load();
  },

  onPullDownRefresh() {
    void this.load().finally(() => platform.stopPullDownRefresh());
  },

  async load() {
    if (!isLoggedIn()) {
      this.setData({
        accountLabel: "",
        error: "",
        loading: false,
        loggedIn: false,
        rows: [],
      });
      return;
    }
    try {
      const snapshot = await getSecuritySnapshot();
      this.setData({
        accountLabel: snapshot.accountLabel,
        error: "",
        loading: false,
        loggedIn: true,
        rows: toRows(snapshot),
      });
    } catch (cause: unknown) {
      this.setData({
        error: errorMessage(cause, t("security.loadFailed")),
        loading: false,
        loggedIn: true,
      });
    }
  },

  retry() {
    void this.load();
  },

  goLogin() {
    platform.navigateTo(mpCapabilityUrl("account.mall.login"));
  },

  togglePassword() {
    this.setData({
      passwordOpen: !this.data.passwordOpen,
      oldPassword: "",
      newPassword: "",
      confirmPassword: "",
      formError: "",
    });
  },

  onPasswordInput(event: MpInputEvent & { currentTarget?: { dataset?: Record<string, unknown> } }) {
    const field = String(event.currentTarget?.dataset?.field ?? "");
    if (field === "oldPassword" || field === "newPassword" || field === "confirmPassword") {
      this.setData({ [field]: event.detail.value, formError: "" });
    }
  },

  async submitPassword() {
    const { oldPassword, newPassword, confirmPassword, saving, labels } = this.data;
    if (saving) {
      return;
    }
    if (!oldPassword || !newPassword || !confirmPassword) {
      this.setData({ formError: labels.missing });
      return;
    }
    if (newPassword.length < 8) {
      this.setData({ formError: labels.tooShort });
      return;
    }
    if (newPassword !== confirmPassword) {
      this.setData({ formError: labels.mismatch });
      return;
    }
    this.setData({ saving: true, formError: "" });
    try {
      await changePassword({ confirmPassword, newPassword, oldPassword });
      this.setData({
        saving: false,
        passwordOpen: false,
        oldPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      platform.toast(t("security.changed"), "success");
    } catch (cause: unknown) {
      this.setData({
        saving: false,
        formError: errorMessage(cause, t("security.updateFailed")),
      });
    }
  },
});
