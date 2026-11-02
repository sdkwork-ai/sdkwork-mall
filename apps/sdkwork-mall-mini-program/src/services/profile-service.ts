/**
 * Buyer profile and account-security facts.
 *
 * Reads the current-account summary (`GET /accounts/current/summary`, the
 * `accounts.current.summary.retrieve` app-api operation) through the shared
 * transport seam and falls back to the local IAM session identity, so the
 * mini program shows the same account fields as the PC and H5 profile screens.
 */
import { asRecord, asString, type MpRecord } from "../types/common";
import { getUserId, isLoggedIn } from "./session";
import { request } from "./transport";

export interface MpProfile {
  displayName: string;
  email: string;
  membershipLevel: string;
  phone: string;
}

export interface MpSecuritySnapshot {
  accountLabel: string;
  userId: string;
}

const EMPTY_PROFILE: MpProfile = {
  displayName: "",
  email: "",
  membershipLevel: "",
  phone: "",
};

export async function getProfile(): Promise<MpProfile> {
  if (!isLoggedIn()) {
    return { ...EMPTY_PROFILE };
  }
  const payload = await request({ path: "/accounts/current/summary" }).catch(
    () => ({}) as MpRecord,
  );
  return {
    displayName: asString(payload, ["displayName", "nickname", "name"]),
    email: asString(payload, ["email"]),
    membershipLevel: asString(payload, ["membershipLevel", "levelName", "level"]),
    phone: asString(payload, ["phone", "mobile", "phoneNumber"]),
  };
}

export async function getSecuritySnapshot(): Promise<MpSecuritySnapshot> {
  const userId = getUserId();
  let accountLabel = userId;
  try {
    const profile = await getProfile();
    accountLabel = profile.displayName || profile.email || profile.phone || userId;
  } catch (error) {
    // The security screen still renders the session identity when the account
    // summary is unavailable.
  }
  return { accountLabel: accountLabel || "当前账户", userId };
}

/** Normalizes a loosely typed payload into the profile shape (unit-tested). */
export function toProfile(payload: unknown): MpProfile {
  const record = asRecord(payload);
  return {
    displayName: asString(record, ["displayName", "nickname", "name"]),
    email: asString(record, ["email"]),
    membershipLevel: asString(record, ["membershipLevel", "levelName", "level"]),
    phone: asString(record, ["phone", "mobile", "phoneNumber"]),
  };
}
