import { errorMessage } from "../../types/common";
import { mpCapabilityUrl } from "../../routes/capabilities";
import {
  getSecuritySnapshot,
  type MpSecuritySnapshot,
} from "../../services/profile-service";
import { isLoggedIn } from "../../services/session";

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
}

function toRows(snapshot: MpSecuritySnapshot): SecurityRow[] {
  return [
    { label: "当前登录", value: snapshot.accountLabel || "当前账户" },
    { label: "用户 ID", value: snapshot.userId || "-" },
  ];
}

Page({
  data: {
    accountLabel: "",
    error: "",
    loading: true,
    loggedIn: false,
    rows: [],
  } as SecurityData,

  onShow() {
    void this.load();
  },

  onPullDownRefresh() {
    void this.load().finally(() => wx.stopPullDownRefresh());
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
        error: errorMessage(cause, "账户安全信息加载失败"),
        loading: false,
        loggedIn: true,
      });
    }
  },

  goLogin() {
    wx.navigateTo({ url: mpCapabilityUrl("account.mall.login") });
  },
});
