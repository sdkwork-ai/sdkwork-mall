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
import { readCommercePayload } from "./commerce-payload";
import { readPageInfo } from "./page-info";

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

/** A points-ledger row: points are a count, never CNY. */
export interface MpPointsLedgerEntry {
  id: string;
  summary: string;
  points: number | null;
  occurredAt: string;
}

export interface MpPointsLot {
  id: string;
  points: number | null;
  expiresAt: string;
}

export interface MpPointsSummary {
  balance: number | null;
  /** Points expiring soon, when the account document states them. */
  expiringPoints: number | null;
  lots: MpPointsLot[];
  ledger: MpPointsLedgerEntry[];
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
  /** Wire id (int64); kept as a string so large ids never round. */
  id: string;
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

function pageItems(payload: MpRecord): MpRecord[] {
  return asRecordList(payload.items);
}

/** A ledger row is signed by its `direction`; the wire amount is positive. */
function readSignedAmount(row: MpRecord, keys: readonly string[]): number | null {
  const amount = asNumber(row, keys);
  if (amount == null) {
    return null;
  }
  const direction = asString(row, ["direction", "drCr", "dcFlag"]).toLowerCase();
  if (direction === "debit" || direction === "d" || direction === "expense") {
    return -Math.abs(amount);
  }
  if (direction === "credit" || direction === "c" || direction === "income") {
    return Math.abs(amount);
  }
  return amount;
}

export async function getWalletOverview(): Promise<MpWalletOverview> {
  // Failures must reach the page: swallowing them rendered "--" balances and an
  // empty ledger as if the account really held nothing.
  const [cash, points] = await Promise.all([
    readCommercePayload(commerce().wallet.accounts.retrieve("cash")),
    readCommercePayload(commerce().wallet.accounts.points.retrieve()),
  ]);
  return {
    cashBalanceCny: asNumber(cash, ["balanceCny", "balance", "availableAmount"]),
    pointsBalance: asNumber(points, ["balance", "pointsBalance", "availablePoints"]),
  };
}

export async function listCashLedger(page = 1): Promise<{ hasMore: boolean; items: MpLedgerEntry[] }> {
  const payload = await readCommercePayload(
    commerce().wallet.ledgerEntries.list({ page, pageSize: PAGE_SIZE }),
  );
  const rows = pageItems(payload)
    // The unfiltered ledger mixes points and token entries; the cash ledger must
    // not print those as CNY. When the asset type is absent the row is kept.
    .filter((row) => {
      const assetType = asString(row, ["assetType", "asset_type"]).toLowerCase();
      return !assetType || assetType === "cash";
    });
  return {
    hasMore: readPageInfo(payload, rows.length, page).hasMore,
    items: rows.map((row, index) => ({
      id: asString(row, ["id", "entryId", "ledgerEntryId"]) || `entry-${index + 1}`,
      summary: asString(row, ["summary", "title", "remark", "reason", "type"], "钱包变动"),
      amountCny: readSignedAmount(row, ["amountCny", "amount", "changeAmount"]),
      occurredAt: asString(row, ["occurredAt", "createdAt", "entryTime"]),
    })),
  };
}

export async function getPointsSummary(): Promise<MpPointsSummary> {
  const [summary, ledgerPage] = await Promise.all([
    readCommercePayload(commerce().wallet.accounts.points.retrieve()),
    readCommercePayload(
      commerce().wallet.ledgerEntries.points.list({ page: 1, pageSize: PAGE_SIZE }),
    ),
  ]);
  return {
    balance: asNumber(summary, ["balance", "availablePoints", "totalPoints"]),
    expiringPoints: asNumber(summary, ["expiringPoints", "expiringAmount", "expireSoonPoints"]),
    // The commerce block settles points as one balance plus ledger entries; there
    // is no per-lot reader to project.
    lots: [],
    ledger: pageItems(ledgerPage).map((row, index) => ({
      id: asString(row, ["id", "entryId", "ledgerEntryId"]) || `point-entry-${index + 1}`,
      summary: asString(row, ["summary", "title", "remark", "reason", "type"], "积分变动"),
      points: readSignedAmount(row, ["points", "amount", "changeAmount"]),
      occurredAt: asString(row, ["occurredAt", "createdAt", "entryTime"]),
    })),
  };
}

export async function getMembershipStatus(): Promise<MpMembershipStatus | null> {
  // The status document carries `active`; the plan/level name lives on the
  // membership summary (`planName`). Reading `levelName`/`status` off the status
  // document always missed and every member rendered as 普通会员.
  const [status, summary] = await Promise.all([
    readCommercePayload(commerce().memberships.current.status.retrieve()),
    readCommercePayload(commerce().memberships.current.retrieve()).catch(() => ({}) as MpRecord),
  ]);
  const active =
    status.active === true || String(status.status ?? "").toUpperCase() === "ACTIVE";
  const levelName = asString(summary, ["planName", "levelName", "planTitle", "name"]);
  if (!active && !levelName) {
    return null;
  }
  return {
    levelName: levelName || "会员",
    status: active ? "active" : "free",
  };
}

export async function listMembershipPlans(): Promise<MpMembershipPlan[]> {
  const payload = await readCommercePayload(
    commerce().memberships.plans.list({}),
  );
  return pageItems(payload).map((row, index) => ({
    id: asString(asRecord(row), ["id", "planId"]) || `plan-${index + 1}`,
    title: asString(asRecord(row), ["title", "name", "levelName"], `会员方案 ${index + 1}`),
  }));
}

/** Purchasable packages; public data, so a guest still sees the catalogue. */
export async function listMembershipPackages(): Promise<MpMembershipPackage[]> {
  const payload = await readCommercePayload(
    commerce().memberships.packages.list({}),
  );
  return pageItems(payload).map((row, index) => {
    const record = asRecord(row);
    return {
      description: asString(record, ["description"]),
      durationDays: asNumber(record, ["durationDays"]),
      id: asString(record, ["id", "packageId"]) || `package-${index + 1}`,
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
  /** Wire id (int64); sent back as the string the server issued. */
  packageId: string;
  paymentMethod?: string;
}): Promise<MpMembershipPurchaseResult> {
  const payload = await readCommercePayload(commerce().memberships.purchases.create({
    packageId: input.packageId,
    paymentMethod: input.paymentMethod,
  }));
  const record = asRecord(payload);
  const raw = asString(record, ["status"]).toUpperCase();
  // Canonical terminal statuses (H5/PC membership service mapping): a charged
  // order reported as PAID/SUCCESS must not be shown as "开通失败".
  const status =
    raw === "SUCCESS" || raw === "COMPLETED" || raw === "PAID" || raw === "ACTIVE"
      ? "completed"
      : raw === "FAILED" || raw === "REJECTED" || raw === "CANCELLED" || raw === "CLOSED" || raw === "EXPIRED"
        ? "failed"
        : "pending";
  return {
    orderId: asString(record, ["orderId"]) || undefined,
    status,
  };
}
