import {
  hasSdkworkAccountSession,
  requireSdkworkAccountSession,
} from "@sdkwork/account-service";
import {
  toNullableSdkworkPaymentNumber,
  toSdkworkPaymentNumber,
  toSdkworkPaymentOptionalString,
  unwrapSdkworkPaymentResponse,
} from "@sdkwork/payment-service";
import {
  getSdkworkInvoiceRemotePort,
  type SdkworkInvoiceRemotePort,
} from "./invoice-remote-port";
import {
  createSdkworkInvoiceMessages,
  type SdkworkInvoiceMessages,
  type SdkworkInvoiceMessagesOverrides,
} from "./invoice-copy";
import {
  summarizeSdkworkInvoices,
  type SdkworkInvoiceStatus,
  type SdkworkInvoiceStatusDigest,
  type SdkworkInvoiceTitleType,
  type SdkworkInvoiceType,
} from "./invoice";

export interface SdkworkInvoiceSummary {
  canCancel: boolean;
  canDownload: boolean;
  canEdit: boolean;
  canSubmit: boolean;
  createdAt: string;
  currency?: string;
  id: string;
  invoiceCode?: string;
  invoiceNo?: string;
  status: SdkworkInvoiceStatus;
  statusLabel: string;
  title: string;
  titleType: SdkworkInvoiceTitleType;
  totalAmountCny: number | null;
  type: SdkworkInvoiceType;
  updatedAt?: string;
}

export interface SdkworkInvoiceStatistics {
  completedInvoices: number;
  pendingInvoices: number;
  totalAmountCny: number | null;
  totalInvoices: number;
}

export interface SdkworkInvoiceItem {
  amountExcludingTaxCny: number | null;
  id: string;
  name: string;
  quantity: number;
  specification?: string;
  taxAmountCny: number | null;
  taxRate: number | null;
  totalAmountCny: number | null;
  unit?: string;
  unitPriceExcludingTaxCny: number | null;
}

export interface SdkworkInvoiceDetail extends SdkworkInvoiceSummary {
  amountExcludingTaxCny: number | null;
  bankAccount?: string;
  bankName?: string;
  electronicUrl?: string;
  invoiceTime?: string;
  items: SdkworkInvoiceItem[];
  registerAddress?: string;
  registerPhone?: string;
  taxAmountCny: number | null;
  taxNo?: string;
  taxRate: number | null;
}

export interface SdkworkInvoiceDashboardData {
  digest: SdkworkInvoiceStatusDigest;
  invoices: SdkworkInvoiceSummary[];
  statistics: SdkworkInvoiceStatistics;
}

export interface SdkworkInvoiceCreateInput {
  taxNo?: string;
  title: string;
  titleType?: SdkworkInvoiceTitleType;
  totalAmountCny?: number | null;
  type?: SdkworkInvoiceType;
}

export interface SdkworkInvoiceUpdateInput {
  bankAccount?: string;
  bankName?: string;
  invoiceId: string;
  registerAddress?: string;
  registerPhone?: string;
  taxNo?: string;
  title?: string;
}

export interface SdkworkInvoiceMutationResult extends Pick<SdkworkInvoiceSummary, "id" | "status" | "title" | "totalAmountCny" | "type"> {}

export interface SdkworkInvoiceSubmitResult {
  invoiceId: string;
  submitted: true;
}

export interface SdkworkInvoiceCancelInput {
  cancelReason?: string;
  invoiceId: string;
}

export interface SdkworkInvoiceCancelResult {
  cancelled: true;
  invoiceId: string;
}

export interface CreateSdkworkInvoiceServiceOptions {
  locale?: string | null;
  messages?: SdkworkInvoiceMessagesOverrides;
  remotePort?: SdkworkInvoiceRemotePort;
}

export interface SdkworkInvoiceService {
  cancelInvoice(input: SdkworkInvoiceCancelInput): Promise<SdkworkInvoiceCancelResult>;
  createInvoice(input: SdkworkInvoiceCreateInput): Promise<SdkworkInvoiceMutationResult>;
  getDashboard(): Promise<SdkworkInvoiceDashboardData>;
  getEmptyDashboard(): SdkworkInvoiceDashboardData;
  getInvoiceDetail(invoiceId: string): Promise<SdkworkInvoiceDetail>;
  submitInvoice(invoiceId: string): Promise<SdkworkInvoiceSubmitResult>;
  updateInvoice(input: SdkworkInvoiceUpdateInput): Promise<SdkworkInvoiceMutationResult>;
}

interface RemotePageEnvelope<T> {
  content?: T[];
}

interface RemoteInvoice {
  amountCny?: number | string;
  createdAt?: string;
  currency?: string;
  id?: string;
  invoiceCode?: string;
  invoiceId?: string;
  invoiceNo?: string;
  status?: string;
  title?: string;
  titleType?: string;
  totalAmount?: number | string;
  type?: string;
  updatedAt?: string;
}

