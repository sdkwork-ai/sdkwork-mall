import { t } from "../../i18n";
import { errorMessage, type MpInputEvent, type MpPickerChangeEvent, type MpTapEvent } from "../../types/common";
import { isLoggedIn } from "../../services/session";
import { formatCny, formatTime } from "../../utils/format";
import { mpCapabilityUrl } from "../../routes/capabilities";
import {
  cancelPartnerApplication,
  listMyPartnerApplications,
  resolvePartnerMembershipState,
  retrievePartnerProgram,
  submitPartnerApplication,
  validatePartnerDraft,
  validatePartnerInviteCode,
  type MpPartnerApplication,
  type MpPartnerApplicationDraft,
  type MpPartnerLevel,
  type MpPartnerProgram,
} from "../../services/partner-service";

interface PartnerLevelView {
  levelNo: number;
  name: string;
  joinFeeText: string;
  customerRevenueText: string;
  joinFeeCommissionText: string;
  benefits: string[];
}

interface PartnerApplicationView {
  id: string;
  title: string;
  statusText: string;
  metaText: string;
  reviewComment: string;
  canCancel: boolean;
}

interface PartnerLevelOption {
  label: string;
  value: number;
}

interface PartnerPageData {
  applicantTypeOptions: string[];
  loading: boolean;
  error: string;
  membershipState: "none" | "pending" | "approved" | "rejected" | "cancelled";
  statusTitle: string;
  statusDescription: string;
  summary: string[];
  levels: PartnerLevelView[];
  rulesText: string;
  levelsEmptyText: string;
  centerNotice: string;
  inviteCode: string;
  shareLink: string;
  inviteInput: string;
  inviteValid: boolean;
  inviteResultTitle: string;
  inviteResultDetail: string;
  formOpen: boolean;
  form: MpPartnerApplicationDraft;
  levelOptions: PartnerLevelOption[];
  issues: string[];
  submitting: boolean;
  validating: boolean;
  cancellingId: string;
  applications: PartnerApplicationView[];
  labels: Record<string, string>;
}

const EMPTY_FORM: MpPartnerApplicationDraft = {
  applicantType: "INDIVIDUAL",
  businessIntro: "",
  contactEmail: "",
  contactName: "",
  contactPhone: "",
  inviteCode: "",
  subjectName: "",
  targetLevelNo: 1,
};

function percentText(value: string): string {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `${parsed}%` : "—";
}

function moneyText(value: string): string {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? formatCny(parsed) : "—";
}

function toLevelView(level: MpPartnerLevel): PartnerLevelView {
  return {
    benefits: level.benefits.map((benefit) => `${benefit.name}${benefit.value ? ` · ${benefit.value}` : ""}`),
    customerRevenueText: percentText(level.customerRevenueRatio),
    joinFeeCommissionText: percentText(level.joinFeeCommissionRatio),
    joinFeeText: moneyText(level.joinFee),
    levelNo: level.levelNo,
    name: level.name,
  };
}

function toApplicationView(application: MpPartnerApplication): PartnerApplicationView {
  return {
    canCancel: application.status === "SUBMITTED",
    id: application.id,
    metaText: `${t("partner.applications.targetLevel")} ${application.targetLevelNo} · ${t("partner.applications.submittedAt")} ${formatTime(application.createdAt)}`,
    reviewComment: application.reviewComment,
    statusText: t(`partner.statusLabel.${application.status}`),
    title: application.subjectName || application.contactName || "—",
  };
}

function buildRulesText(program: MpPartnerProgram): string {
  return [
    t("partner.program.currency"),
    program.rules.currency,
    t("partner.program.profitMargin"),
    percentText(program.rules.profitMarginRatio),
    t("partner.program.minWithdrawal"),
    moneyText(program.rules.minWithdrawalAmount),
  ].join(" · ");
}

