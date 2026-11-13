import { unwrapSdkworkPaymentResponse } from "@sdkwork/payment-service";
import { getSdkworkHomeRemotePort } from "./home-remote-port";

export interface MallHomeProductCard {
  brand?: string;
  freeShipping?: boolean;
  id: string;
  imageUrl?: string;
  inStock?: boolean;
  listPriceCny?: number | null;
  priceCny: number | null;
  rating?: number;
  salesCount?: number;
  selfOperated?: boolean;
  shopName?: string;
  subtitle?: string;
  title: string;
}

export interface MallHomeCategory {
  id: string;
  name: string;
}

export interface MallHomeSnapshot {
  categories: MallHomeCategory[];
  featuredShops: MallHomeShopCard[];
  hotProducts: MallHomeProductCard[];
  newProducts: MallHomeProductCard[];
}

export interface MallHomeShopCard {
  description?: string;
  id: string;
  name: string;
}

function readNumber(record: Record<string, unknown>, keys: readonly string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    // Money columns are decimal strings on some transports; a plain Number()
    // keeps "4299.00" from degrading a card to the "询价" fallback.
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
}

function readBoolean(record: Record<string, unknown>, keys: readonly string[]): boolean | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") {
      return value;
    }
  }
  return undefined;
}

function readProductCard(record: Record<string, unknown>): MallHomeProductCard {
  const media = record.primaryImage ?? record.coverImage ?? record.image;
  const images = Array.isArray(record.images) ? record.images : [];
  const firstImage = images.find((item) => typeof item === "string" && item !== "");
  const imageUrl =
    typeof media === "object" && media !== null && "url" in media
      ? String((media as { url?: unknown }).url ?? "")
      : typeof record.imageUrl === "string" && record.imageUrl
        ? record.imageUrl
        : typeof firstImage === "string"
          ? firstImage
          : undefined;

  const brand =
    typeof record.brand === "string"
      ? record.brand
      : typeof record.brandName === "string"
        ? record.brandName
        : undefined;

  const stock = readNumber(record, ["stock", "stockQuantity"]);

  return {
    id: String(record.id ?? record.spuId ?? ""),
    title: String(record.title ?? record.name ?? "商品"),
    subtitle: typeof record.subtitle === "string" ? record.subtitle : undefined,
    priceCny: readNumber(record, ["salePrice", "price", "priceCny"]) ?? null,
    listPriceCny:
      readNumber(record, ["listPrice", "marketPrice", "originalPrice", "priceList"]) ?? null,
    shopName: typeof record.shopName === "string" ? record.shopName : undefined,
    imageUrl: imageUrl || undefined,
    brand,
    rating: readNumber(record, ["rating", "averageRating"]),
    salesCount: readNumber(record, ["salesCount", "sales"]),
    selfOperated: readBoolean(record, ["selfOperated", "self_operated", "isSelfOperated"]),
    freeShipping: readBoolean(record, ["freeShipping", "free_shipping", "isFreeShipping"]),
    inStock: stock == null ? undefined : stock > 0,
  };
}

export async function loadMallHomeSnapshot(): Promise<MallHomeSnapshot> {
  const remote = getSdkworkHomeRemotePort();
  const [categoriesResult, hotResult, newResult, shopsResult] = await Promise.allSettled([
    remote.listCategories({ page: 1, page_size: 10 }),
    remote.listSpus({ page: 1, page_size: 8, sort: "sales" }),
    remote.listSpus({ page: 1, page_size: 8, sort: "created_at" }),
    remote.listShops({ page: 1, page_size: 8 }),
  ]);

  const categoriesPayload = categoriesResult.status === "fulfilled"
    ? (unwrapSdkworkPaymentResponse(categoriesResult.value) as { items?: Record<string, unknown>[] })
    : { items: [] as Record<string, unknown>[] };
  const categories = categoriesPayload.items?.map((item) => ({
    id: String(item.id ?? ""),
    name: String(item.name ?? item.title ?? "类目"),
  })) ?? [];

  const hotPayload = hotResult.status === "fulfilled"
    ? (unwrapSdkworkPaymentResponse(hotResult.value) as { items?: Record<string, unknown>[] })
    : { items: [] as Record<string, unknown>[] };
  const hotProducts = hotPayload.items?.map((item) => readProductCard(item)) ?? [];

  const newPayload = newResult.status === "fulfilled"
    ? (unwrapSdkworkPaymentResponse(newResult.value) as { items?: Record<string, unknown>[] })
    : { items: [] as Record<string, unknown>[] };
  const newProducts = newPayload.items?.map((item) => readProductCard(item)) ?? [];

  const shopsPayload = shopsResult.status === "fulfilled"
    ? (unwrapSdkworkPaymentResponse(shopsResult.value) as { items?: Record<string, unknown>[] })
    : { items: [] as Record<string, unknown>[] };
  const featuredShops =
    shopsPayload.items?.map((item) => ({
      id: String(item.id ?? ""),
      name: String(item.name ?? item.title ?? item.shopName ?? "店铺"),
      description:
        typeof item.description === "string"
          ? item.description
          : typeof item.summary === "string"
            ? item.summary
            : undefined,
    })).filter((shop) => shop.id) ?? [];

  return { categories, featuredShops, hotProducts, newProducts };
}
