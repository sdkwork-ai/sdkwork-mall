export type SdkworkPartnerLocale = "en-US" | "zh-CN";

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

export type SdkworkPartnerMessagesOverrides = DeepPartial<SdkworkPartnerMessages>;

export interface SdkworkPartnerMessages {
  actions: {
    apply: string;
    cancelApplication: string;
    close: string;
    copied: string;
    copy: string;
    reapply: string;
    refresh: string;
    submit: string;
    submitting: string;
    validate: string;
  };
  applications: {
    empty: string;
    inviteCode: string;
    reviewComment: string;
    submittedAt: string;
    targetLevel: string;
    title: string;
  };
  apply: {
    applicantType: string;
    businessIntro: string;
    contactEmail: string;
    contactName: string;
    contactPhone: string;
    description: string;
    individual: string;
    inviteCode: string;
    organization: string;
    subjectName: string;
    submit: string;
    targetLevel: string;
    title: string;
  };
  center: {
    available: string;
    customers: string;
    description: string;
    directTeam: string;
    inviteCode: string;
    notConfigured: string;
    notEnrolled: string;
    notSupported: string;
    pending: string;
    settled: string;
    team: string;
    title: string;
    withdrawable: string;
  };
  invite: {
    description: string;
    invalid: string;
    inviter: string;
    level: string;
    placeholder: string;
    title: string;
    valid: string;
  };
  issues: {
    contactEmailInvalid: string;
    contactNameRequired: string;
    contactPhoneInvalid: string;
    inviteCodeTooLong: string;
    subjectNameRequired: string;
    targetLevelInvalid: string;
  };
  page: {
    errorTitle: string;
    eyebrow: string;
    loading: string;
    retry: string;
    subtitle: string;
    title: string;
  };
  program: {
    benefits: string;
    currency: string;
    customerRevenue: string;
    description: string;
    empty: string;
    joinFee: string;
    joinFeeCommission: string;
    joinFeePolicy: string;
    level: string;
    minWithdrawal: string;
    profitMargin: string;
    rules: string;
    title: string;
  };
  status: {
    approved: { description: string; title: string };
    cancelled: { description: string; title: string };
    none: { description: string; title: string };
    pending: { description: string; title: string };
    rejected: { description: string; title: string };
  };
  statusLabel: {
    APPROVED: string;
    CANCELLED: string;
    REJECTED: string;
    SUBMITTED: string;
  };
  team: {
    availableBalance: string;
    customerCount: string;
    depth: string;
    description: string;
    directTeam: string;
    empty: string;
    joinedAt: string;
    level: string;
    member: string;
    nextPage: string;
    page: string;
    previousPage: string;
    title: string;
    totalCommission: string;
  };
  commissions: {
    amount: string;
    baseAmount: string;
    computedAt: string;
    description: string;
    empty: string;
    levelOffset: string;
    nextPage: string;
    page: string;
    previousPage: string;
    ratio: string;
    source: string;
    status: string;
    title: string;
  };
  withdrawals: {
    amount: string;
    amountPlaceholder: string;
    available: string;
    belowMin: string;
    description: string;
    empty: string;
    exceedsBalance: string;
    invalidAmount: string;
    minWithdrawal: string;
    nextPage: string;
    page: string;
    paidAt: string;
    pending: string;
    previousPage: string;
    remark: string;
    remarkPlaceholder: string;
    requestedAt: string;
    reviewRemark: string;
    submit: string;
    submitting: string;
    success: string;
    title: string;
    totalEarned: string;
    withdrawn: string;
  };
  withdrawalStatusLabel: {
    APPROVED: string;
    PAID: string;
    PENDING: string;
    REJECTED: string;
  };
  summary: {
    levelCount: string;
    maxCustomerRevenue: string;
    minJoinFee: string;
  };
}

