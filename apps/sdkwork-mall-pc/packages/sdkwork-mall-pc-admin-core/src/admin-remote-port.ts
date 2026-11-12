/**
 * The merchandise backend catalog capability, authority-verbatim.
 *
 * The operation set and vocabularies follow `sdkwork-merchandise` (route
 * manifest `sdkwork-routes-merchandise-backend-api`, 38 operations under
 * `/backend/v3/api/catalog/*`). Every guarded write carries the row version the
 * caller last read (`API_SPEC` section 17): the version rides the write as the
 * `If-Match` precondition, and a stale caller is answered `412` instead of
 * silently discarding someone else's write.
 */
export interface SdkworkAdminCatalogNamespace {
  brands: {
    create(body: Record<string, unknown>): Promise<unknown>;
    delete(brandId: string, expectedVersion: number): Promise<unknown>;
    list(params?: Record<string, unknown>): Promise<unknown>;
    retrieve(brandId: string): Promise<unknown>;
    update(
      brandId: string,
      body: Record<string, unknown>,
      expectedVersion: number,
    ): Promise<unknown>;
  };
  attributes: {
    create(body: Record<string, unknown>): Promise<unknown>;
    management: { list(params?: Record<string, unknown>): Promise<unknown> };
    update(
      attributeId: string,
      body: Record<string, unknown>,
      expectedVersion: number,
    ): Promise<unknown>;
  };
  attributeValues: {
    create(body: Record<string, unknown>): Promise<unknown>;
    delete(valueId: string, expectedVersion: number): Promise<unknown>;
    list(params?: Record<string, unknown>): Promise<unknown>;
    update(
      valueId: string,
      body: Record<string, unknown>,
      expectedVersion: number,
    ): Promise<unknown>;
  };
  categories: {
    create(body: Record<string, unknown>): Promise<unknown>;
    delete(categoryId: string, expectedVersion: number): Promise<unknown>;
    management: { list(params?: Record<string, unknown>): Promise<unknown> };
    retrieve(categoryId: string): Promise<unknown>;
    update(
      categoryId: string,
      body: Record<string, unknown>,
      expectedVersion: number,
    ): Promise<unknown>;
  };
  categoryAttributes: {
    create(body: Record<string, unknown>): Promise<unknown>;
    delete(bindingId: string, expectedVersion: number): Promise<unknown>;
    list(params?: Record<string, unknown>): Promise<unknown>;
    update(
      bindingId: string,
      body: Record<string, unknown>,
      expectedVersion: number,
    ): Promise<unknown>;
  };
  media: {
    create(body: Record<string, unknown>): Promise<unknown>;
    delete(mediaId: string, expectedVersion: number): Promise<unknown>;
    list(params?: Record<string, unknown>): Promise<unknown>;
    update(
      mediaId: string,
      body: Record<string, unknown>,
      expectedVersion: number,
    ): Promise<unknown>;
  };
  priceListItems: {
    create(body: Record<string, unknown>): Promise<unknown>;
    delete(itemId: string, expectedVersion: number): Promise<unknown>;
    list(params?: Record<string, unknown>): Promise<unknown>;
    update(
      itemId: string,
      body: Record<string, unknown>,
      expectedVersion: number,
    ): Promise<unknown>;
  };
  priceLists: {
    create(body: Record<string, unknown>): Promise<unknown>;
    list(params?: Record<string, unknown>): Promise<unknown>;
    update(
      priceListId: string,
      body: Record<string, unknown>,
      expectedVersion: number,
    ): Promise<unknown>;
  };
  products: {
    archive(productId: string, expectedVersion: number): Promise<unknown>;
    attributes: {
      update(
        productId: string,
        body: Record<string, unknown>,
        expectedVersion: number,
      ): Promise<unknown>;
    };
    create(body: Record<string, unknown>): Promise<unknown>;
    delete(productId: string, expectedVersion: number): Promise<unknown>;
    management: {
      list(params?: Record<string, unknown>): Promise<unknown>;
      retrieve(productId: string): Promise<unknown>;
    };
    publish(productId: string, expectedVersion: number): Promise<unknown>;
    update(
      productId: string,
      body: Record<string, unknown>,
      expectedVersion: number,
    ): Promise<unknown>;
  };
  skus: {
    create(body: Record<string, unknown>): Promise<unknown>;
    delete(skuId: string, expectedVersion: number): Promise<unknown>;
    list(params?: Record<string, unknown>): Promise<unknown>;
    retrieve(skuId: string): Promise<unknown>;
    update(
      skuId: string,
      body: Record<string, unknown>,
      expectedVersion: number,
    ): Promise<unknown>;
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
