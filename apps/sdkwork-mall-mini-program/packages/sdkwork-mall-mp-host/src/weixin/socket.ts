/**
 * WebSocket adapter (`wx.connectSocket`).
 *
 * Authority: `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` section 8. The realtime
 * plane of the IM SDK expects a browser-`WebSocket`-shaped object
 * (`readyState` + `addEventListener` + `send`/`close`); WeChat exposes a
 * `SocketTask` instead, so this adapter normalizes the two.
 *
 * State is tracked here rather than read from the platform: `SocketTask` does not
 * expose a portable `readyState` across base-library versions, and the IM SDK
 * branches on it (`CONNECTING` vs `OPEN`) before sending.
 */
import { createMpHostError, normalizeMpHostError, type MpSocket, type MpSocketConnection } from "../index";
import { resolvePlatformScope } from "./scope";

/** `WebSocket`-compatible ready states. */
export const MP_SOCKET_CONNECTING = 0;
export const MP_SOCKET_OPEN = 1;
export const MP_SOCKET_CLOSING = 2;
export const MP_SOCKET_CLOSED = 3;

export interface WxSocketTask {
  close(options?: { code?: number; fail?(result: { errMsg?: string }): void; reason?: string }): void;
  onClose(callback: (result: { code?: number; reason?: string }) => void): void;
  onError(callback: (result: { errMsg?: string }) => void): void;
  onMessage(callback: (result: { data: string | ArrayBuffer }) => void): void;
  onOpen(callback: () => void): void;
  send(options: { data: string; fail?(result: { errMsg?: string }): void }): void;
}

export interface WxSocketApi {
  connectSocket(options: {
    fail?(result: { errMsg?: string }): void;
    header?: Record<string, string>;
    protocols?: string[];
    url: string;
  }): WxSocketTask;
}

type MpSocketEventName = "close" | "error" | "message" | "open";

/**
 * Wraps one `SocketTask` in the `WebSocket`-like contract.
 *
 * Listeners registered before the platform fires are replayed on registration,
 * because the IM SDK subscribes immediately after `connectSocket` returns and
 * `onOpen` may already have fired by then.
 */
export function createWeixinSocketConnection(task: WxSocketTask): MpSocketConnection {
  let readyState = MP_SOCKET_CONNECTING;
  const listeners: Record<MpSocketEventName, Array<(event: unknown) => void>> = {
    close: [],
    error: [],
    message: [],
    open: [],
  };
  const buffered: Partial<Record<MpSocketEventName, unknown>> = {};

  const dispatch = (type: MpSocketEventName, event: unknown): void => {
    if (listeners[type].length === 0) {
      buffered[type] = event;
      return;
    }
    for (const listener of listeners[type]) {
      listener(event);
    }
  };

  task.onOpen(() => {
    readyState = MP_SOCKET_OPEN;
    dispatch("open", { type: "open" });
  });
  task.onMessage((result) => {
    dispatch("message", { data: result.data, type: "message" });
  });
  task.onError((result) => {
    dispatch("error", { message: result.errMsg ?? "socket error", type: "error" });
  });
  task.onClose((result) => {
    readyState = MP_SOCKET_CLOSED;
    dispatch("close", { code: result.code ?? 1006, reason: result.reason ?? "", type: "close" });
  });

  return {
    get readyState() {
      return readyState;
    },
    addEventListener(type, handler) {
      listeners[type].push(handler);
      const pending = buffered[type];
      if (pending !== undefined) {
        delete buffered[type];
        handler(pending);
      }
    },
    send(value) {
      if (readyState !== MP_SOCKET_OPEN) {
        throw createMpHostError("invalid-state", "WebSocket 尚未连接");
      }
      task.send({
        data: value,
        fail: (result) => {
          throw normalizeMpHostError(result);
        },
      });
    },
    close(code, reason) {
      if (readyState === MP_SOCKET_CLOSED) {
        return;
      }
      readyState = MP_SOCKET_CLOSING;
      task.close({ ...(code !== undefined ? { code } : {}), ...(reason ? { reason } : {}) });
    },
  };
}

export function createWeixinSocket(api: WxSocketApi): MpSocket {
  return {
    connect({ header, protocols, url }) {
      const task = api.connectSocket({
        url,
        ...(header ? { header } : {}),
        ...(protocols ? { protocols } : {}),
      });
      return createWeixinSocketConnection(task);
    },
  };
}

export function readWeixinSocketApi(
  scope: { wx?: Partial<WxSocketApi> } = resolvePlatformScope() as { wx?: Partial<WxSocketApi> },
): WxSocketApi {
  const candidate = scope.wx;
  if (!candidate || typeof candidate.connectSocket !== "function") {
    throw createMpHostError("unsupported", "当前运行环境不支持 WebSocket");
  }
  return candidate as WxSocketApi;
}
