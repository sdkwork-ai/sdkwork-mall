import { errorMessage } from "../../types/common";
import {
  getPointsSummary,
  type MpLedgerEntry,
  type MpPointsLot,
} from "../../services/account-service";
import { isLoggedIn } from "../../services/session";
import { formatCny } from "../../utils/format";

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
  message: string;
  balanceText: string;
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
    pointsText: lot.points != null ? formatCny(lot.points) : "--",
    expiresText: lot.expiresAt ? formatOccurredAt(lot.expiresAt) : "",
  }));
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
    balanceText: "--",
    lots: [],
    ledger: [],
  } as PointsData,

  onShow() {
    if (!isLoggedIn()) {
      this.setData({ loading: false, message: "请先登录后查看积分" });
      return;
    }
    void this.load();
  },

  async load() {
    this.setData({ loading: true, message: "" });
    try {
      const summary = await getPointsSummary();
      this.setData({
        balanceText: summary.balance != null ? formatCny(summary.balance) : "--",
        lots: toLotRows(summary.lots),
        ledger: toLedgerRows(summary.ledger),
        loading: false,
      });
    } catch (cause) {
      this.setData({ loading: false, message: errorMessage(cause, "积分加载失败") });
    }
  },
});
