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

/**
 * Installed host profile, stored on the global scope.
 *
 * The published package is bundled per entry (app + every page), so a
 * module-local variable would be installed by `app.onLaunch` and still read as
 * `null` from a page bundle. The global key keeps one profile for the launch.
 */
const HOST_GLOBAL_KEY = "__SDKWORK_MALL_MP_HOST__";

interface HostGlobal {
  __SDKWORK_MALL_MP_HOST__?: MpHost | null;
}

function hostScope(): HostGlobal {
  if (typeof globalThis !== "undefined" && globalThis) {
    return globalThis as unknown as HostGlobal;
  }
  try {
    return (Function("return this") as () => HostGlobal)();
  } catch {
    return {};
  }
}

export function installMallMpHost(host: MpHost): void {
  hostScope()[HOST_GLOBAL_KEY] = host;
}

export function getMallMpHost(): MpHost {
  const installedHost = hostScope()[HOST_GLOBAL_KEY];
  if (!installedHost) {
    throw new Error("mall mini program: host profile is not installed; call initializeMallMpRuntime first");
  }
  return installedHost;
}

export function isMallMpHostInstalled(): boolean {
  return (hostScope()[HOST_GLOBAL_KEY] ?? null) !== null;
}

/** Capabilities the installed profile actually implements. */
export function listInstalledHostCapabilities(): readonly MpHostCapability[] {
  const installedHost = hostScope()[HOST_GLOBAL_KEY];
  return installedHost ? [...installedHost.capabilities] : [];
}
