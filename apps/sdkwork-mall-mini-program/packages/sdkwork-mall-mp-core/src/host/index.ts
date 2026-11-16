/**
 * Host boundary of the mall mini-program core.
 *
 * Authority: `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` sections 3 and 8. Capability
 * packages receive the host through this accessor instead of importing the
 * weixin profile, so a test, the devtools, or a future Alipay/DingTalk profile
 * swaps one registration and nothing else.
 */
import type { MpHost, MpHostCapability } from "@sdkwork/mall-mp-host";
import { readSharedState, writeSharedState } from "@sdkwork/mall-mp-host";
import { MP_HOST_SHARED_KEY, MP_RUNTIME_BOOTSTRAP_SHARED_KEY } from "../shared-keys";

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
 * Installed host profile key.
 *
 * The published package is bundled per entry (app + every page), so a
 * module-local variable would be installed by `app.onLaunch` and still read as
 * `null` from a page bundle. The shared cross-bundle store keeps one profile.
 */
const HOST_GLOBAL_KEY = MP_HOST_SHARED_KEY;

function readInstalledHost(): MpHost | null {
  return readSharedState<MpHost | null>(HOST_GLOBAL_KEY) ?? null;
}

export function installMallMpHost(host: MpHost): void {
  writeSharedState(HOST_GLOBAL_KEY, host);
}

export function getMallMpHost(): MpHost {
  const installedHost = readInstalledHost();
  if (installedHost) {
    return installedHost;
  }
  // Self-healing after a hot reload: rebuild through the published launch factory
  // instead of failing the first capability call of the page.
  const bootstrap = readSharedState<(() => unknown) | null>(MP_RUNTIME_BOOTSTRAP_SHARED_KEY) ?? null;
  if (bootstrap) {
    bootstrap();
    const rebuilt = readInstalledHost();
    if (rebuilt) {
      return rebuilt;
    }
  }
  throw new Error("mall mini program: host profile is not installed; call initializeMallMpRuntime first");
}

export function isMallMpHostInstalled(): boolean {
  return readInstalledHost() !== null;
}

/** Capabilities the installed profile actually implements. */
export function listInstalledHostCapabilities(): readonly MpHostCapability[] {
  const installedHost = readInstalledHost();
  return installedHost ? [...installedHost.capabilities] : [];
}
