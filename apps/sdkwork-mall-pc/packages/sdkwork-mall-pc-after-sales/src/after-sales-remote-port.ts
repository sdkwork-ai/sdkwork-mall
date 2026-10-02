export interface SdkworkAfterSalesRemotePort {
  createAfterSalesRequest(body: Record<string, unknown>): Promise<unknown>;
  listAfterSalesEvents(afterSalesRequestId: string, query: Record<string, unknown>): Promise<unknown>;
  listAfterSalesRequests(query: Record<string, unknown>): Promise<unknown>;
  listReturnShipments(afterSalesRequestId: string, query: Record<string, unknown>): Promise<unknown>;
  retrieveAfterSalesRequest(afterSalesRequestId: string): Promise<unknown>;
  retrieveOrder(orderId: string): Promise<unknown>;
  updateAfterSalesRequest(afterSalesRequestId: string, body: Record<string, unknown>): Promise<unknown>;
}

let afterSalesRemotePort: SdkworkAfterSalesRemotePort | null = null;

export function configureSdkworkAfterSalesRemotePort(port: SdkworkAfterSalesRemotePort | null): void {
  afterSalesRemotePort = port;
}

export function getSdkworkAfterSalesRemotePort(): SdkworkAfterSalesRemotePort {
  if (!afterSalesRemotePort) {
    throw new Error(
      "SDKWork after-sales remote port is not configured. Call configureSdkworkAfterSalesRemotePort() from mall PC bootstrap.",
    );
  }
  return afterSalesRemotePort;
}
