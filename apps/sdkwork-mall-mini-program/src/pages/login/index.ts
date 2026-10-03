import { errorMessage, type MpInputEvent } from "../../types/common";
import { loginWithPassword } from "../../services/auth-service";
import { getToken, setToken, clearSession } from "../../services/session";

interface LoginData {
  account: string;
  password: string;
  token: string;
  useTokenFallback: boolean;
  busy: boolean;
  error: string;
}

Page({
  data: {
    account: "",
    password: "",
    token: "",
    useTokenFallback: false,
    busy: false,
    error: "",
  } as LoginData,

  onShow() {
    this.setData({ token: getToken() });
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

  toggleFallback() {
    this.setData({ useTokenFallback: !this.data.useTokenFallback, error: "" });
  },

  async login() {
    const account = this.data.account.trim();
    const password = this.data.password;
    if (!account || !password) {
      this.setData({ error: "请输入账号与密码" });
      return;
    }
    this.setData({ busy: true, error: "" });
    try {
      await loginWithPassword(account, password);
      this.setData({ busy: false });
      wx.showToast({ title: "登录成功", icon: "success" });
      setTimeout(() => wx.navigateBack({ fail() { wx.switchTab({ url: "/pages/buyer/index" }); } }), 600);
    } catch (cause) {
      this.setData({ busy: false, error: errorMessage(cause, "登录失败") });
    }
  },

  loginWithToken() {
    const token = this.data.token.trim();
    if (!token) {
      this.setData({ error: "请输入访问令牌" });
      return;
    }
    setToken(token);
    wx.showToast({ title: "登录成功", icon: "success" });
    setTimeout(() => wx.navigateBack({ fail() { wx.switchTab({ url: "/pages/buyer/index" }); } }), 600);
  },

  logout() {
    clearSession();
    this.setData({ token: "", account: "", password: "" });
    wx.showToast({ title: "已退出", icon: "success" });
  },
});
