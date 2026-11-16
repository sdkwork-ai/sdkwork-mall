/**
 * In-memory host for node tests and for the devtools-without-platform harness.
 *
 * Authority: `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` section 8 ("`mp-host`
 * provides platform implementations and fakes for tests"). Every fake records
 * its calls so a test can assert the contract without a platform runtime.
 */
import {
  MP_HOST_CAPABILITIES,
  createMpHostError,
  type MpChosenImage,
  type MpHost,
  type MpHostCapability,
  type MpHttpRequestOptions,
  type MpHttpResponse,
  type MpSocket,
  type MpSocketConnection,
  type MpStorage,
} from "../index";

/** A scripted socket the test can open, push into, and inspect. */
export interface MemorySocket extends MpSocket {
  /** Frames the SDK sent through the most recent connection. */
  readonly sent: string[];
  close(): void;
  open(): void;
  push(data: string): void;
}

export function createMemorySocket(): MemorySocket {
  const sent: string[] = [];
  let latest: {
    emit: (type: "close" | "error" | "message" | "open", event: unknown) => void;
    state: { value: number };
  } | null = null;

  const socket: MemorySocket = {
    sent,
    connect({ url }) {
      void url;
      const listeners = new Map<string, Array<(event: unknown) => void>>();
      const state = { value: 0 };
      latest = {
        state,
        emit(type, event) {
          for (const handler of listeners.get(type) ?? []) {
            handler(event);
          }
        },
      };
      const connection: MpSocketConnection = {
        get readyState() {
          return state.value;
        },
        addEventListener(type, handler) {
          const list = listeners.get(type) ?? [];
          list.push(handler);
          listeners.set(type, list);
        },
        send(value) {
          sent.push(value);
        },
        close() {
          state.value = 3;
        },
      };
      return connection;
    },
    open() {
      if (latest) {
        latest.state.value = 1;
        latest.emit("open", { type: "open" });
      }
    },
    push(data) {
      latest?.emit("message", { data, type: "message" });
    },
    close() {
      if (latest) {
        latest.state.value = 3;
        latest.emit("close", { code: 1000, reason: "", type: "close" });
      }
    },
  };
  return socket;
}

export interface MemoryHostRecorder {
  readonly clipboard: string[];
  /** EventChannel handlers registered by a `navigateTo` call, per target URL. */
  readonly eventChannels: Array<{ handlers: Record<string, (...args: never[]) => void>; url: string }>;
  readonly http: MpHttpRequestOptions[];
  readonly navigations: string[];
  readonly toasts: string[];
}

export interface CreateMemoryHostOptions {
  /** Reported by `deviceInfo.accountEnvVersion`; defaults to `develop`. */
  readonly accountEnvVersion?: string;
  readonly capabilities?: readonly MpHostCapability[];
  /** Scripted socket; a fresh one is created when omitted. */
  readonly socket?: MemorySocket;
  /** Key/value seed for `storage`. */
  readonly storage?: Record<string, string>;
  /** Scripted HTTP responses, matched in order. */
  readonly httpResponses?: MpHttpResponse[];
  /** Scripted login codes, consumed in order (default `["test-js-code"]`). */
  readonly loginCodes?: string[];
  /** Scripted image picks. */
  readonly images?: MpChosenImage[];
  /** Confirmation answer for `feedback.confirm`. */
  readonly confirmAnswer?: boolean;
}

export interface MemoryHost extends MpHost {
  readonly recorder: MemoryHostRecorder;
  readonly socket: MemorySocket;
}

export function createMemoryHost(options: CreateMemoryHostOptions = {}): MemoryHost {
  const capabilities = new Set<MpHostCapability>(options.capabilities ?? MP_HOST_CAPABILITIES);
  const values = new Map<string, string>(Object.entries(options.storage ?? {}));
  const recorder: MemoryHostRecorder = {
    clipboard: [],
    eventChannels: [],
    http: [],
    navigations: [],
    toasts: [],
  };
  const loginCodes = [...(options.loginCodes ?? ["test-js-code"])];
  const responses = [...(options.httpResponses ?? [])];
  const socket = options.socket ?? createMemorySocket();

  const storage: MpStorage = {
    get: (key) => values.get(key) ?? null,
    set: (key, value) => {
      values.set(key, value);
    },
    remove: (key) => {
      values.delete(key);
    },
  };

  return {
    capabilities,
    recorder,
    socket,
    hasCapability: (capability) => capabilities.has(capability),
    storage,
    // Tests can assert the release channel without a platform runtime.
    deviceInfo: {
      accountEnvVersion: () => options.accountEnvVersion ?? "develop",
      platform: () => "weixin",
    },
    lifecycle: {
      stopPullDownRefresh() {
        recorder.navigations.push("stopPullDownRefresh");
      },
      async startPullDownRefresh() {
        recorder.navigations.push("startPullDownRefresh");
      },
    },
    loginCode: {
      async requestLoginCode() {
        const next = loginCodes.shift();
        if (!next) {
          throw createMpHostError("invalid-state", "no login code scripted");
        }
        return next;
      },
    },
    navigation: {
      async navigateTo(url, options) {
        recorder.navigations.push(`navigateTo:${url}`);
        // An EventChannel handler is available to the test as a scripted emit.
        if (options?.events) {
          recorder.eventChannels.push({ url, handlers: options.events });
        }
      },
      async redirectTo(url) {
        recorder.navigations.push(`redirectTo:${url}`);
      },
      async switchTab(url) {
        recorder.navigations.push(`switchTab:${url}`);
      },
      async back(delta = 1) {
        recorder.navigations.push(`back:${delta}`);
      },
    },
    feedback: {
      toast(message, tone = "none") {
        recorder.toasts.push(tone === "none" ? message : `${tone}:${message}`);
      },
      async confirm() {
        return options.confirmAnswer ?? true;
      },
      async alert() {
        // recorded as a toast so a test can assert the message text
      },
    },
    clipboard: {
      async setText(text) {
        recorder.clipboard.push(text);
      },
    },
    media: {
      async chooseImages() {
        return options.images ?? [];
      },
      async previewImages() {
        recorder.navigations.push("previewImages");
      },
      async readBytes() {
        return new ArrayBuffer(0);
      },
    },
    payment: {
      async requestPayment() {
        // A memory host always "completes" the platform cashier.
      },
    },
    http: {
      async request(requestOptions) {
        recorder.http.push(requestOptions);
        const next = responses.shift();
        if (!next) {
          throw createMpHostError("unavailable", `no HTTP response scripted for ${requestOptions.url}`);
        }
        return next;
      },
      async requestBytes(requestOptions) {
        recorder.http.push(requestOptions);
        const next = responses.shift();
        if (!next) {
          throw createMpHostError("unavailable", `no HTTP response scripted for ${requestOptions.url}`);
        }
        return next;
      },
    },
  };
}
