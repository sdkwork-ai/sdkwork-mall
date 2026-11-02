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

interface MpMembershipPackageView extends MpMembershipPackage {
  durationText: string;
  priceText: string;
}

interface MembershipData {
  busyPackageId: number | null;
  isMember: boolean;
  loading: boolean;
  message: string;
  packages: MpMembershipPackageView[];
  status: MpMembershipStatus | null;
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
    loading: true,
    message: "",
    packages: [],
    status: null,
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
      this.setData({ loading: false, message: t("membership.loginRequired") });
      return;
    }
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
        packages: packages.map(toPackageView),
        isMember: status?.status === "active",
        loading: false,
      });
    } catch (cause) {
      this.setData({ loading: false, message: errorMessage(cause, t("membership.errors.load")) });
    }
  },

  async purchase(event: MpTapEvent) {
    const packageId = Number(event.currentTarget.dataset.id);
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
    void this.load();
  },
});
