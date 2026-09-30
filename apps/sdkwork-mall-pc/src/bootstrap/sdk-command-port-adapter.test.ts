import { describe, expect, it, vi } from "vitest";

import {
  createSdkCommandPortAdapter,
  splitSdkQueryId,
} from "./sdk-command-port-adapter";

describe("createSdkCommandPortAdapter", () => {
  it("normalizes SDK query keys and preserves the source receiver", async () => {
    const list = vi.fn(async function (this: { marker: string }, query: unknown) {
      return { marker: this.marker, query };
    });
    const source = { records: { marker: "source", list } };
    const port = createSdkCommandPortAdapter<{
      records: { list(query: Record<string, unknown>): Promise<unknown> };
    }>(source);

    await expect(port.records.list({ page_size: 20 })).resolves.toEqual({
      marker: "source",
      query: { pageSize: 20 },
    });
    expect(list).toHaveBeenCalledWith({ pageSize: 20 });
  });

  it("adds generated SDK write parameters only for declared commands", async () => {
    const create = vi.fn(async (_body: unknown, params: unknown) => params);
    const port = createSdkCommandPortAdapter<{
      applications: { create(body: Record<string, unknown>): Promise<unknown> };
    }>({ applications: { create } }, {
      commandPaths: ["applications.create"],
    });

    const result = await port.applications.create({ shop_name: "SDKWork" });
    expect(create).toHaveBeenCalledWith(
      { shopName: "SDKWork" },
      { idempotencyKey: expect.any(String) },
    );
    expect(result).toEqual({ idempotencyKey: expect.any(String) });
  });

  it("supports explicit query-to-path argument rules", async () => {
    const list = vi.fn(async (_shopId: string, query: unknown) => query);
    const port = createSdkCommandPortAdapter<{
      riskSignals: { list(query: Record<string, unknown>): Promise<unknown> };
    }>({ riskSignals: { list } }, {
      argumentRules: {
        "riskSignals.list": ([query]) => splitSdkQueryId(query, "shopId"),
      },
    });

    await port.riskSignals.list({ shopId: "shop-1", page_size: 10 });
    expect(list).toHaveBeenCalledWith("shop-1", { pageSize: 10 });
  });

  it("can project an owner SDK method that is absent from an aggregate transport", async () => {
    const update = vi.fn(async (...args: unknown[]) => args);
    const port = createSdkCommandPortAdapter<{
      requests: { update(id: string, body: Record<string, unknown>): Promise<unknown> };
    }>({ requests: {} }, {
      methodOverrides: {
        "requests.update": update,
      },
    });

    await port.requests.update("after-sales-1", { reason_code: "buyer-update" });
    expect(update).toHaveBeenCalledWith(
      "after-sales-1",
      { reasonCode: "buyer-update" },
    );
  });
});
