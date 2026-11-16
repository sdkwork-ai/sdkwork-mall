/**
 * Host boundary of the mall mini-program core.
 *
 * Authority: `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` sections 3 and 8. Capability
 * packages receive the host through this accessor instead of importing the
 * weixin profile, so a test, the devtools, or a future Alipay/DingTalk profile
 * swaps one registration and nothing else.
 */
import type { MpHost, MpHostCapability } from "@sdkwork/mall-mp-host";

export type {
  MpChosenImage,
  MpClipboard,
  MpFeedback,
  MpHost,
  MpHostCapability,
  MpHostError,
  MpHostErrorCode,
  MpHostOutcome,
  MpHttpClient,
  MpHttpRequestOptions,
  MpHttpResponse,
  MpLoginCodeProvider,
  MpMediaPicker,
  MpNavigation,
  MpPaymentBridge,
  MpPaymentRequest,
  MpStorage,
} from "@sdkwork/mall-mp-host";
export { MP_HOST_CAPABILITIES } from "@sdkwork/mall-mp-host";

let installedHost: MpHost | null = null;

export function installMallMpHost(host: MpHost): void {
  installedHost = host;
}

export function getMallMpHost(): MpHost {
  if (!installedHost) {
    throw new Error("mall mini program: host profile is not installed; call initializeMallMpRuntime first");
  }
  return installedHost;
}

export function isMallMpHostInstalled(): boolean {
  return installedHost !== null;
}

/** Capabilities the installed profile actually implements. */
export function listInstalledHostCapabilities(): readonly MpHostCapability[] {
  return installedHost ? [...installedHost.capabilities] : [];
}
