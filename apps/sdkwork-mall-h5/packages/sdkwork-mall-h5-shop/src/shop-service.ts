import {
  getSdkworkCommerceService,
  unwrapSdkworkCommerceResponse,
} from "@sdkwork/mall-commerce-service";

export interface MallH5ShopSummary {
  id: string;
  logoUrl?: string;
  name: string;
  rating?: number | null;
}

export interface MallH5ShopProduct {
  id: string;
  imageUrl?: string;
  priceCny: number | null;
  sales?: number;
  title: string;
}

export interface MallH5ShopDetail extends MallH5ShopSummary {
  products: MallH5ShopProduct[];
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

function readImage(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function readShopSummary(item: Record<string, unknown>): MallH5ShopSummary {
  return {
    id: String(item.id ?? item.shopId ?? ""),
    logoUrl: readImage(item.logoUrl ?? item.logo ?? item.icon),
    name: String(item.name ?? item.title ?? item.shopName ?? "店铺"),
    rating: readMoney(item.rating ?? item.score),
  };
}

export async function listMallH5FeaturedShops(pageSize = 4): Promise<MallH5ShopSummary[]> {
  const response = await getSdkworkCommerceService().shops.list({
    page: 1,
    page_size: pageSize,
    status: "active",
  });
  const payload = unwrapSdkworkCommerceResponse<{ items?: Record<string, unknown>[] }>(response) ?? {};
  return (payload.items ?? []).map(readShopSummary).filter((shop) => shop.id);
}

export async function retrieveMallH5Shop(shopId: string): Promise<MallH5ShopDetail | null> {
  const remote = getSdkworkCommerceService();
  const [shopResponse, productsResponse] = await Promise.all([
    remote.shops.retrieve(shopId),
    remote.catalog.spus
      .list({ page: 1, page_size: 20, shop_id: shopId })
      .catch(() => null),
  ]);
  const shop = unwrapSdkworkCommerceResponse<Record<string, unknown>>(shopResponse);
  if (!shop?.id) {
    return null;
  }
  const productsPayload = productsResponse
    ? (unwrapSdkworkCommerceResponse<{ items?: Record<string, unknown>[] }>(productsResponse) ?? {})
    : {};
  return {
    ...readShopSummary(shop),
    products: (productsPayload.items ?? []).map((item) => ({
      id: String(item.id ?? item.spuId ?? ""),
      imageUrl: readImage(item.imageUrl ?? item.mainImage ?? item.image),
      priceCny: readMoney(item.priceCny ?? item.price ?? item.salePrice),
      sales: readMoney(item.sales ?? item.salesCount) ?? undefined,
      title: String(item.title ?? item.name ?? "商品"),
    })),
  };
}
