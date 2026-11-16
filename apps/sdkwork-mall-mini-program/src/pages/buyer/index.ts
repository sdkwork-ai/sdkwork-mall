import { t } from "../../i18n";
import { type MpTapEvent } from "../../types/common";
import { mpCapabilityUrl } from "../../routes/capabilities";
import { getOrderStatistics } from "../../services/order-service";
import { getProfile } from "../../services/profile-service";
import { isLoggedIn, clearSession } from "../../services/session";
import { platform } from "@sdkwork/mall-mp-core";

const ORDER_ENTRIES: Array<{ status: string; labelKey: string; icon: string; count: string | number }> = [
  { status: "all", labelKey: "buyerHub.orders.all", icon: "box", count: "" },
  { status: "PENDING_PAYMENT", labelKey: "buyerHub.orders.pendingPayment", icon: "wallet", count: "" },
  { status: "PENDING_SHIPMENT", labelKey: "buyerHub.orders.pendingShipment", icon: "package", count: "" },
  { status: "PENDING_RECEIPT", labelKey: "buyerHub.orders.pendingReceipt", icon: "truck", count: "" },
  { status: "COMPLETED", labelKey: "buyerHub.orders.completed", icon: "check", count: "" },
];

/**
 * 买家中心入口一律按能力路由 id 声明，页面路径由
 * `routes/capabilities.ts` 统一解析：改页面路径只需改注册表，
 * 且与 PC / H5 / Flutter 共用同一套 route id。
 */
const ASSET_LINKS: Array<{ labelKey: string; capability: string; icon: string }> = [
  { labelKey: "buyerHub.assets.wallet", capability: "buyer.mall.wallet", icon: "wallet" },
  { labelKey: "buyerHub.assets.points", capability: "buyer.mall.points", icon: "star" },
  { labelKey: "buyerHub.assets.membership", capability: "buyer.mall.membership", icon: "crown" },
];

const QUICK_LINKS: Array<{ labelKey: string; capability: string; icon: string }> = [
  { labelKey: "buyerHub.services.favorites", capability: "buyer.mall.favorites", icon: "heart" },
  { labelKey: "buyerHub.services.footprint", capability: "buyer.mall.footprint", icon: "clock" },
  { labelKey: "buyerHub.services.addresses", capability: "buyer.mall.addresses", icon: "pin" },
  { labelKey: "buyerHub.services.coupons", capability: "buyer.mall.coupons", icon: "ticket" },
  { labelKey: "buyerHub.services.afterSales", capability: "buyer.mall.after-sales", icon: "file" },
  { labelKey: "buyerHub.services.invoices", capability: "buyer.mall.invoices", icon: "receipt" },
  { labelKey: "buyerHub.services.messages", capability: "buyer.mall.messages", icon: "chat" },
  { labelKey: "buyerHub.services.chats", capability: "buyer.mall.im.chats", icon: "headset" },
];

/** 账户区入口（含设置）同样走能力路由。 */
const ACCOUNT_LINKS: Array<{ labelKey: string; capability: string }> = [
  { labelKey: "buyerHub.account.profile", capability: "buyer.mall.profile" },
  { labelKey: "buyerHub.account.partner", capability: "buyer.mall.distribution" },
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
  displayName: string;
  /** First character of the display name, rendered in the avatar circle. */
  avatarText: string;
  orderEntries: Array<{ status: string; label: string; icon: string; count: string | number }>;
  assetLinks: Array<{ label: string; capability: string; icon: string }>;
  quickLinks: Array<{ label: string; capability: string; icon: string }>;
  accountLinks: Array<{ label: string; capability: string }>;
  otherLinks: Array<{ label: string; capability: string; icon: string }>;
}

function resolveOrderEntries(
  counts?: (status: string) => string | number,
): BuyerData["orderEntries"] {
  return ORDER_ENTRIES.map((entry) => ({
    status: entry.status,
    label: t(entry.labelKey),
    icon: entry.icon,
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
    displayName: t("buyerHub.userFallback"),
    avatarText: t("buyerHub.userFallback").slice(0, 1),
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
      void this.loadStatistics();
      void this.loadProfile();
    }
  },

  /**
   * Identity hero: the H5 buyer hub greets the signed-in account by name.
   *
   * Fail-soft: a profile lookup failure keeps the fallback label instead of
   * turning the hub into an error page.
   */
  async loadProfile() {
    try {
      const profile = await getProfile();
      const displayName = profile.displayName || t("buyerHub.userFallback");
      this.setData({ displayName, avatarText: displayName.slice(0, 1) });
    } catch {
      // keep the fallback identity
    }
  },

  onPullDownRefresh() {
    if (!isLoggedIn()) {
      platform.stopPullDownRefresh();
      return;
    }
    void this.loadStatistics().finally(() => platform.stopPullDownRefresh());
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
    platform.navigateTo(mpCapabilityUrl(
        "buyer.mall.orders",
        status && status !== "all" ? { status } : undefined,
      ));
  },

  goCapability(event: MpTapEvent) {
    const capability = String(event.currentTarget.dataset.capability ?? "");
    if (!capability) {
      return;
    }
    platform.navigateTo(mpCapabilityUrl(capability));
  },

  goLogin() {
    platform.navigateTo(mpCapabilityUrl("account.mall.login"));
  },

  async logout() {
    const confirmed = await platform.confirm({
      title: t("buyerHub.logout.title"),
      content: t("buyerHub.logout.confirm"),
    });
    if (!confirmed) {
      return;
    }
    clearSession();
    this.setData({ loggedIn: false, orderEntries: resolveOrderEntries() });
  },
});
