export const SDKWORK_MALL_H5_CART_COUNT_STORAGE_KEY = "sdkwork-mall-h5-cart-count";
export const SDKWORK_MALL_H5_SESSION_STORAGE_KEY = "sdkwork-mall-h5-session";

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
