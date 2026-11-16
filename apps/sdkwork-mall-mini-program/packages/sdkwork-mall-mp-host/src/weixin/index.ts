/**
 * WeChat mini program host profile.
 *
 * Authority: `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` sections 2 and 8: platform
 * API implementations live under `mp-host/src/weixin/`, and the app bootstrap
 * installs exactly one profile. Everything here is structural typing over the
 * `wx` global so the package builds and unit-tests outside the platform
 * runtime; the platform-specific reference types stay in the app.
 */
import {
  createMpHostError,
  MP_HOST_CAPABILITIES,
  type MpHost,
  type MpHostCapability,
  type MpLoginCodeProvider,
  type MpSocket,
} from "../index";
import type { WxFeedbackApi } from "./feedback";
import { createWeixinClipboard, createWeixinFeedback, readWeixinFeedbackApi } from "./feedback";
import type { WxRequestApi } from "./http";
import { createWeixinHttpClient } from "./http";
import type { WxLoginApi } from "./login";
import { createWeixinLoginCodeProvider, readWeixinLoginApi } from "./login";
import type { WxDeviceInfoApi, WxLifecycleApi } from "./lifecycle";
import { createWeixinDeviceInfo, createWeixinLifecycle } from "./lifecycle";
import type { WxMediaApi } from "./media";
import { createWeixinMediaPicker } from "./media";
import type { WxNavigationApi } from "./navigation";
import { createWeixinNavigation, readWeixinNavigationApi } from "./navigation";
import type { WxPaymentApi } from "./payment";
import { createWeixinPaymentBridge } from "./payment";
import type { WxSocketApi } from "./socket";
import { createWeixinSocket, readWeixinSocketApi } from "./socket";
import type { WxStorageApi } from "./storage";
import { createWeixinStorage, readWeixinStorageApi } from "./storage";

/** Everything the weixin profile reads from the platform global. */
export interface WxGlobal
  extends Partial<WxLoginApi>,
    Partial<WxStorageApi>,
    Partial<WxNavigationApi>,
    Partial<WxFeedbackApi>,
    Partial<WxMediaApi>,
    Partial<WxPaymentApi>,
    Partial<WxRequestApi>,
    Partial<WxLifecycleApi>,
    Partial<WxDeviceInfoApi>,
    Partial<WxSocketApi> {}

/** Capabilities the WeChat profile implements today. */
export const WEIXIN_HOST_CAPABILITIES: readonly MpHostCapability[] = [
  "platformLogin",
  "secureStorage",
  "mediaPicker",
  "clipboard",
  "paymentBridge",
  "appLifecycle",
  "networkStatus",
  "deviceInfo",
  "subscriptionsOrPush",
];

export interface CreateWeixinHostOptions {
  /** Platform global; defaults to `globalThis.wx`. */
  readonly scope?: { wx?: WxGlobal };
  readonly loginTimeoutMs?: number;
}

/**
 * Builds the WeChat host profile.
 *
 * A missing platform API fails closed with `unsupported` instead of throwing a
 * raw `TypeError`: the app bootstrap can then keep the mini program on its
 * development fallbacks instead of white-screening at launch.
 */
export function createWeixinHost(options: CreateWeixinHostOptions = {}): MpHost {
  const scope = options.scope ?? (globalThis as { wx?: WxGlobal });
  const capabilities = new Set<MpHostCapability>(WEIXIN_HOST_CAPABILITIES);

  const unavailable = (capability: MpHostCapability): MpLoginCodeProvider => ({
    requestLoginCode: () => Promise.reject(createMpHostError("unsupported", `未提供 ${capability} 能力`)),
  });

  let loginCode: MpLoginCodeProvider = unavailable("platformLogin");
  try {
    loginCode = createWeixinLoginCodeProvider(readWeixinLoginApi(scope).login, options.loginTimeoutMs);
  } catch {
    capabilities.delete("platformLogin");
  }

  const storageApi = readWeixinStorageApi(scope);
  const navigationApi = readWeixinNavigationApi(scope);
  const feedbackApi = readWeixinFeedbackApi(scope);
  const httpApi = scope.wx;
  if (!httpApi || typeof httpApi.request !== "function") {
    throw createMpHostError("unsupported", "当前运行环境不支持 wx.request");
  }

  const mediaApi = scope.wx;
  const media = mediaApi && typeof mediaApi.chooseMedia === "function"
    ? createWeixinMediaPicker(mediaApi as WxMediaApi)
    : {
        chooseImages: () => Promise.reject(createMpHostError("unsupported", "当前运行环境不支持选择图片")),
        previewImages: () => Promise.reject(createMpHostError("unsupported", "当前运行环境不支持图片预览")),
        readBytes: () => Promise.reject(createMpHostError("unsupported", "当前运行环境不支持读取文件")),
      };
  if (!(mediaApi && typeof mediaApi.chooseMedia === "function")) {
    capabilities.delete("mediaPicker");
  }

  const paymentApi = scope.wx;
  const payment = paymentApi && typeof paymentApi.requestPayment === "function"
    ? createWeixinPaymentBridge(paymentApi as WxPaymentApi)
    : { requestPayment: () => Promise.reject(createMpHostError("unsupported", "当前运行环境不支持微信支付")) };
  if (!(paymentApi && typeof paymentApi.requestPayment === "function")) {
    capabilities.delete("paymentBridge");
  }

  const socketApi = scope.wx;
  const socket = socketApi && typeof socketApi.connectSocket === "function"
    ? createWeixinSocket(socketApi as WxSocketApi)
    : { connect: () => { throw createMpHostError("unsupported", "当前运行环境不支持 WebSocket"); } };
  if (!(socketApi && typeof socketApi.connectSocket === "function")) {
    capabilities.delete("subscriptionsOrPush");
  }

  return {
    capabilities,
    hasCapability: (capability) => capabilities.has(capability),
    loginCode,
    storage: createWeixinStorage(storageApi),
    navigation: createWeixinNavigation(navigationApi),
    feedback: createWeixinFeedback(feedbackApi),
    clipboard: createWeixinClipboard(feedbackApi),
    lifecycle: createWeixinLifecycle(httpApi as unknown as WxLifecycleApi),
    deviceInfo: createWeixinDeviceInfo(httpApi as unknown as WxDeviceInfoApi),
    media,
    payment,
    socket: socket as MpSocket,
    http: createWeixinHttpClient(httpApi as WxRequestApi),
  };
}

/** Re-exported so a profile switch (`my`, `dd`, `tt`) has one capability vocabulary. */
export { MP_HOST_CAPABILITIES };

/** Socket adapter pieces, re-exported for tests and for a future profile. */
export {
  MP_SOCKET_CLOSED,
  MP_SOCKET_CLOSING,
  MP_SOCKET_CONNECTING,
  MP_SOCKET_OPEN,
  createWeixinSocket,
  createWeixinSocketConnection,
} from "./socket";
