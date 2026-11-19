import { isLoggedIn } from "../../services/session";
import { signOut } from "../../services/sign-out";
import { mpCapabilityUrl } from "../../routes/capabilities";
import { clearFootprint, readFavorites, removeFavorite } from "../../services/favorites-service";
import { platform } from "@sdkwork/mall-mp-core";

interface SettingsData {
  loggedIn: boolean;
}

Page({
  data: {
    loggedIn: false,
  } as SettingsData,

  onShow() {
    this.setData({ loggedIn: isLoggedIn() });
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
    await signOut();
    this.setData({ loggedIn: false });
  },

  goLogin() {
    platform.navigateTo(mpCapabilityUrl("account.mall.login"));
  },
});
