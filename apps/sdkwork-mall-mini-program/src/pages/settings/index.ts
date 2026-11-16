import { clearSession, isLoggedIn } from "../../services/session";
import { mpCapabilityUrl } from "../../routes/capabilities";
import { clearFootprint, readFavorites, removeFavorite } from "../../services/favorites-service";
import { platform } from "@sdkwork/mall-mp-core";

interface SettingsData {
  loggedIn: boolean;
  environment: string;
  deploymentProfile: string;
}

interface MallMpGlobalData {
  environment?: string;
  deploymentProfile?: string;
}

interface MallMpApp {
  globalData?: MallMpGlobalData;
}

Page({
  data: {
    loggedIn: false,
    environment: "development",
    deploymentProfile: "standalone",
  } as SettingsData,

  onShow() {
    // The app shell publishes these under `globalData` (src/app.ts), not as
    // top-level app members.
    const globalData = getApp<MallMpApp>()?.globalData;
    this.setData({
      loggedIn: isLoggedIn(),
      environment: String(globalData?.environment ?? "development"),
      deploymentProfile: String(globalData?.deploymentProfile ?? "standalone"),
    });
  },

  async clearFootprint() {
    const confirmed = await platform.confirm({
      title: "清空浏览足迹",
      content: "确定清空全部浏览记录？",
    });
    if (!confirmed) {
      return;
    }
    clearFootprint();
    platform.toast("已清空", "success");
  },

  async clearFavorites() {
    const confirmed = await platform.confirm({
      title: "清空收藏",
      content: `确定移除全部 ${readFavorites().length} 件收藏？`,
    });
    if (!confirmed) {
      return;
    }
    for (const item of readFavorites()) {
      removeFavorite(item.id);
    }
    platform.toast("已清空", "success");
  },

  async logout() {
    const confirmed = await platform.confirm({
      title: "退出登录",
      content: "确定退出当前账号？",
    });
    if (!confirmed) {
      return;
    }
    clearSession();
    this.setData({ loggedIn: false });
  },

  goLogin() {
    platform.navigateTo(mpCapabilityUrl("account.mall.login"));
  },
});
