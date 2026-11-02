import type {
  SdkworkPartnerApplication,
  SdkworkPartnerApplicationDraft,
  SdkworkPartnerApplicationStatus,
  SdkworkPartnerDraftIssue,
  SdkworkPartnerLevel,
  SdkworkPartnerMembership,
  SdkworkPartnerProgram,
} from "./partner-types";

const PARTNER_APPLICATION_ACTIVE: readonly SdkworkPartnerApplicationStatus[] = [
  "SUBMITTED",
  "APPROVED",
];

const PARTNER_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const PARTNER_PHONE_PATTERN = /^[+\d][\d\s()-]{4,24}$/u;
const PARTNER_INVITE_CODE_MAX_LENGTH = 64;

export function isSdkworkPartnerApplicationActive(
  status: SdkworkPartnerApplicationStatus,
): boolean {
  return PARTNER_APPLICATION_ACTIVE.includes(status);
}

export function canCancelSdkworkPartnerApplication(
  application: Pick<SdkworkPartnerApplication, "status">,
): boolean {
  return application.status === "SUBMITTED";
}

/**
 * Resolves the buyer's current membership from their application history.
 *
 * Priority is approved > submitted > most recent closed application, because a
 * partner who was approved after an earlier rejection is still a partner. The
 * history order is the server order (newest first).
 */
export function resolveSdkworkPartnerMembership(
  applications: readonly SdkworkPartnerApplication[],
): SdkworkPartnerMembership {
  const approved = applications.find((application) => application.status === "APPROVED");
  if (approved) {
    return { application: approved, state: "approved" };
  }
  const submitted = applications.find((application) => application.status === "SUBMITTED");
  if (submitted) {
    return { application: submitted, state: "pending" };
  }
  const latest = applications[0] ?? null;
  if (!latest) {
    return { application: null, state: "none" };
  }
  if (latest.status === "REJECTED") {
    return { application: latest, state: "rejected" };
  }
  if (latest.status === "CANCELLED") {
    return { application: latest, state: "cancelled" };
  }
  return { application: latest, state: "none" };
}

/** Orders levels for display: ACTIVE first, then ascending level number. */
export function orderSdkworkPartnerLevels(
  levels: readonly SdkworkPartnerLevel[],
): readonly SdkworkPartnerLevel[] {
  return [...levels].sort((left, right) => {
    if (left.status !== right.status) {
      return left.status === "ACTIVE" ? -1 : 1;
    }
    return left.levelNo - right.levelNo;
  });
}

export interface SdkworkPartnerProgramSummary {
  readonly levelCount: number;
  readonly minJoinFee: string | null;
  readonly maxCustomerRevenueRatio: string | null;
  readonly topLevelNo: number | null;
}

/** Summary used by the hero card so every client shows the same headline. */
export function summarizeSdkworkPartnerProgram(
  program: SdkworkPartnerProgram,
): SdkworkPartnerProgramSummary {
  const activeLevels = program.levels.filter((level) => level.status === "ACTIVE");
  if (activeLevels.length === 0) {
    return {
      levelCount: 0,
      maxCustomerRevenueRatio: null,
      minJoinFee: null,
      topLevelNo: null,
    };
  }
  let minJoinFee: number | null = null;
  let maxRatio: number | null = null;
  let topLevelNo: number | null = null;
  for (const level of activeLevels) {
    const fee = parseSdkworkPartnerRatio(level.joinFee);
    if (fee !== null && (minJoinFee === null || fee < minJoinFee)) {
      minJoinFee = fee;
    }
    const ratio = parseSdkworkPartnerRatio(level.customerRevenueRatio);
    if (ratio !== null && (maxRatio === null || ratio > maxRatio)) {
      maxRatio = ratio;
    }
    if (topLevelNo === null || level.levelNo > topLevelNo) {
      topLevelNo = level.levelNo;
    }
  }
  return {
    levelCount: activeLevels.length,
    maxCustomerRevenueRatio: maxRatio === null ? null : String(maxRatio),
    minJoinFee: minJoinFee === null ? null : String(minJoinFee),
    topLevelNo,
  };
}

