import type { MallMessageCategory } from "./messages-service";

export type SdkworkMallMessagesLocale = "en-US" | "zh-CN";

export interface SdkworkMallMessagesCopy {
  actions: {
    loadMore: string;
    loading: string;
    retry: string;
    viewOrders: string;
  };
  categories: Record<MallMessageCategory, string>;
  empty: {
    description: string;
    title: string;
  };
  error: {
    description: string;
    title: string;
  };
  intro: string;
  noBody: string;
  status: {
    unread: string;
  };
  tabs: {
    all: string;
  };
  title: string;
}

const EN_US: SdkworkMallMessagesCopy = {
  actions: {
    loadMore: "Load more",
    loading: "Loading...",
    retry: "Retry",
    viewOrders: "View order",
  },
  categories: {
    notice: "Reminder",
    other: "Notice",
    system: "System",
    trade: "Transaction",
  },
  empty: {
    description: "Order updates, after-sales progress and system reminders appear here.",
    title: "No messages yet",
  },
  error: {
    description: "Messages could not be loaded.",
    title: "Message centre unavailable",
  },
  intro: "System, transaction and reminder messages from the notification service.",
  noBody: "(no body)",
  status: {
    unread: "Unread",
  },
  tabs: {
    all: "All",
  },
  title: "Message centre",
};

const ZH_CN: SdkworkMallMessagesCopy = {
  actions: {
    loadMore: "加载更多",
    loading: "加载中...",
    retry: "重试",
    viewOrders: "查看订单",
  },
  categories: {
    notice: "提醒",
    other: "通知",
    system: "系统",
    trade: "交易",
  },
  empty: {
    description: "订单动态、售后进度与系统提醒将在此展示",
    title: "暂无消息",
  },
  error: {
    description: "消息加载失败",
    title: "消息加载失败",
  },
  intro: "来自通知服务的系统、交易与提醒消息，点击可展开详情。",
  noBody: "（无正文）",
  status: {
    unread: "未读",
  },
  tabs: {
    all: "全部",
  },
  title: "消息中心",
};

const MESSAGES_BY_LOCALE: Record<SdkworkMallMessagesLocale, SdkworkMallMessagesCopy> = {
  "en-US": EN_US,
  "zh-CN": ZH_CN,
};

export function normalizeSdkworkMallMessagesLocale(
  locale?: string | null,
): SdkworkMallMessagesLocale {
  return String(locale || "").trim().toLowerCase().startsWith("en") ? "en-US" : "zh-CN";
}

/** Resolves the typed message-centre copy for the active locale (zh-CN default). */
export function createSdkworkMallMessagesCopy(
  locale?: string | null,
): SdkworkMallMessagesCopy {
  return MESSAGES_BY_LOCALE[normalizeSdkworkMallMessagesLocale(locale)];
}
