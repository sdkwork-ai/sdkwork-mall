/**
 * Buyer profile and account-security facts.
 *
 * Authority: `IAM_LOGIN_INTEGRATION_SPEC.md` section 5. Identity belongs to
 * `sdkwork-iam`: the capability reads `iam.users.current` through the account
 * service, so the mini program shows the same account fields as the PC and H5
 * profile screens without a mall-owned account-summary endpoint.
 *
 * The membership level is a commerce fact, so it comes from the membership
 * status the mall already reads (fail-soft: an unavailable status leaves the row
 * blank instead of failing the profile screen).
 */
import { getMallMpRuntime } from "@sdkwork/mall-mp-core";
import { createMpAuthService, type MpIamCurrentUser } from "@sdkwork/mall-mp-auth/auth-service";

import { asRecord, asString, type MpRecord } from "../types/common";
import { getMembershipStatus } from "./account-service";
import { getUserId, isLoggedIn } from "./session";

export interface MpProfile {
  displayName: string;
  email: string;
  membershipLevel: string;
  phone: string;
}

export interface MpSecuritySnapshot {
  accountLabel: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  userId: string;
  username: string;
}

const EMPTY_PROFILE: MpProfile = {
  displayName: "",
  email: "",
  membershipLevel: "",
  phone: "",
};

function currentUser(): Promise<MpIamCurrentUser> {
  return createMpAuthService(getMallMpRuntime()).loadCurrentUser();
}

export async function getProfile(): Promise<MpProfile> {
  if (!isLoggedIn()) {
    return { ...EMPTY_PROFILE };
  }
  const [user, membership] = await Promise.all([
    // Identity is the page's primary content: a failed IAM read must surface as an
    // error with retry, not as an empty profile.
    currentUser(),
    getMembershipStatus().catch(() => null),
  ]);
  return {
    displayName: user?.displayName ?? "",
    email: user?.email ?? "",
    membershipLevel: membership?.levelName ?? "",
    phone: user?.phone ?? "",
  };
}

export async function getSecuritySnapshot(): Promise<MpSecuritySnapshot> {
  const userId = getUserId();
  // Identity is the page's primary content: an IAM outage surfaces as an error
  // with retry instead of a plausible-looking "当前账户" placeholder.
  const user = await currentUser();
  const accountLabel = user?.displayName || user?.email || user?.phone || userId;
  return {
    accountLabel: accountLabel || "当前账户",
    emailVerified: user?.emailVerified ?? false,
    phoneVerified: user?.phoneVerified ?? false,
    userId: user?.userId || userId,
    username: user?.username ?? "",
  };
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

/** Exposed for the security page's change-password form. */
export function changePassword(input: {
  confirmPassword: string;
  newPassword: string;
  oldPassword: string;
}): Promise<void> {
  return createMpAuthService(getMallMpRuntime()).changePassword(input);
}

export type { MpIamCurrentUser };
export type { MpRecord };
