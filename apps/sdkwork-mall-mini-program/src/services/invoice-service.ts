/**
 * Buyer invoices (`/invoices` app-api surface).
 *
 * `GET /invoices/mine` returns the paged `data.items` envelope; create posts
 * the invoice application command and mirrors the H5/PC field contract
 * (`title`, `titleType`, `taxNumber`, `email`, `orderId`).
 */
import { request } from "./transport";
import { asNumber, asRecordList, asString, type MpRecord } from "../types/common";

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

export async function listInvoices(): Promise<MpInvoice[]> {
  const payload = await request({
    path: "/invoices/mine",
    query: { page: 1, page_size: 50 },
  });
  return asRecordList(payload.items).map((row: MpRecord) => ({
    id: asString(row, ["id", "invoiceId"]),
    title: asString(row, ["title", "invoiceTitle", "header"], "发票"),
    type: asString(row, ["titleType", "type", "kind"], "personal"),
    status: asString(row, ["status", "statusName"], "pending"),
    amountCny: asNumber(row, ["amountCny", "amount", "totalAmount"]),
  }));
}

export async function createInvoice(input: MpInvoiceCreateInput): Promise<MpRecord> {
  return request({
    path: "/invoices",
    method: "POST",
    body: {
      title: input.title,
      titleType: input.titleType,
      taxNumber: input.taxNumber,
      email: input.email,
      orderId: input.orderId,
    },
  });
}
