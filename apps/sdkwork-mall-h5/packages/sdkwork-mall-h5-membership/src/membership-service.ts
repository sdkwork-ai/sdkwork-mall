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
} from "@sdkwork/membership-service";

export interface MallH5MembershipStatus {
  expireTime?: string;
  isMember: boolean;
  /** Server-provided plan name; empty when the backend sends none. */
  levelName: string;
}

export interface MallH5MembershipPackage {
  description?: string;
  durationDays: number | null;
  id: number;
  name: string;
  priceCny: number | null;
  recommended: boolean;
}

export interface MallH5MembershipPurchaseResult {
  amountCny: number | null;
  orderId?: string;
  packageName?: string;
  status: "completed" | "failed" | "pending";
}

function mapStatus(payload: unknown): MallH5MembershipStatus | null {
  const record = unwrapSdkworkMembershipResponse<Record<string, unknown> | null>(payload);
  if (!record) {
    return null;
  }
  const isMember = Boolean(record.active);
  return {
    expireTime: toSdkworkMembershipOptionalString(record.expireTime),
    isMember,
    levelName: toSdkworkMembershipOptionalString(record.planName) ?? "",
  };
}

function mapPackages(payload: unknown): MallH5MembershipPackage[] {
  return unwrapSdkworkMembershipPageItems<Record<string, unknown>>(payload).map(
    (row, index) => ({
      description: toSdkworkMembershipOptionalString(row.description),
      durationDays: toNullableSdkworkMembershipNumber(row.durationDays),
      id: toSdkworkMembershipNumber(row.id) || index + 1,
      name: toSdkworkMembershipOptionalString(row.name) || `#${index + 1}`,
      priceCny: toNullableSdkworkMembershipNumber(row.price),
      recommended: Boolean(row.recommended),
    }),
  );
}

/**
 * Loads the membership centre: purchasable packages are public, current status
 * needs a session. A failure in either lookup must not hide the packages.
 */
export async function loadMallH5Membership(): Promise<{
  packages: MallH5MembershipPackage[];
  status: MallH5MembershipStatus | null;
}> {
  const service = getSdkworkMembershipService();
  const packagesPayload = await service.memberships.packages.list().catch(() => null);
  const packages = packagesPayload ? mapPackages(packagesPayload) : [];
  let status: MallH5MembershipStatus | null = null;
  if (hasSdkworkMembershipSession()) {
    const statusPayload = await service.memberships.current.status.retrieve().catch(() => null);
    status = statusPayload ? mapStatus(statusPayload) : null;
  }
  return { packages, status };
}

/**
 * Purchases/renews a membership package. The membership service charges the
 * selected payment method server-side and returns the resulting status, so the
 * mobile client never assembles a payment intent itself.
 */
export async function purchaseMallH5Membership(input: {
  packageId: number;
  paymentMethod?: string;
}): Promise<MallH5MembershipPurchaseResult> {
  requireSdkworkMembershipSession("请先登录后开通会员");
  const payload = await getSdkworkMembershipService().memberships.purchases.create({
    packageId: input.packageId,
    paymentMethod: toSdkworkMembershipOptionalString(input.paymentMethod),
  });
  const record = unwrapSdkworkMembershipResponse<Record<string, unknown>>(payload) ?? {};
  return {
    amountCny: toNullableSdkworkMembershipNumber(record.amount),
    orderId: toSdkworkMembershipOptionalString(record.orderId),
    packageName: toSdkworkMembershipOptionalString(record.packageName),
    status: toSdkworkMembershipMutationStatus(
      toSdkworkMembershipOptionalString(record.status),
    ),
  };
}
