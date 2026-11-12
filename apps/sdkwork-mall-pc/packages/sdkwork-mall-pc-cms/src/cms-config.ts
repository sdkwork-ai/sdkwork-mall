export interface MallCmsBanner {
  enabled: boolean;
  id: string;
  imageUrl?: string;
  linkUrl: string;
  sortOrder: number;
  subtitle?: string;
  title: string;
}

export interface MallCmsFloor {
  enabled: boolean;
  id: string;
  productQuery?: string;
  sortOrder: number;
  title: string;
}

export interface MallCmsHotKeyword {
  enabled: boolean;
  id: string;
  keyword: string;
  sortOrder: number;
}

export interface MallCmsConfig {
  banners: MallCmsBanner[];
  floors: MallCmsFloor[];
  hotKeywords: MallCmsHotKeyword[];
  updatedAt: string;
}

import {
  readAccountScopedItem,
  writeAccountScopedItem,
} from "@sdkwork/mall-pc-core/session";

const CMS_STORAGE_KEY = "sdkwork-mall-pc-cms-config";

export const defaultMallCmsConfig = (): MallCmsConfig => ({
  updatedAt: new Date().toISOString(),
  banners: [
    {
      id: "banner-flash-sale",
      title: "限时秒杀",
      subtitle: "全品类限时优惠",
      linkUrl: "/activity",
      sortOrder: 0,
      enabled: true,
    },
    {
      id: "banner-brand-day",
      title: "品牌日",
      subtitle: "大牌专享优惠券",
      linkUrl: "/search?q=brand",
      sortOrder: 1,
      enabled: true,
    },
  ],
  floors: [
    { id: "floor-hot", title: "热卖爆款", productQuery: "", sortOrder: 0, enabled: true },
    { id: "floor-new", title: "新品首发", productQuery: "new", sortOrder: 1, enabled: true },
  ],
  hotKeywords: [
    { id: "kw-phone", keyword: "手机", sortOrder: 0, enabled: true },
    { id: "kw-laptop", keyword: "笔记本", sortOrder: 1, enabled: true },
    { id: "kw-appliance", keyword: "家电", sortOrder: 2, enabled: true },
  ],
});

/**
 * CMS configuration fallback is tenant-scoped: an admin of another tenant must
 * never read or re-publish the previous tenant's banners/floors/keywords.
 */
export function readMallCmsConfig(): MallCmsConfig {
  if (typeof window === "undefined") {
    return defaultMallCmsConfig();
  }
  try {
    const raw = readAccountScopedItem(CMS_STORAGE_KEY);
    if (!raw) {
      return defaultMallCmsConfig();
    }
    const parsed = JSON.parse(raw) as MallCmsConfig;
    return {
      ...defaultMallCmsConfig(),
      ...parsed,
      banners: parsed.banners ?? defaultMallCmsConfig().banners,
      floors: parsed.floors ?? defaultMallCmsConfig().floors,
      hotKeywords: parsed.hotKeywords ?? defaultMallCmsConfig().hotKeywords,
    };
  } catch {
    return defaultMallCmsConfig();
  }
}

export function writeMallCmsConfig(config: MallCmsConfig) {
  if (typeof window === "undefined") {
    return;
  }
  writeAccountScopedItem(
    CMS_STORAGE_KEY,
    JSON.stringify({ ...config, updatedAt: new Date().toISOString() }),
  );
}

export function listEnabledMallCmsBanners(config = readMallCmsConfig()) {
  return [...config.banners]
    .filter((banner) => banner.enabled)
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

export function listEnabledMallCmsFloors(config = readMallCmsConfig()) {
  return [...config.floors]
    .filter((floor) => floor.enabled)
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

export function listEnabledMallCmsHotKeywords(config = readMallCmsConfig()) {
  return [...config.hotKeywords]
    .filter((keyword) => keyword.enabled)
    .sort((left, right) => left.sortOrder - right.sortOrder);
}
