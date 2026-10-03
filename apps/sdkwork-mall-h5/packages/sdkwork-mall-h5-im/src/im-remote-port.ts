/**
 * Remote port for the IM notification plane.
 *
 * The port is satisfied by the app bootstrap with the generated
 * `@sdkwork/im-app-sdk` notifications client, so this package never touches
 * the SDK transport directly (building-block rule: pages -> service -> port).
 */
export interface SdkworkImNotificationsPort {
  listNotifications(query: { cursor?: string; pageSize?: number }): Promise<unknown>;
  retrieveNotification(notificationId: string): Promise<unknown>;
}

let imNotificationsPort: SdkworkImNotificationsPort | null = null;

export function configureSdkworkImNotificationsPort(
  port: SdkworkImNotificationsPort | null,
): void {
  imNotificationsPort = port;
}

export function getSdkworkImNotificationsPort(): SdkworkImNotificationsPort {
  if (!imNotificationsPort) {
    throw new Error("IM notifications port is not configured.");
  }
  return imNotificationsPort;
}

/**
 * Chat plane base URL. Customer-service chat speaks the federation gateway's
 * chat endpoints through the package-local transport seam (im-transport.ts);
 * the base URL is injected by the app bootstrap.
 */
let imChatBaseUrl = "";

export function configureSdkworkImChatBaseUrl(baseUrl: string): void {
  imChatBaseUrl = baseUrl;
}

export function getSdkworkImChatBaseUrl(): string {
  return imChatBaseUrl;
}
