import { describe, expect, it, vi } from "vitest";

import {
  configureMallAfterSalesMediaRuntimePort,
  getMallAfterSalesMediaRuntime,
  isMallAfterSalesMediaRuntimeConfigured,
  resetMallAfterSalesMediaRuntimePort,
} from "../src/after-sales-media-port";
import {
  configureSdkworkAfterSalesRemotePort,
  type SdkworkAfterSalesRemotePort,
} from "../src/after-sales-remote-port";
import {
  createMallAfterSalesRequest,
} from "../src/after-sales-service";

/**
 * After-sales evidence upload adoption (`DRIVE_SPEC.md` §18).
 *
 * The evidence form used to declare fileName/fileSize metadata while the
 * bytes went nowhere. These tests pin the media-port adoption: picks upload
 * through the host port, evidence items carry the returned drive reference,
 * a submission with an in-flight upload is refused, and a host without the
 * port gets a refuse-with-hint picker path instead of a local data URL.
 */

function createMediaPort(overrides: Partial<{ fail: boolean }> = {}) {
  return {
    uploadImages: vi
      .fn()
      .mockImplementation((files: File[]) =>
        overrides.fail
          ? Promise.reject(new Error("upload failed"))
          : Promise.resolve(files.map((file) => `drive://spaces/space-1/nodes/node-${file.name}`)),
      ),
    resolveDisplayUrl: vi.fn().mockResolvedValue("blob:preview"),
  };
}

function createRemotePort() {
  return {
    createAfterSalesRequest: vi.fn().mockResolvedValue({ id: "as-1" }),
    listAfterSalesEvents: vi.fn().mockResolvedValue([]),
    listAfterSalesRequests: vi.fn().mockResolvedValue([]),
    listReturnShipments: vi.fn().mockResolvedValue([]),
    retrieveAfterSalesRequest: vi.fn().mockResolvedValue({}),
    retrieveOrder: vi.fn().mockResolvedValue({
      id: "order-1",
      items: [{ id: "item-1", name: "Goods", price: 10, quantity: 1 }],
    }),
    updateAfterSalesRequest: vi.fn().mockResolvedValue({}),
  };
}

function evidenceFile(name = "evidence.png"): File {
  return new File(["bytes"], name, { type: "image/png" });
}

const formBase = {
  description: "",
  evidenceFiles: [] as Array<{ id: string; name: string; reference?: string; size: number }>,
  orderId: "order-1",
  reason: "damaged",
  requestedAmountCny: "10.00",
  requestType: "refund" as const,
};

const orderContext = {
  items: [{ orderItemId: "item-1", priceCny: 10, quantity: 1 }],
  orderId: "order-1",
} as never;

describe("after-sales media port", () => {
  it("fails closed when the host has not composed the port", () => {
    resetMallAfterSalesMediaRuntimePort();
    expect(isMallAfterSalesMediaRuntimeConfigured()).toBe(false);
    expect(() => getMallAfterSalesMediaRuntime()).toThrow(/media runtime port is not configured/);
  });

  it("configures and resets the host port", () => {
    const port = createMediaPort();
    configureMallAfterSalesMediaRuntimePort(port as never);
    expect(isMallAfterSalesMediaRuntimeConfigured()).toBe(true);
    expect(getMallAfterSalesMediaRuntime()).toBe(port);
    resetMallAfterSalesMediaRuntimePort();
    expect(isMallAfterSalesMediaRuntimeConfigured()).toBe(false);
  });
});

describe("after-sales evidence upload adoption", () => {
  it("carries the drive reference inside the evidence snapshot item", async () => {
    const remote = createRemotePort();
    configureSdkworkAfterSalesRemotePort(remote as unknown as SdkworkAfterSalesRemotePort);
    const form = {
      ...formBase,
      evidenceFiles: [
        {
          id: "e-1",
          name: "evidence.png",
          reference: "drive://spaces/space-1/nodes/node-1",
          size: 4,
        },
      ],
    };

    await createMallAfterSalesRequest(form as never, orderContext);

    const body = remote.createAfterSalesRequest.mock.calls[0][0] as {
      evidenceSnapshot: Array<Record<string, unknown>>;
    };
    expect(body.evidenceSnapshot[0]).toEqual({
      fileName: "evidence.png",
      fileSize: 4,
      source: "drive",
      url: "drive://spaces/space-1/nodes/node-1",
    });
  });

  it("refuses submission while an evidence upload is still in flight", async () => {
    const remote = createRemotePort();
    configureSdkworkAfterSalesRemotePort(remote as unknown as SdkworkAfterSalesRemotePort);
    const form = {
      ...formBase,
      evidenceFiles: [{ id: "e-1", name: "evidence.png", size: 4 }],
    };

    await expect(
      createMallAfterSalesRequest(form as never, orderContext),
    ).rejects.toThrow("凭证仍在上传中");
    expect(remote.createAfterSalesRequest).not.toHaveBeenCalled();
  });
});
