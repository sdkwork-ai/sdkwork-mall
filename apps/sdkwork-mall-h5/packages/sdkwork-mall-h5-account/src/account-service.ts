import {
  getSdkworkAccountService,
  hasSdkworkAccountSession,
  unwrapSdkworkAccountResponse,
} from "@sdkwork/account-service";

export interface MallH5WalletOverview {
  cashBalanceCny: number | null;
  pointsBalance: number | null;
}

export interface MallH5CashLedgerEntry {
  amountCny: number | null;
  id: string;
  occurredAt?: string;
  summary: string;
}

function readMoney(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function readString(record: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value);
    }
  }
  return "";
}

export async function loadMallH5WalletOverview(): Promise<MallH5WalletOverview> {
  if (!hasSdkworkAccountSession()) {
    return { cashBalanceCny: null, pointsBalance: null };
  }
  const service = getSdkworkAccountService();
  const [cashPayload, pointsPayload] = await Promise.all([
    service.wallet.accounts.cash.retrieve().catch(() => null),
    service.wallet.accounts.points.retrieve().catch(() => null),
  ]);
  const cash = cashPayload
    ? (unwrapSdkworkAccountResponse<Record<string, unknown>>(cashPayload) ?? {})
    : {};
  const points = pointsPayload
    ? (unwrapSdkworkAccountResponse<Record<string, unknown>>(pointsPayload) ?? {})
    : {};
  return {
    cashBalanceCny: readMoney(cash.balanceCny ?? cash.balance ?? cash.availableAmount),
    pointsBalance: readMoney(points.balance ?? points.pointsBalance ?? points.availablePoints),
  };
}

export async function loadMallH5CashLedger(): Promise<MallH5CashLedgerEntry[]> {
  if (!hasSdkworkAccountSession()) {
    return [];
  }
  const payload = unwrapSdkworkAccountResponse<{ content?: Record<string, unknown>[] } | null>(
    await getSdkworkAccountService()
      .wallet.ledgerEntries.cash.list({
        pageNum: 1,
        pageSize: 20,
        sortDirection: "desc",
        sortField: "createdAt",
      })
      .catch(() => null),
  ) ?? {};
  const rows = payload.content ?? [];
  return rows.map((row, index) => ({
    amountCny: readMoney(row.amountCny ?? row.amount ?? row.changeAmount),
    id: readString(row, ["id", "entryId", "ledgerEntryId"]) || `entry-${index + 1}`,
    occurredAt: readString(row, ["occurredAt", "createdAt", "entryTime"]) || undefined,
    summary: readString(row, ["summary", "title", "remark", "reason", "type"]) || "钱包变动",
  }));
}

export interface MallH5PointsSummary {
  balance: number | null;
  lots: Array<{ id: string; points: number | null; expiresAt?: string }>;
}

export async function loadMallH5Points(): Promise<MallH5PointsSummary> {
  if (!hasSdkworkAccountSession()) {
    return { balance: null, lots: [] };
  }
  const service = getSdkworkAccountService();
  const [summaryPayload, lotsPayload] = await Promise.all([
    service.wallet.points.summary.retrieve().catch(() => null),
    service.wallet.points.lots.list({ pageNum: 1, pageSize: 20 }).catch(() => null),
  ]);
  const summary = summaryPayload
    ? (unwrapSdkworkAccountResponse<Record<string, unknown>>(summaryPayload) ?? {})
    : {};
  const lotsPage = lotsPayload
    ? (unwrapSdkworkAccountResponse<{ items?: Record<string, unknown>[]; content?: Record<string, unknown>[] } | null>(lotsPayload) ?? {})
    : {};
  const rows = lotsPage.items ?? lotsPage.content ?? [];
  return {
    balance: readMoney(summary.balance ?? summary.availablePoints ?? summary.totalPoints),
    lots: rows.map((row, index) => ({
      id: readString(row, ["id", "lotId"]) || `lot-${index + 1}`,
      points: readMoney(row.points ?? row.availablePoints ?? row.remainingPoints),
      expiresAt: readString(row, ["expiresAt", "expireTime", "expiredAt"]) || undefined,
    })),
  };
}
