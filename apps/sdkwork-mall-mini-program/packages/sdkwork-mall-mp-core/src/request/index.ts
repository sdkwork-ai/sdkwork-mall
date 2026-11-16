/**
 * Commerce app-api request seam for the SDKWork Mall mini program.
 *
 * Authority: `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` section 7 and `API_SPEC.md`
 * sections 4.5/14/15. Every `/app/v3/api` call funnels through `request()` so the
 * envelope unwrap (`{ code, data, traceId }`), the dual-token headers, the
 * timeout, and the `application/problem+json` mapping live in exactly one place.
 *
 * The platform hop itself belongs to the host (`MpHttpClient`); this module only
 * decides what to send and how to interpret the answer.
 */
import type { MpHttpClient, MpHttpResponse } from "@sdkwork/mall-mp-host";

import type { MpSessionStore } from "../session";

const DEFAULT_TIMEOUT_MS = 15_000;

/** One record payload (the `data` member of the success envelope). */
export type MpPayload = Record<string, unknown>;

export interface MpRequestOptions {
  readonly body?: Record<string, unknown>;
  /** Extra request headers, e.g. the `Idempotency-Key` of a command. */
  readonly headers?: Record<string, string>;
  readonly method?: "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
  readonly path: string;
  readonly query?: Record<string, string | number | boolean | undefined>;
  readonly timeoutMs?: number;
}

export interface MpRawRequestOptions {
  readonly body: ArrayBuffer;
  readonly contentType?: string;
  readonly method: "PUT";
  readonly timeoutMs?: number;
  readonly url: string;
}

export interface MpRawResponse {
  readonly data: ArrayBuffer;
  readonly header: Record<string, string>;
  readonly statusCode: number;
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

export interface MpRequestClient {
  rawRequest(options: MpRawRequestOptions): Promise<MpRawResponse>;
  request(options: MpRequestOptions): Promise<MpPayload>;
}

export interface CreateMpRequestClientOptions {
  /** Resolved per call so a runtime env swap (devtools profile switch) is honoured. */
  readonly baseUrl: () => string;
  readonly http: MpHttpClient;
  readonly session: MpSessionStore;
  readonly timeoutMs?: number;
}

function buildQuery(query: MpRequestOptions["query"]): string {
  if (!query) {
    return "";
  }
  return Object.keys(query)
    .filter((key) => query[key] !== undefined && query[key] !== null && query[key] !== "")
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(String(query[key]))}`)
    .join("&");
}

function isEnvelope(payload: unknown): payload is { code: unknown; data?: unknown; message?: unknown; traceId?: unknown } {
  return Boolean(payload) && typeof payload === "object" && !Array.isArray(payload) && "code" in (payload as object);
}

function unwrapEnvelope(payload: unknown): MpPayload {
  const record = payload as { code: unknown; data?: unknown; message?: unknown; traceId?: unknown };
  if (Number(record.code) === 0) {
    const data = record.data;
    return data !== null && typeof data === "object" && !Array.isArray(data) ? (data as MpPayload) : {};
  }
  throw new SdkworkRequestError(
    String(record.message ?? `请求失败（${String(record.code)}）`),
    { code: record.code as string | number, traceId: String(record.traceId ?? "") },
  );
}

function toProblemError(response: MpHttpResponse): SdkworkRequestError {
  const problem = (response.data ?? {}) as Record<string, unknown>;
  return new SdkworkRequestError(
    String(
      problem.detail
        ?? problem.title
        ?? problem.message
        ?? `请求失败（HTTP ${response.statusCode}）`,
    ),
    {
      code: (problem.code ?? response.statusCode) as string | number,
      statusCode: response.statusCode,
      traceId: String(problem.traceId ?? ""),
    },
  );
}

/**
 * Creates the request client bound to one runtime, one session store and one host.
 *
 * @param options - Base-URL resolver, host HTTP client and the session store.
 */
export function createMpRequestClient(options: CreateMpRequestClientOptions): MpRequestClient {
  const { baseUrl, http, session, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  return {
    async request(requestOptions) {
      const origin = baseUrl().replace(/\/+$/u, "");
      const search = buildQuery(requestOptions.query);
      const url = `${origin}${requestOptions.path}${search ? `?${search}` : ""}`;

      const header: Record<string, string> = { "content-type": "application/json" };
      if (requestOptions.headers) {
        Object.assign(header, requestOptions.headers);
      }
      const snapshot = session.read();
      if (snapshot?.authToken) {
        header.authorization = `Bearer ${snapshot.authToken}`;
      }
      if (snapshot?.accessToken) {
        header["access-token"] = snapshot.accessToken;
      }

      let response: MpHttpResponse;
      try {
        response = await http.request({
          url,
          method: requestOptions.method ?? "GET",
          header,
          data: requestOptions.body,
          timeoutMs: requestOptions.timeoutMs ?? timeoutMs,
        });
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : "网络请求失败";
        throw new SdkworkRequestError(message, { cause });
      }

      if (response.statusCode >= 200 && response.statusCode < 300) {
        return isEnvelope(response.data) ? unwrapEnvelope(response.data) : (response.data as MpPayload);
      }
      throw toProblemError(response);
    },

    async rawRequest(rawOptions) {
      const response = await http.requestBytes({
        url: rawOptions.url,
        method: rawOptions.method,
        data: rawOptions.body,
        contentType: rawOptions.contentType ?? "application/octet-stream",
        timeoutMs: rawOptions.timeoutMs ?? timeoutMs,
      });
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw new SdkworkRequestError(`存储上传失败（HTTP ${response.statusCode}）`, {
          statusCode: response.statusCode,
        });
      }
      return {
        statusCode: response.statusCode,
        header: response.header,
        data: response.data instanceof ArrayBuffer ? response.data : new ArrayBuffer(0),
      };
    },
  };
}