interface RemoteInvoiceDetail extends RemoteInvoice {
  amountExcludingTax?: number | string;
  bankAccount?: string;
  bankName?: string;
  electronicUrl?: string;
  invoiceTime?: string;
  items?: RemoteInvoiceItem[];
  registerAddress?: string;
  registerPhone?: string;
  taxAmount?: number | string;
  taxNo?: string;
  taxRate?: number | string;
}

interface RemoteInvoiceItem {
  amountExcludingTax?: number | string;
  itemId?: string;
  productName?: string;
  quantity?: number | string;
  specification?: string;
  taxAmount?: number | string;
  taxRate?: number | string;
  totalAmount?: number | string;
  unit?: string;
  unitPriceExcludingTax?: number | string;
}

interface RemoteInvoiceStatistics {
  completedInvoices?: number | string;
  pendingInvoices?: number | string;
  totalAmount?: number | string;
  totalInvoices?: number | string;
}

type SdkworkInvoiceCopyContext = Pick<SdkworkInvoiceMessages, "service" | "status">;

function toNullableAmount(value: unknown): number | null {
  const amount = toNullableSdkworkPaymentNumber(value);
  if (amount === null) {
    return null;
  }

  return Math.round(amount * 100) / 100;
}

function mapInvoiceStatus(status: string | undefined): SdkworkInvoiceStatus {
  const normalized = (status || "").trim().toUpperCase();
  if (normalized === "DRAFT") {
    return "draft";
  }

  if (normalized === "PENDING") {
    return "pending";
  }

  if (normalized === "PROCESSING") {
    return "processing";
  }

  if (normalized === "COMPLETED") {
    return "completed";
  }

  if (normalized === "FAILED") {
    return "failed";
  }

  if (normalized === "CANCELLED" || normalized === "CANCELED") {
    return "cancelled";
  }

  return "unknown";
}

function formatStatusLabel(
  status: SdkworkInvoiceStatus,
  messages: SdkworkInvoiceCopyContext,
): string {
  if (status === "draft") {
    return messages.status.draft;
  }

  if (status === "pending") {
    return messages.status.pending;
  }

  if (status === "processing") {
    return messages.status.processing;
  }

  if (status === "completed") {
    return messages.status.completed;
  }

  if (status === "failed") {
    return messages.status.failed;
  }

  if (status === "cancelled") {
    return messages.status.cancelled;
  }

  return messages.status.unknown;
}

function mapInvoiceType(type: string | undefined): SdkworkInvoiceType {
  const normalized = (type || "").trim().toUpperCase();
  if (normalized === "NORMAL") {
    return "normal";
  }

  if (normalized === "SPECIAL") {
    return "special";
  }

  if (normalized === "ELECTRONIC") {
    return "electronic";
  }

  if (normalized === "PAPER") {
    return "paper";
  }

  return "unknown";
}

function mapTitleType(titleType: string | undefined): SdkworkInvoiceTitleType {
  const normalized = (titleType || "").trim().toUpperCase();
  if (normalized === "COMPANY") {
    return "company";
  }

  if (normalized === "PERSONAL") {
    return "personal";
  }

  return "unknown";
}

function toRemoteTitleType(titleType: SdkworkInvoiceTitleType | undefined): string | undefined {
  if (titleType === "company") {
    return "COMPANY";
  }

  if (titleType === "personal") {
    return "PERSONAL";
  }

  return undefined;
}

function toRemoteInvoiceType(type: SdkworkInvoiceType | undefined): string | undefined {
  if (type === "normal") {
    return "NORMAL";
  }

  if (type === "special") {
    return "SPECIAL";
  }

  if (type === "electronic") {
    return "ELECTRONIC";
  }

  if (type === "paper") {
    return "PAPER";
  }

  return undefined;
}

function canEditInvoice(status: SdkworkInvoiceStatus): boolean {
  return status === "draft" || status === "failed";
}

function canSubmitInvoice(status: SdkworkInvoiceStatus): boolean {
  return status === "draft" || status === "failed";
}

function canCancelInvoice(status: SdkworkInvoiceStatus): boolean {
  return status === "completed";
}

