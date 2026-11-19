import { errorMessage } from "../../types/common";
import {
  getPointsSummary,
  type MpPointsLedgerEntry,
  type MpPointsLot,
} from "../../services/account-service";
import { isLoggedIn } from "../../services/session";
import { mpCapabilityUrl } from "../../routes/capabilities";
import { formatPoints } from "../../utils/format";
import { platform } from "@sdkwork/mall-mp-core";

interface LotRow {
  id: string;
  pointsText: string;
  expiresText: string;
}

interface LedgerRow {
  id: string;
  summary: string;
  amountText: string;
  occurredText: string;
}

interface PointsData {
  loading: boolean;
  needLogin: boolean;
  message: string;
  balanceText: string;
  expiringText: string;
  lots: LotRow[];
  ledger: LedgerRow[];
}

function formatOccurredAt(iso: string): string {
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) {
    return "";
  }
  return new Date(timestamp).toLocaleDateString("zh-CN");
}

function toLotRows(lots: MpPointsLot[]): LotRow[] {
  return lots.map((lot) => ({
    id: lot.id,
    pointsText: lot.points != null ? formatPoints(lot.points) : "--",
    expiresText: lot.expiresAt ? formatOccurredAt(lot.expiresAt) : "",
  }));
}

function toLedgerRows(entries: MpPointsLedgerEntry[]): LedgerRow[] {
  return entries.map((entry) => ({
    id: entry.id,
    summary: entry.summary,
    // Points are a count: rendering them as CNY printed "¥100.00" for 100 积分.
    amountText: entry.points != null ? formatPoints(entry.points) : "",
    occurredText: formatOccurredAt(entry.occurredAt),
  }));
}

Page({
  data: {
    loading: true,
    needLogin: false,
    message: "",
    balanceText: "--",
    expiringText: "",
    lots: [],
    ledger: [],
  } as PointsData,

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
      const summary = await getPointsSummary();
      this.setData({
        balanceText: summary.balance != null ? formatPoints(summary.balance) : "--",
        expiringText:
          summary.expiringPoints != null && summary.expiringPoints > 0
            ? `即将过期 ${formatPoints(summary.expiringPoints)} 积分`
            : "",
        lots: toLotRows(summary.lots),
        ledger: toLedgerRows(summary.ledger),
        loading: false,
      });
    } catch (cause) {
      this.setData({ loading: false, message: errorMessage(cause, "积分加载失败") });
    }
  },

  goLogin() {
    platform.navigateTo(mpCapabilityUrl("account.mall.login"));
  },

  retry() {
    if (!isLoggedIn()) {
      this.goLogin();
      return;
    }
    void this.load();
  },

  onPullDownRefresh() {
    if (!isLoggedIn()) {
      platform.stopPullDownRefresh();
      return;
    }
    void this.load().finally(() => platform.stopPullDownRefresh());
  },
});
