export interface SdkworkAdminCatalogNamespace {
  attributes: {
    create(body: Record<string, unknown>): Promise<unknown>;
    management: { list(params?: Record<string, unknown>): Promise<unknown> };
  };
  categories: {
    create(body: Record<string, unknown>): Promise<unknown>;
    delete(categoryId: string): Promise<unknown>;
    management: { list(params?: Record<string, unknown>): Promise<unknown> };
    update(categoryId: string, body: Record<string, unknown>): Promise<unknown>;
  };
  categoryAttributes: {
    create(body: Record<string, unknown>): Promise<unknown>;
    delete(bindingId: string): Promise<unknown>;
    list(params?: Record<string, unknown>): Promise<unknown>;
    update(bindingId: string, body: Record<string, unknown>): Promise<unknown>;
  };
  categorySeeds: {
    create(body: Record<string, unknown>): Promise<unknown>;
  };
  priceLists: {
    create(body: Record<string, unknown>): Promise<unknown>;
    list(params?: Record<string, unknown>): Promise<unknown>;
  };
  products: {
    create(body: Record<string, unknown>): Promise<unknown>;
    delete(productId: string): Promise<unknown>;
    management: {
      list(params?: Record<string, unknown>): Promise<unknown>;
      retrieve(productId: string): Promise<unknown>;
    };
    update(productId: string, body: Record<string, unknown>): Promise<unknown>;
  };
  skus: {
    create(body: Record<string, unknown>): Promise<unknown>;
    delete(skuId: string): Promise<unknown>;
    list(params?: Record<string, unknown>): Promise<unknown>;
    update(skuId: string, body: Record<string, unknown>): Promise<unknown>;
  };
}

export interface SdkworkAdminMembershipsNamespace {
  members: {
    list(params?: Record<string, unknown>): Promise<unknown>;
    update(
      membershipId: string,
      input: Record<string, unknown>,
      requestParams?: Record<string, unknown>,
    ): Promise<unknown>;
  };
  packageGroups: {
    create(input: Record<string, unknown>, requestParams?: Record<string, unknown>): Promise<unknown>;
    delete(packageGroupId: string, requestParams?: Record<string, unknown>): Promise<unknown>;
    management: { list(params?: Record<string, unknown>): Promise<unknown> };
    update(
      packageGroupId: string,
      input: Record<string, unknown>,
      requestParams?: Record<string, unknown>,
    ): Promise<unknown>;
  };
  packages: {
    create(input: Record<string, unknown>, requestParams?: Record<string, unknown>): Promise<unknown>;
    delete(packageId: string, requestParams?: Record<string, unknown>): Promise<unknown>;
    management: { list(params?: Record<string, unknown>): Promise<unknown> };
    update(
      packageId: string,
      input: Record<string, unknown>,
      requestParams?: Record<string, unknown>,
    ): Promise<unknown>;
  };
  plans: {
    create(input: Record<string, unknown>, requestParams?: Record<string, unknown>): Promise<unknown>;
    delete(levelId: string, requestParams?: Record<string, unknown>): Promise<unknown>;
    management: { list(params?: Record<string, unknown>): Promise<unknown> };
    update(
      levelId: string,
      input: Record<string, unknown>,
      requestParams?: Record<string, unknown>,
    ): Promise<unknown>;
  };
}

export interface SdkworkAdminCommerceNamespace {
  afterSales: {
    management: {
      list(query: Record<string, unknown>): Promise<unknown>;
      retrieve(afterSalesRequestId: string): Promise<unknown>;
    };
    reviews: {
      create(afterSalesId: string, body: Record<string, unknown>): Promise<unknown>;
    };
  };
  audit: {
    commerceEvents: {
      list(query: Record<string, unknown>): Promise<unknown>;
    };
  };
  catalog: SdkworkAdminCatalogNamespace;
  commerceReports: {
    orderRevenue: { list(query: Record<string, unknown>): Promise<unknown> };
    refunds: { list(query: Record<string, unknown>): Promise<unknown> };
  };
  entitlements: {
    grants: {
      list(params?: Record<string, unknown>): Promise<unknown>;
    };
  };
  memberships: SdkworkAdminMembershipsNamespace;
  orders: {
    management: {
      cancel(orderId: string, body?: Record<string, unknown>): Promise<unknown>;
      close(orderId: string, body?: Record<string, unknown>): Promise<unknown>;
      list(query: Record<string, unknown>): Promise<unknown>;
      retrieve(orderId: string): Promise<unknown>;
    };
  };
  promotions: {
    couponLedgerEntries: { list(query: Record<string, unknown>): Promise<unknown> };
    couponStocks: { list(query: Record<string, unknown>): Promise<unknown> };
    offers: {
      create(body: Record<string, unknown>): Promise<unknown>;
      management: { list(query: Record<string, unknown>): Promise<unknown> };
      update(offerId: string, body: Record<string, unknown>): Promise<unknown>;
    };
    userCoupons: { management: { list(query: Record<string, unknown>): Promise<unknown> } };
  };
  reports: {
    commerceOverview: { retrieve(query: Record<string, unknown>): Promise<unknown> };
  };
  shops: {
    approve(shopId: string, body?: Record<string, unknown>): Promise<unknown>;
    brandAuthorizations: {
      list(shopId: string, query?: Record<string, unknown>): Promise<unknown>;
    };
    depositAccount: { retrieve(query: Record<string, unknown>): Promise<unknown> };
    management: {
      list(query: Record<string, unknown>): Promise<unknown>;
      retrieve(shopId: string): Promise<unknown>;
    };
    riskSignals: {
      list(query: Record<string, unknown>): Promise<unknown>;
      resolve(shopId: string, signalId: string, body?: Record<string, unknown>): Promise<unknown>;
    };
    settlementProfile: { approve(shopId: string, body?: Record<string, unknown>): Promise<unknown> };
    suspend(shopId: string, body?: Record<string, unknown>): Promise<unknown>;
  };
}

export interface SdkworkAdminRemotePort {
  admin: SdkworkAdminCommerceNamespace;
}

let adminRemotePort: SdkworkAdminRemotePort | null = null;

export function configureSdkworkAdminRemotePort(port: SdkworkAdminRemotePort | null): void {
  adminRemotePort = port;
}

export function getSdkworkAdminRemotePort(): SdkworkAdminRemotePort {
  if (!adminRemotePort) {
    throw new Error(
      "SDKWork admin remote port is not configured. Call configureSdkworkAdminRemotePort() from mall PC bootstrap.",
    );
  }
  return adminRemotePort;
}
