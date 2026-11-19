/**
 * Generated SDK client factories for the SDKWork Mall mini program.
 *
 * Authority: `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` section 7 and
 * `APP_SDK_INTEGRATION_SPEC.md`: the root owns client construction, capability
 * packages consume injected clients or ports, and platform login codes are
 * exchanged through the IAM module rather than feature-local HTTP.
 *
 * Boundaries by domain owner:
 * - IAM (`@sdkwork/iam-app-sdk`): the WeChat exchange, session revalidation and
 *   logout — driven by `@sdkwork/iam-mp-core/session-wechat`;
 * - IM (`@sdkwork/im-app-sdk`): the notification plane;
 * - IM (`@sdkwork/im-sdk`): the conversation/message plane, which the
 *   `@sdkwork/im-mp-chat` services consume through their injected resolver.
 *
 * Every client reads credentials through the injected token manager, so a login
 * or logout is visible to all of them without rebuilding a client.
 */
import { createClient as createIamAppClient, type SdkworkAppClient as IamAppClient } from "@sdkwork/iam-app-sdk";
import { createClient as createImAppClient, type SdkworkAppClient as ImAppClient } from "@sdkwork/im-app-sdk";
import { ImSdkClient } from "@sdkwork/im-sdk";
import type { MpSocket } from "@sdkwork/mall-mp-host";
import {
  createClient as createCloudRouterDomainsClient,
  type CloudRouterCommerceAppClient,
} from "@sdkwork/cloudrouter-app-sdk/domains";
import { createClient as createOrderAppClient, type SdkworkAppClient as OrderAppClient } from "@sdkwork/order-app-sdk";
import { createClient as createPartnerAppClient, type SdkworkAppClient as PartnerAppClient } from "@sdkwork/partner-app-sdk";
import { uuid } from "@sdkwork/utils";

import type { MpTokenManager } from "../session";

/** WeChat mini program provider key registered in the IAM OAuth catalog. */
export const MP_WECHAT_PROVIDER_CODE = "wechat_mini_program" as const;

export type IamAppSdkClient = IamAppClient;
export type ImAppSdkClient = ImAppClient;
export type MpCommerceAppSdkClient = CloudRouterCommerceAppClient;
export type MpOrderAppSdkClient = OrderAppClient;
export type MpPartnerAppSdkClient = PartnerAppClient;
/**
 * Conversation/message client.
 *
 * Typed as the generated IM runtime SDK instance; `@sdkwork/im-mp-chat`'s
 * `ImMpChatSdkPort` is the structural view of it, which the messaging capability
 * applies when it builds its services (that package owns the port type, this
 * package owns client construction).
 */
export type ImChatSdkClient = ImSdkClient;

export interface MpSdkClientOptions {
  /** App-api origin, e.g. `https://api.example.com/app/v3/api`. */
  readonly baseUrl: string;
  /** Host realtime adapter; required for the chat plane to go live. */
  readonly socket?: MpSocket;
  readonly tokenManager: MpTokenManager;
  readonly timeoutMs?: number;
}

function normalizeBaseUrl(baseUrl: string): string {
  const normalized = baseUrl.trim().replace(/\/+$/u, "");
  if (!normalized) {
    throw new Error("SDK base URL is required before client construction");
  }
  return normalized;
}

/**
 * Idempotency parameters for order commands.
 *
 * The order block requires an `Idempotency-Key` header on cancellations and
 * receipt confirmations; the key comes from the shared SDKWork uuid helper so the
 * mini program does not grow a bespoke identifier generator (it falls back when
 * `crypto` is unavailable, which is the WeChat case).
 */
export function createMpIdempotencyParams(idempotencyKey?: string): { idempotencyKey: string } {
  return { idempotencyKey: idempotencyKey ?? uuid() };
}

/**
 * Builds the IAM app SDK client.
 *
 * `platform: "mini-program"` is reported to IAM so a session created here is
 * distinguishable from a PC/H5 session of the same account.
 */
export function createMpIamAppSdkClient(options: MpSdkClientOptions): IamAppSdkClient {
  return createIamAppClient({
    authMode: "dual-token",
    baseUrl: normalizeBaseUrl(options.baseUrl),
    platform: "mini-program",
    ...(options.timeoutMs !== undefined ? { timeout: options.timeoutMs } : {}),
    tokenManager: options.tokenManager,
  });
}

