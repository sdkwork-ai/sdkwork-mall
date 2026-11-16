/**
 * Account assets: wallet, points, and membership.
 *
 * Authority: `TECH-BLOCK-INTEGRATION.md` (wallet / memberships rows). Balances,
 * ledger entries, points and the membership catalogue belong to the mall commerce
 * block (`runtime.commerceClient.wallet` / `.memberships`); this module projects
 * them onto the existing view models and owns no wire path.
 *
 * The block exposes no per-lot points reader: the wallet settles points as a
 * balance plus ledger entries (`/wallet/accounts/points`,
 * `/wallet/ledger_entries/points`), so `lots` stays empty rather than being
 * re-derived from a hand-written endpoint.
 */
import { getMallMpRuntime } from "@sdkwork/mall-mp-core";

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

/** A purchasable membership package (`memberships.packages.list`). */
export interface MpMembershipPackage {
  description: string;
  durationDays: number | null;
  id: number;
  name: string;
  priceCny: number | null;
  recommended: boolean;
}

export interface MpMembershipPurchaseResult {
  orderId?: string;
  status: "completed" | "failed" | "pending";
}

function commerce() {
  return getMallMpRuntime().commerceClient;
}

async function readCommerceData(call: Promise<unknown>): Promise<MpRecord> {
  const result = (await call) as { data?: unknown } | null | undefined;
  const data = result && typeof result === "object" ? result.data : undefined;
  return (data && typeof data === "object" ? data : {}) as MpRecord;
}

function pageItems(payload: MpRecord): MpRecord[] {
  return asRecordList(payload.items);
}

export async function getWalletOverview(): Promise<MpWalletOverview> {
  const [cash, points] = await Promise.all([
    readCommerceData(commerce().wallet.accounts.retrieve("cash")).catch(() => ({}) as MpRecord),
    readCommerceData(commerce().wallet.accounts.points.retrieve()).catch(() => ({}) as MpRecord),
  ]);
  return {
    cashBalanceCny: asNumber(cash, ["balanceCny", "balance", "availableAmount"]),
    pointsBalance: asNumber(points, ["balance", "pointsBalance", "availablePoints"]),
  };
}

export async function listCashLedger(): Promise<MpLedgerEntry[]> {
  const payload = await readCommerceData(
    commerce().wallet.ledgerEntries.list({ page: 1, pageSize: PAGE_SIZE }),
  ).catch(() => ({}) as MpRecord);
  return pageItems(payload).map((row, index) => ({
    id: asString(row, ["id", "entryId", "ledgerEntryId"]) || `entry-${index + 1}`,
    summary: asString(row, ["summary", "title", "remark", "reason", "type"], "钱包变动"),
    amountCny: asNumber(row, ["amountCny", "amount", "changeAmount"]),
    occurredAt: asString(row, ["occurredAt", "createdAt", "entryTime"]),
  }));
}

export async function getPointsSummary(): Promise<MpPointsSummary> {
  const [summary, ledgerPage] = await Promise.all([
    readCommerceData(commerce().wallet.accounts.points.retrieve()).catch(() => ({}) as MpRecord),
    readCommerceData(
      commerce().wallet.ledgerEntries.points.list({ page: 1, pageSize: PAGE_SIZE }),
    ).catch(() => ({}) as MpRecord),
  ]);
  return {
    balance: asNumber(summary, ["balance", "availablePoints", "totalPoints"]),
    // The commerce block settles points as one balance plus ledger entries; there
    // is no per-lot reader to project.
    lots: [],
    ledger: pageItems(ledgerPage).map((row, index) => ({
      id: asString(row, ["id", "entryId", "ledgerEntryId"]) || `point-entry-${index + 1}`,
      summary: asString(row, ["summary", "title", "remark", "reason", "type"], "积分变动"),
      amountCny: asNumber(row, ["points", "amountCny", "amount", "changeAmount"]),
      occurredAt: asString(row, ["occurredAt", "createdAt", "entryTime"]),
    })),
  };
}

export async function getMembershipStatus(): Promise<MpMembershipStatus | null> {
  const status = await readCommerceData(
    commerce().memberships.current.status.retrieve(),
  ).catch(() => ({}) as MpRecord);
  if (!asString(status, ["levelName", "level", "status", "statusName"])) {
    return null;
  }
  return {
    levelName: asString(status, ["levelName", "level"], "普通会员"),
    status: asString(status, ["status", "statusName"], "active"),
  };
}

export async function listMembershipPlans(): Promise<MpMembershipPlan[]> {
  const payload = await readCommerceData(
    commerce().memberships.plans.list({}),
  ).catch(() => ({}) as MpRecord);
  return pageItems(payload).map((row, index) => ({
    id: asString(asRecord(row), ["id", "planId"]) || `plan-${index + 1}`,
    title: asString(asRecord(row), ["title", "name", "levelName"], `会员方案 ${index + 1}`),
  }));
}

/** Purchasable packages; public data, so a guest still sees the catalogue. */
export async function listMembershipPackages(): Promise<MpMembershipPackage[]> {
  const payload = await readCommerceData(
    commerce().memberships.packages.list({}),
  ).catch(() => ({}) as MpRecord);
  return pageItems(payload).map((row, index) => {
    const record = asRecord(row);
    return {
      description: asString(record, ["description"]),
      durationDays: asNumber(record, ["durationDays"]),
      id: asNumber(record, ["id"]) ?? index + 1,
      name: asString(record, ["name"], `#${index + 1}`),
      priceCny: asNumber(record, ["price"]),
      recommended: Boolean(record.recommended),
    };
  });
}

/**
 * Charges a membership package. The membership service performs the payment
 * server-side and returns the resulting status; the client only names the
 * channel it wants to pay with.
 */
export async function purchaseMembership(input: {
  packageId: number;
  paymentMethod?: string;
}): Promise<MpMembershipPurchaseResult> {
  const payload = await readCommerceData(commerce().memberships.purchases.create({
    packageId: input.packageId,
    paymentMethod: input.paymentMethod,
  }));
  const record = asRecord(payload);
  const raw = asString(record, ["status"]).toLowerCase();
  return {
    orderId: asString(record, ["orderId"]) || undefined,
    status: raw.includes("complete") ? "completed" : raw.includes("pending") ? "pending" : "failed",
  };
}
