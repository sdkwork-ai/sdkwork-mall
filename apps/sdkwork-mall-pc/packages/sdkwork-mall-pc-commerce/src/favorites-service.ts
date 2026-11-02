const FAVORITES_KEY = "sdkwork-mall-pc-favorites";

export interface MallFavoriteItem {
  id: string;
  title: string;
}

export function readMallFavorites(): MallFavoriteItem[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(FAVORITES_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as MallFavoriteItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function isMallFavorite(productId: string): boolean {
  return readMallFavorites().some((item) => item.id === productId);
}

export function toggleMallFavorite(item: MallFavoriteItem): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const existing = readMallFavorites();
  const found = existing.some((entry) => entry.id === item.id);
  const next = found
    ? existing.filter((entry) => entry.id !== item.id)
    : [{ ...item }, ...existing].slice(0, 100);
  window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
  return !found;
}

export function removeMallFavorite(productId: string) {
  if (typeof window === "undefined") {
    return;
  }
  const next = readMallFavorites().filter((item) => item.id !== productId);
  window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
}

const SHOP_FAVORITES_KEY = "sdkwork-mall-pc-shop-favorites";

export interface MallShopFavorite {
  id: string;
  name: string;
}

export function readMallShopFavorites(): MallShopFavorite[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(SHOP_FAVORITES_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as MallShopFavorite[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function isMallShopFavorite(shopId: string): boolean {
  return readMallShopFavorites().some((item) => item.id === shopId);
}

export function toggleMallShopFavorite(shop: MallShopFavorite): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const existing = readMallShopFavorites();
  const found = existing.some((entry) => entry.id === shop.id);
  const next = found
    ? existing.filter((entry) => entry.id !== shop.id)
    : [{ ...shop }, ...existing].slice(0, 50);
  window.localStorage.setItem(SHOP_FAVORITES_KEY, JSON.stringify(next));
  return !found;
}

/** Clears every locally stored favourite (settings screen: clear local data). */
export function clearMallFavorites(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(FAVORITES_KEY);
  window.localStorage.removeItem(SHOP_FAVORITES_KEY);
}