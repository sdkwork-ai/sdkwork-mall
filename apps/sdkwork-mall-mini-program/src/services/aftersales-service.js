/**
 * After-sales domain for the mini-program: request list, wire-contract
 * create, and revoke. The create body follows the commerce app-api contract
 * (`CreateAfterSalesRequest`): orderId, afterSalesType, reasonCode,
 * requestedAmount as a decimal string, currencyCode, and at least one order
 * item; amounts and per-item quantities come from the order snapshot, never
 * from user input.
 */
const { request } = require("./transport");

const AFTER_SALES_TYPES = [
  { value: "refund", label: "仅退款" },
  { value: "return", label: "退货退款" },
  { value: "exchange", label: "换货" },
];

const AFTER_SALES_REASON_PRESETS = [
  { code: "not-as-described", label: "商品与描述不符" },
  { code: "quality-issue", label: "质量问题" },
  { code: "missing-item", label: "少件/漏发" },
  { code: "shipping-issue", label: "发货/物流问题" },
  { code: "change-mind", label: "多拍/错拍/不想要了" },
  { code: "other", label: "其他" },
];

const STATUS_LABELS = {
  PENDING: "待审核",
  REVIEWING: "审核中",
  APPROVED: "已通过",
  REJECTED: "已拒绝",
  COMPLETED: "已完成",
  CANCELLED: "已撤销",
};

function buildCreateAfterSalesBody(input) {
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new Error("订单没有可售后的商品行");
  }
  const body = {
    orderId: input.orderId,
    afterSalesType: input.afterSalesType,
    reasonCode: input.reasonCode,
    requestedAmount: Number(input.requestedAmountCny).toFixed(2),
    currencyCode: "CNY",
    items: input.items.map((item) => {
      const entry = {
        orderItemId: item.orderItemId,
        requestedQuantity: item.requestedQuantity,
      };
      if (input.afterSalesType !== "exchange" && item.refundAmountCny != null) {
        entry.refundAmount = Number(item.refundAmountCny).toFixed(2);
      }
      return entry;
    }),
  };
  if (input.description && input.description.trim() !== "") {
    body.description = input.description.trim();
  }
  return body;
}

async function listRequests(page = 1, pageSize = 50) {
  const payload = await request({
    path: "/after_sales/requests",
    query: { page, page_size: pageSize },
  });
  const rows = Array.isArray(payload.items) ? payload.items : [];
  return rows.map((item) => {
    const status = String(item.status ?? "").toUpperCase();
    const type = String(item.afterSalesType ?? item.type ?? "refund").toLowerCase();
    return {
      id: String(item.id ?? ""),
      afterSalesNo: String(item.afterSalesNo ?? item.requestNo ?? ""),
      orderId: String(item.orderId ?? ""),
      reasonCode: String(item.reasonCode ?? ""),
      description: String(item.description ?? ""),
      requestedAmount: String(item.requestedAmount ?? ""),
      typeLabel:
        (AFTER_SALES_TYPES.find((entry) => entry.value === type) || { label: type }).label,
      status,
      statusLabel: STATUS_LABELS[status] || status || "处理中",
      revokable: status === "PENDING" || status === "REVIEWING",
    };
  });
}

async function createRequest(input) {
  const body = buildCreateAfterSalesBody(input);
  return request({ path: "/after_sales/requests", method: "POST", body });
}

async function cancelRequest(requestId) {
  return request({
    path: `/after_sales/requests/${requestId}`,
    method: "PATCH",
    body: { status: "CANCELLED" },
  });
}

module.exports = {
  AFTER_SALES_TYPES,
  AFTER_SALES_REASON_PRESETS,
  STATUS_LABELS,
  buildCreateAfterSalesBody,
  listRequests,
  createRequest,
  cancelRequest,
};
