/**
 * Distribution (分销) presentation helpers shared by the partner page.
 *
 * The data plane is the partner capability (`partner_center`, `team`,
 * `commissions`); this module only turns it into the two-level distribution
 * language the storefront shows: earnings summary, level labels, team tabs and
 * share paths that carry the partner's invite code.
 */
import { mpCapabilityUrl } from "../routes/capabilities";
import { formatCny } from "../utils/format";
import type { MpProductCard } from "./catalog-service";
import type { MpPartnerCenter, MpPartnerTeamMember } from "./partner-service";

export interface DistributionEarnings {
  totalText: string;
  availableText: string;
  frozenText: string;
  withdrawnText: string;
}

export type DistributionTeamTab = "all" | "direct" | "second";

export interface DistributionShareProduct {
  id: string;
  title: string;
  priceText: string;
  imageUrl: string;
  path: string;
}

function money(value: string): string {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? formatCny(parsed) : "—";
}

/** Commission ledger summary shown as the distribution hero. */
export function summarizeEarnings(center: MpPartnerCenter): DistributionEarnings {
  return {
    availableText: money(center.availableBalance),
    frozenText: money(center.frozenBalance),
    totalText: money(center.totalCommission),
    withdrawnText: money(center.withdrawnAmount),
  };
}

/** One level per depth: 0 is the partner's own customer chain entry (一级). */
export function teamDepthLabel(depth: number): string {
  if (depth <= 1) {
    return "一级";
  }
  if (depth === 2) {
    return "二级";
  }
  return `${depth} 级`;
}

/** Commission record level offset → buyer-facing label. */
export function commissionLevelLabel(levelOffset: number): string {
  if (levelOffset <= 0) {
    return "一级佣金";
  }
  if (levelOffset === 1) {
    return "二级佣金";
  }
  return `${levelOffset + 1} 级佣金`;
}

/** Tab filter over the loaded team page (server pages the whole chain). */
export function filterTeamByTab<T extends { depth: number }>(
  members: T[],
  tab: DistributionTeamTab,
): T[] {
  if (tab === "direct") {
    return members.filter((member) => member.depth <= 1);
  }
  if (tab === "second") {
    return members.filter((member) => member.depth === 2);
  }
  return members;
}

export function countTeamLevels(members: MpPartnerTeamMember[]): { direct: number; second: number } {
  return {
    direct: members.filter((member) => member.depth <= 1).length,
    second: members.filter((member) => member.depth === 2).length,
  };
}

/** Invite path; the invitee sees the partner page with the code pre-filled. */
export function buildInviteSharePath(inviteCode: string): string {
  return mpCapabilityUrl("buyer.mall.distribution", inviteCode ? { invite: inviteCode } : undefined);
}

/** Product share path; the invite code attributes the order to this partner. */
export function buildProductSharePath(productId: string, inviteCode: string): string {
  return mpCapabilityUrl("storefront.mall.product-detail", {
    ...(productId ? { id: productId } : {}),
    ...(inviteCode ? { invite: inviteCode } : {}),
  });
}

export function toShareProduct(product: MpProductCard, inviteCode: string): DistributionShareProduct {
  return {
    id: product.id,
    imageUrl: product.imageUrl ?? "",
    path: buildProductSharePath(product.id, inviteCode),
    priceText: product.priceCny == null ? "—" : formatCny(product.priceCny),
    title: product.title ?? "",
  };
}