/** Parses a decimal wire amount ("20.00") without coercing ids or currency. */
export function parseSdkworkPartnerRatio(value: string | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const normalized = String(value).trim();
  if (normalized === "") {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Builds a shareable invite link from a deployment origin.
 *
 * The partner app API owns invite-code validation; the mall only composes the
 * link, so no attribution decision is made on the client.
 */
export function buildSdkworkPartnerInviteLink(
  origin: string,
  inviteCode: string,
): string {
  const normalizedOrigin = origin.trim().replace(/\/+$/u, "");
  const normalizedCode = inviteCode.trim();
  if (!normalizedOrigin || !normalizedCode) {
    return "";
  }
  const separator = normalizedOrigin.includes("?") ? "&" : "?";
  return `${normalizedOrigin}${separator}invite=${encodeURIComponent(normalizedCode)}`;
}

/** Validates the apply form. Returns stable issue codes, never localized copy. */
export function validateSdkworkPartnerApplicationDraft(
  draft: SdkworkPartnerApplicationDraft,
): readonly SdkworkPartnerDraftIssue[] {
  const issues: SdkworkPartnerDraftIssue[] = [];
  if (draft.applicantType === "ORGANIZATION" && draft.subjectName.trim() === "") {
    issues.push({ code: "subjectNameRequired", field: "subjectName" });
  }
  if (draft.contactName.trim() === "") {
    issues.push({ code: "contactNameRequired", field: "contactName" });
  }
  if (!PARTNER_PHONE_PATTERN.test(draft.contactPhone.trim())) {
    issues.push({ code: "contactPhoneInvalid", field: "contactPhone" });
  }
  if (!PARTNER_EMAIL_PATTERN.test(draft.contactEmail.trim())) {
    issues.push({ code: "contactEmailInvalid", field: "contactEmail" });
  }
  if (!Number.isInteger(draft.targetLevelNo) || draft.targetLevelNo < 1) {
    issues.push({ code: "targetLevelInvalid", field: "targetLevelNo" });
  }
  if (draft.inviteCode.trim().length > PARTNER_INVITE_CODE_MAX_LENGTH) {
    issues.push({ code: "inviteCodeTooLong", field: "inviteCode" });
  }
  return issues;
}

/** Locale-aware percent formatting with a raw-value fallback. */
export function formatSdkworkPartnerPercent(
  value: string | number | null | undefined,
  locale: string,
): string {
  const parsed = typeof value === "number" ? value : parseSdkworkPartnerRatio(value);
  if (parsed === null) {
    return "—";
  }
  try {
    return new Intl.NumberFormat(locale, {
      maximumFractionDigits: 2,
      style: "percent",
    }).format(parsed / 100);
  } catch {
    return `${parsed}%`;
  }
}

/** Locale-aware currency formatting with a raw-value fallback. */
export function formatSdkworkPartnerMoney(
  amount: string | number | null | undefined,
  currency: string,
  locale: string,
): string {
  const parsed = typeof amount === "number" ? amount : parseSdkworkPartnerRatio(amount);
  const normalizedCurrency = currency.trim().toUpperCase() || "CNY";
  if (parsed === null) {
    return "—";
  }
  try {
    return new Intl.NumberFormat(locale, {
      currency: normalizedCurrency,
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
      style: "currency",
    }).format(parsed);
  } catch {
    return `${normalizedCurrency} ${parsed}`;
  }
}

/** Locale-aware date/time formatting with a raw-value fallback. */
export function formatSdkworkPartnerDateTime(
  value: string | null | undefined,
  locale: string,
): string {
  const raw = value?.trim();
  if (!raw) {
    return "—";
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(parsed);
  } catch {
    return raw;
  }
}
