import {
  readAccountScopedItem,
  removeAccountScopedItem,
  writeAccountScopedItem,
} from "@sdkwork/mall-pc-core/session";

const FOOTPRINT_KEY = "sdkwork-mall-pc-footprint";

export interface MallFootprintItem {
  id: string;
  title: string;
  viewedAt: string;
}

/** Browsing footprint is account-scoped: the next account starts empty. */
export function readMallFootprint(): MallFootprintItem[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = readAccountScopedItem(FOOTPRINT_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as MallFootprintItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function recordMallFootprint(item: Omit<MallFootprintItem, "viewedAt">) {
  if (typeof window === "undefined") {
    return;
  }
  const next = [
    { ...item, viewedAt: new Date().toISOString() },
    ...readMallFootprint().filter((entry) => entry.id !== item.id),
  ].slice(0, 50);
  writeAccountScopedItem(FOOTPRINT_KEY, JSON.stringify(next));
}

export function clearMallFootprint() {
  if (typeof window === "undefined") {
    return;
  }
  removeAccountScopedItem(FOOTPRINT_KEY);
}
