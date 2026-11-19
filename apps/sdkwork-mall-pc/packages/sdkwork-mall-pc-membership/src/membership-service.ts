import {
  getSdkworkMembershipService,
  hasSdkworkMembershipSession,
  requireSdkworkMembershipSession,
  toNullableSdkworkMembershipNumber,
  toSdkworkMembershipMutationStatus,
  toSdkworkMembershipNumber,
  toSdkworkMembershipOptionalString,
  unwrapSdkworkMembershipPageItems,
  unwrapSdkworkMembershipResponse,
  readSdkworkMediaResource,
  type SdkworkMembershipAppService,
  type SdkworkMediaResource,
} from "@sdkwork/membership-service";
import {
  createSdkworkMembershipMessages,
  type SdkworkMembershipMessages,
  type SdkworkMembershipMessagesOverrides,
} from "./membership-copy";

export interface SdkworkMembershipBenefit {
  benefitKey?: string;
  claimed: boolean;
  description?: string;
  id: string;
  name: string;
  type?: string;
  usageLimit: number | null;
  usedCount: number | null;
}

export interface SdkworkMembershipLevel {
  badge?: string;
  description?: string;
  icon?: SdkworkMediaResource;
  id: string;
  isCurrent: boolean;
  levelValue: number;
  name: string;
  requiredPoints: number | null;
}

export interface SdkworkMembershipPlan {
  description?: string;
  durationDays: number | null;
  id: string;
  includedPoints: number;
  levelName?: string;
  name: string;
  originalPriceCny: number | null;
  packageId: number;
  priceCny: number;
  recommended: boolean;
  tags: string[];
}

export interface SdkworkMembershipSummary {
  currentLevelName: string;
  currentLevelValue: number | null;
  expireTime?: string;
  growthValue: number | null;
  isAuthenticated: boolean;
  isMember: boolean;
  pointBalance: number | null;
  points: number | null;
  remainingDays: number | null;
  status: "active" | "free" | "guest";
  totalSpent: number | null;
  upgradeGrowthValue: number | null;
}

export interface SdkworkMembershipDashboardData {
  benefits: SdkworkMembershipBenefit[];
  levels: SdkworkMembershipLevel[];
  plans: SdkworkMembershipPlan[];
  summary: SdkworkMembershipSummary;
}

export interface SdkworkMembershipMutationInput {
  couponId?: string;
  packageId: number;
  paymentMethod?: string;
}

export interface SdkworkMembershipPurchaseResult {
  amountCny: number | null;
  durationDays: number | null;
  orderId?: string;
  packageId: number | null;
  packageName?: string;
  status: "completed" | "failed" | "pending";
  targetLevelName?: string;
}

export interface CreateSdkworkMembershipServiceOptions {
  membershipService?: SdkworkMembershipAppService;
  locale?: string | null;
  messages?: SdkworkMembershipMessagesOverrides;
}

export interface SdkworkMembershipService {
  getDashboard(): Promise<SdkworkMembershipDashboardData>;
  getEmptyDashboard(): SdkworkMembershipDashboardData;
  purchaseMembership(input: SdkworkMembershipMutationInput): Promise<SdkworkMembershipPurchaseResult>;
  renewMembership(input: SdkworkMembershipMutationInput): Promise<SdkworkMembershipPurchaseResult>;
  upgradeMembership(input: SdkworkMembershipMutationInput): Promise<SdkworkMembershipPurchaseResult>;
}

interface RemoteMembershipBenefit {
  benefitKey?: string;
  claimed?: boolean;
  description?: string;
  id?: number | string;
  name?: string;
  type?: string;
  usageLimit?: number | string;
  usedCount?: number | string;
}

interface RemoteMembershipLevel {
  badge?: string;
  description?: string;
  icon?: unknown;
  id?: number | string;
  levelValue?: number | string;
  name?: string;
  requiredPoints?: number | string;
}

interface RemoteMembershipInfo {
  expireTime?: string;
  growthValue?: number | string;
  membershipStatus?: string;
  planName?: string;
  planRank?: number | string;
  points?: number | string;
  remainingDays?: number | string;
  totalSpent?: number | string;
  upgradeGrowthValue?: number | string;
}

interface RemoteMembershipStatus {
  active?: boolean;
  expireTime?: string;
  pointBalance?: number | string;
  planRank?: number | string;
}

interface RemoteMembershipPackage {
  description?: string;
  id?: number | string;
  levelName?: string;
  name?: string;
  originalPrice?: number | string;
  pointAmount?: number | string;
  points?: number | string;
  price?: number | string;
  priceAmount?: number | string;
  salePrice?: number | string;
  recommended?: boolean;
  sortWeight?: number | string;
  tags?: string[];
  durationDays?: number | string;
}

interface RemoteMembershipPurchaseResult {
  amount?: number | string;
  durationDays?: number | string;
  orderId?: string;
  packageId?: number | string;
  packageName?: string;
  status?: string;
  targetLevelName?: string;
}

