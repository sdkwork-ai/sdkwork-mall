import {
  configureSdkworkImChatBaseUrl,
  configureSdkworkImNotificationsPort,
} from "@sdkwork/mall-h5-im/im-remote-port";

import type { SdkworkMallH5RuntimeConfig } from "./environment";
import type { SdkworkMallH5SdkClientInventory } from "./sdkClients";

/**
 * Wires the IM planes for feature packages:
 * - the notifications port is satisfied by the generated `@sdkwork/im-app-sdk`
 *   notifications client (same session token manager as every other family);
 * - customer-service chat gets the federation gateway base URL for the
 *   package-local chat transport seam.
 */
export function configureSdkworkMallH5ImProviders(input: {
  config: SdkworkMallH5RuntimeConfig;
  sdkClients: SdkworkMallH5SdkClientInventory;
}): void {
  configureSdkworkImNotificationsPort({
    listNotifications: (query) =>
      input.sdkClients.imAppClient.notifications.list({
        cursor: query.cursor,
        pageSize: query.pageSize,
      }),
    retrieveNotification: (notificationId) =>
      input.sdkClients.imAppClient.notifications.retrieve(notificationId),
  });
  configureSdkworkImChatBaseUrl(input.config.appApiBaseUrl);
  if (typeof window !== "undefined") {
    (window as unknown as Record<string, unknown>).__imAppClient = input.sdkClients.imAppClient;
  }
}
