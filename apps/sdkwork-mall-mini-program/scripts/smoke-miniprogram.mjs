#!/usr/bin/env node
/**
 * Headless smoke run of the built mini-program package.
 *
 * The WeChat dev tool is the only real runtime, but its console is manual. This
 * harness loads the same `dist/` bundles the tool loads — with a stub `wx`, `App`
 * and `Page` — runs `onLaunch`/`onShow`, then every page's lifecycle, and reports
 * the first error of each. It catches boot regressions (platform globals, missing
 * runtime composition, page-level throw) in CI without a device.
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { allPagePaths } from "./app-pages.mjs";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = path.join(appRoot, "dist");
const appJson = JSON.parse(readFileSync(path.join(distRoot, "app.json"), "utf8").replace(/^\uFEFF/u, ""));
const pagePaths = allPagePaths(appJson);

const errors = [];
const log = [];
function record(scope, error) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  errors.push({ scope, message });
  console.error(`  ✖ ${scope}: ${message}`);
}

/** Memory storage shared by every page instance, like the platform. */
const storage = new Map();
const toasts = [];
const requests = [];

/** A permissive `wx` stub: unknown members fail loudly instead of silently. */
function createWxStub() {
  const stub = {
    getAccountInfoSync: () => ({ miniProgram: { envVersion: "develop", appId: "wxstub", version: "0.0.0" } }),
    getStorageSync: (key) => (storage.has(key) ? storage.get(key) : ""),
    setStorageSync: (key, value) => storage.set(key, value),
    removeStorageSync: (key) => storage.delete(key),
    getSystemInfoSync: () => ({ brand: "devtools", model: "stub", pixelRatio: 2, platform: "devtools", system: "stub", windowWidth: 375, windowHeight: 667 }),
    getWindowInfo: () => ({ pixelRatio: 2, screenHeight: 667, screenWidth: 375, statusBarHeight: 20, windowHeight: 667, windowWidth: 375 }),
    getDeviceInfo: () => ({ brand: "devtools", model: "stub", platform: "devtools", system: "stub" }),
    getAppBaseInfo: () => ({ SDKVersion: "3.18.0", language: "zh_CN", theme: "light", version: "0.0.0" }),
    login: (options) => {
      options?.success?.({ code: "stub-js-code" });
      options?.complete?.({});
    },
    request: (options) => {
      requests.push(options?.url);
      options?.fail?.({ errMsg: "request:fail stub network disabled" });
      options?.complete?.({});
    },
    connectSocket: () => ({
      close: () => undefined,
      onClose: () => undefined,
      onError: () => undefined,
      onMessage: () => undefined,
      onOpen: () => undefined,
      send: () => undefined,
    }),
    navigateTo: (options) => options?.success?.({}),
    redirectTo: (options) => options?.success?.({}),
    switchTab: (options) => options?.success?.({}),
    navigateBack: (options) => options?.success?.({}),
    setTabBarBadge: (options) => options?.success?.({}),
    removeTabBarBadge: (options) => options?.success?.({}),
    showToast: (options) => {
      toasts.push(options?.title ?? "");
      options?.success?.({});
    },
    hideToast: () => undefined,
    showModal: (options) => options?.success?.({ confirm: false, cancel: true }),
    showLoading: (options) => options?.success?.({}),
    hideLoading: () => undefined,
    setClipboardData: (options) => options?.success?.({}),
    stopPullDownRefresh: (options) => options?.success?.({}),
    startPullDownRefresh: (options) => options?.success?.({}),
    chooseMedia: (options) => options?.fail?.({ errMsg: "chooseMedia:fail stub" }),
    previewImage: (options) => options?.success?.({}),
    setNavigationBarTitle: (options) => options?.success?.({}),
    getFileSystemManager: () => ({
      readFile: (options) => options?.fail?.({ errMsg: "readFile:fail stub" }),
    }),
    requestPayment: (options) => options?.fail?.({ errMsg: "requestPayment:fail cancel" }),
    getNetworkType: (options) => options?.success?.({ networkType: "wifi" }),
    onNetworkStatusChange: () => undefined,
    offNetworkStatusChange: () => undefined,
    nextTick: (callback) => callback(),
  };
  return stub;
}

