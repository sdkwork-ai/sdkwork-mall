import { getSdkworkCommerceService } from "@sdkwork/mall-commerce-service";
import { configureSdkworkAfterSalesRemotePort } from "@sdkwork/mall-pc-after-sales";
import { configureSdkworkMessagesRemotePort } from "@sdkwork/mall-pc-messages";
import { configureSdkworkReviewsRemotePort } from "@sdkwork/mall-pc-reviews";

export function configureSdkworkMallPcBuyerCommerceRemotePorts(): void {
  const commerce = () => getSdkworkCommerceService();

  configureSdkworkReviewsRemotePort({
    listOrders(query) {
      return commerce().orders.list(query);
    },
  });

  configureSdkworkMessagesRemotePort({
    listAfterSalesRequests(query) {
      return commerce().afterSales.requests.list(query);
    },
    listOrders(query) {
      return commerce().orders.list(query);
    },
  });

  configureSdkworkAfterSalesRemotePort({
    createAfterSalesRequest(body) {
      return commerce().afterSales.requests.create(body);
    },
    listAfterSalesEvents(afterSalesRequestId, query) {
      return commerce().afterSales.events.list(afterSalesRequestId, query);
    },
    listAfterSalesRequests(query) {
      return commerce().afterSales.requests.list(query);
    },
    listReturnShipments(afterSalesRequestId, query) {
      return commerce().afterSales.returnShipments.list(afterSalesRequestId, query);
    },
    retrieveAfterSalesRequest(afterSalesRequestId) {
      return commerce().afterSales.requests.retrieve(afterSalesRequestId);
    },
    retrieveOrder(orderId) {
      return commerce().orders.retrieve(orderId);
    },
    updateAfterSalesRequest(afterSalesRequestId, body) {
      return commerce().afterSales.requests.update(afterSalesRequestId, body);
    },
  });
}
