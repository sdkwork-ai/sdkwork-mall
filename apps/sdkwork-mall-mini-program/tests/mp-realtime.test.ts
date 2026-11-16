/**
 * Realtime plane contracts.
 *
 * Authority: `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` section 8. The IM realtime
 * service expects a browser-`WebSocket`-like object; the WeChat host adapts
 * `SocketTask` to it. These tests pin that adaptation and the mall-facing
 * realtime facade, without a platform runtime or a live gateway.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createWeixinSocket,
  MP_SOCKET_CLOSED,
  MP_SOCKET_CONNECTING,
  MP_SOCKET_OPEN,
} from "@sdkwork/mall-mp-host/weixin";
import { configureMpImServices, recoverRealtime, subscribeConversationMessages } from "@sdkwork/mall-mp-im/im-service";
import type { MpImServices } from "@sdkwork/mall-mp-im/im-service";

interface FakeTask {
  closeCalled: number;
  emitClose(code?: number): void;
  emitMessage(data: string): void;
  emitOpen(): void;
  sent: string[];
}

function createFakeSocketApi() {
  const state: { task: FakeTask | null } = { task: null };
  const api = {
    connectSocket(options: { header?: Record<string, string>; protocols?: string[]; url: string }) {
      const handlers = {
        close: [] as Array<(result: { code?: number; reason?: string }) => void>,
        error: [] as Array<(result: { errMsg?: string }) => void>,
        message: [] as Array<(result: { data: string | ArrayBuffer }) => void>,
        open: [] as Array<() => void>,
      };
      const task: FakeTask & {
        close(options?: { code?: number }): void;
        onClose(cb: (result: { code?: number; reason?: string }) => void): void;
        onError(cb: (result: { errMsg?: string }) => void): void;
        onMessage(cb: (result: { data: string | ArrayBuffer }) => void): void;
        onOpen(cb: () => void): void;
        send(options: { data: string }): void;
      } = {
        closeCalled: 0,
        sent: [],
        onOpen(cb) {
          handlers.open.push(cb);
        },
        onMessage(cb) {
          handlers.message.push(cb);
        },
        onError(cb) {
          handlers.error.push(cb);
        },
        onClose(cb) {
          handlers.close.push(cb);
        },
        send({ data }) {
          task.sent.push(data);
        },
        close(options) {
          task.closeCalled += 1;
          for (const cb of handlers.close) {
            cb({ code: options?.code, reason: "" });
          }
        },
        emitOpen() {
          for (const cb of handlers.open) {
            cb();
          }
        },
        emitMessage(data) {
          for (const cb of handlers.message) {
            cb({ data });
          }
        },
        emitClose(code) {
          for (const cb of handlers.close) {
            cb({ code });
          }
        },
      };
      state.task = task;
      void options;
      return task;
    },
  };
  return { api, state };
}

describe("weixin socket adapter", () => {
  it("normalizes SocketTask into the WebSocket subset the IM SDK uses", () => {
    const { api, state } = createFakeSocketApi();
    const socket = createWeixinSocket(api);
    const connection = socket.connect({ url: "wss://im.test/ws", header: { "x-a": "1" } });
    const events: Array<{ type: string; payload?: unknown }> = [];
    connection.addEventListener("open", () => events.push({ type: "open" }));
    connection.addEventListener("message", (event) => events.push({ type: "message", payload: event }));

    expect(connection.readyState).toBe(MP_SOCKET_CONNECTING);
    state.task?.emitOpen();
    state.task?.emitMessage('{"type":"x"}');

    expect(connection.readyState).toBe(MP_SOCKET_OPEN);
    expect(events).toEqual([
      { type: "open" },
      { type: "message", payload: { data: '{"type":"x"}', type: "message" } },
    ]);
  });

  it("replays an open that fired before the SDK subscribed", () => {
    const { api, state } = createFakeSocketApi();
    const connection = createWeixinSocket(api).connect({ url: "wss://im.test/ws" });
    state.task?.emitOpen();

    let opened = 0;
    connection.addEventListener("open", () => {
      opened += 1;
    });

    expect(opened).toBe(1);
  });

  it("refuses to send while connecting and tracks close state", () => {
    const { api, state } = createFakeSocketApi();
    const connection = createWeixinSocket(api).connect({ url: "wss://im.test/ws" });

    expect(() => connection.send("ping")).toThrow("WebSocket 尚未连接");

    state.task?.emitOpen();
    connection.send("ping");
    expect(state.task?.sent).toEqual(["ping"]);

    let closed = 0;
    connection.addEventListener("close", () => {
      closed += 1;
    });
    connection.close(1000, "bye");

    expect(closed).toBe(1);
    expect(connection.readyState).toBe(MP_SOCKET_CLOSED);
    expect(state.task?.closeCalled).toBe(1);
  });
});

describe("mall realtime facade", () => {
  beforeEach(() => {
    configureMpImServices(null);
  });

  it("leases a conversation through the IM realtime service and releases it", () => {
    const release = vi.fn();
    const subscribeConversation = vi.fn(() => release);
    const recover = vi.fn();
    const dispose = vi.fn();
    configureMpImServices({
      realtime: {
        subscribeConversation,
        subscribeConversationTyping: vi.fn(() => vi.fn()),
        subscribeRefresh: vi.fn(() => vi.fn()),
        isLiveConnected: () => true,
        recover,
        dispose,
      },
    } as unknown as MpImServices);

    const onMessage = vi.fn();
    const releaseLease = subscribeConversationMessages("c-1", onMessage);

    expect(subscribeConversation).toHaveBeenCalledWith("c-1", expect.any(Function));
    // The facade re-reads the page instead of mapping the wire payload.
    subscribeConversation.mock.calls[0]?.[1]?.({}, {});
    expect(onMessage).toHaveBeenCalledTimes(1);

    releaseLease();
    expect(release).toHaveBeenCalledTimes(1);

    recoverRealtime();
    expect(recover).toHaveBeenCalledTimes(1);
  });

  it("fails loudly when the realtime service was never wired", () => {
    expect(() => subscribeConversationMessages("c-1", () => undefined)).toThrow("IM services are not configured");
  });
});
