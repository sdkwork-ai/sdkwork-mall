const auth = require("../../services/auth-service");
const session = require("../../services/session");

Page({
  data: {
    account: "",
    password: "",
    token: "",
    useTokenFallback: false,
    busy: false,
    error: "",
  },

  onShow() {
    this.setData({ token: session.getToken() });
  },

  onAccountInput(event) {
    this.setData({ account: event.detail.value });
  },

  onPasswordInput(event) {
    this.setData({ password: event.detail.value });
  },

  onTokenInput(event) {
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
      await auth.loginWithPassword(account, password);
      this.setData({ busy: false });
      wx.showToast({ title: "登录成功", icon: "success" });
      setTimeout(() => wx.navigateBack({ fail() { wx.switchTab({ url: "/pages/buyer/index" }); } }), 600);
    } catch (cause) {
      this.setData({ busy: false, error: cause && cause.message ? cause.message : "登录失败" });
    }
  },

  loginWithToken() {
    const token = this.data.token.trim();
    if (!token) {
      this.setData({ error: "请输入访问令牌" });
      return;
    }
    session.setToken(token);
    wx.showToast({ title: "登录成功", icon: "success" });
    setTimeout(() => wx.navigateBack({ fail() { wx.switchTab({ url: "/pages/buyer/index" }); } }), 600);
  },

  logout() {
    session.clearSession();
    this.setData({ token: "", account: "", password: "" });
    wx.showToast({ title: "已退出", icon: "success" });
  },
});
