import {
  errorMessage,
  type MpInputEvent,
  type MpPickerChangeEvent,
  type MpTapEvent,
} from "../../types/common";
import {
  createInvoice,
  listInvoices,
  type MpInvoice,
} from "../../services/invoice-service";
import { isLoggedIn } from "../../services/session";
import { formatCny } from "../../utils/format";

const TITLE_TYPE_OPTIONS = ["个人", "企业"];
const TITLE_TYPE_VALUES = ["personal", "company"];
const STATUS_TEXTS: Record<string, string> = {
  pending: "待开具",
  issued: "已开具",
  cancelled: "已作废",
};

interface InvoiceRow {
  id: string;
  title: string;
  statusText: string;
  amountText: string;
}

interface InvoicesData {
  loading: boolean;
  busy: boolean;
  message: string;
  toast: string;
  titleTypeOptions: string[];
  titleTypeIndex: number;
  title: string;
  taxNumber: string;
  email: string;
  orderId: string;
  invoices: InvoiceRow[];
  _toastTimer: number | null;
}

function toRows(invoices: MpInvoice[]): InvoiceRow[] {
  return invoices.map((invoice) => ({
    id: invoice.id,
    title: invoice.title,
    statusText: STATUS_TEXTS[invoice.status.toLowerCase()] ?? invoice.status,
    amountText: invoice.amountCny != null ? formatCny(invoice.amountCny) : "",
  }));
}

Page({
  data: {
    loading: true,
    busy: false,
    message: "",
    toast: "",
    titleTypeOptions: TITLE_TYPE_OPTIONS,
    titleTypeIndex: 0,
    title: "",
    taxNumber: "",
    email: "",
    orderId: "",
    invoices: [],
    _toastTimer: null,
  } as InvoicesData,

  onShow() {
    if (!isLoggedIn()) {
      this.setData({ loading: false, message: "请先登录后管理发票" });
      return;
    }
    void this.reload();
  },

  async reload() {
    this.setData({ loading: true, message: "" });
    try {
      const invoices = await listInvoices();
      this.setData({ invoices: toRows(invoices), loading: false });
    } catch (cause) {
      this.setData({ loading: false, message: errorMessage(cause, "发票加载失败") });
    }
  },

  onTitleTypeChange(event: MpPickerChangeEvent) {
    this.setData({ titleTypeIndex: Number(event.detail.value) || 0 });
  },

  onTitleInput(event: MpInputEvent) {
    this.setData({ title: event.detail.value });
  },

  onTaxNumberInput(event: MpInputEvent) {
    this.setData({ taxNumber: event.detail.value });
  },

  onEmailInput(event: MpInputEvent) {
    this.setData({ email: event.detail.value });
  },

  onOrderIdInput(event: MpInputEvent) {
    this.setData({ orderId: event.detail.value });
  },

  async submit() {
    const title = this.data.title.trim();
    const titleType = TITLE_TYPE_VALUES[this.data.titleTypeIndex] ?? "personal";
    if (!title) {
      this.showToast("请填写发票抬头");
      return;
    }
    if (titleType === "company" && !this.data.taxNumber.trim()) {
      this.showToast("企业抬头需要填写税号");
      return;
    }
    this.setData({ busy: true, message: "" });
    try {
      await createInvoice({
        title,
        titleType,
        taxNumber: titleType === "company" ? this.data.taxNumber.trim() : undefined,
        email: this.data.email.trim() || undefined,
        orderId: this.data.orderId.trim() || undefined,
      });
      this.setData({ title: "", taxNumber: "" });
      this.showToast("开票申请已提交");
      await this.reload();
    } catch (cause) {
      this.setData({ message: errorMessage(cause, "开票申请失败") });
    } finally {
      this.setData({ busy: false });
    }
  },

  showToast(message: string) {
    this.setData({ toast: message });
    if (this.data._toastTimer != null) {
      clearTimeout(this.data._toastTimer);
    }
    this.setData({ _toastTimer: setTimeout(() => this.setData({ toast: "" }), 2200) });
  },
});
