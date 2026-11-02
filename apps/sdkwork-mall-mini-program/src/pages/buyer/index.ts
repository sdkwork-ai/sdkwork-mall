import { t } from "../../i18n";
import { type MpTapEvent } from "../../types/common";
import { mpCapabilityUrl } from "../../routes/capabilities";
import { getOrderStatistics } from "../../services/order-service";
import { isLoggedIn, clearSession } from "../../services/session";

const ORDER_ENTRIES: Array<{ status: string; labelKey: string; count: string | number }> = [
  { status: "all", labelKey: "buyerHub.orders.all", count: "" },
  { status: "PENDING_PAYMENT", labelKey: "buyerHub.orders.pendingPayment", count: "" },
  { status: "PENDING_SHIPMENT", labelKey: "buyerHub.orders.pendingShipment", count: "" },
  { status: "PENDING_RECEIPT", labelKey: "buyerHub.orders.pendingReceipt", count: "" },
  { status: "COMPLETED", labelKey: "buyerHub.orders.completed", count: "" },
];

/**
 * 买家中心入口一律按能力路由 id 声明，页面路径由
 * `routes/capabilities.ts` 统一解析：改页面路径只需改注册表，
 * 且与 PC / H5 / Flutter 共用同一套 route id。
 */
const ASSET_LINKS: Array<{ labelKey: string; capability: string }> = [
  { labelKey: "buyerHub.assets.wallet", capability: "buyer.mall.wallet" },
  { labelKey: "buyerHub.assets.points", capability: "buyer.mall.points" },
  { labelKey: "buyerHub.assets.membership", capability: "buyer.mall.membership" },
];

const QUICK_LINKS: Array<{ labelKey: string; capability: string }> = [
  { labelKey: "buyerHub.services.favorites", capability: "buyer.mall.favorites" },
  { labelKey: "buyerHub.services.footprint", capability: "buyer.mall.footprint" },
  { labelKey: "buyerHub.services.addresses", capability: "buyer.mall.addresses" },
  { labelKey: "buyerHub.services.coupons", capability: "buyer.mall.coupons" },
  { labelKey: "buyerHub.services.afterSales", capability: "buyer.mall.after-sales" },
  { labelKey: "buyerHub.services.invoices", capability: "buyer.mall.invoices" },
  { labelKey: "buyerHub.services.messages", capability: "buyer.mall.messages" },
  { labelKey: "buyerHub.services.chats", capability: "buyer.mall.im.chats" },
];

/** 账户区入口（含设置）同样走能力路由。 */
const ACCOUNT_LINKS: Array<{ labelKey: string; capability: string }> = [
  { labelKey: "buyerHub.account.profile", capability: "buyer.mall.profile" },
  { labelKey: "buyerHub.account.reviews", capability: "buyer.mall.reviews" },
  { labelKey: "buyerHub.account.giftCards", capability: "buyer.mall.gift-cards" },
  { labelKey: "buyerHub.account.security", capability: "buyer.mall.security" },
  { labelKey: "buyerHub.account.settings", capability: "buyer.mall.settings" },
  { labelKey: "buyerHub.account.help", capability: "storefront.mall.help" },
];

const OTHER_LINKS: Array<{ labelKey: string; capability: string }> = [
  { labelKey: "buyerHub.others.activity", capability: "storefront.mall.activity-list" },
];

interface BuyerData {
  loggedIn: boolean;
  orderEntries: Array<{ status: string; label: string; count: string | number }>;
  assetLinks: Array<{ label: string; capability: string }>;
  quickLinks: Array<{ label: string; capability: string }>;
  accountLinks: Array<{ label: string; capability: string }>;
  otherLinks: Array<{ label: string; capability: string }>;
}

function resolveOrderEntries(
  counts?: (status: string) => string | number,
): BuyerData["orderEntries"] {
  return ORDER_ENTRIES.map((entry) => ({
    status: entry.status,
    label: t(entry.labelKey),
    count: counts ? counts(entry.status) : entry.count,
  }));
}

function resolveLinks(
  links: Array<{ labelKey: string; capability: string }>,
): Array<{ label: string; capability: string }> {
  return links.map((link) => ({ label: t(link.labelKey), capability: link.capability }));
}

Page({
  data: {
    loggedIn: false,
    orderEntries: resolveOrderEntries(),
    assetLinks: resolveLinks(ASSET_LINKS),
    quickLinks: resolveLinks(QUICK_LINKS),
    accountLinks: resolveLinks(ACCOUNT_LINKS),
    otherLinks: resolveLinks(OTHER_LINKS),
  } as BuyerData,

  onShow() {
    const loggedIn = isLoggedIn();
    this.setData({ loggedIn });
    if (loggedIn) {
      this.loadStatistics();
    }
  },

  async loadStatistics() {
    try {
      const statistics = await getOrderStatistics();
      const countFor = (status: string): string | number => {
        if (!statistics) {
          return "";
        }
        if (status === "all") {
          return statistics.totalOrders;
        }
        if (status === "PENDING_PAYMENT") {
          return statistics.pendingPayment;
        }
        if (status === "PENDING_SHIPMENT") {
          return statistics.pendingShipment;
        }
        if (status === "PENDING_RECEIPT") {
          return statistics.pendingReceipt;
        }
        if (status === "COMPLETED") {
          return statistics.completed;
        }
        return "";
      };
      this.setData({
        orderEntries: resolveOrderEntries(countFor),
      });
    } catch (cause) {
      // 统计为增强信息，失败时保持空态。
    }
  },

  goOrderEntry(event: MpTapEvent) {
    const status = String(event.currentTarget.dataset.status ?? "");
    wx.navigateTo({
      url: mpCapabilityUrl(
        "buyer.mall.orders",
        status && status !== "all" ? { status } : undefined,
      ),
    });
  },

  goCapability(event: MpTapEvent) {
    const capability = String(event.currentTarget.dataset.capability ?? "");
    if (!capability) {
      return;
    }
    wx.navigateTo({ url: mpCapabilityUrl(capability) });
  },

  goLogin() {
    wx.navigateTo({ url: mpCapabilityUrl("account.mall.login") });
  },

  logout() {
    wx.showModal({
      title: t("buyerHub.logout.title"),
      content: t("buyerHub.logout.confirm"),
      success: (result) => {
        if (result.confirm) {
          clearSession();
          this.setData({ loggedIn: false, orderEntries: resolveOrderEntries() });
        }
      },
    });
  },
});
