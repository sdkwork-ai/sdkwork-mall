import type {
  MallDefaultDataCmsConfigShape,
  MallDefaultDataPort,
} from "../src/default-data/port";

export interface FakeMallDefaultDataPortState {
  brands: Record<string, unknown>[];
  attributes: Record<string, unknown>[];
  categoryAttributes: Record<string, unknown>[];
  priceLists: Record<string, unknown>[];
  priceListItems: Record<string, unknown>[];
  categories: Record<string, unknown>[];
  shops: Record<string, unknown>[];
  products: Record<string, unknown>[];
  skus: Record<string, unknown>[];
  offers: Record<string, unknown>[];
  plans: Record<string, unknown>[];
  packageGroups: Record<string, unknown>[];
  packages: Record<string, unknown>[];
  cms: MallDefaultDataCmsConfigShape;
  cmsPreset: string | null;
}

export interface FakeMallDefaultDataPortOptions {
  /** Natural key (categoryNo/spuNo/code/...) whose create call throws. */
  readonly failOn?: string;
  readonly preexisting?: boolean;
}

export interface FakeMallDefaultDataPort extends MallDefaultDataPort {
  readonly state: FakeMallDefaultDataPortState;
  readonly calls: { readonly created: string[]; readonly published: string[]; readonly cmsWrites: number };
}

const EMPTY_CMS: MallDefaultDataCmsConfigShape = {
  banners: [],
  floors: [],
  hotKeywords: [],
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function okItem(item: string | Record<string, unknown>): Record<string, unknown> {
  const resource = typeof item === "string" ? { id: item } : item;
  return { data: { item: resource }, code: 0 };
}

function okList(items: readonly Record<string, unknown>[]): Record<string, unknown> {
  return { data: { items }, code: 0 };
}

function pickKey(body: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const value = body[key];
    if (typeof value === "string" && value) {
      return value;
    }
  }
  return "";
}

/**
 * In-memory provisioning port used by the default-data tests.
 *
 * It mirrors the server contract tightly enough to prove idempotency: creates
 * return `{ data: { item: { id } } }`, lists return `{ data: { items } }`, and
 * natural keys are stored exactly as the plan sends them.
 */
