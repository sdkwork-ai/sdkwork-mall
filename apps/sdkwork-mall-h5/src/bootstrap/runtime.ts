import type { SdkworkCommerceService } from "@sdkwork/mall-commerce-service";
import { createDriveUploadImageService } from "@sdkwork/drive-upload-image-core";
import { configureMallH5AfterSalesMediaRuntimePort } from "@sdkwork/mall-h5-buyer";

import { configureSdkworkMallH5Providers } from "./commerceProviders";
import { createSdkworkMallH5DriveAppClient } from "./driveClient";
import {
  resolveSdkworkMallH5RuntimeConfig,
  type SdkworkMallH5RuntimeConfig,
} from "./environment";
import { configureSdkworkMallH5ImProviders } from "./imProviders";
import {
  createSdkworkMallH5IamRuntime,
  createSdkworkMallH5SdkClientsWithTokenManager,
  type SdkworkMallH5IamRuntime,
} from "./iamRuntime";
import {
  sdkworkMallH5Routes,
  type SdkworkMallH5RouteContribution,
} from "./routes";
import {
  createSdkworkMallH5SessionStore,
  registerSdkworkMallH5SessionStoreLocator,
  type SdkworkMallH5SessionStore,
} from "./sessionStore";
import { createSdkworkMallH5SessionTokenManager } from "./sessionTokenManager";
import type { SdkworkMallH5SdkClientInventory } from "./sdkClients";
import { SDKWORK_MALL_H5_AFTER_SALES_EVIDENCE_UPLOAD } from "./uploadDeclaration";

export interface SdkworkMallH5Runtime {
  commerceService: SdkworkCommerceService;
  config: SdkworkMallH5RuntimeConfig;
  iamRuntime: SdkworkMallH5IamRuntime;
  routes: readonly SdkworkMallH5RouteContribution[];
  sdkClients: SdkworkMallH5SdkClientInventory;
  session: SdkworkMallH5SessionStore;
}

export function createSdkworkMallH5Runtime(): SdkworkMallH5Runtime {
  const config = resolveSdkworkMallH5RuntimeConfig();
  const session = createSdkworkMallH5SessionStore(
    typeof window === "undefined" ? undefined : window.localStorage,
  );
  registerSdkworkMallH5SessionStoreLocator(() => session);
  const tokenManager = createSdkworkMallH5SessionTokenManager(session);
  const sdkClients = createSdkworkMallH5SdkClientsWithTokenManager(config, tokenManager);
  const iamRuntime = createSdkworkMallH5IamRuntime({
    config,
    sdkClients,
    session,
  });
  const { commerceService } = configureSdkworkMallH5Providers({
    config,
    iamRuntime,
    sdkClients,
  });
  configureSdkworkMallH5ImProviders({ config, sdkClients });
  configureSdkworkMallH5AfterSalesMediaPort(config, tokenManager);

  return {
    commerceService,
    config,
    iamRuntime,
    routes: sdkworkMallH5Routes,
    sdkClients,
    session,
  };
}

/**
 * Drive-backed evidence uploads for the buyer after-sales form.
 *
 * The media port binds the declared after-sales evidence intent
 * (`SDKWORK_MALL_H5_AFTER_SALES_EVIDENCE_UPLOAD`) to the composed drive
 * uploader; evidence snapshot items carry the returned `drive://` reference
 * next to their declared file metadata. Hosts that never compose this port
 * get a refuse-with-hint picker instead of a local-only fake upload.
 */
function configureSdkworkMallH5AfterSalesMediaPort(
  config: SdkworkMallH5RuntimeConfig,
  tokenManager: ReturnType<typeof createSdkworkMallH5SessionTokenManager>,
): void {
  const driveClient = createSdkworkMallH5DriveAppClient(config, tokenManager);
  const imageService = createDriveUploadImageService({
    uploader: driveClient.uploader,
    declaration: SDKWORK_MALL_H5_AFTER_SALES_EVIDENCE_UPLOAD,
  });

  configureMallH5AfterSalesMediaRuntimePort({
    async uploadImages(files: File[]): Promise<string[]> {
      const references: string[] = [];
      for (const file of files) {
        const uploaded = await imageService.upload({
          file,
          appResourceId: SDKWORK_MALL_H5_AFTER_SALES_EVIDENCE_UPLOAD.scene,
        });
        references.push(uploaded.uri);
      }
      return references;
    },
  });
}
