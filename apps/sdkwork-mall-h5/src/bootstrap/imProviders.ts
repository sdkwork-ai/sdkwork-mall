import {
  configureSdkworkImChatBaseUrl,
  configureSdkworkImNotificationsPort,
} from "@sdkwork/mall-h5-im/im-remote-port";

import type { SdkworkMallH5RuntimeConfig } from "./environment";
import { loadSdkworkMallH5ImAppClient } from "./iamRuntime";
import { createSdkworkMallH5SessionTokenManager } from "./sessionTokenManager";

/**
 * Wires the IM planes for feature packages.
 *
 * The notifications port is satisfied by the generated `@sdkwork/im-app-sdk`
 * client, loaded on first use (it is not part of the first-load bundle).
 * Customer-service chat gets the federation gateway base URL for the
 * package-local chat transport seam.
 */
export function configureSdkworkMallH5ImProviders(input: {
  config: SdkworkMallH5RuntimeConfig;
  tokenManager: ReturnType<typeof createSdkworkMallH5SessionTokenManager>;
}): void {
  let clientPromise: ReturnType<typeof loadSdkworkMallH5ImAppClient> | null = null;
  const getClient = () => {
    clientPromise ??= loadSdkworkMallH5ImAppClient(input.config, input.tokenManager);
    return clientPromise;
  };

  configureSdkworkImNotificationsPort({
    async listNotifications(query) {
      const client = await getClient();
      return client.notifications.list({
        cursor: query.cursor,
        pageSize: query.pageSize,
      });
    },
    async retrieveNotification(notificationId) {
      const client = await getClient();
      return client.notifications.retrieve(notificationId);
    },
  });
  configureSdkworkImChatBaseUrl(input.config.appApiBaseUrl);
}
