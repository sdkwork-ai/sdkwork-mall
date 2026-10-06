/**
 * Single transport seam for the mini-program.
 *
 * Every network call in the app funnels through `request()` so envelope
 * unwrapping, auth headers, timeouts, and error mapping live in exactly one
 * place. Pages and services never call wx.request directly.
 */
import { getAccessToken, getToken } from "./session";

const DEFAULT_TIMEOUT_MS = 15000;

/** One MP record payload (the `data` member of the success envelope). */
export type MpPayload = Record<string, unknown>;

export interface MpRequestOptions {
  path: string;
  method?: "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
  body?: Record<string, unknown>;
  query?: Record<string, string | number | boolean | undefined>;
  timeoutMs?: number;
}

/** Error carrying the platform problem fields (`code`, `traceId`). */
export class SdkworkRequestError extends Error {
  constructor(
    message: string,
    fields: { cause?: unknown; code?: string | number; statusCode?: number; traceId?: string } = {},
  ) {
    super(message);
    this.name = "SdkworkRequestError";
    this.code = fields.code;
    this.traceId = fields.traceId;
    this.statusCode = fields.statusCode;
    if (fields.cause !== undefined) {
      this.cause = fields.cause;
    }
  }

  code?: string | number;
  traceId?: string;
  statusCode?: number;
  cause?: unknown;
}

export interface MpRawResponse {
  statusCode: number;
  header: Record<string, string>;
  data: ArrayBuffer;
}

function getBaseUrl(): string {
  const app = getApp<{ globalData?: { commerceApiBaseUrl?: string } }>();
  return app?.globalData?.commerceApiBaseUrl || "https://api-dev.sdkwork.com/app/v3/api";
}

/**
 * Performs a request against the commerce app-api and unwraps the
 * SdkWorkApiResponse envelope (`{ code, data, traceId }`).
 * HTTP/problem errors reject with a SdkworkRequestError.
 */
export function request(options: MpRequestOptions): Promise<MpPayload> {
  const { path, method = "GET", body, query, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  let url = `${getBaseUrl()}${path}`;
  if (query) {
    const search = Object.keys(query)
      .filter((key) => query[key] !== undefined && query[key] !== null && query[key] !== "")
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(String(query[key]))}`)
      .join("&");
    if (search) {
      url += `?${search}`;
    }
  }

  const header: Record<string, string> = { "content-type": "application/json" };
  const token = getToken();
  if (token) {
    header.authorization = `Bearer ${token}`;
  }
  const accessToken = getAccessToken();
  if (accessToken) {
    header["access-token"] = accessToken;
  }

  return new Promise<MpPayload>((resolve, reject) => {
    wx.request({
      url,
      // `PATCH` sits outside the wx.request documented method list; the
      // platform passes explicit methods through, and the after-sales revoke
      // command is a PATCH on the wire contract.
      method: method as unknown as "GET",
      data: body,
      header,
      timeout: timeoutMs,
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const payload = res.data;
          if (payload && typeof payload === "object" && !Array.isArray(payload) && "code" in payload) {
            if (Number(payload.code) === 0) {
              const data = (payload as { data?: unknown }).data;
              resolve(data !== null && typeof data === "object" && !Array.isArray(data)
                ? (data as MpPayload)
                : {});
              return;
            }
            reject(
              new SdkworkRequestError(
                String((payload as { message?: unknown }).message ?? `请求失败（${payload.code}）`),
                {
                  code: (payload as { code?: string | number }).code,
                  traceId: String((payload as { traceId?: unknown }).traceId ?? ""),
                },
              ),
            );
            return;
          }
          resolve(payload as MpPayload);
          return;
        }
        const problem = (res.data ?? {}) as Record<string, unknown>;
        reject(
          new SdkworkRequestError(
            String(
              problem.detail
                ?? problem.title
                ?? problem.message
                ?? `请求失败（HTTP ${res.statusCode}）`,
            ),
            {
              code: (problem.code ?? res.statusCode) as string | number,
              statusCode: res.statusCode,
              traceId: String(problem.traceId ?? ""),
            },
          ),
        );
      },
      fail(cause) {
        reject(
          new SdkworkRequestError(
            cause?.errMsg ? `网络请求失败：${cause.errMsg}` : "网络请求失败",
            { cause },
          ),
        );
      },
    });
  });
}

/**
 * Raw byte PUT for the drive presigned storage hop (`DRIVE_SPEC.md` §9).
 *
 * The presigned upload is a bare body transfer with an ETag response header —
 * no envelope, no auth projection. It lives inside the transport seam so the
 * "pages and services never call wx.request directly" rule stays intact.
 */
export function rawRequest(options: {
  url: string;
  method: "PUT";
  body: ArrayBuffer;
  contentType?: string;
  timeoutMs?: number;
}): Promise<MpRawResponse> {
  const { url, method, body, contentType = "application/octet-stream", timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  return new Promise<MpRawResponse>((resolve, reject) => {
    wx.request({
      url,
      // `PATCH` sits outside the wx.request documented method list; the
      // platform passes explicit methods through, and the presigned storage
      // hop is a PUT on the wire contract.
      method: method as unknown as "GET",
      data: body,
      header: { "content-type": contentType },
      timeout: timeoutMs,
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const header: Record<string, string> = {};
          for (const [key, value] of Object.entries(res.header ?? {})) {
            header[key.toLowerCase()] = String(value);
          }
          resolve({
            statusCode: res.statusCode,
            header,
            data:
              res.data instanceof ArrayBuffer
                ? res.data
                : new ArrayBuffer(0),
          });
          return;
        }
        reject(
          new SdkworkRequestError(`存储上传失败（HTTP ${res.statusCode}）`, {
            statusCode: res.statusCode,
          }),
        );
      },
      fail(cause) {
        reject(
          new SdkworkRequestError(
            cause?.errMsg ? `存储上传失败：${cause.errMsg}` : "存储上传失败",
            { cause },
          ),
        );
      },
    });
  });
}