function summaryTexts(program: MpPartnerProgram): string[] {
  const active = program.levels.filter((level) => level.status === "ACTIVE");
  if (active.length === 0) {
    return [];
  }
  const maxRatio = Math.max(...active.map((level) => Number(level.customerRevenueRatio) || 0));
  const minFee = Math.min(...active.map((level) => Number(level.joinFee) || 0));
  return [
    `${t("partner.program.level")} ${active.length}`,
    `${t("partner.program.customerRevenue")} ${maxRatio}%`,
    `${t("partner.program.joinFee")} ${formatCny(minFee)}`,
  ];
}

function buildLabels(): Record<string, string> {
  return {
    actionsApply: t("partner.actions.apply"),
    actionsCancel: t("partner.actions.cancelApplication"),
    actionsClose: t("partner.actions.close"),
    actionsCopy: t("partner.actions.copy"),
    actionsReapply: t("partner.actions.reapply"),
    actionsSubmitting: t("partner.actions.submitting"),
    actionsValidate: t("partner.actions.validate"),
    applicantType: t("partner.apply.applicantType"),
    applicationsEmpty: t("partner.applications.empty"),
    applicationsTitle: t("partner.applications.title"),
    applyBusinessIntro: t("partner.apply.businessIntro"),
    applyContactEmail: t("partner.apply.contactEmail"),
    applyContactName: t("partner.apply.contactName"),
    applyContactPhone: t("partner.apply.contactPhone"),
    applyDescription: t("partner.apply.description"),
    applyIndividual: t("partner.apply.individual"),
    applyInviteCode: t("partner.apply.inviteCode"),
    applyOrganization: t("partner.apply.organization"),
    applySubjectName: t("partner.apply.subjectName"),
    applySubmit: t("partner.apply.submit"),
    applyTargetLevel: t("partner.apply.targetLevel"),
    applyTitle: t("partner.apply.title"),
    centerNotice: t("partner.center.notConfigured"),
    centerTitle: t("partner.center.title"),
    inviteCodeLabel: t("partner.center.inviteCode"),
    inviteDescription: t("partner.invite.description"),
    invitePlaceholder: t("partner.invite.placeholder"),
    inviteTitle: t("partner.invite.title"),
    levelsEmpty: t("partner.program.empty"),
    loading: t("partner.page.loading"),
    pageEyebrow: t("partner.page.eyebrow"),
    pageTitle: t("partner.page.title"),
    programBenefits: t("partner.program.benefits"),
    programCustomerRevenue: t("partner.program.customerRevenue"),
    programDescription: t("partner.program.description"),
    programJoinFee: t("partner.program.joinFee"),
    programJoinFeeCommission: t("partner.program.joinFeeCommission"),
    programTitle: t("partner.program.title"),
    reviewComment: t("partner.applications.reviewComment"),
    retry: t("partner.page.retry"),
  };
}