function mapPlan(membershipPackage: RemoteMembershipPackage): SdkworkMembershipPlan {
  const packageId = toSdkworkMembershipNumber(membershipPackage.id);
  // Preserve the raw identity for the React key. Several packages can map to
  // numeric 0 (non-numeric ids), and keying them all as `membership-package-0`
  // duplicated selection state across rows.
  const identity = membershipPackage.id == null ? packageId : String(membershipPackage.id);

  return {
    description: toSdkworkMembershipOptionalString(membershipPackage.description),
    durationDays: toNullableSdkworkMembershipNumber(membershipPackage.durationDays),
    id: `membership-package-${identity}`,
    includedPoints: toSdkworkMembershipNumber(
      membershipPackage.pointAmount ?? membershipPackage.points,
    ),
    levelName: toSdkworkMembershipOptionalString(membershipPackage.levelName),
    name: toSdkworkMembershipOptionalString(membershipPackage.name) || "Membership package",
    originalPriceCny: toNullableSdkworkMembershipNumber(membershipPackage.originalPrice),
    packageId,
    priceCny: toSdkworkMembershipNumber(
      membershipPackage.priceAmount ?? membershipPackage.price ?? membershipPackage.salePrice,
    ),
    recommended: Boolean(membershipPackage.recommended),
    tags: Array.isArray(membershipPackage.tags)
      ? membershipPackage.tags.map((tag) => tag.trim()).filter(Boolean)
      : [],
  };
}

function sortPlans(plans: SdkworkMembershipPlan[]): SdkworkMembershipPlan[] {
  return [...plans].sort(
    (left, right) =>
      Number(right.recommended) - Number(left.recommended)
      || right.includedPoints - left.includedPoints
      || left.priceCny - right.priceCny
      || left.id.localeCompare(right.id),
  );
}

function sortBenefits(benefits: SdkworkMembershipBenefit[]): SdkworkMembershipBenefit[] {
  return [...benefits].sort(
    (left, right) =>
      Number(right.claimed) - Number(left.claimed)
      || left.name.localeCompare(right.name),
  );
}

function sortLevels(levels: SdkworkMembershipLevel[]): SdkworkMembershipLevel[] {
  return [...levels].sort(
    (left, right) => left.levelValue - right.levelValue || left.name.localeCompare(right.name),
  );
}

function mapSummary(
  membershipInfo: RemoteMembershipInfo | null | undefined,
  membershipStatus: RemoteMembershipStatus | null | undefined,
): SdkworkMembershipSummary {
  const isMember = Boolean(membershipStatus?.active || (membershipInfo?.membershipStatus || "").toUpperCase() === "ACTIVE");
  const currentLevelValue = toNullableSdkworkMembershipNumber(membershipStatus?.planRank ?? membershipInfo?.planRank);

  return {
    currentLevelName: toSdkworkMembershipOptionalString(membershipInfo?.planName) || (isMember ? "Member" : "Free"),
    currentLevelValue,
    expireTime: toSdkworkMembershipOptionalString(membershipStatus?.expireTime) || toSdkworkMembershipOptionalString(membershipInfo?.expireTime),
    growthValue: toNullableSdkworkMembershipNumber(membershipInfo?.growthValue),
    isAuthenticated: true,
    isMember,
    pointBalance: toNullableSdkworkMembershipNumber(membershipStatus?.pointBalance),
    points: toNullableSdkworkMembershipNumber(membershipInfo?.points),
    remainingDays: toNullableSdkworkMembershipNumber(membershipInfo?.remainingDays),
    status: isMember ? "active" : "free",
    totalSpent: toNullableSdkworkMembershipNumber(membershipInfo?.totalSpent),
    upgradeGrowthValue: toNullableSdkworkMembershipNumber(membershipInfo?.upgradeGrowthValue),
  };
}

function mapLevels(
  levels: RemoteMembershipLevel[],
  currentLevelValue: number | null,
): SdkworkMembershipLevel[] {
  return sortLevels(levels.map((level) => ({
    badge: toSdkworkMembershipOptionalString(level.badge),
    description: toSdkworkMembershipOptionalString(level.description),
    icon: readSdkworkMediaResource(level.icon),
    id: `membership-level-${level.id == null ? toSdkworkMembershipNumber(level.id) : String(level.id)}`,
    isCurrent: currentLevelValue !== null && toSdkworkMembershipNumber(level.levelValue) === currentLevelValue,
    levelValue: toSdkworkMembershipNumber(level.levelValue),
    name: toSdkworkMembershipOptionalString(level.name) || "Membership level",
    requiredPoints: toNullableSdkworkMembershipNumber(level.requiredPoints),
  })));
}

function mapBenefits(benefits: RemoteMembershipBenefit[]): SdkworkMembershipBenefit[] {
  return sortBenefits(benefits.map((benefit) => ({
    benefitKey: toSdkworkMembershipOptionalString(benefit.benefitKey),
    claimed: Boolean(benefit.claimed),
    description: toSdkworkMembershipOptionalString(benefit.description),
    id: `membership-benefit-${benefit.id == null ? toSdkworkMembershipNumber(benefit.id) : String(benefit.id)}`,
    name: toSdkworkMembershipOptionalString(benefit.name) || "Membership benefit",
    type: toSdkworkMembershipOptionalString(benefit.type),
    usageLimit: toNullableSdkworkMembershipNumber(benefit.usageLimit),
    usedCount: toNullableSdkworkMembershipNumber(benefit.usedCount),
  })));
}

