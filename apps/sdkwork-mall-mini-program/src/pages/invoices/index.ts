import { t } from "../../i18n";
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
import { mpCapabilityUrl } from "../../routes/capabilities";
import { formatCny } from "../../utils/format";
import { platform } from "@sdkwork/mall-mp-core";

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
  loadingMore: boolean;
  needLogin: boolean;
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
  hasMore: boolean;
  _page: number;
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
    loadingMore: false,
    needLogin: false,
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
    hasMore: true,
    _page: 0,
    _toastTimer: null,
  } as InvoicesData,

  onShow() {
    if (!isLoggedIn()) {
      this.setData({ loading: false, needLogin: true, message: "" });
      return;
    }
    this.setData({ needLogin: false });
    void this.reload(1);
  },

  onReachBottom() {
    void this.loadMore();
  },

  async reload(page = 1) {
    this.setData(
      page === 1
        ? { loading: true, message: "", _page: 0, hasMore: true }
        : { loadingMore: true },
    );
    try {
      const invoices = await listInvoices(page);
      const rows = toRows(invoices.items);
      this.setData(
        page === 1
          ? { invoices: rows, loading: false, hasMore: invoices.hasMore, _page: 1 }
          : {
              invoices: this.data.invoices.concat(rows.filter((row) => !this.data.invoices.some((existing) => existing.id === row.id))),
              loadingMore: false,
              hasMore: invoices.hasMore,
              _page: page,
            },
      );
    } catch (cause) {
      this.setData({
        loading: false,
        loadingMore: false,
        message: errorMessage(cause, "发票加载失败"),
      });
    }
  },

  async loadMore() {
    if (this.data.loading || this.data.loadingMore || !this.data.hasMore) {
      return;
    }
    await this.reload(this.data._page + 1);
  },

  goLogin() {
    platform.navigateTo(mpCapabilityUrl("account.mall.login"));
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
    if (this.data.busy) {
      return;
    }
    const title = this.data.title.trim();
    const titleType = TITLE_TYPE_VALUES[this.data.titleTypeIndex] ?? "personal";
    // A USCC is case-insensitive; lowercase input was rejected by the uppercase
    // pattern even though it is a valid tax number.
    const taxNumber = this.data.taxNumber.trim().toUpperCase();
    if (!title) {
      this.showToast("请填写发票抬头");
      return;
    }
    if (titleType === "company" && !taxNumber) {
      this.showToast("企业抬头需要填写税号");
      return;
    }
    if (titleType === "company" && !/^[A-Z0-9]{15,20}$/.test(taxNumber)) {
      this.showToast(t("invoices.taxInvalid"));
      return;
    }
    this.setData({ busy: true, message: "" });
    try {
      await createInvoice({
        title,
        titleType,
        taxNumber: titleType === "company" ? taxNumber : undefined,
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

  retry() {
    if (!isLoggedIn()) {
      this.goLogin();
      return;
    }
    void this.reload(1);
  },

  onPullDownRefresh() {
    if (!isLoggedIn()) {
      platform.stopPullDownRefresh();
      return;
    }
    void this.reload(1).finally(() => platform.stopPullDownRefresh());
  },
});
