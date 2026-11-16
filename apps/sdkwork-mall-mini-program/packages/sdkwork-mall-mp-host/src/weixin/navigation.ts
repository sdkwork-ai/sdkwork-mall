/**
 * Navigation adapter (`wx.navigateTo` / `switchTab` / `redirectTo` / `navigateBack`).
 *
 * Authority: `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` section 8. Tab pages cannot
 * be opened with `navigateTo`, so the capability registry decides the call and
 * this adapter stays a thin, promise-shaped wrapper around the platform API.
 */
import { createMpHostError, normalizeMpHostError, type MpNavigation } from "../index";

export interface WxNavigationApi {
  navigateBack(options?: { delta?: number; fail?(result: { errMsg?: string }): void; success?(): void }): void;
  navigateTo(options: { fail?(result: { errMsg?: string }): void; success?(): void; url: string }): void;
  redirectTo(options: { fail?(result: { errMsg?: string }): void; success?(): void; url: string }): void;
  switchTab(options: { fail?(result: { errMsg?: string }): void; success?(): void; url: string }): void;
}

function navigate(
  open: (options: { fail?(result: { errMsg?: string }): void; success?(): void; url: string }) => void,
  url: string,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    open({
      url,
      success: () => resolve(),
      fail: (result) => reject(normalizeMpHostError(result)),
    });
  });
}

export function createWeixinNavigation(api: WxNavigationApi): MpNavigation {
  return {
    navigateTo: (url) => navigate(api.navigateTo.bind(api), url),
    redirectTo: (url) => navigate(api.redirectTo.bind(api), url),
    switchTab: (url) => navigate(api.switchTab.bind(api), url),
    back(delta = 1) {
      return new Promise<void>((resolve, reject) => {
        api.navigateBack({
          delta,
          success: () => resolve(),
          fail: (result) => {
            // "no page to go back to" is a state a caller can recover from by
            // redirecting to the capability root, not a platform failure.
            if (/fail can not navigateBack|at first page/iu.test(result.errMsg ?? "")) {
              reject(createMpHostError("invalid-state", "已经是首个页面", result));
              return;
            }
            reject(normalizeMpHostError(result));
          },
        });
      });
    },
  };
}

export function readWeixinNavigationApi(
  scope: { wx?: Partial<WxNavigationApi> } = globalThis as { wx?: Partial<WxNavigationApi> },
): WxNavigationApi {
  const candidate = scope.wx;
  if (!candidate || typeof candidate.navigateTo !== "function" || typeof candidate.switchTab !== "function") {
    throw createMpHostError("unsupported", "当前运行环境不支持 wx 导航");
  }
  return candidate as WxNavigationApi;
}
