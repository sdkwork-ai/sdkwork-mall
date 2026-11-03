/**
 * Provisioning port.
 *
 * The default-data engine never talks to an SDK directly: the app bootstrap
 * adapts the federated commerce backend client onto this port, and tests drive
 * an in-memory fake. Every method returns the raw transport value so the engine
 * owns envelope parsing in one place.
 */

export interface MallDefaultDataCmsConfigShape {
  readonly banners: readonly {
    readonly enabled: boolean;
    readonly id: string;
    readonly imageUrl?: string;
    readonly linkUrl: string;
    readonly sortOrder: number;
    readonly subtitle?: string;
    readonly title: string;
  }[];
  readonly floors: readonly {
    readonly enabled: boolean;
    readonly id: string;
    readonly productQuery?: string;
    readonly sortOrder: number;
    readonly title: string;
  }[];
  readonly hotKeywords: readonly {
    readonly enabled: boolean;
    readonly id: string;
    readonly keyword: string;
    readonly sortOrder: number;
  }[];
  readonly updatedAt: string;
}

/** Transport surface required to provision the default dataset. */
export interface MallDefaultDataPort {
  readonly catalog: {
    listCategories(): Promise<unknown>;
    createCategory(body: Record<string, unknown>): Promise<unknown>;
    listProducts(): Promise<unknown>;
    createProduct(body: Record<string, unknown>): Promise<unknown>;
    publishProduct(productId: string): Promise<unknown>;
    listSkus(): Promise<unknown>;
    createSku(body: Record<string, unknown>): Promise<unknown>;
  };
  readonly shops: {
    listShops(): Promise<unknown>;
    createShop(body: Record<string, unknown>): Promise<unknown>;
  };
  readonly promotions: {
    listOffers(): Promise<unknown>;
    createOffer(body: Record<string, unknown>): Promise<unknown>;
  };
  readonly memberships: {
    listPlans(): Promise<unknown>;
    createPlan(body: Record<string, unknown>): Promise<unknown>;
    listPackageGroups(): Promise<unknown>;
    createPackageGroup(body: Record<string, unknown>): Promise<unknown>;
    listPackages(): Promise<unknown>;
    createPackage(body: Record<string, unknown>): Promise<unknown>;
  };
  readonly cms: {
    read(): MallDefaultDataCmsConfigShape;
    write(config: MallDefaultDataCmsConfigShape): void;
    /** Id of the default-data CMS preset already applied on this surface, if any. */
    readAppliedPreset(): string | null;
    /** Records that a preset was applied, so a rerun leaves operator edits alone. */
    markAppliedPreset(presetId: string): void;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Reads a list payload from any of the envelope shapes the commerce transports
 * return today: `{ data: { items } }`, `{ items }`, a bare array, or the
 * generated SDK's already-unwrapped `{ items }`.
 */
export function readDefaultDataItems(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }
  if (!isRecord(value)) {
    return [];
  }
  const data = value.data;
  if (isRecord(data) && Array.isArray(data.items)) {
    return data.items.filter(isRecord);
  }
  if (Array.isArray(value.items)) {
    return value.items.filter(isRecord);
  }
  return [];
}

/** Reads a single resource payload: `{ data: { item } }`, `{ item }` or the record itself. */
export function readDefaultDataItem(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) {
    return null;
  }
  const data = value.data;
  if (isRecord(data) && isRecord(data.item)) {
    return data.item;
  }
  if (isRecord(value.item)) {
    return value.item;
  }
  if ("id" in value) {
    return value;
  }
  if (isRecord(data)) {
    return data;
  }
  return null;
}

/** Extracts the created resource id from a create response, tolerating envelope variants. */
export function readDefaultDataId(value: unknown): string {
  const item = readDefaultDataItem(value);
  if (item) {
    const id = item.id ?? item.categoryId ?? item.productId ?? item.shopId ?? item.offerId ?? item.planId ?? item.packageId;
    if (typeof id === "string" && id.trim()) {
      return id;
    }
    if (typeof id === "number" && Number.isFinite(id)) {
      return String(id);
    }
  }
  if (isRecord(value)) {
    const data = value.data;
    if (isRecord(data)) {
      const id = data.resourceId ?? data.id;
      if (typeof id === "string" && id.trim()) {
        return id;
      }
    }
  }
  return "";
}

/** Reads the first non-empty string field, tolerating snake_case and camelCase transports. */
export function readDefaultDataString(
  record: Record<string, unknown>,
  keys: readonly string[],
): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return "";
}
