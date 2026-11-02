import {
  createContext,
  useContext,
  useMemo,
  type PropsWithChildren,
} from "react";

import {
  formatSdkworkPartnerDateTime,
  formatSdkworkPartnerMoney,
  formatSdkworkPartnerPercent,
} from "@sdkwork/mall-partner-service";
import type {
  SdkworkPartnerApplicationStatus,
  SdkworkPartnerDraftIssueCode,
} from "@sdkwork/mall-partner-service";

import {
  createSdkworkPartnerMessages,
  mergeSdkworkPartnerMessages,
  normalizeSdkworkPartnerLocale,
  type SdkworkPartnerMessages,
  type SdkworkPartnerMessagesOverrides,
} from "./partner-copy.ts";

export interface SdkworkPartnerIntlValue {
  readonly copy: SdkworkPartnerMessages;
  readonly formatDate: (value: string | null | undefined) => string;
  readonly formatMoney: (amount: string | null | undefined, currency: string) => string;
  readonly formatPercent: (value: string | null | undefined) => string;
  readonly formatStatus: (status: SdkworkPartnerApplicationStatus) => string;
  readonly formatWithdrawalStatus: (status: string) => string;
  readonly formatPage: (template: string, page: number, total: number) => string;
  readonly issueText: (code: SdkworkPartnerDraftIssueCode) => string;
  readonly locale: string;
}

export interface SdkworkPartnerIntlProviderProps extends PropsWithChildren {
  readonly locale?: string | null;
  readonly messages?: SdkworkPartnerMessagesOverrides;
}

const SdkworkPartnerIntlContext = createContext<SdkworkPartnerIntlValue | null>(null);

export function SdkworkPartnerIntlProvider({
  children,
  locale,
  messages,
}: SdkworkPartnerIntlProviderProps) {
  const value = useMemo<SdkworkPartnerIntlValue>(() => {
    const normalizedLocale = normalizeSdkworkPartnerLocale(locale);
    const copy = mergeSdkworkPartnerMessages(
      createSdkworkPartnerMessages(normalizedLocale),
      messages,
    );
    return {
      copy,
      formatDate: (value) => formatSdkworkPartnerDateTime(value, normalizedLocale),
      formatMoney: (amount, currency) =>
        formatSdkworkPartnerMoney(amount, currency, normalizedLocale),
      formatPercent: (value) => formatSdkworkPartnerPercent(value, normalizedLocale),
      formatStatus: (status) => copy.statusLabel[status],
      formatWithdrawalStatus: (status) => {
        const key = String(status || "").toUpperCase();
        return (
          copy.withdrawalStatusLabel[
            key as keyof SdkworkPartnerMessages["withdrawalStatusLabel"]
          ] ?? key
        );
      },
      formatPage: (template, page, total) =>
        template.replace("{page}", String(page)).replace("{total}", String(total)),
      issueText: (code) => copy.issues[code],
      locale: normalizedLocale,
    };
  }, [locale, messages]);

  return (
    <SdkworkPartnerIntlContext.Provider value={value}>
      {children}
    </SdkworkPartnerIntlContext.Provider>
  );
}

export function useSdkworkPartnerIntl(): SdkworkPartnerIntlValue {
  const value = useContext(SdkworkPartnerIntlContext);
  if (!value) {
    throw new Error("SdkworkPartnerIntlProvider is missing.");
  }
  return value;
}
