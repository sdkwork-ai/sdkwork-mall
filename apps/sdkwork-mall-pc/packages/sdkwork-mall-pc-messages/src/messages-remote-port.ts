/**
 * Remote port for the IM notification plane.
 *
 * The port is satisfied by the app bootstrap with the generated
 * `@sdkwork/im-app-sdk` notifications client, so this package never touches the
 * SDK transport directly (building-block rule: pages -> service -> port).
 */
export interface SdkworkMessagesNotificationsPort {
  listNotifications(query: { cursor?: string; pageSize?: number }): Promise<unknown>;
  retrieveNotification(notificationId: string): Promise<unknown>;
}

let messagesNotificationsPort: SdkworkMessagesNotificationsPort | null = null;

export function configureSdkworkMessagesNotificationsPort(
  port: SdkworkMessagesNotificationsPort | null,
): void {
  messagesNotificationsPort = port;
}

export function getSdkworkMessagesNotificationsPort(): SdkworkMessagesNotificationsPort {
  if (!messagesNotificationsPort) {
    throw new Error(
      "SDKWork messages notifications port is not configured. Call configureSdkworkMessagesNotificationsPort() from mall PC bootstrap.",
    );
  }
  return messagesNotificationsPort;
}
