import { errorMessage } from "../../types/common";
import {
  getWalletOverview,
  listCashLedger,
  type MpLedgerEntry,
} from "../../services/account-service";
import { formatCny, formatPoints } from "../../utils/format";
import { isLoggedIn } from "../../services/session";
import { mpCapabilityUrl } from "../../routes/capabilities";
import { platform } from "@sdkwork/mall-mp-core";

interface LedgerRow {
  id: string;
  summary: string;
  amountText: string;
  occurredText: string;
}

interface WalletData {
  loading: boolean;
  loadingMore: boolean;
  needLogin: boolean;
  message: string;
  cashText: string;
  pointsText: string;
  ledger: LedgerRow[];
  hasMore: boolean;
  _page: number;
}

function formatOccurredAt(iso: string): string {
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) {
    return "";
  }
  return new Date(timestamp).toLocaleString("zh-CN");
}

function toLedgerRows(entries: MpLedgerEntry[]): LedgerRow[] {
  return entries.map((entry) => ({
    id: entry.id,
    summary: entry.summary,
    amountText: entry.amountCny != null ? formatCny(entry.amountCny) : "",
    occurredText: formatOccurredAt(entry.occurredAt),
  }));
}

Page({
  data: {
    loading: true,
    loadingMore: false,
    needLogin: false,
    message: "",
    cashText: "--",
    pointsText: "--",
    ledger: [],
    hasMore: true,
    _page: 0,
  } as WalletData,

  onShow() {
    if (!isLoggedIn()) {
      this.setData({ loading: false, needLogin: true, message: "" });
      return;
    }
    this.setData({ needLogin: false });
    void this.load();
  },

  onReachBottom() {
    void this.loadMore();
  },

  async load() {
    this.setData({ loading: true, message: "", _page: 0, hasMore: true });
    try {
      const [overview, ledger] = await Promise.all([getWalletOverview(), listCashLedger(1)]);
      this.setData({
        cashText: overview.cashBalanceCny != null ? formatCny(overview.cashBalanceCny) : "--",
        pointsText: overview.pointsBalance != null ? formatPoints(overview.pointsBalance) : "--",
        ledger: toLedgerRows(ledger.items),
        hasMore: ledger.hasMore,
        _page: 1,
        loading: false,
      });
    } catch (cause) {
      this.setData({ loading: false, message: errorMessage(cause, "钱包加载失败") });
    }
  },

  async loadMore() {
    if (this.data.loading || this.data.loadingMore || !this.data.hasMore) {
      return;
    }
    const nextPage = this.data._page + 1;
    this.setData({ loadingMore: true });
    try {
      const ledger = await listCashLedger(nextPage);
      const seen = new Set(this.data.ledger.map((row) => row.id));
      const appended = toLedgerRows(ledger.items).filter((row) => !seen.has(row.id));
      this.setData({
        ledger: this.data.ledger.concat(appended),
        hasMore: ledger.hasMore,
        _page: nextPage,
        loadingMore: false,
      });
    } catch (cause) {
      this.setData({ loadingMore: false });
      platform.toast(errorMessage(cause, "流水加载失败"), "none");
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
