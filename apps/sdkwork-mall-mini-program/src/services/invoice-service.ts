/**
 * Buyer invoices.
 *
 * Authority: `TECH-BLOCK-INTEGRATION.md` (invoices row). Invoice listing and
 * application belong to the mall commerce block
 * (`runtime.commerceClient.invoices`); the mall keeps the view model and the
 * H5/PC field contract (`title`, `titleType`, `taxNumber`, `email`, `orderId`).
 */
import { getMallMpRuntime } from "@sdkwork/mall-mp-core";

import { asNumber, asRecordList, asString, type MpRecord } from "../types/common";
import { readCommercePayload } from "./commerce-payload";
import { readPageInfo } from "./page-info";

export interface MpInvoice {
  id: string;
  title: string;
  type: string;
  status: string;
  amountCny: number | null;
}

export interface MpInvoiceCreateInput {
  title: string;
  titleType: string;
  taxNumber?: string;
  email?: string;
  orderId?: string;
}

function invoices() {
  return getMallMpRuntime().commerceClient.invoices;
}

export async function listInvoices(page = 1): Promise<{ hasMore: boolean; items: MpInvoice[] }> {
  const pageSize = 20;
  const payload = await readCommercePayload(invoices().mine.list({ page, pageSize }));
  const rows = asRecordList(payload.items);
  return {
    hasMore: readPageInfo(payload, rows.length, page).hasMore,
    items: rows.map((row: MpRecord) => ({
      id: asString(row, ["id", "invoiceId"]),
      title: asString(row, ["title", "invoiceTitle", "header"], "发票"),
      type: asString(row, ["titleType", "type", "kind"], "personal"),
      status: asString(row, ["status", "statusName"], "pending"),
      amountCny: asNumber(row, ["amountCny", "amount", "totalAmount"]),
    })),
  };
}

export async function createInvoice(input: MpInvoiceCreateInput): Promise<MpRecord> {
  return readCommercePayload(invoices().create({
    title: input.title,
    titleType: input.titleType,
    taxNumber: input.taxNumber,
    email: input.email,
    orderId: input.orderId,
  }));
}