function mapSummary(
  invoice: RemoteInvoice | null | undefined,
  messages: SdkworkInvoiceCopyContext,
): SdkworkInvoiceSummary {
  const status = mapInvoiceStatus(invoice?.status);

  return {
    canCancel: canCancelInvoice(status),
    canDownload: status === "completed",
    canEdit: canEditInvoice(status),
    canSubmit: canSubmitInvoice(status),
    createdAt: toSdkworkPaymentOptionalString(invoice?.createdAt) || new Date(0).toISOString(),
    currency: toSdkworkPaymentOptionalString(invoice?.currency) || messages.service.defaultCurrency,
    id:
      toSdkworkPaymentOptionalString(invoice?.invoiceId)
      ?? toSdkworkPaymentOptionalString(invoice?.id)
      ?? "unknown-invoice",
    invoiceCode: toSdkworkPaymentOptionalString(invoice?.invoiceCode),
    invoiceNo: toSdkworkPaymentOptionalString(invoice?.invoiceNo),
    status,
    statusLabel: formatStatusLabel(status, messages),
    title: toSdkworkPaymentOptionalString(invoice?.title) || messages.service.summaryFallbackTitle,
    titleType: mapTitleType(invoice?.titleType),
    totalAmountCny: toNullableAmount(invoice?.totalAmount ?? invoice?.amountCny),
    type: mapInvoiceType(invoice?.type),
    updatedAt: toSdkworkPaymentOptionalString(invoice?.updatedAt),
  };
}

function mapItem(
  item: RemoteInvoiceItem | null | undefined,
  index: number,
  messages: SdkworkInvoiceCopyContext,
): SdkworkInvoiceItem {
  return {
    amountExcludingTaxCny: toNullableAmount(item?.amountExcludingTax),
    id: toSdkworkPaymentOptionalString(item?.itemId) || `invoice-item-${index + 1}`,
    name: toSdkworkPaymentOptionalString(item?.productName) || messages.service.itemFallbackName,
    quantity: toSdkworkPaymentNumber(item?.quantity, 1),
    specification: toSdkworkPaymentOptionalString(item?.specification),
    taxAmountCny: toNullableAmount(item?.taxAmount),
    taxRate: toNullableSdkworkPaymentNumber(item?.taxRate),
    totalAmountCny: toNullableAmount(item?.totalAmount),
    unit: toSdkworkPaymentOptionalString(item?.unit),
    unitPriceExcludingTaxCny: toNullableAmount(item?.unitPriceExcludingTax),
  };
}

function mapDetail(
  detail: RemoteInvoiceDetail | null | undefined,
  fallbackItems: RemoteInvoiceItem[] | null | undefined,
  messages: SdkworkInvoiceCopyContext,
): SdkworkInvoiceDetail {
  const summary = mapSummary(detail, messages);
  const itemsSource = (detail?.items && detail.items.length > 0) ? detail.items : (fallbackItems ?? []);

  return {
    ...summary,
    amountExcludingTaxCny: toNullableAmount(detail?.amountExcludingTax),
    bankAccount: toSdkworkPaymentOptionalString(detail?.bankAccount),
    bankName: toSdkworkPaymentOptionalString(detail?.bankName),
    electronicUrl: toSdkworkPaymentOptionalString(detail?.electronicUrl),
    invoiceTime: toSdkworkPaymentOptionalString(detail?.invoiceTime),
    items: itemsSource.map((item, index) => mapItem(item, index, messages)),
    registerAddress: toSdkworkPaymentOptionalString(detail?.registerAddress),
    registerPhone: toSdkworkPaymentOptionalString(detail?.registerPhone),
    taxAmountCny: toNullableAmount(detail?.taxAmount),
    taxNo: toSdkworkPaymentOptionalString(detail?.taxNo),
    taxRate: toNullableSdkworkPaymentNumber(detail?.taxRate),
  };
}

function mapStatistics(statistics: RemoteInvoiceStatistics | null | undefined): SdkworkInvoiceStatistics {
  return {
    completedInvoices: toSdkworkPaymentNumber(statistics?.completedInvoices),
    pendingInvoices: toSdkworkPaymentNumber(statistics?.pendingInvoices),
    totalAmountCny: toNullableAmount(statistics?.totalAmount),
    totalInvoices: toSdkworkPaymentNumber(statistics?.totalInvoices),
  };
}

function createEmptyDashboard(): SdkworkInvoiceDashboardData {
  return {
    digest: summarizeSdkworkInvoices([]),
    invoices: [],
    statistics: {
      completedInvoices: 0,
      pendingInvoices: 0,
      totalAmountCny: 0,
      totalInvoices: 0,
    },
  };
}

function mapMutationResult(
  result: RemoteInvoice | null | undefined,
  messages: SdkworkInvoiceCopyContext,
  fallback: {
    invoiceId?: string;
    title?: string;
    titleType?: SdkworkInvoiceTitleType;
    totalAmountCny?: number | null;
    type?: SdkworkInvoiceType;
  } = {},
): SdkworkInvoiceMutationResult {
  const summary = mapSummary({
    ...result,
    invoiceId: result?.invoiceId ?? fallback.invoiceId,
    title: result?.title ?? fallback.title,
    titleType: result?.titleType ?? toRemoteTitleType(fallback.titleType),
    totalAmount: result?.totalAmount ?? fallback.totalAmountCny ?? undefined,
    type: result?.type ?? toRemoteInvoiceType(fallback.type),
  }, messages);

  return {
    id: summary.id,
    status: summary.status,
    title: summary.title,
    totalAmountCny: summary.totalAmountCny,
    type: summary.type,
  };
}

