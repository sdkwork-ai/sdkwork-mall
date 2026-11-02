import { errorMessage } from "../../types/common";
import { getProfile, type MpProfile } from "../../services/profile-service";

interface ProfileRow {
  label: string;
  value: string;
}

interface ProfileData {
  error: string;
  loading: boolean;
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
    rows: [],
  } as ProfileData,

  onShow() {
    void this.load();
  },

  async load() {
    try {
      const profile = await getProfile();
      this.setData({ error: "", loading: false, rows: toRows(profile) });
    } catch (cause: unknown) {
      this.setData({ error: errorMessage(cause, "个人资料加载失败"), loading: false });
    }
  },

  goSecurity() {
    wx.navigateTo({ url: "/pages/security/index" });
  },
});
