/**
 * Contracts for the host `fetch` adapter.
 *
 * Authority: `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` section 8. Every generated
 * SDKWork SDK reaches the network through the global `fetch`; WeChat has none, so
 * this adapter is the single platform seam that makes the blocks runnable on a
 * device. `@sdkwork/sdk-common`'s `BaseHttpClient` only needs the subset these
 * tests pin.
 */
import { afterEach, describe, expect, it } from "vitest";

import { createMpFetch, installMpFetch } from "@sdkwork/mall-mp-host/fetch";
import { createMemoryHost } from "@sdkwork/mall-mp-host/testing";

const URL = "https://api.test/app/v3/api/orders";

function hostWith(response: Record<string, unknown>) {
  return createMemoryHost({
    httpResponses: [{ statusCode: 200, header: { ETag: '"abc"' }, data: response }],
  });
}

describe("host fetch adapter", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("projects a host response onto the fetch Response subset", async () => {
    const host = hostWith({ code: 0, data: { items: [] }, traceId: "t-1" });
    const fetchImpl = createMpFetch(host.http);

    const response = await fetchImpl(URL, {
      method: "GET",
      headers: { "Accept-Language": "zh-CN" },
    });

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
    expect(response.headers.get("etag")).toBe('"abc"');
    await expect(response.json()).resolves.toEqual({ code: 0, data: { items: [] }, traceId: "t-1" });
    expect(await response.text()).toContain("\"code\":0");
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0);
    expect(host.recorder.http[0]).toMatchObject({
      url: URL,
      method: "GET",
      header: { "Accept-Language": "zh-CN" },
    });
  });

  it("passes the body and method through to the host hop", async () => {
    const host = createMemoryHost({ httpResponses: [{ statusCode: 201, header: {}, data: { ok: true } }] });
    const fetchImpl = createMpFetch(host.http);

    const response = await fetchImpl(URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "PENDING_PAYMENT" }),
    });

    expect(response.status).toBe(201);
    expect(host.recorder.http[0]).toMatchObject({
      method: "POST",
      data: '{"status":"PENDING_PAYMENT"}',
    });
  });

  it("resolves non-2xx responses so the SDK envelope handling sees them", async () => {
    const host = createMemoryHost({
      httpResponses: [{ statusCode: 422, header: { "Content-Type": "application/problem+json" }, data: { code: 42201 } }],
    });
    const fetchImpl = createMpFetch(host.http);

    const response = await fetchImpl(URL);

    expect(response.ok).toBe(false);
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({ code: 42201 });
  });

  it("installs itself as the global fetch when the runtime has none", () => {
    delete (globalThis as { fetch?: unknown }).fetch;
    const host = hostWith({});
    installMpFetch(host.http);
    expect(typeof globalThis.fetch).toBe("function");
  });

  it("never replaces a native fetch", () => {
    const native = (() => Promise.resolve(null)) as unknown as typeof fetch;
    globalThis.fetch = native;
    const host = hostWith({});
    installMpFetch(host.http);
    expect(globalThis.fetch).toBe(native);
  });
});
