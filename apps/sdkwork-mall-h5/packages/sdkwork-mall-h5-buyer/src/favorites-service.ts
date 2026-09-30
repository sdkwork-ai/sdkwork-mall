import { useEffect, useState } from "react";

const FAVORITES_STORAGE_KEY = "sdkwork-mall-h5-favorites";
const FOOTPRINT_STORAGE_KEY = "sdkwork-mall-h5-footprint";
const FOOTPRINT_LIMIT = 50;

export interface MallH5FavoriteItem {
  id: string;
  imageUrl?: string;
  priceCny: number | null;
  title: string;
}

export interface MallH5FootprintItem {
  id: string;
  imageUrl?: string;
  title: string;
  viewedAt: string;
}

function readList<T>(storageKey: string): T[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(storageKey);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeList<T>(storageKey: string, items: T[]): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(storageKey, JSON.stringify(items));
}

export function readMallH5Favorites(): MallH5FavoriteItem[] {
  return readList<MallH5FavoriteItem>(FAVORITES_STORAGE_KEY);
}

export function isMallH5Favorite(productId: string): boolean {
  return readMallH5Favorites().some((item) => item.id === productId);
}

export function toggleMallH5Favorite(item: MallH5FavoriteItem): boolean {
  const favorites = readMallH5Favorites();
  const exists = favorites.some((entry) => entry.id === item.id);
  const next = exists
    ? favorites.filter((entry) => entry.id !== item.id)
    : [item, ...favorites];
  writeList(FAVORITES_STORAGE_KEY, next);
  return !exists;
}

export function removeMallH5Favorite(productId: string): void {
  writeList(
    FAVORITES_STORAGE_KEY,
    readMallH5Favorites().filter((entry) => entry.id !== productId),
  );
}

export function recordMallH5Footprint(item: Omit<MallH5FootprintItem, "viewedAt">): void {
  const footprint = readMallH5Footprint().filter((entry) => entry.id !== item.id);
  writeList(FOOTPRINT_STORAGE_KEY, [{ ...item, viewedAt: new Date().toISOString() }, ...footprint].slice(0, FOOTPRINT_LIMIT));
}

export function readMallH5Footprint(): MallH5FootprintItem[] {
  return readList<MallH5FootprintItem>(FOOTPRINT_STORAGE_KEY);
}

export function clearMallH5Footprint(): void {
  writeList(FOOTPRINT_STORAGE_KEY, []);
}

export function useMallH5Favorites(): MallH5FavoriteItem[] {
  const [favorites, setFavorites] = useState<MallH5FavoriteItem[]>(() => readMallH5Favorites());
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === FAVORITES_STORAGE_KEY) {
        setFavorites(readMallH5Favorites());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return favorites;
}
