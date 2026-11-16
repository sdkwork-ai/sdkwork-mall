/**
 * Contracts for the mall mini-program runtime composition and the domain modules
 * it reuses.
 *
 * Authority: `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` sections 6-7. Session
 * persistence, the token manager and the WeChat session lifecycle belong to
 * `sdkwork-iam`; these tests exercise them through the mall runtime and through
 * the IAM module's own public subpath, so the reuse is proven, not assumed.
 */
import { describe, expect, it } from "vitest";

import {
  IAM_MP_WECHAT_SESSION_STORAGE_KEY,
  MP_SESSION_STORAGE_KEY,
  SdkworkRequestError,
  createIamMpWechatSessionManager,
  createIamMpWechatSessionStore,
  createMpRequestClient,
  createMpSessionStore,
  createMpSessionTokenManager,
  extractIamMpWechatSessionPayload,
} from "@sdkwork/mall-mp-core";
import { createMemoryHost } from "@sdkwork/mall-mp-host/testing";

function envelope(data: unknown, code = 0) {
  return { code, data, traceId: "trace-1" };
}

describe("session store", () => {
  it("is the IAM-owned store surfaced by mall core", () => {
    expect(MP_SESSION_STORAGE_KEY).toBe(IAM_MP_WECHAT_SESSION_STORAGE_KEY);
  });

  it("persists the dual-token session and restores it for a rebuilt store", () => {
    const host = createMemoryHost();
    const store = createMpSessionStore(host.storage);
    expect(store.isAuthenticated()).toBe(false);

    store.write({ accessToken: "access-1", authToken: "auth-1", userId: "user-1" });

    const rebuilt = createMpSessionStore(host.storage);
    expect(rebuilt.read()).toMatchObject({ accessToken: "access-1", authToken: "auth-1", userId: "user-1" });
    expect(rebuilt.isAuthenticated()).toBe(true);
    expect(host.storage.get(MP_SESSION_STORAGE_KEY)).toContain("auth-1");
  });

  it("drops an expired session instead of serving a dead token", () => {
    const host = createMemoryHost();
    const store = createMpSessionStore(host.storage);
    store.write({ accessToken: "access-1", authToken: "auth-1", expiresAt: Date.now() - 1000 });

    let expired = 0;
    store.onExpired(() => {
      expired += 1;
    });
    expect(store.read()).toBeNull();
    expect(store.isAuthenticated()).toBe(false);
    expect(expired).toBe(1);
  });

  it("clears both credentials and notifies subscribers", () => {
    const host = createMemoryHost();
    const store = createMpSessionStore(host.storage);
    const seen: Array<string | null> = [];
    store.subscribe((snapshot) => seen.push(snapshot?.authToken ?? null));

    store.write({ accessToken: "access-1", authToken: "auth-1" });
    store.clear();

    expect(seen).toEqual(["auth-1", null]);
    expect(host.storage.get(MP_SESSION_STORAGE_KEY)).toBeNull();
  });

  it("keeps the device identity stable across sessions", () => {
    const host = createMemoryHost();
    const store = createMpSessionStore(host.storage);
    const first = store.write({ accessToken: "a", authToken: "b" }).deviceId;
    const second = store.write({ accessToken: "c", authToken: "d" }).deviceId;
    expect(first).toBeTruthy();
    expect(second).toBe(first);
  });
});

describe("token manager", () => {
  it("reads and writes through the session store so generated SDKs see one cache", () => {
    const host = createMemoryHost();
    const store = createMpSessionStore(host.storage);
    const manager = createMpSessionTokenManager(store);

    expect(manager.hasAccessToken()).toBe(false);
    manager.setTokens({ accessToken: "access-2", authToken: "auth-2", expiresIn: 60 });

    expect(manager.hasAccessToken()).toBe(true);
    expect(store.read()).toMatchObject({ accessToken: "access-2", authToken: "auth-2" });
    expect(manager.isValid()).toBe(true);
    expect(typeof store.read()?.expiresAt).toBe("number");

    manager.clearTokens();
    expect(store.read()).toBeNull();
    expect(manager.hasToken()).toBe(false);
  });

  it("refuses to resurrect a half session after a clear", () => {
    const host = createMemoryHost();
    const store = createMpSessionStore(host.storage);
    const manager = createMpSessionTokenManager(store);

    manager.setTokens({ accessToken: "access-only" });

    expect(store.read()).toBeNull();
  });
});

