/**
 * `wx.setStorageSync` adapter.
 *
 * Authority: `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` section 8 (`secureStorage`
 * category). WeChat storage is already scoped to the mini program and cleared
 * with it; this adapter only normalizes failures so a full device does not
 * crash a login attempt with a raw platform exception.
 */
import { createMpHostError, normalizeMpHostError, type MpStorage } from "../index";

export interface WxStorageApi {
  getStorageSync(key: string): unknown;
  removeStorageSync(key: string): void;
  setStorageSync(key: string, value: string): void;
}

export function createWeixinStorage(api: WxStorageApi): MpStorage {
  return {
    get(key) {
      try {
        const value = api.getStorageSync(key);
        return typeof value === "string" && value !== "" ? value : null;
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        api.setStorageSync(key, value);
      } catch (cause) {
        throw normalizeMpHostError(cause);
      }
    },
    remove(key) {
      try {
        api.removeStorageSync(key);
      } catch (cause) {
        throw normalizeMpHostError(cause);
      }
    },
  };
}

export function readWeixinStorageApi(
  scope: { wx?: Partial<WxStorageApi> } = globalThis as { wx?: Partial<WxStorageApi> },
): WxStorageApi {
  const candidate = scope.wx;
  if (
    !candidate
    || typeof candidate.getStorageSync !== "function"
    || typeof candidate.setStorageSync !== "function"
    || typeof candidate.removeStorageSync !== "function"
  ) {
    throw createMpHostError("unsupported", "当前运行环境不支持 wx storage");
  }
  return candidate as WxStorageApi;
}