const ZH_CN: SdkworkPartnerMessages = {
  actions: {
    apply: "申请成为分销商",
    cancelApplication: "撤回申请",
    close: "关闭",
    copied: "已复制",
    copy: "复制链接",
    reapply: "重新申请",
    refresh: "刷新",
    submit: "提交申请",
    submitting: "提交中…",
    validate: "校验邀请码",
  },
  applications: {
    empty: "还没有提交过加盟申请。",
    inviteCode: "邀请码",
    reviewComment: "审核意见",
    submittedAt: "提交时间",
    targetLevel: "意向等级",
    title: "我的加盟申请",
  },
  apply: {
    applicantType: "申请主体",
    businessIntro: "业务介绍（选填）",
    contactEmail: "联系邮箱",
    contactName: "联系人",
    contactPhone: "联系电话",
    description: "填写联系人与意向等级，平台审核通过后开通分销权益。",
    individual: "个人",
    inviteCode: "邀请码（选填）",
    organization: "企业 / 机构",
    subjectName: "主体名称",
    submit: "提交申请",
    targetLevel: "意向等级",
    title: "加盟申请",
  },
  center: {
    available: "可用余额",
    customers: "客户数",
    description: "团队规模、客户数与佣金余额。",
    directTeam: "直属团队",
    inviteCode: "我的邀请码",
    notConfigured:
      "团队、佣金与提现需要合作伙伴自助端读模型接入后展示；当前已开放加盟申请与邀请码校验。",
    notEnrolled: "成为分销伙伴后，这里会展示你的团队、收益记录与提现能力。",
    notSupported: "当前部署尚未提供团队与佣金接口。",
    pending: "待结算",
    settled: "累计结算",
    team: "团队人数",
    title: "团队与收益",
    withdrawable: "可提现",
  },
  invite: {
    description: "输入上级伙伴的邀请码，确认邀请关系后再提交申请。",
    invalid: "邀请码无效",
    inviter: "邀请人",
    level: "邀请人等级",
    placeholder: "输入邀请码",
    title: "邀请码校验",
    valid: "邀请码有效",
  },
  issues: {
    contactEmailInvalid: "请输入有效的邮箱地址。",
    contactNameRequired: "请填写联系人。",
    contactPhoneInvalid: "请输入有效的联系电话。",
    inviteCodeTooLong: "邀请码不能超过 64 个字符。",
    subjectNameRequired: "企业 / 机构申请需要填写主体名称。",
    targetLevelInvalid: "请选择意向等级。",
  },
  page: {
    errorTitle: "分销中心加载失败",
    eyebrow: "合作伙伴计划",
    loading: "正在加载分销中心…",
    retry: "重试",
    subtitle: "邀请好友、管理团队、查看佣金与提现进度。",
    title: "分销中心",
  },
  program: {
    benefits: "等级权益",
    currency: "结算币种",
    customerRevenue: "客户收益提成",
    description: "等级越高，客户收益提成池与加盟费提成池越高。",
    empty: "暂未发布可用的分销等级。",
    joinFee: "加盟费",
    joinFeeCommission: "加盟费提成",
    joinFeePolicy: "加盟费说明",
    level: "等级",
    minWithdrawal: "最低提现",
    profitMargin: "利润返佣基数",
    rules: "结算规则",
    title: "分销等级与权益",
  },
  status: {
    approved: {
      description: "你的分销权益已开通，可分享邀请码发展团队并获取佣金。",
      title: "已成为分销伙伴",
    },
    cancelled: {
      description: "你可以随时重新提交加盟申请。",
      title: "申请已撤回",
    },
    none: {
      description: "提交加盟申请，审核通过后即可获得专属邀请码与佣金权益。",
      title: "还未加入分销计划",
    },
    pending: {
      description: "平台正在审核你的加盟申请，审核通过后将自动开通分销权益。",
      title: "申请审核中",
    },
    rejected: {
      description: "你可以查看审核意见后重新提交申请。",
      title: "申请未通过",
    },
  },
  statusLabel: {
    APPROVED: "已通过",
    CANCELLED: "已撤回",
    REJECTED: "未通过",
    SUBMITTED: "审核中",
  },
  team: {
    availableBalance: "可提现",
    customerCount: "客户数",
    depth: "层级",
    description: "团队成员的等级、客户与各自的收益。",
    directTeam: "直属",
    empty: "团队还没有成员，分享邀请码开始招募。",
    joinedAt: "加入时间",
    level: "等级",
    member: "成员",
    nextPage: "下一页",
    page: "第 {page} / {total} 页",
    previousPage: "上一页",
    title: "我的团队",
    totalCommission: "累计收益",
  },
  commissions: {
    amount: "佣金",
    baseAmount: "计佣基数",
    computedAt: "结算时间",
    description: "每一笔分销收益的来源、比例与金额。",
    empty: "还没有收益记录。",
    levelOffset: "层级",
    nextPage: "下一页",
    page: "第 {page} / {total} 页",
    previousPage: "上一页",
    ratio: "比例",
    source: "来源",
    status: "状态",
    title: "收益记录",
  },
  withdrawals: {
    amount: "提现金额",
    amountPlaceholder: "输入提现金额",
    available: "可提现余额",
    belowMin: "提现金额低于最低提现额度。",
    description: "提交提现申请后由平台审核并打款。",
    empty: "还没有提现记录。",
    exceedsBalance: "提现金额超过可提现余额。",
    invalidAmount: "请输入有效的提现金额。",
    minWithdrawal: "最低提现 {value}",
    nextPage: "下一页",
    page: "第 {page} / {total} 页",
    paidAt: "打款时间",
    pending: "冻结中",
    previousPage: "上一页",
    remark: "备注（选填）",
    remarkPlaceholder: "收款账户或说明",
    requestedAt: "申请时间",
    reviewRemark: "审核意见",
    submit: "申请提现",
    submitting: "提交中…",
    success: "提现申请已提交，等待平台审核。",
    title: "提现",
    totalEarned: "累计收益",
    withdrawn: "已提现",
  },
  withdrawalStatusLabel: {
    APPROVED: "已审核",
    PAID: "已打款",
    PENDING: "审核中",
    REJECTED: "已驳回",
  },
  summary: {
    levelCount: "{count} 个等级",
    maxCustomerRevenue: "最高客户提成 {value}",
    minJoinFee: "加盟费 {value} 起",
  },
};

