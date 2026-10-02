export const SDKWORK_MALL_H5_CART_COUNT_STORAGE_KEY = "sdkwork-mall-h5-cart-count";
export const SDKWORK_MALL_H5_SESSION_STORAGE_KEY = "sdkwork-mall-h5-session";
export const SDKWORK_MALL_H5_CART_COUNT_EVENT = "sdkwork-mall-h5-cart-count-changed";

export function formatMallH5Cny(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return "--";
  }
  return `¥${value.toFixed(2)}`;
}

export function formatMallH5Timestamp(value: string | undefined): string {
  if (!value) {
    return "--";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "--" : date.toLocaleString("zh-CN");
}

export function clampMallH5Quantity(value: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1;
}

export function readMallH5CartCount(): number {
  if (typeof window === "undefined") {
    return 0;
  }
  const raw = window.localStorage.getItem(SDKWORK_MALL_H5_CART_COUNT_STORAGE_KEY);
  if (!raw) {
    return 0;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

/**
 * Persists the cart size and notifies in-document listeners. The shell badge
 * subscribes to the custom event plus the `storage` event so counts update
 * without waiting for a route re-render.
 */
export function writeMallH5CartCount(totalQuantity: number): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(SDKWORK_MALL_H5_CART_COUNT_STORAGE_KEY, String(Math.max(0, totalQuantity)));
  window.dispatchEvent(
    new CustomEvent(SDKWORK_MALL_H5_CART_COUNT_EVENT, { detail: { totalQuantity } }),
  );
}

export function subscribeMallH5CartCount(onChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  window.addEventListener(SDKWORK_MALL_H5_CART_COUNT_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(SDKWORK_MALL_H5_CART_COUNT_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
