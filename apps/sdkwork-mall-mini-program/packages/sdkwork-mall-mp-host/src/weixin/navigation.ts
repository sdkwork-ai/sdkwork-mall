/**
 * Navigation adapter (`wx.navigateTo` / `switchTab` / `redirectTo` / `navigateBack`).
 *
 * Authority: `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` section 8. Tab pages cannot
 * be opened with `navigateTo`, so the capability registry decides the call and
 * this adapter stays a thin, promise-shaped wrapper around the platform API.
 */
import { createMpHostError, normalizeMpHostError, type MpNavigation } from "../index";
import { resolvePlatformScope } from "./scope";

export interface WxNavigationApi {
  navigateBack(options?: { delta?: number; fail?(result: { errMsg?: string }): void; success?(): void }): void;
  navigateTo(options: {
    events?: Record<string, (...args: unknown[]) => void>;
    fail?(result: { errMsg?: string }): void;
    success?(): void;
    url: string;
  }): void;
  redirectTo(options: { fail?(result: { errMsg?: string }): void; success?(): void; url: string }): void;
  switchTab(options: { fail?(result: { errMsg?: string }): void; success?(): void; url: string }): void;
  /** Tab-bar badge APIs are optional: an older base library may not expose them. */
  removeTabBarBadge?(options: { fail?(result: { errMsg?: string }): void; index: number; success?(): void }): void;
  setTabBarBadge?(options: { fail?(result: { errMsg?: string }): void; index: number; success?(): void; text: string }): void;
}

function navigate(
  open: (options: {
    events?: Record<string, (...args: unknown[]) => void>;
    fail?(result: { errMsg?: string }): void;
    success?(): void;
    url: string;
  }) => void,
  url: string,
  events?: Record<string, (...args: never[]) => void>,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    open({
      url,
      ...(events ? { events: events as Record<string, (...args: unknown[]) => void> } : {}),
      success: () => resolve(),
      fail: (result) => reject(normalizeMpHostError(result)),
    });
  });
}

export function createWeixinNavigation(api: WxNavigationApi): MpNavigation {
  return {
    navigateTo: (url, options) => navigate(api.navigateTo.bind(api), url, options?.events),
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
    setTabBarBadge(index, text) {
      return new Promise<void>((resolve, reject) => {
        if (typeof api.setTabBarBadge !== "function") {
          // A badge is decoration: an older base library simply skips it.
          resolve();
          return;
        }
        api.setTabBarBadge({
          index,
          text,
          success: () => resolve(),
          fail: (result) => reject(normalizeMpHostError(result)),
        });
      });
    },
    removeTabBarBadge(index) {
      return new Promise<void>((resolve, reject) => {
        if (typeof api.removeTabBarBadge !== "function") {
          resolve();
          return;
        }
        api.removeTabBarBadge({
          index,
          success: () => resolve(),
          fail: (result) => {
            // "no badge on this tab" is the desired end state.
            if (/no tabBar badge|not found/iu.test(result.errMsg ?? "")) {
              resolve();
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
  scope: { wx?: Partial<WxNavigationApi> } = resolvePlatformScope() as { wx?: Partial<WxNavigationApi> },
): WxNavigationApi {
  const candidate = scope.wx;
  if (!candidate || typeof candidate.navigateTo !== "function" || typeof candidate.switchTab !== "function") {
    throw createMpHostError("unsupported", "当前运行环境不支持 wx 导航");
  }
  return candidate as WxNavigationApi;
}
