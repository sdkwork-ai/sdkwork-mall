/**
 * Invite-code capture for distribution attribution.
 *
 * A share link/QR carries `invite=<code>`. The storefront remembers the code so a
 * signed-out visitor can log in first, and binds the buyer to the distributor as
 * soon as a session exists. Binding is idempotent on the server.
 */
import { platform } from "@sdkwork/mall-mp-core";

import { bindPartnerCustomerByInviteCode } from "./partner-service";
import { isLoggedIn } from "./session";

const PENDING_INVITE_KEY = "sdkwork-mall-mp-pending-invite";

export function readPendingInvite(): string {
  try {
    return platform.storage.get(PENDING_INVITE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function clearPendingInvite(): void {
  try {
    platform.storage.remove(PENDING_INVITE_KEY);
  } catch {
    // Storage is device-local; a failed clear only retries the idempotent bind.
  }
}

/** Remembers the code and binds immediately when a session already exists. */
export async function captureInviteCode(inviteCode?: string): Promise<void> {
  const invite = (inviteCode ?? "").trim();
  if (!invite) {
    return;
  }
  try {
    platform.storage.set(PENDING_INVITE_KEY, invite);
  } catch {
    return;
  }
  if (!isLoggedIn()) {
    return;
  }
  await bindPendingInvite();
}

/** Binds the remembered code (called after a successful sign-in and on capture). */
export async function bindPendingInvite(): Promise<boolean> {
  const invite = readPendingInvite();
  if (!invite || !isLoggedIn()) {
    return false;
  }
  try {
    await bindPartnerCustomerByInviteCode(invite);
    clearPendingInvite();
    return true;
  } catch {
    // Keep the code; the next capture or sign-in retries the idempotent bind.
    return false;
  }
}
