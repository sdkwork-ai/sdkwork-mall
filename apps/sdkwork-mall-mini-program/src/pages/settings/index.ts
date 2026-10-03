import { clearSession, isLoggedIn } from "../../services/session";
import { clearFootprint, readFavorites, removeFavorite } from "../../services/favorites-service";

interface SettingsData {
  loggedIn: boolean;
  environment: string;
  deploymentProfile: string;
}

interface MallMpGlobalData {
  environment?: string;
  deploymentProfile?: string;
}

Page({
  data: {
    loggedIn: false,
    environment: "development",
    deploymentProfile: "standalone",
  } as SettingsData,

  onShow() {
    const app = getApp<MallMpGlobalData>();
    this.setData({
      loggedIn: isLoggedIn(),
      environment: String(app?.environment ?? "development"),
      deploymentProfile: String(app?.deploymentProfile ?? "standalone"),
    });
  },

  clearFootprint() {
    wx.showModal({
      title: "清空浏览足迹",
      content: "确定清空全部浏览记录？",
      success: (result) => {
        if (result.confirm) {
          clearFootprint();
          wx.showToast({ title: "已清空", icon: "success" });
        }
      },
    });
  },

  clearFavorites() {
    wx.showModal({
      title: "清空收藏",
      content: `确定移除全部 ${readFavorites().length} 件收藏？`,
      success: (result) => {
        if (result.confirm) {
          for (const item of readFavorites()) {
            removeFavorite(item.id);
          }
          wx.showToast({ title: "已清空", icon: "success" });
        }
      },
    });
  },

  logout() {
    wx.showModal({
      title: "退出登录",
      content: "确定退出当前账号？",
      success: (result) => {
        if (result.confirm) {
          clearSession();
          this.setData({ loggedIn: false });
        }
      },
    });
  },

  goLogin() {
    wx.navigateTo({ url: "/pages/login/index" });
  },
});
