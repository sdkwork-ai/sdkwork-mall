import type {
  MallDefaultDataCmsConfigShape,
  MallDefaultDataPort,
} from "../src/default-data/port";

export interface FakeMallDefaultDataPortState {
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

function okItem(id: string): Record<string, unknown> {
  return { data: { item: { id } }, code: 0 };
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
        const spuNo = pickKey(body, ["spuNo"]);
        failIfRequested(spuNo);
        const id = nextId("spu");
        state.products.push({ ...body, id });
        created.push(spuNo);
        return okItem(id);
      },
      async publishProduct(productId) {
        published.push(productId);
        return okItem(productId);
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