const EN_US: SdkworkPartnerMessages = {
  actions: {
    apply: "Become a partner",
    cancelApplication: "Withdraw application",
    close: "Close",
    copied: "Copied",
    copy: "Copy link",
    reapply: "Apply again",
    refresh: "Refresh",
    submit: "Submit application",
    submitting: "Submitting…",
    validate: "Validate code",
  },
  applications: {
    empty: "No join application has been submitted yet.",
    inviteCode: "Invite code",
    reviewComment: "Review note",
    submittedAt: "Submitted",
    targetLevel: "Target level",
    title: "My join applications",
  },
  apply: {
    applicantType: "Applicant type",
    businessIntro: "Business introduction (optional)",
    contactEmail: "Contact email",
    contactName: "Contact name",
    contactPhone: "Contact phone",
    description:
      "Provide a contact and target level. The distribution rights activate after review.",
    individual: "Individual",
    inviteCode: "Invite code (optional)",
    organization: "Organization",
    subjectName: "Subject name",
    submit: "Submit application",
    targetLevel: "Target level",
    title: "Join application",
  },
  center: {
    available: "Available",
    customers: "Customers",
    description: "Team size, customer count and commission balance.",
    directTeam: "Direct team",
    inviteCode: "My invite code",
    notConfigured:
      "Team, commission and withdrawal projections appear once the partner self-service read model lands; join applications and invite-code validation are live now.",
    notEnrolled: "Once you become a partner, your team, earnings records and withdrawals appear here.",
    notSupported: "This deployment does not expose the team and commission API yet.",
    pending: "Pending",
    settled: "Settled total",
    team: "Team size",
    title: "Team and earnings",
    withdrawable: "Withdrawable",
  },
  invite: {
    description: "Validate the inviter's code before you submit an application.",
    invalid: "Invite code is invalid",
    inviter: "Inviter",
    level: "Inviter level",
    placeholder: "Enter an invite code",
    title: "Invite-code validation",
    valid: "Invite code is valid",
  },
  issues: {
    contactEmailInvalid: "Enter a valid email address.",
    contactNameRequired: "Enter a contact name.",
    contactPhoneInvalid: "Enter a valid contact phone.",
    inviteCodeTooLong: "The invite code must be at most 64 characters.",
    subjectNameRequired: "An organization application needs a subject name.",
    targetLevelInvalid: "Select a target level.",
  },
  page: {
    errorTitle: "Could not load the distribution centre",
    eyebrow: "Partner program",
    loading: "Loading the distribution centre…",
    retry: "Retry",
    subtitle: "Invite partners, manage your team, and track commissions and withdrawals.",
    title: "Distribution centre",
  },
  program: {
    benefits: "Level benefits",
    currency: "Currency",
    customerRevenue: "Customer revenue share",
    description:
      "Higher levels carry a larger customer-revenue and join-fee commission pool.",
    empty: "No distribution levels are published yet.",
    joinFee: "Join fee",
    joinFeeCommission: "Join-fee share",
    joinFeePolicy: "Join-fee policy",
    level: "Level",
    minWithdrawal: "Minimum withdrawal",
    profitMargin: "Profit rebate base",
    rules: "Settlement rules",
    title: "Levels and benefits",
  },
  status: {
    approved: {
      description:
        "Your distribution rights are active. Share your invite code to grow a team and earn commission.",
      title: "You are a partner",
    },
    cancelled: {
      description: "You can submit a new join application at any time.",
      title: "Application withdrawn",
    },
    none: {
      description:
        "Submit a join application to receive your invite code and commission rights after review.",
      title: "Not enrolled yet",
    },
    pending: {
      description:
        "The platform is reviewing your application. Distribution rights activate on approval.",
      title: "Application under review",
    },
    rejected: {
      description: "Read the review note and submit a new application.",
      title: "Application not approved",
    },
  },
  statusLabel: {
    APPROVED: "Approved",
    CANCELLED: "Withdrawn",
    REJECTED: "Rejected",
    SUBMITTED: "Under review",
  },
  team: {
    availableBalance: "Withdrawable",
    customerCount: "Customers",
    depth: "Depth",
    description: "Team members with their level, customers and own earnings.",
    directTeam: "Direct",
    empty: "No team members yet. Share your invite code to start recruiting.",
    joinedAt: "Joined",
    level: "Level",
    member: "Member",
    nextPage: "Next",
    page: "Page {page} / {total}",
    previousPage: "Previous",
    title: "My team",
    totalCommission: "Lifetime earnings",
  },
  commissions: {
    amount: "Commission",
    baseAmount: "Base",
    computedAt: "Settled",
    description: "Every distribution credit with its source, ratio and amount.",
    empty: "No commission records yet.",
    levelOffset: "Depth",
    nextPage: "Next",
    page: "Page {page} / {total}",
    previousPage: "Previous",
    ratio: "Ratio",
    source: "Source",
    status: "Status",
    title: "Earnings records",
  },
  withdrawals: {
    amount: "Amount",
    amountPlaceholder: "Enter an amount",
    available: "Withdrawable balance",
    belowMin: "The amount is below the minimum withdrawal.",
    description: "Applications are reviewed and paid out by the platform.",
    empty: "No withdrawal applications yet.",
    exceedsBalance: "The amount exceeds your withdrawable balance.",
    invalidAmount: "Enter a valid withdrawal amount.",
    minWithdrawal: "Minimum {value}",
    nextPage: "Next",
    page: "Page {page} / {total}",
    paidAt: "Paid at",
    pending: "Frozen",
    previousPage: "Previous",
    remark: "Note (optional)",
    remarkPlaceholder: "Payout account or note",
    requestedAt: "Requested",
    reviewRemark: "Review note",
    submit: "Request withdrawal",
    submitting: "Submitting…",
    success: "Withdrawal requested. The platform will review it.",
    title: "Withdrawals",
    totalEarned: "Lifetime earnings",
    withdrawn: "Withdrawn",
  },
  withdrawalStatusLabel: {
    APPROVED: "Approved",
    PAID: "Paid",
    PENDING: "Under review",
    REJECTED: "Rejected",
  },
  summary: {
    levelCount: "{count} levels",
    maxCustomerRevenue: "Up to {value} customer share",
    minJoinFee: "From {value} join fee",
  },
};

export function normalizeSdkworkPartnerLocale(locale: string | null | undefined): SdkworkPartnerLocale {
  return String(locale ?? "").toLowerCase().startsWith("en") ? "en-US" : "zh-CN";
}

export function createSdkworkPartnerMessages(
  locale: string | null | undefined,
): SdkworkPartnerMessages {
  return normalizeSdkworkPartnerLocale(locale) === "en-US" ? EN_US : ZH_CN;
}

export function mergeSdkworkPartnerMessages(
  base: SdkworkPartnerMessages,
  overrides: SdkworkPartnerMessagesOverrides | undefined,
): SdkworkPartnerMessages {
  if (!overrides) {
    return base;
  }
  return mergeDeep(base, overrides) as SdkworkPartnerMessages;
}

function mergeDeep<T extends object>(base: T, overrides: DeepPartial<T>): T {
  const result: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(overrides as Record<string, unknown>)) {
    if (value === undefined) {
      continue;
    }
    const current = result[key];
    if (value && typeof value === "object" && current && typeof current === "object") {
      result[key] = mergeDeep(current as object, value as object);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}
