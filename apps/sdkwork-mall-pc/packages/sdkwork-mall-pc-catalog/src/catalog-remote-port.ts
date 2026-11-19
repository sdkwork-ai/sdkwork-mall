export interface SdkworkCatalogRemotePort {
  createCartItem(body: Record<string, unknown>): Promise<unknown>;
  updateCartItem(cartItemId: string, body: Record<string, unknown>): Promise<unknown>;
  listPromotionOffers(query: Record<string, unknown>): Promise<unknown>;
  retrieveCategory(query: Record<string, unknown>): Promise<unknown>;
  retrieveSpu(query: Record<string, unknown>): Promise<unknown>;
}

let catalogRemotePort: SdkworkCatalogRemotePort | null = null;

export function configureSdkworkCatalogRemotePort(port: SdkworkCatalogRemotePort | null): void {
  catalogRemotePort = port;
}

export function getSdkworkCatalogRemotePort(): SdkworkCatalogRemotePort {
  if (!catalogRemotePort) {
    throw new Error(
      "SDKWork catalog remote port is not configured. Call configureSdkworkCatalogRemotePort() from mall PC bootstrap.",
    );
  }
  return catalogRemotePort;
}
