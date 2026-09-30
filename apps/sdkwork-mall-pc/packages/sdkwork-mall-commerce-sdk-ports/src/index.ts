type CommerceSdkMethod = (...args: unknown[]) => Promise<unknown>;

type MethodTree = {
  readonly [key: string]: true | MethodTree;
};

export type ClientFromMethodTree<TTree extends MethodTree> = {
  readonly [TKey in keyof TTree]: TTree[TKey] extends true
    ? CommerceSdkMethod
    : TTree[TKey] extends MethodTree
      ? ClientFromMethodTree<TTree[TKey]>
      : never;
};

export const APP_COMMERCE_METHOD_TREE = {
  accounts: { current: { summary: { retrieve: true } } },
  shops: { list: true, retrieve: true },
  catalog: {
    categories: { list: true, retrieve: true },
    spus: { list: true, retrieve: true },
    products: { list: true, retrieve: true },
  },
  cart: {
    current: { retrieve: true },
    items: { create: true, update: true, delete: true },
  },
  addresses: {
    list: true,
    create: true,
    update: true,
    delete: true,
    defaultSelection: { create: true },
  },
  checkout: {
    sessions: {
      create: true,
      orders: { create: true },
      quotes: { create: true },
    },
  },
  orders: {
    list: true,
    create: true,
    retrieve: true,
    pay: true,
    paymentSuccess: { retrieve: true },
  },
  payments: { methods: { list: true } },
  afterSales: {
    requests: { list: true, create: true, retrieve: true, update: true },
    events: { list: true },
    returnShipments: { list: true },
  },
  wallet: {
    overview: { retrieve: true },
    holds: { create: true },
    accounts: { points: { retrieve: true } },
  },
  promotions: {
    offers: { list: true, retrieve: true },
    userCoupons: { list: true },
    discountApplications: { create: true },
  },
  billing: { history: { list: true } },
  invoices: {
    create: true,
    retrieve: true,
    update: true,
    mine: { list: true },
    items: { list: true },
    statistics: { retrieve: true },
    cancellations: { create: true },
    submissions: { create: true },
  },
} as const satisfies MethodTree;

export const BACKEND_COMMERCE_METHOD_TREE = {
  promotions: {
    offers: {
      create: true,
      update: true,
      management: { list: true },
    },
  },
  catalog: { products: { create: true } },
  inventory: { stocks: { update: true } },
  payments: {
    providerAccounts: { create: true },
    reconciliationRuns: { list: true },
  },
  commerceReports: { paymentReconciliation: { retrieve: true } },
  audit: { commerceEvents: { list: true } },
} as const satisfies MethodTree;

export type CommerceAppTransport = ClientFromMethodTree<typeof APP_COMMERCE_METHOD_TREE>;
export type CommerceBackendTransport = ClientFromMethodTree<typeof BACKEND_COMMERCE_METHOD_TREE>;

export type CommerceAppSdkClient = {
  commerce: CommerceAppTransport;
};

export type CommerceBackendSdkClient = {
  commerce: CommerceBackendTransport;
};

export type SdkworkCommerceService = CommerceAppTransport & {
  admin: CommerceBackendTransport;
};

function flattenMethodTree(tree: MethodTree, prefix = ""): string[] {
  const methods: string[] = [];
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value === true) {
      methods.push(`commerce.${path}`);
      continue;
    }
    methods.push(...flattenMethodTree(value, path));
  }
  return methods;
}

export const SDKWORK_COMMERCE_APP_SDK_REQUIRED_METHODS = flattenMethodTree(APP_COMMERCE_METHOD_TREE);
export const SDKWORK_COMMERCE_BACKEND_SDK_REQUIRED_METHODS = flattenMethodTree(BACKEND_COMMERCE_METHOD_TREE);

export function assertCommerceAppSdkClient(client: CommerceAppSdkClient): CommerceAppSdkClient {
  if (!client?.commerce) {
    throw new Error("Commerce app SDK client must expose a commerce transport namespace.");
  }
  return client;
}

export function assertCommerceBackendSdkClient(client: CommerceBackendSdkClient): CommerceBackendSdkClient {
  if (!client?.commerce) {
    throw new Error("Commerce backend SDK client must expose a commerce transport namespace.");
  }
  return client;
}
