const cartService = require("../../services/cart-service");
const session = require("../../services/session");
const { formatCny } = require("../../utils/format");

function groupByShop(items) {
  const groups = [];
  const byId = new Map();
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
  },

  onShow() {
    this.setData({ loggedIn: session.isLoggedIn() });
    if (session.isLoggedIn()) {
      this.refresh();
    } else {
      this.setData({ loading: false });
    }
  },

  async refresh() {
    this.setData({ loading: true, error: "" });
    try {
      const cart = await cartService.getCart();
      const groups = groupByShop(cart.items).map((group) => ({
        ...group,
        allSelected: group.items.every((item) => this.isSelected(item.id)),
      }));
      this.setData({ groups, loading: false });
      this.syncSelection(groups);
    } catch (cause) {
      this.setData({
        loading: false,
        error: cause && cause.message ? cause.message : "购物车加载失败",
      });
    }
  },

  isSelected(itemId) {
    return this.data.selectedIds.indexOf(itemId) >= 0;
  },

  syncSelection(groups) {
    const allIds = [];
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
    const allIds = [];
    for (const group of this.data.groups) {
      for (const item of group.items) {
        allIds.push(item.id);
      }
    }
    const allSelected = allIds.length > 0 && allIds.every((id) => this.isSelected(id));
    const selectedIds = allSelected ? [] : allIds;
    this.setData({ selectedIds }, () => this.syncSelection(this.data.groups));
  },

  toggleGroup(event) {
    const shopId = event.currentTarget.dataset.shop;
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

  toggleItem(event) {
    const itemId = event.currentTarget.dataset.id;
    const index = this.data.selectedIds.indexOf(itemId);
    const selectedIds = this.data.selectedIds.slice();
    if (index >= 0) {
      selectedIds.splice(index, 1);
    } else {
      selectedIds.push(itemId);
    }
    this.setData({ selectedIds }, () => this.syncSelection(this.data.groups));
  },

  async changeQuantity(event) {
    const { id, quantity } = event.currentTarget.dataset;
    const nextQuantity = Number(quantity);
    if (!id || nextQuantity < 1) {
      return;
    }
    try {
      await cartService.updateCartItem(id, nextQuantity);
      await this.refresh();
    } catch (cause) {
      this.showToast(cause && cause.message ? cause.message : "更新数量失败");
    }
  },

  async removeItem(event) {
    const id = event.currentTarget.dataset.id;
    try {
      await cartService.removeCartItem(id);
      await this.refresh();
    } catch (cause) {
      this.showToast(cause && cause.message ? cause.message : "删除失败");
    }
  },

  goProduct(event) {
    wx.navigateTo({ url: `/pages/product/index?id=${event.currentTarget.dataset.id}` });
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

  showToast(message) {
    this.setData({ toast: message });
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
    this.toastTimer = setTimeout(() => this.setData({ toast: "" }), 2200);
  },
});
