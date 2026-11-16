/**
 * Session shim for the mini program.
 *
 * Authority: `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` sections 2-3. The real
 * session/token context is the IAM-owned store surfaced by
 * `@sdkwork/mall-mp-core`; this module keeps the historical helper names the
 * pages already import so a capability package can be adopted without touching
 * every page at once.
 *
 * The development-only token paste still writes `LEGACY_TOKEN_KEY` directly: it
 * produces a single-credential session that the IAM exchange would refuse, and
 * keeping it out of the dual-token store prevents a half session from ever
 * reaching a generated SDK.
 */
import { getMallMpRuntime, type MpSessionSnapshot as MpCoreSession } from "@sdkwork/mall-mp-core";

export interface MpSessionSnapshot {
  accessToken: string;
  authToken: string;
  userId: string;
}

/** Storage key of the pre-dual-token single credential (dev escape hatch). */
const LEGACY_TOKEN_KEY = "sdkwork-mall-mp-session-token";

function storage(): ReturnType<typeof getMallMpRuntime>["host"]["storage"] {
  return getMallMpRuntime().host.storage;
}

function readLegacyToken(): string {
  try {
    return storage().get(LEGACY_TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

function toShim(snapshot: MpCoreSession | null): MpSessionSnapshot | null {
  if (!snapshot) {
    return null;
  }
  return {
    accessToken: snapshot.accessToken,
    authToken: snapshot.authToken,
    userId: snapshot.userId ?? "",
  };
}

/** `Authorization` credential; empty when signed out. */
export function getToken(): string {
  const stored = toShim(getMallMpRuntime().session.read());
  if (stored && stored.authToken !== "") {
    return stored.authToken;
  }
  return readLegacyToken();
}

/** `access-token` credential; empty when signed out or on the dev fallback. */
export function getAccessToken(): string {
  return toShim(getMallMpRuntime().session.read())?.accessToken ?? "";
}

export function setSession(snapshot: MpSessionSnapshot): void {
  getMallMpRuntime().session.write({
    accessToken: snapshot.accessToken,
    authToken: snapshot.authToken,
    ...(snapshot.userId ? { userId: snapshot.userId } : {}),
  });
}

/** Development-only single-credential sign-in (login page escape hatch). */
export function setToken(token: string): void {
  storage().set(LEGACY_TOKEN_KEY, token);
}

export function clearSession(): void {
  const runtime = getMallMpRuntime();
  runtime.session.clear();
  try {
    runtime.host.storage.remove(LEGACY_TOKEN_KEY);
  } catch {
    // storage unavailable: the in-memory snapshot is already cleared
  }
}

export function isLoggedIn(): boolean {
  return Boolean(getToken());
}

/** IAM user id captured by the login exchange (empty when signed out). */
export function getUserId(): string {
  return toShim(getMallMpRuntime().session.read())?.userId ?? "";
}
