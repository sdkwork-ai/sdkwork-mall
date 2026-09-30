import {
  getSdkworkCommerceService,
  unwrapSdkworkCommerceResponse,
} from "@sdkwork/mall-commerce-service";

export interface MallH5AfterSalesRequest {
  createdAt?: string;
  id: string;
  orderId: string;
  reason?: string;
  status: string;
  type: string;
}

export interface MallH5AfterSalesCreateInput {
  orderId: string;
  reason: string;
  type: string;
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

export async function listMallH5AfterSalesRequests(): Promise<MallH5AfterSalesRequest[]> {
  const response = await getSdkworkCommerceService().afterSales.requests.list({
    page: 1,
    page_size: 50,
  });
  const payload = unwrapSdkworkCommerceResponse<{ items?: Record<string, unknown>[] }>(response) ?? {};
  return (payload.items ?? []).map((item) => ({
    createdAt: readString(item, ["createdAt", "created_at", "appliedAt"]) || undefined,
    id: readString(item, ["id", "afterSalesRequestId", "requestId"]),
    orderId: readString(item, ["orderId", "order_id"]),
    reason: readString(item, ["reason", "reasonText", "description"]) || undefined,
    status: readString(item, ["status", "statusName"]) || "pending",
    type: readString(item, ["type", "requestType", "afterSalesType"]) || "refund",
  }));
}

export async function createMallH5AfterSalesRequest(input: MallH5AfterSalesCreateInput): Promise<void> {
  await getSdkworkCommerceService().afterSales.requests.create({
    orderId: input.orderId,
    reason: input.reason,
    type: input.type,
  });
}

export const MALL_H5_AFTER_SALES_TYPES = [
  { value: "refund", label: "仅退款" },
  { value: "return-refund", label: "退货退款" },
  { value: "exchange", label: "换货" },
] as const;
