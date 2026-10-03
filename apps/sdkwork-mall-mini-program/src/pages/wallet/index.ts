import { errorMessage } from "../../types/common";
import {
  getWalletOverview,
  listCashLedger,
  type MpLedgerEntry,
} from "../../services/account-service";
import { formatCny } from "../../utils/format";
import { isLoggedIn } from "../../services/session";

interface LedgerRow {
  id: string;
  summary: string;
  amountText: string;
  occurredText: string;
}

interface WalletData {
  loading: boolean;
  message: string;
  cashText: string;
  pointsText: string;
  ledger: LedgerRow[];
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
    message: "",
    cashText: "--",
    pointsText: "--",
    ledger: [],
  } as WalletData,

  onShow() {
    if (!isLoggedIn()) {
      this.setData({ loading: false, message: "请先登录后查看钱包" });
      return;
    }
    void this.load();
  },

  async load() {
    this.setData({ loading: true, message: "" });
    try {
      const [overview, ledger] = await Promise.all([getWalletOverview(), listCashLedger()]);
      this.setData({
        cashText: overview.cashBalanceCny != null ? formatCny(overview.cashBalanceCny) : "--",
        pointsText: overview.pointsBalance != null ? String(overview.pointsBalance) : "--",
        ledger: toLedgerRows(ledger),
        loading: false,
      });
    } catch (cause) {
      this.setData({ loading: false, message: errorMessage(cause, "钱包加载失败") });
    }
  },
});
