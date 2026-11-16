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
import { resolvePlatformScope } from "./weixin/scope";

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

/**
 * UTF-8 encodes text without `TextEncoder`.
 *
 * `TextEncoder` is missing on older WeChat base libraries, and the SDKs only need
 * this for `arrayBuffer()` on non-binary responses.
 */
function encodeUtf8(value: string): Uint8Array {
  const bytes: number[] = [];
  for (let index = 0; index < value.length; index += 1) {
    let codePoint = value.charCodeAt(index);
    // Combine a surrogate pair into one code point.
    if (codePoint >= 0xd800 && codePoint <= 0xdbff && index + 1 < value.length) {
      const low = value.charCodeAt(index + 1);
      if (low >= 0xdc00 && low <= 0xdfff) {
        codePoint = ((codePoint - 0xd800) << 10) + (low - 0xdc00) + 0x10000;
        index += 1;
      }
    }
    if (codePoint < 0x80) {
      bytes.push(codePoint);
    } else if (codePoint < 0x800) {
      bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
    } else if (codePoint < 0x10000) {
      bytes.push(0xe0 | (codePoint >> 12), 0x80 | ((codePoint >> 6) & 0x3f), 0x80 | (codePoint & 0x3f));
    } else {
      bytes.push(
        0xf0 | (codePoint >> 18),
        0x80 | ((codePoint >> 12) & 0x3f),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    }
  }
  return Uint8Array.from(bytes);
}

/** Copies a typed array into an exactly-sized `ArrayBuffer`. */
function toArrayBufferFromBytes(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
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
    return toArrayBufferFromBytes(encodeUtf8(data));
  }
  return toArrayBufferFromBytes(encodeUtf8(JSON.stringify(data ?? null)));
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
 * Minimal `AbortSignal`/`AbortController` for base libraries without them.
 *
 * `@sdkwork/sdk-common`'s `BaseHttpClient` creates an `AbortController` for every
 * request timeout, so a missing global would break every SDK call. The SDK only
 * sets a timer that calls `abort()` and passes `signal` to `fetch`; this
 * implementation covers exactly that (`aborted` + `addEventListener("abort")`).
 */
function createAbortPolyfill(): { AbortController: unknown; AbortSignal: unknown } {
  class MpAbortSignal {
    aborted = false;
    private readonly listeners = new Set<() => void>();

    addEventListener(type: string, handler: () => void): void {
      if (type === "abort" && typeof handler === "function") {
        this.listeners.add(handler);
      }
    }

    removeEventListener(type: string, handler: () => void): void {
      if (type === "abort") {
        this.listeners.delete(handler);
      }
    }

    /** Internal: flips the flag and notifies listeners once. */
    dispatchAbort(): void {
      if (this.aborted) {
        return;
      }
      this.aborted = true;
      for (const listener of [...this.listeners]) {
        listener();
      }
      this.listeners.clear();
    }
  }

  class MpAbortController {
    readonly signal = new MpAbortSignal();

    abort(): void {
      this.signal.dispatchAbort();
    }
  }

  return { AbortController: MpAbortController, AbortSignal: MpAbortSignal };
}

/**
 * Installs the adapter as the global `fetch` when the runtime does not have one.
 *
 * Returns the effective implementation so a caller (or a test) can use it
 * directly. An existing native `fetch` wins: newer base libraries may ship one.
 * `AbortController` is polyfilled independently of `fetch`, because the SDKs use
 * it for request timeouts even against a native `fetch`.
 *
 * @param http - Host HTTP client backing the adapter.
 */
export function installMpFetch(http: MpHttpClient): MpFetch {
  const globalScope = resolvePlatformScope() as { AbortController?: unknown; AbortSignal?: unknown; fetch?: unknown };
  if (typeof globalScope.AbortController !== "function" || typeof globalScope.AbortSignal !== "function") {
    const polyfill = createAbortPolyfill();
    globalScope.AbortController = polyfill.AbortController;
    globalScope.AbortSignal = polyfill.AbortSignal;
  }
  if (typeof globalScope.fetch === "function") {
    return globalScope.fetch as MpFetch;
  }
  const adapter = createMpFetch(http);
  globalScope.fetch = adapter as unknown as typeof fetch;
  return adapter;
}
