export interface MpPartnerMessages {
  partner: {
    page: {
      eyebrow: string;
      title: string;
      subtitle: string;
      loading: string;
      errorTitle: string;
      retry: string;
    };
    actions: {
      apply: string;
      reapply: string;
      cancelApplication: string;
      validate: string;
      copy: string;
      copied: string;
      close: string;
      submitting: string;
    };
    status: Record<
      "none" | "pending" | "approved" | "rejected" | "cancelled",
      { title: string; description: string }
    >;
    statusLabel: Record<"SUBMITTED" | "APPROVED" | "REJECTED" | "CANCELLED", string>;
    program: Record<string, string>;
    center: Record<string, string>;
    invite: Record<string, string>;
    applications: Record<string, string>;
    apply: Record<string, string>;
    issues: Record<string, string>;
  };
}

declare const messages: MpPartnerMessages;
export = messages;
