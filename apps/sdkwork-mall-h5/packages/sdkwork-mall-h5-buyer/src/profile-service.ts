import {
  getSdkworkCommerceService,
  unwrapSdkworkCommerceResponse,
} from "@sdkwork/mall-commerce-service";
import {
  getSdkworkMallH5SessionStore,
  readSdkworkMallH5SessionDisplayName,
  type SdkworkMallH5SessionSnapshot,
} from "@sdkwork/mall-h5-core/session";

export interface MallH5Profile {
  displayName: string;
  email: string;
  membershipLevel: string;
  phone: string;
}

export interface MallH5SecuritySnapshot {
  accountLabel: string;
  organizationId?: string;
  sessionId?: string;
  tenantId?: string;
  userId?: string;
}

const EMPTY_SESSION: SdkworkMallH5SessionSnapshot = {};

function readString(record: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value);
    }
  }
  return "";
}

/** Current-account summary shared with the PC and mini-program profile screens. */
export async function loadMallH5Profile(): Promise<MallH5Profile> {
  const session = getSdkworkMallH5SessionStore()?.getSnapshot() ?? EMPTY_SESSION;
  const response = await getSdkworkCommerceService().accounts.current.summary.retrieve({});
  const payload = unwrapSdkworkCommerceResponse<Record<string, unknown>>(response) ?? {};
  return {
    displayName: readString(payload, ["displayName", "nickname", "name"])
      || readSdkworkMallH5SessionDisplayName(session),
    email: readString(payload, ["email"]),
    membershipLevel: readString(payload, ["membershipLevel", "levelName", "level"]),
    phone: readString(payload, ["phone", "mobile", "phoneNumber"]),
  };
}

/** Account identity plus the active session facts shown on the security screen. */
export async function loadMallH5SecuritySnapshot(): Promise<MallH5SecuritySnapshot> {
  const session = getSdkworkMallH5SessionStore()?.getSnapshot() ?? EMPTY_SESSION;
  let accountLabel = readSdkworkMallH5SessionDisplayName(session);
  try {
    const profile = await loadMallH5Profile();
    accountLabel = profile.displayName || profile.email || profile.phone || accountLabel;
  } catch {
    // The security screen still renders a usable identity from the active session
    // when the account summary endpoint is unavailable.
  }
  return {
    accountLabel,
    organizationId: session.context?.organizationId,
    sessionId: session.sessionId ?? session.context?.sessionId,
    tenantId: session.context?.tenantId,
    userId: session.context?.userId,
  };
}
