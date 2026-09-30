import {
  getSdkworkCommerceService,
  unwrapSdkworkCommerceResponse,
} from "@sdkwork/mall-commerce-service";

export interface MallH5Invoice {
  amountCny: number | null;
  id: string;
  status: string;
  title: string;
  type: string;
}

export interface MallH5InvoiceCreateInput {
  email?: string;
  orderId?: string;
  taxNumber?: string;
  title: string;
  titleType: string;
}

function readMoney(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function readString(record: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value);
    }
  }
  return "";
}

export async function listMallH5Invoices(): Promise<MallH5Invoice[]> {
  const response = await getSdkworkCommerceService().invoices.mine.list({ page: 1, page_size: 50 });
  const payload = unwrapSdkworkCommerceResponse<{ items?: Record<string, unknown>[] }>(response) ?? {};
  return (payload.items ?? []).map((item) => ({
    amountCny: readMoney(item.amountCny ?? item.amount ?? item.totalAmount),
    id: readString(item, ["id", "invoiceId"]),
    status: readString(item, ["status", "statusName"]) || "pending",
    title: readString(item, ["title", "invoiceTitle", "header"]) || "发票",
    type: readString(item, ["titleType", "type", "kind"]) || "personal",
  }));
}

export async function createMallH5Invoice(input: MallH5InvoiceCreateInput): Promise<void> {
  await getSdkworkCommerceService().invoices.create({
    email: input.email,
    orderId: input.orderId,
    taxNumber: input.taxNumber,
    title: input.title,
    titleType: input.titleType,
  });
}
