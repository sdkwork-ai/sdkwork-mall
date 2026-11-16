/**
 * Page lifecycle and device-info adapters.
 *
 * Authority: `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` section 8 (`appLifecycle`,
 * `deviceInfo`). Pull-to-refresh is a platform side effect every list page needs
 * after its own reload, and the release channel decides the fallback API host, so
 * both are host facts rather than page-level platform calls.
 */
import {
  createMpHostError,
  normalizeMpHostError,
  type MpDeviceInfo,
  type MpLifecycle,
} from "../index";

export interface WxLifecycleApi {
  startPullDownRefresh(options?: { fail?(result: { errMsg?: string }): void; success?(): void }): void;
  stopPullDownRefresh(options?: { complete?(): void }): void;
}

export function createWeixinLifecycle(api: WxLifecycleApi): MpLifecycle {
  return {
    stopPullDownRefresh() {
      // Not every platform build implements the spinner on every page; a missing
      // hook must never abort the caller's data path.
      try {
        api.stopPullDownRefresh();
      } catch {
        // no-op: the spinner is cosmetic
      }
    },
    startPullDownRefresh() {
      return new Promise<void>((resolve, reject) => {
        if (typeof api.startPullDownRefresh !== "function") {
          reject(createMpHostError("unsupported", "当前运行环境不支持下拉刷新"));
          return;
        }
        api.startPullDownRefresh({
          success: () => resolve(),
          fail: (result) => reject(normalizeMpHostError(result)),
        });
      });
    },
  };
}

export interface WxDeviceInfoApi {
  getAccountInfoSync(): { miniProgram?: { envVersion?: string } };
}

export function createWeixinDeviceInfo(api: WxDeviceInfoApi): MpDeviceInfo {
  return {
    accountEnvVersion() {
      try {
        return api.getAccountInfoSync().miniProgram?.envVersion ?? "develop";
      } catch {
        return "develop";
      }
    },
    platform: () => "weixin",
  };
}
