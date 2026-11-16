/**
 * `fetch` adapter over the host HTTP client.
 *
 * Authority: `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` section 8 and
 * `APP_SDK_INTEGRATION_SPEC.md` section 9. Every generated SDKWork SDK
 * (`@sdkwork/sdk-common` `BaseHttpClient`) issues requests through the global
 * `fetch`. WeChat has no `fetch`, so the mini program installs one that is backed
 * by the host `MpHttpClient` (`wx.request`) — the SDKs stay unmodified and the
 * platform seam stays in the host.
 *
 * The adapter implements the `fetch` subset the SDKs use: `(url, init)` with
 * `method`/`headers`/`body`/`signal` and a `Response`-shaped result
 * (`ok`/`status`/`statusText`/`headers.get`/`json`/`text`/`arrayBuffer`).
 */
import type { MpHttpClient, MpHttpResponse } from "./index";

/** Minimal `fetch` shape the SDKs rely on. */
export type MpFetch = (
  input: string,
  init?: {
    body?: unknown;
    headers?: Record<string, string>;
    method?: string;
    signal?: AbortSignal;
  },
) => Promise<MpFetchResponse>;

export interface MpFetchResponse {
  readonly arrayBuffer: () => Promise<ArrayBuffer>;
  readonly headers: { get(name: string): string | null };
  readonly json: () => Promise<unknown>;
  readonly ok: boolean;
  readonly status: number;
  readonly statusText: string;
  readonly text: () => Promise<string>;
  readonly url: string;
}

function isArrayBuffer(value: unknown): value is ArrayBuffer {
  return typeof value === "object"
    && value !== null
    && Object.prototype.toString.call(value) === "[object ArrayBuffer]";
}

function encodeBody(body: unknown): unknown {
  if (body === undefined || body === null) {
    return undefined;
  }
  if (typeof body === "string" || isArrayBuffer(body)) {
    return body;
  }
  return JSON.stringify(body);
}

function lowerCaseHeaders(header: Record<string, string> | undefined): MpFetchResponse["headers"] {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(header ?? {})) {
    normalized[key.toLowerCase()] = value;
  }
  return {
    get(name) {
      return normalized[name.toLowerCase()] ?? null;
    },
  };
}

function toArrayBuffer(data: unknown): ArrayBuffer {
  if (data instanceof ArrayBuffer) {
    return data;
  }
  if (typeof data === "string") {
    const encoded = new TextEncoder().encode(data);
    return encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength) as ArrayBuffer;
  }
  const text = JSON.stringify(data ?? null);
  const encoded = new TextEncoder().encode(text);
  return encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength) as ArrayBuffer;
}

function toText(data: unknown): string {
  if (typeof data === "string") {
    return data;
  }
  if (data === undefined || data === null) {
    return "";
  }
  return JSON.stringify(data);
}

function createResponse(url: string, response: MpHttpResponse): MpFetchResponse {
  const data = response.data;
  const ok = response.statusCode >= 200 && response.statusCode < 300;
  return {
    ok,
    status: response.statusCode,
    statusText: ok ? "OK" : `HTTP ${response.statusCode}`,
    headers: lowerCaseHeaders(response.header),
    url,
    async json() {
      if (typeof data === "string") {
        return JSON.parse(data) as unknown;
      }
      return data;
    },
    async text() {
      return toText(data);
    },
    async arrayBuffer() {
      return toArrayBuffer(data);
    },
  };
}

/**
 * Builds a `fetch` implementation backed by the host HTTP client.
 *
 * A non-2xx platform response still resolves (as `fetch` does) so the SDK's own
 * envelope/`ProblemDetail` handling sees the status; only a transport failure
 * rejects.
 */
export function createMpFetch(http: MpHttpClient): MpFetch {
  return async (input, init = {}) => {
    if (init.signal?.aborted) {
      throw Object.assign(new Error("Request was cancelled"), { name: "AbortError" });
    }
    const response = await http.request({
      url: input,
      ...(init.method ? { method: init.method } : {}),
      ...(init.headers ? { header: init.headers } : {}),
      ...(encodeBody(init.body) !== undefined ? { data: encodeBody(init.body) } : {}),
    });
    return createResponse(input, response);
  };
}

/**
 * Installs the adapter as the global `fetch` when the runtime does not have one.
 *
 * Returns the effective implementation so a caller (or a test) can use it
 * directly. An existing native `fetch` wins: newer base libraries may ship one.
 *
 * @param http - Host HTTP client backing the adapter.
 */
export function installMpFetch(http: MpHttpClient): MpFetch {
  const globalScope = globalThis as { fetch?: unknown };
  if (typeof globalScope.fetch === "function") {
    return globalScope.fetch as MpFetch;
  }
  const adapter = createMpFetch(http);
  globalScope.fetch = adapter as unknown as typeof fetch;
  return adapter;
}
