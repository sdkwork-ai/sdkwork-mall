/**
 * Account-scoped browser storage for the Mall PC surfaces.
 *
 * Browser storage is shared by every account that signs in on the same origin,
 * so a bare key leaks the previous account's favourites, footprint, search
 * history, CMS draft and admin role into the next account. Every persisted
 * account key carries `<baseKey>::<tenantId>:<userId>`, resolved from the live
 * IAM session through {@link configureMallAccountScopeProvider}; the IAM runtime
 * clears the previous scope when the session changes or ends.
 *
 * Device preferences (theme, locale, layout) are intentionally not scoped.
 */

export interface MallAccountScope {
  tenantId: string;
  userId: string;
}

/** Scope id used while no tenant/user claims are available. */
export const MALL_ACCOUNT_SCOPE_ANONYMOUS = "anonymous";

const SCOPE_SUFFIX_SEPARATOR = "::";

/**
 * Base keys (or base-key prefixes) whose values belong to the signed-in account.
 * Keys outside this list are device preferences and stay shared.
 */
export const MALL_ACCOUNT_SCOPED_KEY_PREFIXES = [
  "sdkwork-mall-pc-favorites",
  "sdkwork-mall-pc-shop-favorites",
  "sdkwork-mall-pc-footprint",
  "sdkwork-mall-pc-search-history",
  "sdkwork-mall-pc-cms-config",
  "sdkwork-mall-pc-default-data:cms-preset",
  "sdkwork-mall-pc-admin-role",
] as const;

let scopeProvider: (() => MallAccountScope | null) | null = null;
let activeScopeId: string | null = null;

/**
 * Wire the scope to the running IAM session. Called once at app bootstrap; the
 * provider is evaluated per storage access so a session change is picked up
 * without re-registering anything.
 */
export function configureMallAccountScopeProvider(
  provider: (() => MallAccountScope | null) | null,
): void {
  scopeProvider = provider;
}

function scopeIdOf(scope: MallAccountScope | null): string {
  return scope ? `${scope.tenantId}:${scope.userId}` : MALL_ACCOUNT_SCOPE_ANONYMOUS;
}

export function currentMallAccountScopeId(): string {
  const scope = scopeProvider?.() ?? null;
  return scopeIdOf(scope);
}

export function scopedMallStorageKey(
  baseKey: string,
  scopeId: string = currentMallAccountScopeId(),
): string {
  return `${baseKey}${SCOPE_SUFFIX_SEPARATOR}${scopeId}`;
}

export function isMallAccountScopedBaseKey(baseKey: string): boolean {
  return MALL_ACCOUNT_SCOPED_KEY_PREFIXES.some((prefix) => baseKey.startsWith(prefix));
}

function getStorage(): Storage | undefined {
  try {
    return (globalThis as { localStorage?: Storage }).localStorage ?? undefined;
  } catch {
    return undefined;
  }
}

export function readAccountScopedItem(baseKey: string): string | null {
  try {
    return getStorage()?.getItem(scopedMallStorageKey(baseKey)) ?? null;
  } catch {
    return null;
  }
}

export function writeAccountScopedItem(baseKey: string, value: string): void {
  try {
    getStorage()?.setItem(scopedMallStorageKey(baseKey), value);
  } catch {
    // Private mode / quota: callers degrade to the in-memory state.
  }
}

export function removeAccountScopedItem(baseKey: string): void {
  try {
    getStorage()?.removeItem(scopedMallStorageKey(baseKey));
  } catch {
    // Nothing to remove when storage is unavailable.
  }
}

function listStorageKeys(store: Storage): string[] {
  const keys: string[] = [];
  try {
    const length = typeof store.length === "number" ? store.length : 0;
    for (let index = 0; index < length; index += 1) {
      const key = store.key(index);
      if (key) {
        keys.push(key);
      }
    }
  } catch {
    return keys;
  }
  return keys;
}

/**
 * Remove account-scoped values for the given scopes.
 *
 * Legacy unscoped keys are dropped too: they cannot be attributed to an
 * account, so showing them to whoever signs in next is exactly the defect this
 * module removes.
 */
export function clearMallAccountScopedStorage(
  scopeIds: readonly string[] = [currentMallAccountScopeId(), MALL_ACCOUNT_SCOPE_ANONYMOUS],
): string[] {
  const store = getStorage();
  const removed: string[] = [];
  if (!store || scopeIds.length === 0) {
    return removed;
  }
  const suffixes = scopeIds.map((scopeId) => `${SCOPE_SUFFIX_SEPARATOR}${scopeId}`);
  for (const key of listStorageKeys(store)) {
    const matchedSuffix = suffixes.find((suffix) => key.endsWith(suffix));
    if (matchedSuffix) {
      if (!isMallAccountScopedBaseKey(key.slice(0, -matchedSuffix.length))) {
        continue;
      }
      store.removeItem(key);
      removed.push(key);
      continue;
    }
    if (key.includes(SCOPE_SUFFIX_SEPARATOR) || !isMallAccountScopedBaseKey(key)) {
      continue;
    }
    store.removeItem(key);
    removed.push(key);
  }
  activeScopeId = MALL_ACCOUNT_SCOPE_ANONYMOUS;
  return removed;
}

/**
 * Point storage at the session's scope, clearing the previous account's values
 * when the identity changed. The anonymous bucket is kept so a guest draft
 * survives sign-in; it is cleared on sign-out.
 */
export function syncMallAccountScope(scope: MallAccountScope | null): void {
  const nextScopeId = scopeIdOf(scope);
  const previousScopeId = activeScopeId ?? currentMallAccountScopeId();
  if (
    previousScopeId !== nextScopeId
    && previousScopeId !== MALL_ACCOUNT_SCOPE_ANONYMOUS
  ) {
    clearMallAccountScopedStorage([previousScopeId]);
  }
  activeScopeId = nextScopeId;
}

/** Test hook: forget module-level scope state between cases. */
export function resetMallAccountScopeForTests(): void {
  scopeProvider = null;
  activeScopeId = null;
}
