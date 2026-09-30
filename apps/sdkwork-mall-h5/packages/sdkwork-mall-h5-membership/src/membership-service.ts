import {
  getSdkworkMembershipService,
  hasSdkworkMembershipSession,
  unwrapSdkworkMembershipResponse,
} from "@sdkwork/membership-service";

export interface MallH5MembershipStatus {
  levelName: string;
  status: string;
}

export interface MallH5MembershipPlan {
  id: string;
  title: string;
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

export async function loadMallH5Membership(): Promise<{
  plans: MallH5MembershipPlan[];
  status: MallH5MembershipStatus | null;
}> {
  if (!hasSdkworkMembershipSession()) {
    return { plans: [], status: null };
  }
  const service = getSdkworkMembershipService();
  const [statusPayload, plansPayload] = await Promise.all([
    service.memberships.current.status.retrieve().catch(() => null),
    service.memberships.plans.list({ page: 1, pageSize: 20 }).catch(() => null),
  ]);
  const status = statusPayload
    ? (unwrapSdkworkMembershipResponse<Record<string, unknown>>(statusPayload) ?? {})
    : {};
  const plansPage = plansPayload
    ? (unwrapSdkworkMembershipResponse<{ content?: Record<string, unknown>[]; items?: Record<string, unknown>[] }>(plansPayload) ?? {})
    : {};
  const rows = plansPage.content ?? plansPage.items ?? [];
  return {
    plans: rows.map((row, index) => ({
      id: readString(row, ["id", "planId"]) || `plan-${index + 1}`,
      title: readString(row, ["title", "name", "levelName"]) || `会员方案 ${index + 1}`,
    })),
    status: status.levelName || status.status
      ? {
          levelName: readString(status, ["levelName", "level"]) || "普通会员",
          status: readString(status, ["status", "statusName"]) || "active",
        }
      : null,
  };
}
