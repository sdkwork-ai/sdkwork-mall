export interface SdkworkMallH5SessionSnapshot {
  accessToken?: string;
  authToken?: string;
  refreshToken?: string;
  sessionId?: string;
  context?: {
    tenantId?: string;
    userId?: string;
    organizationId?: string;
    sessionId?: string;
    appId?: string;
    environment?: string;
    deploymentMode?: string;
  };
  updatedAt?: string;
}

export interface SdkworkMallH5SessionStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SdkworkMallH5SessionStore {
  clearSession(): void;
  getSnapshot(): SdkworkMallH5SessionSnapshot;
  refreshSession(): SdkworkMallH5SessionSnapshot;
  setSession(nextSession: SdkworkMallH5SessionSnapshot): void;
  subscribe(listener: (snapshot: SdkworkMallH5SessionSnapshot) => void): () => void;
}

export const SDKWORK_COMMERCE_H5_SESSION_STORAGE_KEY = "sdkwork-mall-h5-session";

function readInitialSession(
  storage: SdkworkMallH5SessionStorageLike | undefined,
  storageKey: string,
): SdkworkMallH5SessionSnapshot {
  if (!storage) {
    return {};
  }

  try {
    const raw = storage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as SdkworkMallH5SessionSnapshot) : {};
  } catch {
    return {};
  }
}

export function createSdkworkMallH5SessionStore(
  storage?: SdkworkMallH5SessionStorageLike,
  storageKey = SDKWORK_COMMERCE_H5_SESSION_STORAGE_KEY,
): SdkworkMallH5SessionStore {
  let snapshot = readInitialSession(storage, storageKey);
  const listeners = new Set<(nextSnapshot: SdkworkMallH5SessionSnapshot) => void>();

  const emit = () => {
    for (const listener of listeners) {
      listener(snapshot);
    }
  };

  const persist = () => {
    if (!storage) {
      return;
    }

    if (!snapshot.authToken && !snapshot.accessToken && !snapshot.refreshToken) {
      storage.removeItem(storageKey);
      return;
    }

    storage.setItem(storageKey, JSON.stringify(snapshot));
  };

  return {
    clearSession() {
      snapshot = {};
      persist();
      emit();
    },
    getSnapshot() {
      return snapshot;
    },
    refreshSession() {
      snapshot = readInitialSession(storage, storageKey);
      emit();
      return snapshot;
    },
    setSession(nextSession) {
      snapshot = {
        ...nextSession,
        updatedAt: new Date().toISOString(),
      };
      persist();
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function hasSdkworkMallH5IamSession(
  snapshot: SdkworkMallH5SessionSnapshot,
): boolean {
  return Boolean(snapshot.authToken && snapshot.accessToken && snapshot.context?.tenantId);
}
