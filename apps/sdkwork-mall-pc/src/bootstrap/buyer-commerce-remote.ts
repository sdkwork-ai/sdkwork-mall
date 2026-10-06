import { getSdkworkCommerceService } from "@sdkwork/mall-commerce-service";
import { configureSdkworkAfterSalesRemotePort } from "@sdkwork/mall-pc-after-sales";
import { configureSdkworkMessagesRemotePort } from "@sdkwork/mall-pc-messages";
import { configureSdkworkReviewsRemotePort } from "@sdkwork/mall-pc-reviews";
import { createDriveUploadImageService } from "@sdkwork/drive-upload-image-core";
import { configureMallAfterSalesMediaRuntimePort } from "@sdkwork/mall-pc-after-sales";
import { createSdkworkMallPcDriveAppClient } from "./driveClient";
import { createSdkworkMallPcSessionTokenManager } from "./sessionTokenManager";
import { SDKWORK_MALL_PC_AFTER_SALES_EVIDENCE_UPLOAD } from "./uploadDeclaration";
import type { SdkworkMallPcRuntimeConfig } from "./environment";

export function configureSdkworkMallPcBuyerCommerceRemotePorts(input: {
  config: SdkworkMallPcRuntimeConfig;
  tokenManager: ReturnType<typeof createSdkworkMallPcSessionTokenManager>;
}): void {
  configureSdkworkMallPcBuyerAfterSalesMediaPort(input.config, input.tokenManager);
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

/**
 * Drive-backed evidence uploads for the buyer after-sales form.
 *
 * The media port binds the declared after-sales evidence intent
 * (`SDKWORK_MALL_PC_AFTER_SALES_EVIDENCE_UPLOAD`) to the composed drive
 * uploader; evidence snapshot items carry the returned `drive://` reference
 * next to their declared file metadata. Hosts that never compose this port
 * get a refuse-with-hint picker instead of a local-only fake upload.
 */
function configureSdkworkMallPcBuyerAfterSalesMediaPort(
  config: SdkworkMallPcRuntimeConfig,
  tokenManager: ReturnType<typeof createSdkworkMallPcSessionTokenManager>,
): void {
  const driveClient = createSdkworkMallPcDriveAppClient(config, tokenManager);
  const imageService = createDriveUploadImageService({
    uploader: driveClient.uploader,
    declaration: SDKWORK_MALL_PC_AFTER_SALES_EVIDENCE_UPLOAD,
  });

  configureMallAfterSalesMediaRuntimePort({
    async uploadImages(files: File[]): Promise<string[]> {
      const references: string[] = [];
      for (const file of files) {
        const uploaded = await imageService.upload({
          file,
          appResourceId: SDKWORK_MALL_PC_AFTER_SALES_EVIDENCE_UPLOAD.scene,
        });
        references.push(uploaded.uri);
      }
      return references;
    },
  });
}
