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

/** Storefront home section a read failure belongs to. */
export type MallHomeSection = "categories" | "hotProducts" | "newProducts" | "shops";

/**
 * One section read that failed while the rest of the page still rendered.
 *
 * Home is an aggregate of four independent commerce reads. A partially
 * reachable backend must degrade section by section, but a completely
 * unreachable one must never be reported as "the shop simply has no products":
 * an empty array and a broken transport look identical to a shopper.
 */
export interface MallHomeLoadIssue {
  readonly message: string;
  readonly section: MallHomeSection;
}

export interface MallHomeSnapshot {
  categories: MallHomeCategory[];
  featuredShops: MallHomeShopCard[];
  hotProducts: MallHomeProductCard[];
  newProducts: MallHomeProductCard[];
  /** Sections that failed on this load; empty when every read succeeded. */
  issues: readonly MallHomeLoadIssue[];
  /**
   * True when every read succeeded and the backend genuinely holds no catalog.
   * That is the first-run state an install reports instead of a silent blank.
   */
  isEmpty: boolean;
}

export interface MallHomeShopCard {
  description?: string;
  id: string;
  name: string;
}

/**
 * Raised when no home section could be read at all.
 *
 * The page surfaces this as an availability error with a retry action, so a
 * dead gateway (or a wrong API base URL) is distinguishable from a mall whose
 * catalog has not been provisioned yet.
 */
export class MallHomeUnavailableError extends Error {
  readonly issues: readonly MallHomeLoadIssue[];

  constructor(issues: readonly MallHomeLoadIssue[]) {
    const detail = issues
      .map((issue) => issue.message)
      .filter((message, index, all) => all.indexOf(message) === index)
      .slice(0, 2)
      .join(" / ");
    super(detail ? `首页数据加载失败：${detail}` : "首页数据加载失败");
    this.name = "MallHomeUnavailableError";
    this.issues = issues;
  }
}

const SECTION_LABELS: Readonly<Record<MallHomeSection, string>> = {
  categories: "类目",
  hotProducts: "热卖商品",
  newProducts: "新品",
  shops: "店铺",
};

function describeFailure(cause: unknown, section: MallHomeSection): string {
  const suffix = cause instanceof Error && cause.message ? `（${cause.message}）` : "";
  return `${SECTION_LABELS[section]}加载失败${suffix}`;
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

/**
 * Unwraps one settled section read into items, recording a section issue when
 * the transport rejected or the envelope reported a business failure.
 */
function takeItems(
  result: PromiseSettledResult<unknown>,
  section: MallHomeSection,
  issues: MallHomeLoadIssue[],
): Record<string, unknown>[] {
  if (result.status === "rejected") {
    issues.push({ message: describeFailure(result.reason, section), section });
    return [];
  }
  try {
    const payload = unwrapSdkworkPaymentResponse(result.value) as
      | { items?: Record<string, unknown>[] }
      | null;
    return payload?.items ?? [];
  } catch (cause) {
    issues.push({ message: describeFailure(cause, section), section });
    return [];
  }
}

export async function loadMallHomeSnapshot(): Promise<MallHomeSnapshot> {
  const remote = getSdkworkHomeRemotePort();
  const [categoriesResult, hotResult, newResult, shopsResult] = await Promise.allSettled([
    remote.listCategories({ page: 1, page_size: 10 }),
    remote.listSpus({ page: 1, page_size: 8, sort: "sales" }),
    remote.listSpus({ page: 1, page_size: 8, sort: "created_at" }),
    remote.listShops({ page: 1, page_size: 8 }),
  ]);

  const issues: MallHomeLoadIssue[] = [];

  const categories = takeItems(categoriesResult, "categories", issues).map((item) => ({
    id: String(item.id ?? ""),
    name: String(item.name ?? item.title ?? "类目"),
  }));

  const hotProducts = takeItems(hotResult, "hotProducts", issues).map((item) =>
    readProductCard(item));

  const newProducts = takeItems(newResult, "newProducts", issues).map((item) =>
    readProductCard(item));

  const featuredShops = takeItems(shopsResult, "shops", issues)
    .map((item) => ({
      id: String(item.id ?? ""),
      name: String(item.name ?? item.title ?? item.shopName ?? "店铺"),
      description:
        typeof item.description === "string"
          ? item.description
          : typeof item.summary === "string"
            ? item.summary
            : undefined,
    }))
    .filter((shop) => shop.id);

  // Every section failed: this is an outage or a misconfigured API base URL,
  // not an unprovisioned catalog. Throwing keeps the two states distinct for
  // the shopper and for the first-run provisioning prompt.
  if (issues.length === 4) {
    throw new MallHomeUnavailableError(issues);
  }

  return {
    categories,
    featuredShops,
    hotProducts,
    newProducts,
    issues,
    isEmpty:
      issues.length === 0 &&
      categories.length === 0 &&
      hotProducts.length === 0 &&
      newProducts.length === 0 &&
      featuredShops.length === 0,
  };
}
