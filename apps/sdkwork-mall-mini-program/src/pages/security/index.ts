import { errorMessage } from "../../types/common";
import {
  getSecuritySnapshot,
  type MpSecuritySnapshot,
} from "../../services/profile-service";

interface SecurityRow {
  label: string;
  value: string;
}

interface SecurityData {
  accountLabel: string;
  error: string;
  loading: boolean;
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
    rows: [],
  } as SecurityData,

  onShow() {
    void this.load();
  },

  async load() {
    try {
      const snapshot = await getSecuritySnapshot();
      this.setData({
        accountLabel: snapshot.accountLabel,
        error: "",
        loading: false,
        rows: toRows(snapshot),
      });
    } catch (cause: unknown) {
      this.setData({ error: errorMessage(cause, "账户安全信息加载失败"), loading: false });
    }
  },

  goLogin() {
    wx.navigateTo({ url: "/pages/login/index" });
  },
});
