/**
 * Platform scope resolution.
 *
 * On a WeChat device the platform APIs live on the appservice global object, but
 * `globalThis` is **not** reliably defined there (base library 3.18 reported
 * `Cannot read property '…' of undefined` whenever the code dereferenced it).
 * The reliable global object is `wx` itself; `getApp()` is the documented
 * cross-bundle store. This module resolves both without ever dereferencing a
 * possibly missing binding unguarded.
 */
export interface MpPlatformScope {
  wx?: Record<string, unknown>;
}

const moduleFallback: Record<string, unknown> = {};

/**
 * The real global object: the WeChat `wx` surface on a device, else the host
 * global (Node tests, the bundler smoke harness).
 *
 * Use this when *installing* a global (the SDK `fetch` adapter, the
 * `AbortController` polyfill, a runtime-injection override).
 */
export function resolveGlobalObject(): Record<string, unknown> {
  if (typeof wx !== "undefined" && wx) {
    return wx as unknown as Record<string, unknown>;
  }
  if (typeof globalThis !== "undefined" && globalThis) {
    return globalThis as unknown as Record<string, unknown>;
  }
  return moduleFallback;
}

/**
 * The `{ wx }` scope the WeChat adapters receive.
 *
 * On a device the global object is already the `wx` surface itself, so it is
 * wrapped; in Node tests `globalThis.wx` is the stub and the global object is
 * returned as-is.
 */
export function resolvePlatformScope(): MpPlatformScope & Record<string, unknown> {
  const globalObject = resolveGlobalObject();
  if (globalObject && typeof globalObject === "object" && (globalObject as MpPlatformScope).wx) {
    return globalObject as MpPlatformScope & Record<string, unknown>;
  }
  return { wx: globalObject } as unknown as MpPlatformScope & Record<string, unknown>;
}

/**
 * Shared per-launch store that survives per-entry bundling.
 *
 * Every entry (app + each page) is bundled separately, so module-level variables
 * are **not** shared between them. `getApp().globalData` is the documented object
 * every bundle can reach, so cross-bundle state (runtime, host, services) lives
 * there; outside the platform (tests) the global object keeps it shared.
 */
export function resolveSharedScope(): Record<string, unknown> {
  if (typeof getApp === "function") {
    try {
      const app = getApp();
      const globalData = (app as { globalData?: unknown } | undefined)?.globalData;
      if (globalData && typeof globalData === "object") {
        return globalData as Record<string, unknown>;
      }
    } catch {
      // `getApp()` is undefined until App() has been constructed.
    }
  }
  return resolveGlobalObject();
}