export function createFakeMallDefaultDataPort(
  options: FakeMallDefaultDataPortOptions = {},
): FakeMallDefaultDataPort {
  let sequence = 0;
  let cmsWriteCount = 0;
  const nextId = (prefix: string) => `${prefix}-${(sequence += 1)}`;
  const created: string[] = [];
  const published: string[] = [];
  const state: FakeMallDefaultDataPortState = {
    brands: [],
    attributes: [],
    categoryAttributes: [],
    priceLists: [],
    priceListItems: [],
    categories: [],
    shops: [],
    products: [],
    skus: [],
    offers: [],
    plans: [],
    packageGroups: [],
    packages: [],
    cms: { ...EMPTY_CMS },
    cmsPreset: null,
  };

  const failIfRequested = (naturalKey: string) => {
    if (options.failOn && options.failOn === naturalKey) {
      throw new Error(`forced failure for ${naturalKey}`);
    }
  };

  const port: FakeMallDefaultDataPort = {
    state,
    calls: {
      created,
      published,
      get cmsWrites() {
        return cmsWriteCount;
      },
    },
    catalog: {
      async listBrands() {
        return okList(state.brands ?? []);
      },
      async createBrand(body) {
        const brandNo = pickKey(body, ["brandNo"]);
        const id = nextId("brand");
        if (state.brands) state.brands.push({ ...body, id });
        created.push(brandNo);
        return okItem({ id, version: 0, status: "active" });
      },
      async listAttributes() {
        return okList(state.attributes ?? []);
      },
      async createAttribute(body) {
        const attributeNo = pickKey(body, ["attributeNo"]);
        const id = nextId("attr");
        if (state.attributes) {
          const values = Array.isArray(body.values)
            ? (body.values as string[]).map((displayValue, index) => ({
              id: `${id}-v${index + 1}`,
              valueCode: `V${index + 1}`,
              displayValue,
            }))
            : [];
          state.attributes.push({ ...body, id, values });
        }
        created.push(attributeNo);
        return okItem({ id, version: 0, status: "active" });
      },
      async listAttributeValues(params) {
        const attributeId = params?.attributeId;
        const values = (state.attributes ?? [])
          .filter((attribute) => !attributeId || attribute.id === attributeId)
          .flatMap((attribute) => (attribute.values ?? []) as Record<string, unknown>[]);
        return okList(values);
      },
      async listCategoryAttributes() {
        return okList(state.categoryAttributes ?? []);
      },
      async listPriceLists() {
        return okList(state.priceLists ?? []);
      },
      async createPriceList(body) {
        const priceListNo = pickKey(body, ["priceListNo"]);
        const id = nextId("plist");
        if (state.priceLists) state.priceLists.push({ ...body, id });
        created.push(priceListNo);
        return okItem({ id, version: 0, status: "active" });
      },
      async listPriceListItems() {
        return okList(state.priceListItems ?? []);
      },
      async createPriceListItem(body) {
        const id = nextId("pitem");
        if (state.priceListItems) state.priceListItems.push({ ...body, id });
        created.push(String(body.skuId ?? ""));
        return okItem({ id, version: 0, status: "active" });
      },
      async createCategoryAttribute(body) {
        const id = nextId("binding");
        if (state.categoryAttributes) state.categoryAttributes.push({ ...body, id });
        created.push(`${body.categoryId}:${body.attributeId}`);
        return okItem({ id, version: 0, status: "active" });
      },
      async listCategories() {
        return okList(state.categories);
      },
      async createCategory(body) {
        const categoryNo = pickKey(body, ["categoryNo"]);
        failIfRequested(categoryNo);
        const id = nextId("cat");
        state.categories.push({ ...body, id });
        created.push(categoryNo);
        return okItem(id);
      },
      async listProducts() {
        return okList(state.products);
      },
      async createProduct(body) {
        // Authority resources key on `productNo`; legacy rows still carry
        // `spuNo`, so both spellings resolve the natural key.
        const productNo = pickKey(body, ["productNo", "product_no", "spuNo", "spu_no"]);
        failIfRequested(productNo);
        const id = nextId("spu");
        // A fresh authority row is a draft at version 0; the list rows carry
        // the same resource shape the guarded commands read back.
        const record = { ...body, id, status: "draft", version: 0 };
        state.products.push(record);
        created.push(productNo);
        return okItem({ id, version: 0, status: "draft" });
      },
      async publishProduct(productId, expectedVersion) {
        published.push(productId);
        const record = state.products.find((product) => product.id === productId);
        if (record) {
          record.status = "active";
          record.version = (expectedVersion ?? 0) + 1;
        }
        // The authority answers a guarded command with the row's post-write version.
        return okItem({ id: productId, version: (expectedVersion ?? 0) + 1, status: "active" });
      },
      async listSkus() {
        return okList(state.skus);
      },
      async createSku(body) {
        const skuNo = pickKey(body, ["skuNo"]);
        failIfRequested(skuNo);
        const id = nextId("sku");
        state.skus.push({ ...body, id });
        created.push(skuNo);
        return okItem(id);
      },
    },
    shops: {
      async listShops() {
        return okList(state.shops);
      },
      async createShop(body) {
        const shopName = pickKey(body, ["shopName"]);
        failIfRequested(shopName);
        const id = nextId("shop");
        state.shops.push({ ...body, id });
        created.push(shopName);
        return okItem(id);
      },
    },
    promotions: {
      async listOffers() {
        return okList(state.offers);
      },
      async createOffer(body) {
        const code = pickKey(body, ["code"]);
        failIfRequested(code);
        const id = nextId("offer");
        state.offers.push({ ...body, id });
        created.push(code);
        return okItem(id);
      },
    },
    memberships: {
      async listPlans() {
        return okList(state.plans);
      },
      async createPlan(body) {
        const code = pickKey(body, ["code"]);
        failIfRequested(code);
        const id = nextId("plan");
        state.plans.push({ ...body, id });
        created.push(code);
        return okItem(id);
      },
      async listPackageGroups() {
        return okList(state.packageGroups);
      },
      async createPackageGroup(body) {
        const code = pickKey(body, ["code"]);
        failIfRequested(code);
        const id = nextId("group");
        state.packageGroups.push({ ...body, id });
        created.push(code);
        return okItem(id);
      },
      async listPackages() {
        return okList(state.packages);
      },
      async createPackage(body) {
        const code = pickKey(body, ["code"]);
        failIfRequested(code);
        const id = nextId("package");
        state.packages.push({ ...body, id });
        created.push(code);
        return okItem(id);
      },
    },
    cms: {
      read() {
        return state.cms;
      },
      write(config) {
        state.cms = config;
        cmsWriteCount += 1;
      },
      readAppliedPreset() {
        return state.cmsPreset;
      },
      markAppliedPreset(presetId) {
        state.cmsPreset = presetId;
      },
    },
  };

  return port;
}