export function createSdkworkInvoiceService(
  options: CreateSdkworkInvoiceServiceOptions = {},
): SdkworkInvoiceService {
  const messages = createSdkworkInvoiceMessages(options.locale, options.messages);
  const copy = messages.service;
  const getRemotePort = () => options.remotePort ?? getSdkworkInvoiceRemotePort();

  return {
    async cancelInvoice(input) {
      requireSdkworkAccountSession(copy.signInRequired);
      await unwrapSdkworkPaymentResponse<void>(
        await getRemotePort().cancelInvoice(input.invoiceId, {
          cancelReason: toSdkworkPaymentOptionalString(input.cancelReason),
        }),
        copy.cancelFailed,
      );

      return {
        cancelled: true,
        invoiceId: input.invoiceId,
      };
    },

    async createInvoice(input) {
      requireSdkworkAccountSession(copy.signInRequired);
      const payload = {
        taxNo: toSdkworkPaymentOptionalString(input.taxNo),
        title: input.title.trim(),
        titleType: toRemoteTitleType(input.titleType),
        totalAmount: toNullableAmount(input.totalAmountCny),
        type: toRemoteInvoiceType(input.type),
      };
      const result = unwrapSdkworkPaymentResponse<RemoteInvoice>(
        await getRemotePort().createInvoice(payload),
        copy.createFailed,
      );

      return mapMutationResult(result, messages, {
        title: input.title,
        titleType: input.titleType,
        totalAmountCny: input.totalAmountCny ?? null,
        type: input.type,
      });
    },

    async getDashboard() {
      if (!hasSdkworkAccountSession()) {
        return createEmptyDashboard();
      }

      const [invoicePagePayload, statisticsPayload] = await Promise.all([
        getRemotePort().listMineInvoices({
              page: 1,
              pageSize: 20,
        }),
        getRemotePort().retrieveStatistics(),
      ]);
      const invoicePage = unwrapSdkworkPaymentResponse<RemotePageEnvelope<RemoteInvoice>>(
        invoicePagePayload,
        copy.requestFailed,
      );
      const statistics = unwrapSdkworkPaymentResponse<RemoteInvoiceStatistics | null>(
        statisticsPayload,
        copy.requestFailed,
      );

      const invoices = (invoicePage.content ?? [])
        .map((invoice) => mapSummary(invoice, messages))
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

      return {
        digest: summarizeSdkworkInvoices(invoices),
        invoices,
        statistics: mapStatistics(statistics),
      };
    },

    getEmptyDashboard() {
      return createEmptyDashboard();
    },

    async getInvoiceDetail(invoiceId) {
      requireSdkworkAccountSession(copy.signInRequired);
      const [detailPayload, itemsPayload] = await Promise.all([
        getRemotePort().retrieveInvoice(invoiceId),
        getRemotePort().listInvoiceItems(invoiceId),
      ]);
      const detail = unwrapSdkworkPaymentResponse<RemoteInvoiceDetail | null>(detailPayload, copy.requestFailed);
      const items = unwrapSdkworkPaymentResponse<RemoteInvoiceItem[] | null>(itemsPayload, copy.requestFailed);

      return mapDetail(detail, items, messages);
    },

    async submitInvoice(invoiceId) {
      requireSdkworkAccountSession(copy.signInRequired);
      await unwrapSdkworkPaymentResponse<unknown>(
        await getRemotePort().submitInvoice(invoiceId),
        copy.submitFailed,
      );

      return {
        invoiceId,
        submitted: true,
      };
    },

    async updateInvoice(input) {
      requireSdkworkAccountSession(copy.signInRequired);
      const payload = {
        bankAccount: toSdkworkPaymentOptionalString(input.bankAccount),
        bankName: toSdkworkPaymentOptionalString(input.bankName),
        registerAddress: toSdkworkPaymentOptionalString(input.registerAddress),
        registerPhone: toSdkworkPaymentOptionalString(input.registerPhone),
        taxNo: toSdkworkPaymentOptionalString(input.taxNo),
        title: toSdkworkPaymentOptionalString(input.title),
      };
      const result = unwrapSdkworkPaymentResponse<RemoteInvoice>(
        await getRemotePort().updateInvoice(input.invoiceId, payload),
        copy.updateFailed,
      );

      return mapMutationResult(result, messages, {
        invoiceId: input.invoiceId,
        title: input.title,
      });
    },
  };
}

export const sdkworkInvoiceService = createSdkworkInvoiceService();