let appInstance = null;
const appConfig = [];
const pageConfigs = [];

globalThis.wx = createWxStub();
globalThis.App = (config) => {
  appConfig.push(config);
  appInstance = { ...config, globalData: config.globalData ?? {} };
};
globalThis.Page = (config) => {
  pageConfigs.push(config);
};
globalThis.Component = () => undefined;
globalThis.Behavior = () => undefined;
globalThis.getApp = () => appInstance;
globalThis.getCurrentPages = () => [];
globalThis.requirePlugin = () => undefined;

function loadModule(relative) {
  const absolute = path.join(distRoot, relative);
  delete require.cache[absolute];
  return require(absolute);
}

console.log("[smoke] booting the app bundle");
try {
  loadModule("app.js");
  if (!appInstance) {
    throw new Error("App() was never called by the bundle");
  }
  appInstance.onLaunch?.({ path: "pages/home/index", query: {} });
  appInstance.onShow?.({ path: "pages/home/index", query: {} });
} catch (error) {
  record("app.onLaunch", error);
}

// `--hot-reload` emulates the dev tool: the page bundles evaluate without
// `app.onLaunch` having run in this context (only the app module's registration
// survives), so the runtime must be rebuilt lazily from the published factory.
if (process.argv.includes("--hot-reload")) {
  const shared = appInstance?.globalData ?? {};
  for (const key of ["__SDKWORK_MALL_MP_RUNTIME__", "__SDKWORK_MALL_MP_HOST__", "__SDKWORK_MALL_MP_IM_SERVICES__"]) {
    delete shared[key];
    delete globalThis.wx[key];
  }
  console.log("[smoke] hot-reload: runtime/host/services state cleared, bootstrap factory kept");
}
// `--shared-store-only` proves the module-cache store is enough: the three
// platform-facing stores are cleared and `wx` is frozen, so only
// `dist/shared-state.js` can carry the runtime/host/services to the page bundles.
if (process.argv.includes("--shared-store-only")) {
  const shared = appInstance?.globalData ?? {};
  for (const key of ["__SDKWORK_MALL_MP_RUNTIME__", "__SDKWORK_MALL_MP_HOST__", "__SDKWORK_MALL_MP_IM_SERVICES__"]) {
    delete shared[key];
    delete globalThis.wx[key];
  }
  Object.freeze(globalThis.wx);
  console.log("[smoke] shared-store-only: platform stores cleared, wx frozen");
}
for (const page of pagePaths) {
  const before = pageConfigs.length;
  try {
    loadModule(`${page}.js`);
    if (pageConfigs.length === before) {
      throw new Error("Page() was never called by the bundle");
    }
    const config = pageConfigs[pageConfigs.length - 1];
    const instance = {
      ...config,
      data: { ...(config.data ?? {}) },
      setData(patch) {
        for (const [key, value] of Object.entries(patch ?? {})) {
          this.data[key] = value;
        }
      },
      route: page,
    };
    instance.onLoad?.({ id: "stub", conversationId: "stub", categoryId: "", orderId: "stub" });
    instance.onShow?.();
    // Deferred loaders (network) settle with the stub rejections; ignore them.
    await Promise.resolve();
  } catch (error) {
    record(page, error);
  }
}

console.log("[smoke] ----------------------------------------");
console.log(`[smoke] pages: ${pagePaths.length}  requests attempted: ${requests.length}  toasts: ${toasts.length}`);
if (errors.length === 0) {
  console.log("[smoke] PASS no boot or page-lifecycle errors");
  process.exit(0);
}
console.error(`[smoke] FAIL ${errors.length} error(s)`);
process.exit(1);
