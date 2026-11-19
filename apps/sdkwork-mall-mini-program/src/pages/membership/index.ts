import { t } from "../../i18n";
import { errorMessage, type MpTapEvent } from "../../types/common";
import {
  getMembershipStatus,
  listMembershipPackages,
  purchaseMembership,
  type MpMembershipPackage,
  type MpMembershipStatus,
} from "../../services/account-service";
import { listPaymentMethods } from "../../services/cart-service";
import { isLoggedIn } from "../../services/session";
import { formatCny } from "../../utils/format";
import { platform } from "@sdkwork/mall-mp-core";
import { mpCapabilityUrl } from "../../routes/capabilities";

interface MpMembershipPackageView extends MpMembershipPackage {
  durationText: string;
  priceText: string;
}

interface MembershipData {
  busyPackageId: string | null;
  isMember: boolean;
  needLogin: boolean;
  /** Static benefit tiles shown above the packages (parity with the H5 page). */
  benefits: Array<{ id: string; label: string }>;
  loading: boolean;
  message: string;
  packages: MpMembershipPackageView[];
  status: MpMembershipStatus | null;
  /** Localized "状态：会员/普通会员" line. */
  statusLabel: string;
  title: string;
  loadingText: string;
  retryText: string;
  levelLabel: string;
  defaultLevel: string;
  plansTitle: string;
  plansEmpty: string;
  openText: string;
  renewText: string;
  openingText: string;
}

function toPackageView(pkg: MpMembershipPackage): MpMembershipPackageView {
  return {
    ...pkg,
    durationText:
      pkg.durationDays != null
        ? t("membership.plans.duration", { days: pkg.durationDays })
        : "",
    priceText: formatCny(pkg.priceCny),
  };
}

Page({
  data: {
    busyPackageId: null,
    isMember: false,
    needLogin: false,
    benefits: [
      { id: "price", label: t("membership.benefits.price") },
      { id: "points", label: t("membership.benefits.points") },
      { id: "support", label: t("membership.benefits.support") },
      { id: "afterSales", label: t("membership.benefits.afterSales") },
    ],
    loading: true,
    message: "",
    packages: [],
    status: null,
    statusLabel: "",
    title: t("membership.title"),
    loadingText: t("membership.loading"),
    retryText: t("membership.retry"),
    levelLabel: t("membership.levelLabel"),
    defaultLevel: t("membership.defaultLevel"),
    plansTitle: t("membership.plans.title"),
    plansEmpty: t("membership.plans.empty"),
    openText: t("membership.plans.open"),
    renewText: t("membership.plans.renew"),
    openingText: t("membership.plans.opening"),
  } as MembershipData,

  onShow() {
    if (!isLoggedIn()) {
      this.setData({ loading: false, needLogin: true, message: "" });
      return;
    }
    this.setData({ needLogin: false });
    void this.load();
  },

  async load() {
    this.setData({ loading: true, message: "" });
    try {
      const [status, packages] = await Promise.all([
        getMembershipStatus(),
        listMembershipPackages(),
      ]);
      this.setData({
        status,
        statusLabel: status
          ? t("membership.statusLabel", {
              status: status.status === "active" ? t("membership.status.active") : t("membership.status.free"),
            })
          : "",
        packages: packages.map(toPackageView),
        isMember: status?.status === "active",
        loading: false,
      });
    } catch (cause) {
      this.setData({ loading: false, message: errorMessage(cause, t("membership.errors.load")) });
    }
  },

  async purchase(event: MpTapEvent) {
    const packageId = String(event.currentTarget.dataset.id ?? "");
    if (!packageId || this.data.busyPackageId !== null) {
      return;
    }
    this.setData({ busyPackageId: packageId, message: "" });
    try {
      // The membership service charges the selected channel server-side; the
      // client only names the channel it wants to pay with.
      const methods = await listPaymentMethods().catch(() => []);
      const paymentMethod = methods[0]?.code;
      if (!paymentMethod) {
        this.setData({ message: t("membership.plans.payFailed") });
        return;
      }
      const result = await purchaseMembership({ packageId, paymentMethod });
      if (result.status === "completed") {
        this.setData({ message: t("membership.plans.success") });
        await this.load();
        return;
      }
      this.setData({
        message:
          result.status === "pending"
            ? t("membership.plans.pending")
            : t("membership.plans.failed"),
      });
    } catch (cause) {
      this.setData({ message: errorMessage(cause, t("membership.plans.failed")) });
    } finally {
      this.setData({ busyPackageId: null });
    }
  },

  retry() {
    if (!isLoggedIn()) {
      this.goLogin();
      return;
    }
    void this.load();
  },

  goLogin() {
    platform.navigateTo(mpCapabilityUrl("account.mall.login"));
  },

  onPullDownRefresh() {
    void this.load().finally(() => platform.stopPullDownRefresh());
  },
});
