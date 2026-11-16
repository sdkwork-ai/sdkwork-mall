/**
 * Commerce app-api transport seam.
 *
 * Authority: `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` section 7. The seam still
 * funnels every backend call through one function, but the implementation now
 * lives in `@sdkwork/mall-mp-core` so the envelope unwrap, dual-token headers and
 * problem mapping are shared with the IAM/IM capability packages instead of
 * being re-declared per app.
 */
import {
  SdkworkRequestError,
  getMallMpRuntime,
  type MpPayload,
  type MpRawRequestOptions,
  type MpRawResponse,
  type MpRequestOptions,
} from "@sdkwork/mall-mp-core";

export { SdkworkRequestError };
export type { MpPayload, MpRawResponse };
export type { MpRequestOptions };
export type MpRawRequestOptionsAlias = MpRawRequestOptions;

/**
 * Performs a request against the commerce app-api and unwraps the
 * `SdkWorkApiResponse` envelope (`{ code, data, traceId }`).
 * HTTP/problem errors reject with a `SdkworkRequestError`.
 */
export function request(options: MpRequestOptions): Promise<MpPayload> {
  return getMallMpRuntime().request.request(options);
}

/**
 * Raw byte PUT for the drive presigned storage hop (`DRIVE_SPEC.md` section 9).
 * The presigned upload is a bare body transfer with an ETag response header —
 * no envelope, no auth projection — so it stays a separate entry point.
 */
export function rawRequest(options: MpRawRequestOptions): Promise<MpRawResponse> {
  return getMallMpRuntime().request.rawRequest(options);
}
