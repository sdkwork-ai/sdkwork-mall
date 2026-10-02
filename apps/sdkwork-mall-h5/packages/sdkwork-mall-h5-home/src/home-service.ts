import {
  getSdkworkCommerceService,
  unwrapSdkworkCommerceResponse,
} from "@sdkwork/mall-commerce-service";

export interface MallH5HomeProductCard {
  id: string;
  imageUrl?: string;
  priceCny: number | null;
  sales?: number;
  title: string;
}

export interface MallH5HomeCategory {
  id: string;
  name: string;
}

export interface MallH5HomeShop {
  id: string;
  logoUrl?: string;
  name: string;
  rating?: number | null;
}

export interface MallH5HomeOffer {
  discountText?: string;
  endAt?: string;
  highlight?: string;
  id: string;
  startAt?: string;
  title: string;
}

export interface MallH5HomeSnapshot {
  categories: MallH5HomeCategory[];
  featuredShops: MallH5HomeShop[];
  hotProducts: MallH5HomeProductCard[];
  newProducts: MallH5HomeProductCard[];
  offers: MallH5HomeOffer[];
}

function readMoney(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function readProductCard(item: Record<string, unknown>): MallH5HomeProductCard {
  const image = item.imageUrl ?? item.mainImage ?? item.image;
  return {
    id: String(item.id ?? item.spuId ?? ""),
    imageUrl: typeof image === "string" && image ? image : undefined,
    priceCny: readMoney(item.priceCny ?? item.price ?? item.salePrice),
    sales: readMoney(item.sales ?? item.salesCount) ?? undefined,
    title: String(item.title ?? item.name ?? "商品"),
  };
}

export async function loadMallH5HomeSnapshot(): Promise<MallH5HomeSnapshot> {
  const commerce = getSdkworkCommerceService();
  const [categoriesResult, hotResult, newResult, shopsResult, offersResult] = await Promise.allSettled([
    commerce.catalog.categories.list({ page: 1, page_size: 10, status: "active" }),
    commerce.catalog.spus.list({ page: 1, page_size: 10, sort: "sales" }),
    commerce.catalog.spus.list({ page: 1, page_size: 10, sort: "newest" }),
    commerce.shops.list({ page: 1, page_size: 4, status: "active" }),
    commerce.promotions.offers.list({ page: 1, page_size: 6, status: "active" }),
  ]);

  const categoriesPayload =
    categoriesResult.status === "fulfilled"
      ? (unwrapSdkworkCommerceResponse<{ items?: Record<string, unknown>[] }>(categoriesResult.value) ?? { items: [] })
      : { items: [] };
  const hotPayload =
    hotResult.status === "fulfilled"
      ? (unwrapSdkworkCommerceResponse<{ items?: Record<string, unknown>[] }>(hotResult.value) ?? { items: [] })
      : { items: [] };
  const newPayload =
    newResult.status === "fulfilled"
      ? (unwrapSdkworkCommerceResponse<{ items?: Record<string, unknown>[] }>(newResult.value) ?? { items: [] })
      : { items: [] };

  const shopsPayload =
    shopsResult.status === "fulfilled"
      ? (unwrapSdkworkCommerceResponse<{ items?: Record<string, unknown>[] }>(shopsResult.value) ?? { items: [] })
      : { items: [] };

  const offersPayload =
    offersResult.status === "fulfilled"
      ? (unwrapSdkworkCommerceResponse<{ items?: Record<string, unknown>[] }>(offersResult.value) ?? { items: [] })
      : { items: [] };

  const readOfferTime = (record: Record<string, unknown>, keys: readonly string[]): string | undefined => {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === "string" && value) {
        return value;
      }
    }
    return undefined;
  };

  return {
    categories: (categoriesPayload.items ?? []).map((item) => ({
      id: String(item.id ?? ""),
      name: String(item.name ?? item.title ?? "类目"),
    })),
    featuredShops: (shopsPayload.items ?? [])
      .map((item) => ({
        id: String(item.id ?? item.shopId ?? ""),
        logoUrl: typeof (item.logoUrl ?? item.logo) === "string" ? String(item.logoUrl ?? item.logo) : undefined,
        name: String(item.name ?? item.title ?? item.shopName ?? "店铺"),
        rating: readMoney(item.rating ?? item.score),
      }))
      .filter((shop) => shop.id)
      .slice(0, 4),
    hotProducts: (hotPayload.items ?? []).map(readProductCard),
    newProducts: (newPayload.items ?? []).map(readProductCard),
    offers: (offersPayload.items ?? [])
      .map((item) => ({
        discountText: typeof item.discountText === "string" ? item.discountText : undefined,
        endAt: readOfferTime(item, ["endAt", "endTime", "expiresAt"]),
        highlight: typeof item.highlight === "string" ? item.highlight : undefined,
        id: String(item.id ?? item.offerId ?? ""),
        startAt: readOfferTime(item, ["startAt", "startTime"]),
        title: String(item.title ?? item.name ?? "活动"),
      }))
      .filter((offer) => offer.id),
  };
}