/** Builds the IM app SDK client used by the notification plane. */
export function createMpImAppSdkClient(options: MpSdkClientOptions): ImAppSdkClient {
  return createImAppClient({
    authMode: "dual-token",
    baseUrl: normalizeBaseUrl(options.baseUrl),
    platform: "mini-program",
    ...(options.timeoutMs !== undefined ? { timeout: options.timeoutMs } : {}),
    tokenManager: options.tokenManager,
  });
}

/**
 * Builds the mall commerce app SDK client.
 *
 * Commerce is the federated Cloud Router commerce facade
 * (`@sdkwork/cloudrouter-app-sdk/domains`); the retired standalone commerce
 * transport package must not be reintroduced. The facade groups the generated
 * commerce transports under `.commerce`, which is the namespace the capability
 * services consume as `commerceClient.catalog` / `.cart` / ….
 */
export function createMpCommerceAppSdkClient(options: MpSdkClientOptions): MpCommerceAppSdkClient {
  const client = createCloudRouterDomainsClient({
    authMode: "dual-token",
    baseUrl: normalizeBaseUrl(options.baseUrl),
    platform: "mini-program",
    ...(options.timeoutMs !== undefined ? { timeout: options.timeoutMs } : {}),
    tokenManager: options.tokenManager,
  });
  return client.commerce;
}

/**
 * Builds the order app SDK client.
 *
 * The generated order block exposes `orders` (list/retrieve/statistics, payments,
 * cancellations, receipts, payment-success, discount), `checkout`, `shipments`
 * and `afterSales` — the same operations the H5 client reaches through the
 * composed `@sdkwork/order-service` facade, minus that facade's Node-style `.ts`
 * import specifiers, which the mini-program compiler does not resolve.
 */
export function createMpOrderAppSdkClient(options: MpSdkClientOptions): MpOrderAppSdkClient {
  return createOrderAppClient({
    authMode: "dual-token",
    baseUrl: normalizeBaseUrl(options.baseUrl),
    platform: "mini-program",
    ...(options.timeoutMs !== undefined ? { timeout: options.timeoutMs } : {}),
    tokenManager: options.tokenManager,
  });
}

/**
 * Builds the partner app SDK client.
 *
 * The partner block owns the join programme (`join.partnerJoin`) and the partner
 * centre (`center.partnerCenter`); the distributor capability projects it.
 */
export function createMpPartnerAppSdkClient(options: MpSdkClientOptions): MpPartnerAppSdkClient {
  return createPartnerAppClient({
    authMode: "dual-token",
    baseUrl: normalizeBaseUrl(options.baseUrl),
    platform: "mini-program",
    ...(options.timeoutMs !== undefined ? { timeout: options.timeoutMs } : {}),
    tokenManager: options.tokenManager,
  });
}

/**
 * Builds the IM conversation/message client.
 *
 * The generated IM runtime SDK is the only surface that exposes
 * `conversations.list/listMessages/postText/updateReadCursor`; the
 * `@sdkwork/im-mp-chat` services take it through a resolver. When a host socket
 * is available it is adapted to the SDK's `ImWebSocketFactory`, which enables the
 * realtime plane; without one the client stays HTTP-only and the chat page keeps
 * its polling fallback.
 */
export function createMpImChatSdkClient(options: MpSdkClientOptions): ImChatSdkClient {
  const socket = options.socket;
  return new ImSdkClient({
    apiBaseUrl: normalizeBaseUrl(options.baseUrl),
    platform: "mini-program",
    ...(options.timeoutMs !== undefined ? { timeout: options.timeoutMs } : {}),
    tokenManager: options.tokenManager,
    ...(socket
      ? {
          // `MpSocketConnection` is the platform-neutral `WebSocket` subset the
          // IM SDK's factory expects; the cast is the documented boundary.
          webSocketFactory: (url: string, factoryOptions: { headers: Record<string, string>; protocols: string[] }) =>
            socket.connect({
              url,
              header: factoryOptions.headers,
              protocols: factoryOptions.protocols,
            }),
        }
      : {}),
  });
}
