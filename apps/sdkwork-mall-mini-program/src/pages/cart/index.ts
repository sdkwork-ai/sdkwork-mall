import { errorMessage, type MpTapEvent } from "../../types/common";
import { type MpCartItem, getCart, removeCartItem, updateCartItem } from "../../services/cart-service";
import { isLoggedIn } from "../../services/session";

interface CartGroup {
  shopId: string;
  shopName: string;
  items: MpCartItem[];
}

interface CartGroupView extends CartGroup {
  allSelected: boolean;
}

interface CartData {
  groups: CartGroupView[];
  selectedIds: string[];
  selectedTotal: string;
  selectedCount: number;
  loading: boolean;
  loggedIn: boolean;
  error: string;
  toast: string;
  _toastTimer: number | null;
}

function groupByShop(items: MpCartItem[]): CartGroup[] {
  const groups: CartGroup[] = [];
  const byId = new Map<string, CartGroup>();
  for (const item of items) {
    const shopId = item.shopId || "shop-default";
    let group = byId.get(shopId);
    if (!group) {
      group = { shopId, shopName: item.shopName || "SDKWork 精选", items: [] };
      byId.set(shopId, group);
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

Page({
  data: {
    groups: [],
    selectedIds: [],
    selectedTotal: "0.00",
    selectedCount: 0,
    loading: true,
    loggedIn: false,
    error: "",
    toast: "",
    _toastTimer: null,
  } as CartData,

  onShow() {
    this.setData({ loggedIn: isLoggedIn() });
    if (isLoggedIn()) {
      void this.refresh();
    } else {
      this.setData({ loading: false });
    }
  },

  async refresh() {
    this.setData({ loading: true, error: "" });
    try {
      const cart = await getCart();
      const groups = groupByShop(cart.items).map((group) => ({
        ...group,
        allSelected: group.items.every((item) => this.isSelected(item.id)),
      }));
      this.setData({ groups, loading: false });
      this.syncSelection(groups);
    } catch (cause) {
      this.setData({
        loading: false,
        error: errorMessage(cause, "购物车加载失败"),
      });
    }
  },

  isSelected(itemId: string) {
    return this.data.selectedIds.indexOf(itemId) >= 0;
  },

  syncSelection(groups: CartGroupView[]) {
    const allIds: string[] = [];
    for (const group of groups) {
      for (const item of group.items) {
        allIds.push(item.id);
      }
    }
    const selectedIds = allIds.filter((id) => this.isSelected(id));
    let selectedTotal = 0;
    let selectedCount = 0;
    for (const group of groups) {
      for (const item of group.items) {
        if (this.isSelected(item.id)) {
          selectedTotal += (item.priceCny ?? 0) * item.quantity;
          selectedCount += 1;
        }
      }
    }
    this.setData({
      selectedIds,
      selectedTotal: selectedTotal.toFixed(2),
      selectedCount,
      groups: groups.map((group) => ({
        ...group,
        allSelected: group.items.every((item) => this.isSelected(item.id)),
      })),
    });
  },

  toggleAll() {
    const allIds: string[] = [];
    for (const group of this.data.groups) {
      for (const item of group.items) {
        allIds.push(item.id);
      }
    }
    const allSelected = allIds.length > 0 && allIds.every((id) => this.isSelected(id));
    const selectedIds = allSelected ? [] : allIds;
    this.setData({ selectedIds }, () => this.syncSelection(this.data.groups));
  },

  toggleGroup(event: MpTapEvent) {
    const shopId = String(event.currentTarget.dataset.shop ?? "");
    const group = this.data.groups.find((entry) => entry.shopId === shopId);
    if (!group) {
      return;
    }
    const groupIds = group.items.map((item) => item.id);
    const shouldSelect = !groupIds.every((id) => this.isSelected(id));
    let selectedIds = this.data.selectedIds.filter((id) => groupIds.indexOf(id) < 0);
    if (shouldSelect) {
      selectedIds = selectedIds.concat(groupIds);
    }
    this.setData({ selectedIds }, () => this.syncSelection(this.data.groups));
  },

  toggleItem(event: MpTapEvent) {
    const itemId = String(event.currentTarget.dataset.id ?? "");
    const index = this.data.selectedIds.indexOf(itemId);
    const selectedIds = this.data.selectedIds.slice();
    if (index >= 0) {
      selectedIds.splice(index, 1);
    } else {
      selectedIds.push(itemId);
    }
    this.setData({ selectedIds }, () => this.syncSelection(this.data.groups));
  },

  async changeQuantity(event: MpTapEvent) {
    const id = String(event.currentTarget.dataset.id ?? "");
    const nextQuantity = Number(event.currentTarget.dataset.quantity ?? 0);
    if (!id || nextQuantity < 1) {
      return;
    }
    try {
      await updateCartItem(id, nextQuantity);
      await this.refresh();
    } catch (cause) {
      this.showToast(errorMessage(cause, "更新数量失败"));
    }
  },

  async removeItem(event: MpTapEvent) {
    const id = String(event.currentTarget.dataset.id ?? "");
    try {
      await removeCartItem(id);
      await this.refresh();
    } catch (cause) {
      this.showToast(errorMessage(cause, "删除失败"));
    }
  },

  goProduct(event: MpTapEvent) {
    wx.navigateTo({ url: `/pages/product/index?id=${String(event.currentTarget.dataset.id ?? "")}` });
  },

  goHome() {
    wx.switchTab({ url: "/pages/home/index" });
  },

  goLogin() {
    wx.navigateTo({ url: "/pages/login/index" });
  },

  goCheckout() {
    if (this.data.selectedIds.length === 0) {
      this.showToast("请先选择商品");
      return;
    }
    wx.navigateTo({ url: `/pages/checkout/index?items=${this.data.selectedIds.join(",")}` });
  },

  showToast(message: string) {
    this.setData({ toast: message });
    if (this.data._toastTimer != null) {
      clearTimeout(this.data._toastTimer);
    }
    this.setData({ _toastTimer: setTimeout(() => this.setData({ toast: "" }), 2200) });
  },
});
