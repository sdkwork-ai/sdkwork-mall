/**
 * Account assets: wallet, points, and membership.
 *
 * Wire contract (app-api, `SdkWorkApiResponse` envelope unwrapped by the
 * transport): item reads return `data.item`, list reads return
 * `data.items` + `data.pageInfo`. Pagination follows PAGINATION_SPEC
 * (`page` / `page_size`), default page size 20.
 */
import { request } from "./transport";
import { asNumber, asRecord, asRecordList, asString, type MpRecord } from "../types/common";

const PAGE_SIZE = 20;

export interface MpWalletOverview {
  cashBalanceCny: number | null;
  pointsBalance: number | null;
}

export interface MpLedgerEntry {
  id: string;
  summary: string;
  amountCny: number | null;
  occurredAt: string;
}

export interface MpPointsLot {
  id: string;
  points: number | null;
  expiresAt: string;
}

export interface MpPointsSummary {
  balance: number | null;
  lots: MpPointsLot[];
  ledger: MpLedgerEntry[];
}

export interface MpMembershipStatus {
  levelName: string;
  status: string;
}

export interface MpMembershipPlan {
  id: string;
  title: string;
}

function pageItems(payload: MpRecord): MpRecord[] {
  return asRecordList(payload.items);
}

export async function getWalletOverview(): Promise<MpWalletOverview> {
  const [cash, points] = await Promise.all([
    request({ path: "/wallet/accounts/cash" }).catch(() => ({}) as MpRecord),
    request({ path: "/wallet/accounts/points" }).catch(() => ({}) as MpRecord),
  ]);
  return {
    cashBalanceCny: asNumber(cash, ["balanceCny", "balance", "availableAmount"]),
    pointsBalance: asNumber(points, ["balance", "pointsBalance", "availablePoints"]),
  };
}

export async function listCashLedger(): Promise<MpLedgerEntry[]> {
  const payload = await request({
    path: "/wallet/ledger_entries/cash",
    query: { page: 1, page_size: PAGE_SIZE },
  }).catch(() => ({}) as MpRecord);
  return pageItems(payload).map((row, index) => ({
    id: asString(row, ["id", "entryId", "ledgerEntryId"]) || `entry-${index + 1}`,
    summary: asString(row, ["summary", "title", "remark", "reason", "type"], "钱包变动"),
    amountCny: asNumber(row, ["amountCny", "amount", "changeAmount"]),
    occurredAt: asString(row, ["occurredAt", "createdAt", "entryTime"]),
  }));
}

export async function getPointsSummary(): Promise<MpPointsSummary> {
  const [summary, lotsPage, ledgerPage] = await Promise.all([
    request({ path: "/wallet/points/summary" }).catch(() => ({}) as MpRecord),
    request({
      path: "/wallet/points/lots",
      query: { page: 1, page_size: PAGE_SIZE },
    }).catch(() => ({}) as MpRecord),
    request({
      path: "/wallet/ledger_entries/points",
      query: { page: 1, page_size: PAGE_SIZE },
    }).catch(() => ({}) as MpRecord),
  ]);
  return {
    balance: asNumber(summary, ["balance", "availablePoints", "totalPoints"]),
    lots: pageItems(lotsPage).map((row, index) => ({
      id: asString(row, ["id", "lotId"]) || `lot-${index + 1}`,
      points: asNumber(row, ["points", "availablePoints", "remainingPoints"]),
      expiresAt: asString(row, ["expiresAt", "expireTime", "expiredAt"]),
    })),
    ledger: pageItems(ledgerPage).map((row, index) => ({
      id: asString(row, ["id", "entryId", "ledgerEntryId"]) || `point-entry-${index + 1}`,
      summary: asString(row, ["summary", "title", "remark", "reason", "type"], "积分变动"),
      amountCny: asNumber(row, ["points", "amountCny", "amount", "changeAmount"]),
      occurredAt: asString(row, ["occurredAt", "createdAt", "entryTime"]),
    })),
  };
}

export async function getMembershipStatus(): Promise<MpMembershipStatus | null> {
  const status = await request({ path: "/memberships/current/status" }).catch(() => ({}) as MpRecord);
  if (!asString(status, ["levelName", "level", "status", "statusName"])) {
    return null;
  }
  return {
    levelName: asString(status, ["levelName", "level"], "普通会员"),
    status: asString(status, ["status", "statusName"], "active"),
  };
}

export async function listMembershipPlans(): Promise<MpMembershipPlan[]> {
  const payload = await request({
    path: "/memberships/plans",
    query: { page: 1, page_size: PAGE_SIZE },
  }).catch(() => ({}) as MpRecord);
  return pageItems(payload).map((row, index) => ({
    id: asString(asRecord(row), ["id", "planId"]) || `plan-${index + 1}`,
    title: asString(asRecord(row), ["title", "name", "levelName"], `会员方案 ${index + 1}`),
  }));
}
