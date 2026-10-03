/**
 * Local favorites and browsing-footprint store.
 *
 * 收藏与足迹暂存本机（与 H5/PC 行为一致），账号级云同步等待收藏服务上线。
 * Storage keys are namespaced so clears from the settings page can target
 * each surface independently.
 */
import { type MpRecord } from "../types/common";

const FAVORITES_STORAGE_KEY = "sdkwork-mall-favorites";
const FOOTPRINT_STORAGE_KEY = "sdkwork-mall-footprint";
const FOOTPRINT_LIMIT = 50;

export interface MpFavoriteItem {
  id: string;
  imageUrl: string;
  priceCny: number | null;
  title: string;
}

export interface MpFootprintItem {
  id: string;
  imageUrl: string;
  title: string;
  viewedAt: string;
}

function readList<T>(storageKey: string): T[] {
  try {
    const raw = wx.getStorageSync(storageKey);
    if (typeof raw !== "string" || raw === "") {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeList<T>(storageKey: string, items: T[]): void {
  wx.setStorageSync(storageKey, JSON.stringify(items));
}

export function readFavorites(): MpFavoriteItem[] {
  return readList<MpFavoriteItem>(FAVORITES_STORAGE_KEY);
}

export function isFavorite(productId: string): boolean {
  return readFavorites().some((item) => item.id === productId);
}

/** Toggles the favorite and returns the new state (true = favorited). */
export function toggleFavorite(item: MpFavoriteItem): boolean {
  const favorites = readFavorites();
  const exists = favorites.some((entry) => entry.id === item.id);
  const next = exists
    ? favorites.filter((entry) => entry.id !== item.id)
    : [{ ...item }, ...favorites];
  writeList(FAVORITES_STORAGE_KEY, next);
  return !exists;
}

export function removeFavorite(productId: string): void {
  writeList(
    FAVORITES_STORAGE_KEY,
    readFavorites().filter((entry) => entry.id !== productId),
  );
}

export function recordFootprint(item: Omit<MpFootprintItem, "viewedAt">): void {
  if (!item.id) {
    return;
  }
  const rest = readList<MpFootprintItem>(FOOTPRINT_STORAGE_KEY).filter(
    (entry) => entry.id !== item.id,
  );
  writeList(FOOTPRINT_STORAGE_KEY, [
    { ...item, viewedAt: new Date().toISOString() },
    ...rest,
  ].slice(0, FOOTPRINT_LIMIT));
}

export function readFootprint(): MpFootprintItem[] {
  return readList<MpFootprintItem>(FOOTPRINT_STORAGE_KEY);
}

export function clearFootprint(): void {
  writeList(FOOTPRINT_STORAGE_KEY, []);
}

/** Rehydrates service records into the display shape used by the PDP. */
export function favoriteFromRecord(record: MpRecord): MpFavoriteItem {
  return {
    id: String(record.id ?? ""),
    imageUrl: String(record.imageUrl ?? ""),
    priceCny: typeof record.priceCny === "number" ? record.priceCny : null,
    title: String(record.title ?? "商品"),
  };
}
