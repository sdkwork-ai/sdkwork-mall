/**
 * `wx.request` adapter.
 *
 * Authority: `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` section 8. This is the only
 * module in the mall mini program allowed to touch `wx.request`; the commerce
 * envelope, auth headers and error mapping live in `@sdkwork/mall-mp-core`, and
 * business services never see this file.
 */
import { normalizeMpHostError, type MpHttpClient, type MpHttpResponse } from "../index";

export interface WxRequestApi {
  request(options: {
    data?: unknown;
    fail?(result: { errMsg?: string }): void;
    header?: Record<string, string>;
    method?: string;
    success?(result: { data: unknown; header: Record<string, string>; statusCode: number }): void;
    timeout?: number;
    url: string;
  }): { abort(): void };
}

export function createWeixinHttpClient(api: WxRequestApi): MpHttpClient {
  return {
    request(options) {
      return new Promise<MpHttpResponse>((resolve, reject) => {
        api.request({
          url: options.url,
          method: options.method ?? "GET",
          header: options.header,
          data: options.data,
          timeout: options.timeoutMs,
          success: (result) => resolve({
            statusCode: result.statusCode,
            header: result.header ?? {},
            data: result.data,
          }),
          fail: (failure) => reject(normalizeMpHostError(failure)),
        });
      });
    },

    requestBytes(options) {
      return new Promise<MpHttpResponse>((resolve, reject) => {
        api.request({
          url: options.url,
          method: options.method ?? "PUT",
          header: {
            "content-type": options.contentType ?? "application/octet-stream",
            ...(options.header ?? {}),
          },
          data: options.data,
          timeout: options.timeoutMs,
          success: (result) => resolve({
            statusCode: result.statusCode,
            header: result.header ?? {},
            data: result.data,
          }),
          fail: (failure) => reject(normalizeMpHostError(failure)),
        });
      });
    },
  };
}
