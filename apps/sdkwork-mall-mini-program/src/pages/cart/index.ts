import { errorMessage, type MpTapEvent } from "../../types/common";
import { t } from "../../i18n";
import { mpCapabilityUrl } from "../../routes/capabilities";
import { type MpCartItem, getCart, removeCartItem, updateCartItem } from "../../services/cart-service";
import { isLoggedIn } from "../../services/session";
import { platform } from "@sdkwork/mall-mp-core";
import { setCartTabBadge } from "../../services/tab-bar-service";

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
  allSelected: boolean;
  itemCount: number;
  manageMode: boolean;
  busy: boolean;
  loading: boolean;
  loggedIn: boolean;
  error: string;
  toast: string;
  manageText: string;
  doneText: string;
  countText: string;
  priceFallback: string;
  retryText: string;
  _toastTimer: number | null;
}

function groupByShop(items: MpCartItem[]): CartGroup[] {
  const groups: CartGroup[] = [];
  const byId = new Map<string, CartGroup>();
  for (const item of items) {
    const shopId = item.shopId || "shop-default";
    let group = byId.get(shopId);
    if (!group) {
      group = { shopId, shopName: item.shopName || t("cart.shopFallback"), items: [] };
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
    allSelected: false,
    itemCount: 0,
    manageMode: false,
    busy: false,
    loading: true,
    loggedIn: false,
    error: "",
    toast: "",
    manageText: t("cart.manage"),
    doneText: t("cart.done"),
    countText: t("cart.countLabel", { count: 0 }),
    priceFallback: t("cart.priceFallback"),
    retryText: t("cart.retry"),
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
      this.setData({
        groups,
        itemCount: cart.items.length,
        countText: t("cart.countLabel", { count: cart.items.length }),
        loading: false,
      });
      this.syncSelection(groups);
      // Keep the tab bar's cart badge in step with the cart plane (H5 parity:
      // the shell reads the same total quantity).
      setCartTabBadge(cart.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0));
    } catch (cause) {
      this.setData({
        loading: false,
        error: errorMessage(cause, t("cart.errors.load")),
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
      allSelected: allIds.length > 0 && selectedIds.length === allIds.length,
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
    // The stepper is a network command: a double tap must not queue two writes.
    if (!id || nextQuantity < 1 || this.data.busy) {
      return;
    }
    this.setData({ busy: true });
    try {
      await updateCartItem(id, nextQuantity);
      await this.refresh();
    } catch (cause) {
      this.showToast(errorMessage(cause, t("cart.errors.updateQuantity")));
    } finally {
      this.setData({ busy: false });
    }
  },

  async removeItem(event: MpTapEvent) {
    const id = String(event.currentTarget.dataset.id ?? "");
    if (!id) {
      return;
    }
    const item = this.findItem(id);
    const confirmed = await platform.confirm({
      title: t("cart.deleteTitle"),
      content: item
        ? t("cart.deleteConfirm", { title: item.title })
        : t("cart.deleteConfirmPlain"),
    });
    if (confirmed) {
      await this.deleteItems([id]);
    }
  },

  findItem(itemId: string): MpCartItem | null {
    for (const group of this.data.groups) {
      for (const item of group.items) {
        if (item.id === itemId) {
          return item;
        }
      }
    }
    return null;
  },

  async deleteItems(itemIds: string[]) {
    if (itemIds.length === 0 || this.data.busy) {
      return;
    }
    this.setData({ busy: true });
    try {
      for (const id of itemIds) {
        await removeCartItem(id);
      }
      this.setData({ selectedIds: this.data.selectedIds.filter((id) => itemIds.indexOf(id) < 0) });
      await this.refresh();
    } catch (cause) {
      this.showToast(errorMessage(cause, t("cart.errors.remove")));
    } finally {
      this.setData({ busy: false });
    }
  },

  async removeSelected() {
    if (this.data.selectedIds.length === 0) {
      return;
    }
    const confirmed = await platform.confirm({
      title: t("cart.deleteSelected"),
      content: t("cart.deleteSelectedConfirm", { count: this.data.selectedIds.length }),
    });
    if (confirmed) {
      await this.deleteItems(this.data.selectedIds.slice());
    }
  },

  toggleManage() {
    this.setData({ manageMode: !this.data.manageMode });
  },

  onPullDownRefresh() {
    void this.refresh().finally(() => platform.stopPullDownRefresh());
  },

  goProduct(event: MpTapEvent) {
    platform.navigateTo(mpCapabilityUrl("storefront.mall.product-detail", { id: String(event.currentTarget.dataset.id ?? "") }));
  },

  /** Shop entry on the cart group header (the H5 cart links the shop too). */
  goShop(event: MpTapEvent) {
    const shopId = String(event.currentTarget.dataset.id ?? "");
    if (shopId) {
      platform.navigateTo(mpCapabilityUrl("storefront.mall.shop", { id: shopId }));
    }
  },

  goHome() {
    platform.switchTab(mpCapabilityUrl("storefront.mall.home"));
  },

  goLogin() {
    platform.navigateTo(mpCapabilityUrl("account.mall.login"));
  },

  goCheckout() {
    if (this.data.selectedIds.length === 0) {
      this.showToast(t("cart.errors.selectionRequired"));
      return;
    }
    platform.navigateTo(mpCapabilityUrl("storefront.mall.checkout", { items: this.data.selectedIds.join(",") }));
  },

  showToast(message: string) {
    this.setData({ toast: message });
    if (this.data._toastTimer != null) {
      clearTimeout(this.data._toastTimer);
    }
    this.setData({ _toastTimer: setTimeout(() => this.setData({ toast: "" }), 2200) });
  },

  retry() {
    void this.refresh();
  },
});
