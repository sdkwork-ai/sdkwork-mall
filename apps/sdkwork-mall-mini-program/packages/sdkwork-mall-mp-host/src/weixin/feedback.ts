/**
 * Feedback adapter (`wx.showToast` / `wx.showModal`) and clipboard.
 *
 * Authority: `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` section 8. Pages ask for a
 * toast or a confirmation; they never assemble platform options themselves.
 */
import { createMpHostError, normalizeMpHostError, type MpClipboard, type MpFeedback } from "../index";

export interface WxFeedbackApi {
  setClipboardData(options: { data: string; fail?(result: { errMsg?: string }): void; success?(): void }): void;
  showModal(options: {
    cancelText?: string;
    confirmText?: string;
    content?: string;
    fail?(result: { errMsg?: string }): void;
    showCancel?: boolean;
    success?(result: { cancel: boolean; confirm: boolean }): void;
    title?: string;
  }): void;
  showToast(options: { duration?: number; icon?: "none" | "success" | "error"; title: string }): void;
}

const TOAST_DURATION_MS = 2200;

export function createWeixinFeedback(api: WxFeedbackApi): MpFeedback {
  return {
    toast(message) {
      if (!message) {
        return;
      }
      api.showToast({ icon: "none", title: message, duration: TOAST_DURATION_MS });
    },
    confirm({ content, confirmText, title }) {
      return new Promise<boolean>((resolve) => {
        api.showModal({
          title,
          content,
          showCancel: true,
          ...(confirmText ? { confirmText } : {}),
          success: (result) => resolve(Boolean(result.confirm)),
          fail: () => resolve(false),
        });
      });
    },
    alert({ content, showCancel = false, title }) {
      return new Promise<void>((resolve) => {
        api.showModal({
          title,
          content,
          showCancel,
          success: () => resolve(),
          fail: () => resolve(),
        });
      });
    },
  };
}

export function createWeixinClipboard(api: WxFeedbackApi): MpClipboard {
  return {
    setText(text) {
      return new Promise<void>((resolve, reject) => {
        api.setClipboardData({
          data: text,
          success: () => resolve(),
          fail: (result) => reject(normalizeMpHostError(result)),
        });
      });
    },
  };
}

export function readWeixinFeedbackApi(
  scope: { wx?: Partial<WxFeedbackApi> } = globalThis as { wx?: Partial<WxFeedbackApi> },
): WxFeedbackApi {
  const candidate = scope.wx;
  if (!candidate || typeof candidate.showToast !== "function" || typeof candidate.showModal !== "function") {
    throw createMpHostError("unsupported", "当前运行环境不支持 wx 反馈接口");
  }
  return candidate as WxFeedbackApi;
}