Page({
  data: {
    applicantTypeOptions: [t("partner.apply.individual"), t("partner.apply.organization")],
    applications: [],
    cancellingId: "",
    centerNotice: "",
    error: "",
    form: { ...EMPTY_FORM },
    formOpen: false,
    inviteCode: "",
    inviteInput: "",
    inviteResultDetail: "",
    inviteResultTitle: "",
    inviteValid: false,
    issues: [],
    labels: buildLabels(),
    levelOptions: [],
    levels: [],
    levelsEmptyText: t("partner.program.empty"),
    loading: true,
    membershipState: "none",
    rulesText: "",
    shareLink: "",
    statusDescription: "",
    statusTitle: "",
    submitting: false,
    summary: [],
    validating: false,
  } as PartnerPageData,

  onLoad(options: Record<string, string | undefined>) {
    const invite = (options.invite ?? "").trim();
    if (invite) {
      this.setData({ "form.inviteCode": invite, inviteInput: invite });
    }
  },

  onShow() {
    if (!isLoggedIn()) {
      this.setData({
        error: t("partner.page.errorTitle"),
        loading: false,
      });
      return;
    }
    void this.load();
  },

  async load() {
    this.setData({ error: "", loading: true });
    try {
      const [program, applications] = await Promise.all([
        retrievePartnerProgram(),
        listMyPartnerApplications(),
      ]);
      const membershipState = resolvePartnerMembershipState(applications);
      const levelOptions = program.levels
        .filter((level) => level.status === "ACTIVE")
        .map((level) => ({
          label: `${level.name} · ${t("partner.program.level")} ${level.levelNo}`,
          value: level.levelNo,
        }));
      this.setData({
        applications: applications.map(toApplicationView),
        form: {
          ...this.data.form,
          targetLevelNo: this.data.form.targetLevelNo || levelOptions[0]?.value || 1,
        },
        levelOptions,
        levels: program.levels.map(toLevelView),
        loading: false,
        membershipState,
        rulesText: buildRulesText(program),
        statusDescription: t(`partner.status.${membershipState}.description`),
        statusTitle: t(`partner.status.${membershipState}.title`),
        summary: summaryTexts(program),
      });
    } catch (cause) {
      this.setData({
        error: errorMessage(cause, t("partner.page.errorTitle")),
        loading: false,
      });
    }
  },

  retry() {
    void this.load();
  },

  openForm() {
    this.setData({ formOpen: true, issues: [] });
  },

  closeForm() {
    this.setData({ formOpen: false });
  },

  onFieldInput(event: MpInputEvent & MpTapEvent) {
    const field = String(event.currentTarget.dataset.field ?? "");
    if (!field) {
      return;
    }
    this.setData({ [`form.${field}`]: event.detail.value });
  },

  onApplicantTypeChange(event: MpPickerChangeEvent) {
    const index = Number(event.detail.value);
    this.setData({ "form.applicantType": index === 1 ? "ORGANIZATION" : "INDIVIDUAL" });
  },

  onTargetLevelChange(event: MpPickerChangeEvent) {
    const index = Number(event.detail.value);
    const option = this.data.levelOptions[index];
    if (option) {
      this.setData({ "form.targetLevelNo": option.value });
    }
  },

  onInviteInput(event: MpInputEvent) {
    this.setData({ inviteInput: event.detail.value });
  },

  async submit() {
    if (this.data.submitting) {
      return;
    }
    const issues = validatePartnerDraft(this.data.form).map((code) => t(`partner.issues.${code}`));
    if (issues.length > 0) {
      this.setData({ issues });
      return;
    }
    this.setData({ issues: [], submitting: true });
    try {
      await submitPartnerApplication(this.data.form);
      this.setData({ form: { ...EMPTY_FORM }, formOpen: false });
      await this.load();
    } catch (cause) {
      this.setData({ issues: [errorMessage(cause, t("partner.page.errorTitle"))] });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async validateInvite() {
    const code = this.data.inviteInput.trim();
    if (!code || this.data.validating) {
      return;
    }
    this.setData({ validating: true, inviteResultDetail: "", inviteResultTitle: "" });
    try {
      const preview = await validatePartnerInviteCode(code);
      this.setData({
        inviteResultDetail: preview.valid
          ? `${t("partner.invite.inviter")}: ${preview.partnerName || "—"}${preview.levelNo ? ` · ${t("partner.invite.level")} ${preview.levelNo}` : ""}`
          : "",
        inviteResultTitle: preview.valid ? t("partner.invite.valid") : t("partner.invite.invalid"),
        inviteValid: preview.valid,
      });
    } catch (cause) {
      this.setData({
        inviteResultDetail: "",
        inviteResultTitle: errorMessage(cause, t("partner.invite.invalid")),
        inviteValid: false,
      });
    } finally {
      this.setData({ validating: false });
    }
  },

  async cancelApplication(event: MpTapEvent) {
    const applicationId = String(event.currentTarget.dataset.id ?? "");
    if (!applicationId || this.data.cancellingId) {
      return;
    }
    this.setData({ cancellingId: applicationId });
    try {
      await cancelPartnerApplication(applicationId);
      await this.load();
    } catch (cause) {
      this.setData({ error: errorMessage(cause, t("partner.page.errorTitle")) });
    } finally {
      this.setData({ cancellingId: "" });
    }
  },

  copyShareLink() {
    if (!this.data.shareLink) {
      return;
    }
    wx.setClipboardData({ data: this.data.shareLink });
  },

  goOrders() {
    wx.navigateTo({ url: mpCapabilityUrl("buyer.mall.orders") });
  },
});
