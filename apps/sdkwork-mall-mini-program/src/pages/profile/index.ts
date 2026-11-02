import { errorMessage } from "../../types/common";
import { mpCapabilityUrl } from "../../routes/capabilities";
import { getProfile, type MpProfile } from "../../services/profile-service";
import { isLoggedIn } from "../../services/session";

interface ProfileRow {
  label: string;
  value: string;
}

interface ProfileData {
  error: string;
  loading: boolean;
  loggedIn: boolean;
  rows: ProfileRow[];
}

function toRows(profile: MpProfile): ProfileRow[] {
  return [
    { label: "昵称", value: profile.displayName || "-" },
    { label: "邮箱", value: profile.email || "-" },
    { label: "手机号", value: profile.phone || "-" },
    { label: "会员等级", value: profile.membershipLevel || "-" },
  ];
}

Page({
  data: {
    error: "",
    loading: true,
    loggedIn: false,
    rows: [],
  } as ProfileData,

  onShow() {
    void this.load();
  },

  onPullDownRefresh() {
    void this.load().finally(() => wx.stopPullDownRefresh());
  },

  async load() {
    if (!isLoggedIn()) {
      this.setData({ error: "", loading: false, loggedIn: false, rows: [] });
      return;
    }
    try {
      const profile = await getProfile();
      this.setData({ error: "", loading: false, loggedIn: true, rows: toRows(profile) });
    } catch (cause: unknown) {
      this.setData({
        error: errorMessage(cause, "个人资料加载失败"),
        loading: false,
        loggedIn: true,
      });
    }
  },

  goLogin() {
    wx.navigateTo({ url: mpCapabilityUrl("account.mall.login") });
  },

  goSecurity() {
    wx.navigateTo({ url: mpCapabilityUrl("buyer.mall.security") });
  },
});