describe("commerce request seam", () => {
  it("unwraps the success envelope and sends both credentials", async () => {
    const host = createMemoryHost({
      httpResponses: [{ statusCode: 200, header: {}, data: envelope({ items: [] }) }],
    });
    const store = createMpSessionStore(host.storage);
    store.write({ accessToken: "access-3", authToken: "auth-3" });
    const client = createMpRequestClient({ baseUrl: () => "https://api.test/app/v3/api", http: host.http, session: store });

    await expect(client.request({ path: "/catalog/products", query: { page: 1 } })).resolves.toEqual({ items: [] });

    const sent = host.recorder.http[0];
    expect(sent.url).toBe("https://api.test/app/v3/api/catalog/products?page=1");
    expect(sent.header).toMatchObject({
      "content-type": "application/json",
      authorization: "Bearer auth-3",
      "access-token": "access-3",
    });
  });

  it("rejects a non-zero envelope code with the problem fields", async () => {
    const host = createMemoryHost({
      httpResponses: [{ statusCode: 200, header: {}, data: { code: 40401, message: "not found", traceId: "trace-9" } }],
    });
    const store = createMpSessionStore(host.storage);
    const client = createMpRequestClient({ baseUrl: () => "https://api.test/app/v3/api", http: host.http, session: store });

    const failure = await client.request({ path: "/orders/x" }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(SdkworkRequestError);
    expect(failure).toMatchObject({ code: 40401, traceId: "trace-9", message: "not found" });
  });

  it("maps an HTTP problem document onto the same error type", async () => {
    const host = createMemoryHost({
      httpResponses: [{
        statusCode: 401,
        header: {},
        data: { code: 40101, detail: "token expired", traceId: "trace-401" },
      }],
    });
    const store = createMpSessionStore(host.storage);
    const client = createMpRequestClient({ baseUrl: () => "https://api.test/app/v3/api", http: host.http, session: store });

    const failure = await client.request({ path: "/orders" }).catch((error: unknown) => error);
    expect(failure).toMatchObject({ statusCode: 401, code: 40101, traceId: "trace-401" });
  });

  it("rawRequest returns bytes for the presigned storage hop", async () => {
    const bytes = new ArrayBuffer(8);
    const host = createMemoryHost({ httpResponses: [{ statusCode: 200, header: { etag: "abc" }, data: bytes }] });
    const store = createMpSessionStore(host.storage);
    const client = createMpRequestClient({ baseUrl: () => "https://api.test/app/v3/api", http: host.http, session: store });

    const response = await client.rawRequest({ url: "https://storage.test/upload", method: "PUT", body: bytes });

    expect(response.statusCode).toBe(200);
    expect(response.header.etag).toBe("abc");
    // The byte hop passes contentType through the host contract; the weixin
    // adapter is what turns it into the `content-type` header.
    expect(host.recorder.http[0]).toMatchObject({ contentType: "application/octet-stream" });
  });
});

describe("IAM wechat session module (reused by mall core)", () => {
  it("normalizes the generated payload shapes", () => {
    expect(extractIamMpWechatSessionPayload({ item: { accessToken: "a", authToken: "b" } }))
      .toMatchObject({ accessToken: "a", authToken: "b" });
    expect(extractIamMpWechatSessionPayload({ data: { session: { access_token: "c", auth_token: "d" } } }))
      .toMatchObject({ accessToken: "c", authToken: "d" });
    expect(extractIamMpWechatSessionPayload({ data: { item: { accessToken: "e", authToken: "f", tenantId: "t1" } } }))
      .toMatchObject({ accessToken: "e", authToken: "f", tenantId: "t1" });
  });

  it("fails loudly when the exchange returns no complete session", () => {
    expect(() => extractIamMpWechatSessionPayload({ accessToken: "access-only" }))
      .toThrow("no complete dual-token session");
  });

  it("exchanges a login code, persists the session and restores it", async () => {
    const host = createMemoryHost();
    const store = createIamMpWechatSessionStore(host.storage);
    let received: Record<string, unknown> | null = null;
    const client = {
      oauth: {
        miniProgramSessions: {
          create: async (body: Record<string, unknown>) => {
            received = body;
            return { accessToken: "access-wx", authToken: "auth-wx", expiresIn: 3600, userId: "user-wx" };
          },
        },
      },
      auth: { sessions: { current: { retrieve: async () => ({}), delete: async () => undefined } } },
    };
    const manager = createIamMpWechatSessionManager({ client, store, surfaceCode: "mall-mini-program" });

    const session = await manager.login({ jsCode: "code-1" });

    expect(session).toMatchObject({ accessToken: "access-wx", authToken: "auth-wx", userId: "user-wx" });
    expect(received).toMatchObject({
      jsCode: "code-1",
      providerCode: "wechat_mini_program",
      surfaceCode: "mall-mini-program",
    });
    expect(received?.deviceId).toBeTruthy();
    expect(store.isAuthenticated()).toBe(true);

    const restored = await manager.restore();
    expect(restored).toMatchObject({ authenticated: true, reason: "restored" });
  });

  it("rejects an empty login code before calling IAM", async () => {
    const host = createMemoryHost();
    const store = createIamMpWechatSessionStore(host.storage);
    const client = {
      oauth: { miniProgramSessions: { create: async () => ({ accessToken: "a", authToken: "b" }) } },
      auth: { sessions: { current: { retrieve: async () => ({}), delete: async () => undefined } } },
    };
    const manager = createIamMpWechatSessionManager({ client, store });

    await expect(manager.login({ jsCode: "  " })).rejects.toThrow("non-empty WeChat login code");
  });

  it("keeps the session on a transient revalidation failure and clears on rejection", async () => {
    const host = createMemoryHost();
    const store = createIamMpWechatSessionStore(host.storage);
    store.write({ accessToken: "a", authToken: "b" });

    const transient = createIamMpWechatSessionManager({
      client: {
        oauth: { miniProgramSessions: { create: async () => ({}) } },
        auth: { sessions: { current: {
          retrieve: async () => {
            throw new Error("offline");
          },
          delete: async () => undefined,
        } } },
      },
      store,
    });
    expect((await transient.restore()).reason).toBe("transient");
    expect(store.isAuthenticated()).toBe(true);

    const rejecting = createIamMpWechatSessionManager({
      client: {
        oauth: { miniProgramSessions: { create: async () => ({}) } },
        auth: { sessions: { current: {
          retrieve: async () => {
            throw Object.assign(new Error("unauthorized"), { statusCode: 401 });
          },
          delete: async () => undefined,
        } } },
      },
      store,
    });
    expect(await rejecting.restore()).toMatchObject({ authenticated: false, reason: "rejected" });
    expect(store.isAuthenticated()).toBe(false);
  });
});