function mapPurchaseResult(result: RemoteMembershipPurchaseResult | null | undefined): SdkworkMembershipPurchaseResult {
  return {
    amountCny: toNullableSdkworkMembershipNumber(result?.amount),
    durationDays: toNullableSdkworkMembershipNumber(result?.durationDays),
    orderId: toSdkworkMembershipOptionalString(result?.orderId),
    packageId: toNullableSdkworkMembershipNumber(result?.packageId),
    packageName: toSdkworkMembershipOptionalString(result?.packageName),
    status: toSdkworkMembershipMutationStatus(toSdkworkMembershipOptionalString(result?.status)),
    targetLevelName: toSdkworkMembershipOptionalString(result?.targetLevelName),
  };
}

async function runPurchaseMutation(
  getMembershipService: () => SdkworkMembershipAppService,
  copy: SdkworkMembershipMessages["service"],
  action: "purchase" | "renew" | "upgrade",
  input: SdkworkMembershipMutationInput,
): Promise<SdkworkMembershipPurchaseResult> {
  requireSdkworkMembershipSession(copy.signInRequired);
  const membershipService = getMembershipService();
  const body = {
    couponId: toSdkworkMembershipOptionalString(input.couponId),
    packageId: input.packageId,
    paymentMethod: toSdkworkMembershipOptionalString(input.paymentMethod),
  };
  const result = unwrapSdkworkMembershipResponse<RemoteMembershipPurchaseResult>(
    await (
      action === "purchase"
        ? membershipService.memberships.purchases.create(body)
        : action === "renew"
          ? membershipService.memberships.purchases.renew(body)
          : membershipService.memberships.purchases.upgrade(body)
    ),
    action === "purchase"
      ? copy.purchaseFailed
      : action === "renew"
        ? copy.renewFailed
        : copy.upgradeFailed,
  );

  return mapPurchaseResult(result);
}

function createEmptyDashboard(): SdkworkMembershipDashboardData {
  return {
    benefits: [],
    levels: [],
    plans: [],
    summary: {
      currentLevelName: "Guest",
      currentLevelValue: null,
      growthValue: null,
      isAuthenticated: false,
      isMember: false,
      pointBalance: null,
      points: null,
      remainingDays: null,
      status: "guest",
      totalSpent: null,
      upgradeGrowthValue: null,
    },
  };
}

export function createSdkworkMembershipService(
  options: CreateSdkworkMembershipServiceOptions = {},
): SdkworkMembershipService {
  const copy = createSdkworkMembershipMessages(options.locale, options.messages);
  const getMembershipService = () => options.membershipService ?? getSdkworkMembershipService();

  return {
    async getDashboard() {
      const membershipService = getMembershipService();

      if (!hasSdkworkMembershipSession()) {
        const packagesPayload = await membershipService.memberships.packages.list();
        const packages = unwrapSdkworkMembershipPageItems<RemoteMembershipPackage>(packagesPayload);

        return {
          ...createEmptyDashboard(),
          plans: sortPlans(packages.map(mapPlan)),
        };
      }

      const [membershipInfoPayload, membershipStatusPayload, levelsPayload, benefitsPayload, packagesPayload] = await Promise.all([
        membershipService.memberships.current.retrieve(),
        membershipService.memberships.current.status.retrieve(),
        membershipService.memberships.plans.list(),
        membershipService.memberships.benefits.list(),
        membershipService.memberships.packages.list(),
      ]);
      const membershipInfo = unwrapSdkworkMembershipResponse<RemoteMembershipInfo | null>(membershipInfoPayload);
      const membershipStatus = unwrapSdkworkMembershipResponse<RemoteMembershipStatus | null>(membershipStatusPayload);
      const levels = unwrapSdkworkMembershipPageItems<RemoteMembershipLevel>(levelsPayload);
      const benefits = unwrapSdkworkMembershipPageItems<RemoteMembershipBenefit>(benefitsPayload);
      const packages = unwrapSdkworkMembershipPageItems<RemoteMembershipPackage>(packagesPayload);
      const summary = mapSummary(membershipInfo, membershipStatus);

      return {
        benefits: mapBenefits(benefits),
        levels: mapLevels(levels, summary.currentLevelValue),
        plans: sortPlans(packages.map(mapPlan)),
        summary,
      };
    },

    getEmptyDashboard() {
      return createEmptyDashboard();
    },

    async purchaseMembership(input) {
      return runPurchaseMutation(getMembershipService, copy.service, "purchase", input);
    },

    async renewMembership(input) {
      return runPurchaseMutation(getMembershipService, copy.service, "renew", input);
    },

    async upgradeMembership(input) {
      return runPurchaseMutation(getMembershipService, copy.service, "upgrade", input);
    },
  };
}

export const sdkworkMembershipService = createSdkworkMembershipService();
