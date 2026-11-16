/**
 * Host adapter contracts for the SDKWork Mall mini program.
 *
 * Authority: `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` sections 3 and 8. A
 * feature package never touches `wx.*`: it depends on these interfaces, and the
 * weixin implementation (`./weixin`) is installed once by the app bootstrap.
 * The testing implementation (`@sdkwork/mall-mp-host/testing`) keeps node tests
 * runnable without the platform runtime.
 *
 * Every adapter normalizes platform failures into `MpHostError` so callers can
 * branch on a stable code (`cancelled` vs `unavailable`) instead of parsing
 * `errMsg` text.
 */

export type MpHostErrorCode =
  | "unsupported"
  | "permission-denied"
  | "unavailable"
  | "cancelled"
  | "invalid-state";

export interface MpHostError {
  readonly code: MpHostErrorCode;
  readonly message: string;
  readonly cause?: unknown;
}

export type MpHostOutcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: MpHostError };

/** Adapter categories a host profile may implement (spec section 8). */
export const MP_HOST_CAPABILITIES = [
  "platformLogin",
  "secureStorage",
  "camera",
  "qrScanner",
  "mediaPicker",
  "filePicker",
  "share",
  "subscriptionsOrPush",
  "deepLinksOrScene",
  "networkStatus",
  "appLifecycle",
  "clipboard",
  "deviceInfo",
  "haptics",
  "paymentBridge",
] as const;

export type MpHostCapability = (typeof MP_HOST_CAPABILITIES)[number];

export function createMpHostError(
  code: MpHostErrorCode,
  message: string,
  cause?: unknown,
): MpHostError {
  const error: MpHostError = cause === undefined ? { code, message } : { code, message, cause };
  return error;
}

/** Maps a platform `errMsg` onto the stable host error codes. */
export function normalizeMpHostError(cause: unknown, fallback: MpHostErrorCode = "unavailable"): MpHostError {
  const raw = cause && typeof cause === "object" ? (cause as { errMsg?: unknown }).errMsg : undefined;
  const message = typeof raw === "string" && raw ? raw : "微信小程序接口调用失败";
  if (/cancel/iu.test(message)) {
    return createMpHostError("cancelled", message, cause);
  }
  if (/auth|deny|denied|permission/iu.test(message)) {
    return createMpHostError("permission-denied", message, cause);
  }
  if (/not supported|unsupported|not implemented/iu.test(message)) {
    return createMpHostError("unsupported", message, cause);
  }
  return createMpHostError(fallback, message, cause);
}

/**
 * On-demand `wx.login()` code provider.
 *
 * The code is single-use and short-lived, so the host resolves it per call and
 * never caches or logs it (`MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` section 7).
 */
export interface MpLoginCodeProvider {
  requestLoginCode(): Promise<string>;
}

/** Session-safe key/value storage (WeChat storage is per-app and not readable by others). */
export interface MpStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export interface MpNavigation {
  navigateTo(url: string): Promise<void>;
  redirectTo(url: string): Promise<void>;
  switchTab(url: string): Promise<void>;
  back(delta?: number): Promise<void>;
}

export interface MpFeedback {
  toast(message: string): void;
  /** Resolves `true` when the buyer confirms. */
  confirm(options: { content: string; confirmText?: string; title: string }): Promise<boolean>;
  alert(options: { content: string; showCancel?: boolean; title: string }): Promise<void>;
}

export interface MpClipboard {
  setText(text: string): Promise<void>;
}

export interface MpChosenImage {
  /** Local temp file path returned by the platform picker. */
  readonly path: string;
  readonly sizeBytes: number;
  readonly contentType: string;
}

export interface MpMediaPicker {
  chooseImages(options: { maxCount: number; maxSizeBytes: number }): Promise<MpChosenImage[]>;
  readBytes(path: string): Promise<ArrayBuffer>;
}

export interface MpPaymentRequest {
  readonly nonceStr: string;
  readonly package: string;
  readonly paySign: string;
  readonly signType?: string;
  readonly timeStamp: string;
}

export interface MpPaymentBridge {
  /** Resolves when the platform cashier reports success; rejects with `cancelled` when dismissed. */
  requestPayment(request: MpPaymentRequest): Promise<void>;
}

export interface MpHttpRequestOptions {
  readonly data?: unknown;
  readonly header?: Record<string, string>;
  /** `PATCH` is outside the documented wx.request method list but passes through. */
  readonly method?: string;
  readonly timeoutMs?: number;
  readonly url: string;
}

export interface MpHttpResponse {
  readonly data: unknown;
  readonly header: Record<string, string>;
  readonly statusCode: number;
}

export interface MpHttpClient {
  request(options: MpHttpRequestOptions): Promise<MpHttpResponse>;
  /** Raw byte hop for presigned storage uploads (`DRIVE_SPEC.md` section 9). */
  requestBytes(options: MpHttpRequestOptions & { contentType?: string }): Promise<MpHttpResponse>;
}

/** The complete host surface a mall mini-program bootstrap installs. */
export interface MpHost {
  readonly capabilities: ReadonlySet<MpHostCapability>;
  readonly clipboard: MpClipboard;
  readonly feedback: MpFeedback;
  readonly http: MpHttpClient;
  readonly loginCode: MpLoginCodeProvider;
  readonly media: MpMediaPicker;
  readonly navigation: MpNavigation;
  readonly payment: MpPaymentBridge;
  readonly storage: MpStorage;
  hasCapability(capability: MpHostCapability): boolean;
}
