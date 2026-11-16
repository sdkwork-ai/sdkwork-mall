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

import type { MpTokenManager } from "../session";

/** WeChat mini program provider key registered in the IAM OAuth catalog. */
export const MP_WECHAT_PROVIDER_CODE = "wechat_mini_program" as const;

export type IamAppSdkClient = IamAppClient;
export type ImAppSdkClient = ImAppClient;
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
 * Builds the IM conversation/message client.
 *
 * The generated IM runtime SDK is the only surface that exposes
 * `conversations.list/listMessages/postText/updateReadCursor`; the
 * `@sdkwork/im-mp-chat` services take it through a resolver. Realtime
 * (`connect`) needs a `wx.connectSocket` factory, which the mall chat page does
 * not use yet: reads and sends are HTTP on the same client.
 */
export function createMpImChatSdkClient(options: MpSdkClientOptions): ImChatSdkClient {
  return new ImSdkClient({
    apiBaseUrl: normalizeBaseUrl(options.baseUrl),
    platform: "mini-program",
    ...(options.timeoutMs !== undefined ? { timeout: options.timeoutMs } : {}),
    tokenManager: options.tokenManager,
  });
}
