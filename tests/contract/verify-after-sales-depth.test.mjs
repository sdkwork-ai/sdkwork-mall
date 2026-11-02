import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { strict as assert } from "node:assert";
import { test } from "node:test";

/**
 * After-sales return-shipment contract.
 *
 * A return/refund is not complete until the buyer can tell the merchant which
 * carrier and tracking number sent the goods back. The commerce API exposes
 * `POST /after_sales/requests/{id}/return_shipments`, but no client exposed it:
 * buyers could apply for a return and then had no way to ship it. Every root
 * must submit that command (idempotently) and only offer it once the request is
 * approved for a return or exchange.
 */
const workspaceRoot = fileURLToPath(new URL("../../", import.meta.url));

const ROOTS = [
  {
    name: "pc",
    service: "apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-after-sales/src/after-sales-service.ts",
    servicePatterns: [
      "createMallAfterSalesReturnShipment",
      "createReturnShipment(",
      'row.status === "approved"',
    ],
    page: "apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-after-sales/src/pages/AfterSalesPage.tsx",
    pagePatterns: ["填写退货物流", "handleSubmitReturnShipment", "canMallAfterSalesReturn"],
  },
  {
    name: "h5",
    service: "apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-buyer/src/aftersales-service.ts",
    servicePatterns: [
      "afterSales.returnShipments.create(",
      "idempotencyKey",
    ],
    page: "apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-buyer/src/pages/AfterSalesPage.tsx",
    pagePatterns: [
      "afterSales.list.returnEntry",
      "handleReturnShipment",
      "canSubmitReturnShipment",
      'request.status === "approved"',
    ],
  },
  {
    name: "miniProgram",
    service: "apps/sdkwork-mall-mini-program/src/services/aftersales-service.ts",
    servicePatterns: ["/return_shipments", "Idempotency-Key", 'status === "APPROVED"'],
    page: "apps/sdkwork-mall-mini-program/src/pages/aftersales/index.ts",
    pagePatterns: ["submitReturnShipment", "createReturnShipment"],
  },
  {
    name: "flutter",
    service: "apps/sdkwork-mall-flutter-mobile/lib/services/after_sales_service.dart",
    servicePatterns: ["/return_shipments", "Idempotency-Key", "createReturnShipment"],
    page: "apps/sdkwork-mall-flutter-mobile/lib/pages/after_sales_page.dart",
    pagePatterns: ["填写退货物流", "_submitReturnShipment", "status == 'APPROVED'"],
  },
];

function read(relativePath) {
  assert.ok(existsSync(path.join(workspaceRoot, relativePath)), `missing ${relativePath}`);
  return readFileSync(path.join(workspaceRoot, relativePath), "utf8");
}

test("every root submits the buyer's return tracking number", () => {
  for (const entry of ROOTS) {
    const service = read(entry.service);
    for (const pattern of entry.servicePatterns) {
      assert.ok(
        service.includes(pattern),
        `${entry.name} service must contain ${JSON.stringify(pattern)}`,
      );
    }
    const page = read(entry.page);
    for (const pattern of entry.pagePatterns) {
      assert.ok(
        page.includes(pattern),
        `${entry.name} page must contain ${JSON.stringify(pattern)}`,
      );
    }
  }
});

/**
 * A refund the buyer cannot follow is a support ticket. `GET
 * /after_sales/requests/{id}/events` returns the audit timeline; PC already
 * rendered it, while the three mobile roots only showed a status label. Every
 * root must load the timeline on demand and render the events.
 */
const TIMELINE_ROOTS = [
  {
    name: "pc",
    service: "apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-after-sales/src/after-sales-service.ts",
    servicePatterns: ["listAfterSalesEvents"],
    page: "apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-after-sales/src/pages/AfterSalesPage.tsx",
    pagePatterns: ["setEvents", "处理进度"],
  },
  {
    name: "h5",
    service: "apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-buyer/src/aftersales-service.ts",
    servicePatterns: ["loadMallH5AfterSalesEvents", "afterSales.events.list("],
    page: "apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-buyer/src/pages/AfterSalesPage.tsx",
    pagePatterns: ["toggleProgress", "progressEvents", "afterSales.progress.toggle"],
  },
  {
    name: "miniProgram",
    service: "apps/sdkwork-mall-mini-program/src/services/aftersales-service.ts",
    servicePatterns: ["listAfterSalesEvents", "/events"],
    page: "apps/sdkwork-mall-mini-program/src/pages/aftersales/index.ts",
    pagePatterns: ["toggleProgress", "progressEvents"],
  },
  {
    name: "flutter",
    service: "apps/sdkwork-mall-flutter-mobile/lib/services/after_sales_service.dart",
    servicePatterns: ["listEvents(", "/events"],
    page: "apps/sdkwork-mall-flutter-mobile/lib/pages/after_sales_page.dart",
    pagePatterns: ["_toggleProgress", "_progressEvents", "处理进度"],
  },
];

test("every root renders the after-sales progress timeline", () => {
  for (const entry of TIMELINE_ROOTS) {
    const service = read(entry.service);
    for (const pattern of entry.servicePatterns) {
      assert.ok(
        service.includes(pattern),
        `${entry.name} service must load the timeline (${JSON.stringify(pattern)})`,
      );
    }
    const page = read(entry.page);
    for (const pattern of entry.pagePatterns) {
      assert.ok(
        page.includes(pattern),
        `${entry.name} page must render the timeline (${JSON.stringify(pattern)})`,
      );
    }
  }
});
