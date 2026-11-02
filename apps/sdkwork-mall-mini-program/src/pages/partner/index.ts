import { t } from "../../i18n";
import { errorMessage, type MpInputEvent, type MpPickerChangeEvent, type MpTapEvent } from "../../types/common";
import { isLoggedIn } from "../../services/session";
import { formatCny, formatTime } from "../../utils/format";
import { mpCapabilityUrl } from "../../routes/capabilities";
import {
  cancelPartnerApplication,
  createPartnerWithdrawal,
  listMyPartnerApplications,
  listPartnerCommissions,
  listPartnerTeam,
  listPartnerWithdrawals,
  resolvePartnerMembershipState,
  retrievePartnerCenter,
  retrievePartnerProgram,
  submitPartnerApplication,
  validatePartnerDraft,
  validatePartnerInviteCode,
  type MpPartnerApplication,
  type MpPartnerApplicationDraft,
  type MpPartnerCenter,
  type MpPartnerCommissionRecord,
  type MpPartnerLevel,
  type MpPartnerProgram,
  type MpPartnerTeamMember,
  type MpPartnerWithdrawal,
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

interface PartnerTeamView {
  partnerId: string;
  name: string;
  levelText: string;
  metaText: string;
  commissionText: string;
  balanceText: string;
  joinedText: string;
}

interface PartnerCommissionView {
  id: string;
  amountText: string;
  sourceText: string;
  baseText: string;
  ratioText: string;
  metaText: string;
  statusText: string;
}

interface PartnerWithdrawalView {
  id: string;
  amountText: string;
  statusText: string;
  metaText: string;
  reviewComment: string;
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
  center: MpPartnerCenter | null;
  team: PartnerTeamView[];
  teamPage: number;
  teamPageText: string;
  teamTotal: number;
  teamLoading: boolean;
  commissions: PartnerCommissionView[];
  commissionPage: number;
  commissionPageText: string;
  commissionTotal: number;
  commissionLoading: boolean;
  withdrawals: PartnerWithdrawalView[];
  withdrawalPage: number;
  withdrawalPageText: string;
  withdrawalTotal: number;
  withdrawalLoading: boolean;
  withdrawAmount: string;
  withdrawRemark: string;
  withdrawing: boolean;
  withdrawError: string;
  withdrawSuccess: boolean;
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

function toTeamView(member: MpPartnerTeamMember, currency: string): PartnerTeamView {
  return {
    balanceText: `${t("partner.team.availableBalance")} ${moneyText(member.availableBalance)}`,
    commissionText: `${t("partner.team.totalCommission")} ${moneyText(member.totalCommission)}`,
    joinedText: `${t("partner.team.joinedAt")} ${formatTime(member.joinedAt)}`,
    levelText: `${member.levelName || member.levelNo} · ${t("partner.team.depth")} ${member.depth}`,
    metaText: `${t("partner.team.customerCount")} ${member.customerCount} · ${t("partner.team.directTeam")} ${member.directTeamSize} · ${currency}`,
    name: member.name || member.partnerId,
    partnerId: member.partnerId,
  };
}

function toCommissionView(record: MpPartnerCommissionRecord): PartnerCommissionView {
  return {
    amountText: moneyText(record.amount),
    baseText: `${t("partner.commissions.baseAmount")} ${moneyText(record.baseAmount)}`,
    id: record.id,
    metaText: `${t("partner.commissions.levelOffset")} ${record.levelOffset} · ${formatTime(record.computedAt)}`,
    ratioText: `${t("partner.commissions.ratio")} ${percentText(record.ratio)}`,
    sourceText: record.sourceRef ? `${record.sourceType} · ${record.sourceRef}` : record.sourceType,
    statusText: record.status,
  };
}

function toWithdrawalView(withdrawal: MpPartnerWithdrawal): PartnerWithdrawalView {
  return {
    amountText: moneyText(withdrawal.amount),
    id: withdrawal.id,
    metaText: `${t("partner.withdrawals.requestedAt")} ${formatTime(withdrawal.createdAt)}${
      withdrawal.paidAt
        ? ` · ${t("partner.withdrawals.paidAt")} ${formatTime(withdrawal.paidAt)}`
        : ""
    }`,
    reviewComment: withdrawal.reviewRemark,
    statusText: t(`partner.withdrawalStatusLabel.${withdrawal.status.toUpperCase()}`),
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
    customers: t("partner.team.customerCount"),
    directTeam: t("partner.team.directTeam"),
    commissionsEmpty: t("partner.commissions.empty"),
    commissionsNext: t("partner.commissions.nextPage"),
    commissionsPage: t("partner.commissions.page").replace("{{page}}", "{page}").replace("{{total}}", "{total}"),
    commissionsPrev: t("partner.commissions.previousPage"),
    commissionsTitle: t("partner.commissions.title"),
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
    teamEmpty: t("partner.team.empty"),
    teamNext: t("partner.team.nextPage"),
    teamPage: t("partner.team.page").replace("{{page}}", "{page}").replace("{{total}}", "{total}"),
    teamPrev: t("partner.team.previousPage"),
    teamTitle: t("partner.team.title"),
    withdrawAmount: t("partner.withdrawals.amount"),
    withdrawAmountPlaceholder: t("partner.withdrawals.amountPlaceholder"),
    withdrawAvailable: t("partner.withdrawals.available"),
    withdrawBelowMin: t("partner.withdrawals.belowMin"),
    withdrawEmpty: t("partner.withdrawals.empty"),
    withdrawExceeds: t("partner.withdrawals.exceedsBalance"),
    withdrawInvalid: t("partner.withdrawals.invalidAmount"),
    withdrawMin: t("partner.program.minWithdrawal"),
    withdrawNext: t("partner.withdrawals.nextPage"),
    withdrawPage: t("partner.withdrawals.page").replace("{{page}}", "{page}").replace("{{total}}", "{total}"),
    withdrawPending: t("partner.withdrawals.pending"),
    withdrawPrev: t("partner.withdrawals.previousPage"),
    withdrawRemark: t("partner.withdrawals.remark"),
    withdrawRemarkPlaceholder: t("partner.withdrawals.remarkPlaceholder"),
    withdrawSubmit: t("partner.withdrawals.submit"),
    withdrawSuccess: t("partner.withdrawals.success"),
    withdrawTitle: t("partner.withdrawals.title"),
    withdrawTotal: t("partner.withdrawals.totalEarned"),
    withdrawWithdrawn: t("partner.withdrawals.withdrawn"),
  };
}

Page({
  data: {
    applicantTypeOptions: [t("partner.apply.individual"), t("partner.apply.organization")],
    applications: [],
    cancellingId: "",
    center: null,
    centerNotice: "",
    commissionLoading: false,
    commissionPage: 1,
    commissionPageText: "",
    commissionTotal: 0,
    commissions: [],
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
    team: [],
    teamLoading: false,
    teamPage: 1,
    teamPageText: "",
    teamTotal: 0,
    validating: false,
    withdrawAmount: "",
    withdrawError: "",
    withdrawRemark: "",
    withdrawSuccess: false,
    withdrawing: false,
    withdrawalLoading: false,
    withdrawalPage: 1,
    withdrawalPageText: "",
    withdrawalTotal: 0,
    withdrawals: [],
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
      await this.loadCenter();
    } catch (cause) {
      this.setData({
        error: errorMessage(cause, t("partner.page.errorTitle")),
        loading: false,
      });
    }
  },

  async loadCenter() {
    try {
      const center = await retrievePartnerCenter();
      this.setData({ center, centerNotice: "" });
      await Promise.all([
        this.loadTeamPage(1),
        this.loadCommissionPage(1),
        this.loadWithdrawalPage(1),
      ]);
    } catch (cause) {
      if ((cause as { statusCode?: number }).statusCode === 404) {
        this.setData({ center: null, centerNotice: t("partner.center.notEnrolled") });
        return;
      }
      this.setData({ center: null, centerNotice: t("partner.center.notSupported") });
    }
  },

  async loadTeamPage(page: number) {
    if (this.data.teamLoading) {
      return;
    }
    this.setData({ teamLoading: true });
    try {
      const result = await listPartnerTeam(page);
      this.setData({
        team: result.items.map((member) => toTeamView(member, this.data.center?.currency ?? "CNY")),
        teamLoading: false,
        teamPage: result.page,
        teamPageText: `${result.page} / ${Math.max(1, Math.ceil(result.total / result.pageSize))}`,
        teamTotal: result.total,
      });
    } catch (cause) {
      this.setData({
        teamLoading: false,
        error: errorMessage(cause, t("partner.page.errorTitle")),
      });
    }
  },

  async loadCommissionPage(page: number) {
    if (this.data.commissionLoading) {
      return;
    }
    this.setData({ commissionLoading: true });
    try {
      const result = await listPartnerCommissions(page);
      this.setData({
        commissionLoading: false,
        commissionPage: result.page,
        commissionPageText: `${result.page} / ${Math.max(1, Math.ceil(result.total / result.pageSize))}`,
        commissionTotal: result.total,
        commissions: result.items.map(toCommissionView),
      });
    } catch (cause) {
      this.setData({
        commissionLoading: false,
        error: errorMessage(cause, t("partner.page.errorTitle")),
      });
    }
  },

  async loadWithdrawalPage(page: number) {
    if (this.data.withdrawalLoading) {
      return;
    }
    this.setData({ withdrawalLoading: true });
    try {
      const result = await listPartnerWithdrawals(page);
      this.setData({
        withdrawalLoading: false,
        withdrawalPage: result.page,
        withdrawalPageText: `${result.page} / ${Math.max(1, Math.ceil(result.total / result.pageSize))}`,
        withdrawalTotal: result.total,
        withdrawals: result.items.map(toWithdrawalView),
      });
    } catch (cause) {
      this.setData({
        withdrawalLoading: false,
        withdrawError: errorMessage(cause, t("partner.page.errorTitle")),
      });
    }
  },

  teamPage(event: MpTapEvent) {
    void this.loadTeamPage(Number(event.currentTarget.dataset.page));
  },

  commissionPageTap(event: MpTapEvent) {
    void this.loadCommissionPage(Number(event.currentTarget.dataset.page));
  },

  withdrawalPageTap(event: MpTapEvent) {
    void this.loadWithdrawalPage(Number(event.currentTarget.dataset.page));
  },

  onWithdrawAmountInput(event: MpInputEvent) {
    this.setData({ withdrawAmount: event.detail.value, withdrawSuccess: false });
  },

  onWithdrawRemarkInput(event: MpInputEvent) {
    this.setData({ withdrawRemark: event.detail.value });
  },

  async submitWithdrawal() {
    if (this.data.withdrawing) {
      return;
    }
    const center = this.data.center;
    const parsed = Number(this.data.withdrawAmount);
    if (!center || !this.data.withdrawAmount.trim() || !Number.isFinite(parsed) || parsed <= 0) {
      this.setData({ withdrawError: t("partner.withdrawals.invalidAmount") });
      return;
    }
    if (parsed > Number(center.availableBalance)) {
      this.setData({ withdrawError: t("partner.withdrawals.exceedsBalance") });
      return;
    }
    if (parsed < Number(center.minWithdrawalAmount)) {
      this.setData({ withdrawError: t("partner.withdrawals.belowMin") });
      return;
    }
    this.setData({ withdrawError: "", withdrawing: true, withdrawSuccess: false });
    try {
      await createPartnerWithdrawal(this.data.withdrawAmount.trim(), this.data.withdrawRemark.trim());
      this.setData({ withdrawAmount: "", withdrawRemark: "", withdrawSuccess: true });
      await this.loadWithdrawalPage(1);
      this.setData({ center: await retrievePartnerCenter() });
    } catch (cause) {
      this.setData({ withdrawError: errorMessage(cause, t("partner.page.errorTitle")) });
    } finally {
      this.setData({ withdrawing: false });
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

  noop() {
    // Stops taps inside the modal panel from bubbling to the backdrop.
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
