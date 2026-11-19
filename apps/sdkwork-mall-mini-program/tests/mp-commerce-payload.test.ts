/**
 * Contract for the shared commerce payload reader.
 *
 * The generated app SDK unwraps the success envelope before it resolves, so a
 * list call hands back `{ items, pageInfo }`. Reading `.data` unconditionally
 * produced `{}` for every such call and the home page rendered empty without an
 * error (the storefront regression this reader fixes). The envelope shape still
 * has to work because federated block calls can hand it back verbatim.
 */
import { describe, expect, it } from "vitest";

import { normalizeCommercePayload, readCommercePayload } from "../src/services/commerce-payload";

describe("commerce payload reader", () => {
  it("keeps an unwrapped list payload intact", () => {
    const payload = normalizeCommercePayload({
      items: [{ id: "p-1", title: "无线耳机" }],
      pageInfo: { mode: "offset", page: 1, pageSize: 10, totalItems: 1, hasMore: false },
    });

    expect(payload.items).toEqual([{ id: "p-1", title: "无线耳机" }]);
    expect(payload.pageInfo).toMatchObject({ totalItems: 1, hasMore: false });
  });

  it("keeps an unwrapped detail record intact", () => {
    expect(normalizeCommercePayload({ id: "p-1", title: "无线耳机" })).toMatchObject({
      id: "p-1",
      title: "无线耳机",
    });
  });

  it("unwraps a verbatim success envelope", () => {
    expect(
      normalizeCommercePayload({ code: 0, data: { items: [{ id: "p-1" }] }, traceId: "trace-1" }),
    ).toEqual({ items: [{ id: "p-1" }] });
  });

  it("wraps a bare array answer so list readers keep working", () => {
    expect(normalizeCommercePayload([{ id: "p-1" }, null])).toEqual({ items: [{ id: "p-1" }] });
  });

  it("raises the message of a verbatim failure envelope instead of looking empty", () => {
    expect(() =>
      normalizeCommercePayload({ code: 40301, data: null, message: "没有权限" }),
    ).toThrow("没有权限");
  });

  it("normalizes an empty answer to an empty record", () => {
    expect(normalizeCommercePayload(undefined)).toEqual({});
    expect(normalizeCommercePayload({ code: 0, data: null })).toEqual({});
  });

  it("awaits the call before normalizing it", async () => {
    await expect(
      readCommercePayload(Promise.resolve({ items: [{ id: "p-1" }] })),
    ).resolves.toEqual({ items: [{ id: "p-1" }] });
  });
});
