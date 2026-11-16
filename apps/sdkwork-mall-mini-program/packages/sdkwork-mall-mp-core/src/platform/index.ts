/**
 * Page-facing platform facade.
 *
 * Authority: `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` sections 3 and 8. Pages must
 * not assemble platform option objects, and feature code must not touch `wx.*`.
 * This facade is the app-level vocabulary over the installed host: one call per
 * intent (`toast`, `navigateTo`, `stopPullDownRefresh`) instead of a platform
 * options literal in every page.
 *
 * It is a projection of `MpHost`, not a second host: every method delegates to
 * the installed adapters at call time, so a profile swap, a devtools reinstall or
 * a test fake is picked up without a stale closure — and importing this module
 * is safe before `app.onLaunch` has installed the host.
 */
import { getMallMpHost, type MpChosenImage, type MpStorage } from "../host";

export type MpToastTone = "error" | "none" | "success";

export interface MallMpPlatform {
  alert(options: { content: string; title: string }): Promise<void>;
  /**
   * Goes back one page.
   *
   * `fallback` covers a dead end (a deep link with no history): `tab` switches to
   * a tabBar page, otherwise it redirects to the given capability URL.
   */
  back(fallback?: { tab?: boolean; url: string }): void;
  /** Platform image picker (album/camera) with the size guard applied. */
  chooseImages(options: { maxCount: number; maxSizeBytes: number }): Promise<MpChosenImage[]>;
  confirm(options: { confirmText?: string; content: string; title: string }): Promise<boolean>;
  copy(text: string): Promise<void>;
  /**
   * Opens a capability page.
   *
   * `fallbackUrl` covers a navigation failure; `events` is the platform
   * EventChannel the opened page emits back (the address picker uses it).
   */
  navigateTo(
    url: string,
    options?: { events?: Record<string, (...args: never[]) => void>; fallbackUrl?: string },
  ): void;
  previewImages(options: { current?: string; urls: string[] }): void;
  /** Reads local bytes (media upload); the Drive facade owns the upload. */
  readBytes(path: string): Promise<ArrayBuffer>;
  redirectTo(url: string, fallbackUrl?: string): void;
  requestPayment(request: {
    nonceStr: string;
    package: string;
    paySign: string;
    signType?: string;
    timeStamp: string;
  }): Promise<void>;
  /** Ends a pull-to-refresh spinner; a no-op when none is running. */
  stopPullDownRefresh(): void;
  /** Platform key/value storage for device-local state (history, dev token). */
  readonly storage: MpStorage;
  switchTab(url: string): void;
  toast(message: string, tone?: MpToastTone): void;
}

function redirect(url: string): void {
  void getMallMpHost().navigation.redirectTo(url).catch(() => undefined);
}

/** The single facade instance; methods resolve the installed host per call. */
export const platform: MallMpPlatform = {
  alert: (options) => getMallMpHost().feedback.alert(options),
  confirm: (options) => getMallMpHost().feedback.confirm(options),
  chooseImages: (options) => getMallMpHost().media.chooseImages(options),
  readBytes: (path) => getMallMpHost().media.readBytes(path),
  copy: (text) => getMallMpHost().clipboard.setText(text),
  toast: (message, tone) => getMallMpHost().feedback.toast(message, tone ?? "none"),
  stopPullDownRefresh: () => getMallMpHost().lifecycle.stopPullDownRefresh(),
  get storage() {
    return getMallMpHost().storage;
  },
  previewImages({ current, urls }) {
    if (urls.length === 0) {
      return;
    }
    void getMallMpHost().media.previewImages(current ? { current, urls } : { urls }).catch(() => undefined);
  },
  navigateTo(url, options) {
    void getMallMpHost().navigation.navigateTo(url, options?.events ? { events: options.events } : undefined).catch(() => {
      if (options?.fallbackUrl) {
        redirect(options.fallbackUrl);
      }
    });
  },
  redirectTo(url, fallbackUrl) {
    void getMallMpHost().navigation.redirectTo(url).catch(() => {
      if (fallbackUrl) {
        redirect(fallbackUrl);
      }
    });
  },
  switchTab(url) {
    void getMallMpHost().navigation.switchTab(url).catch(() => undefined);
  },
  back(fallback) {
    void getMallMpHost().navigation.back().catch(() => {
      if (!fallback) {
        return;
      }
      if (fallback.tab) {
        void getMallMpHost().navigation.switchTab(fallback.url).catch(() => undefined);
        return;
      }
      redirect(fallback.url);
    });
  },
  requestPayment: (request) => getMallMpHost().payment.requestPayment(request),
};

/** Alias kept so callers can express "read the facade" as a function. */
export function getMallMpPlatform(): MallMpPlatform {
  return platform;
}
