import { t } from "../../i18n";
import { type MpTapEvent } from "../../types/common";
import { mpCapabilityUrl } from "../../routes/capabilities";

interface HelpSection {
  titleKey: string;
  itemKeys: string[];
}

interface HelpQuickLink {
  capability: string;
  labelKey: string;
}

const QUICK_LINKS: HelpQuickLink[] = [
  { labelKey: "help.quick.orders", capability: "buyer.mall.orders" },
  { labelKey: "help.quick.afterSales", capability: "buyer.mall.after-sales" },
  { labelKey: "help.quick.invoices", capability: "buyer.mall.invoices" },
  { labelKey: "help.quick.messages", capability: "buyer.mall.messages" },
  { labelKey: "help.quick.giftCards", capability: "buyer.mall.gift-cards" },
  { labelKey: "help.quick.security", capability: "buyer.mall.security" },
];

const HELP_SECTIONS: HelpSection[] = [
  {
    titleKey: "help.sections.orders.title",
    itemKeys: [
      "help.sections.orders.item0",
      "help.sections.orders.item1",
      "help.sections.orders.item2",
    ],
  },
  {
    titleKey: "help.sections.afterSales.title",
    itemKeys: [
      "help.sections.afterSales.item0",
      "help.sections.afterSales.item1",
      "help.sections.afterSales.item2",
    ],
  },
  {
    titleKey: "help.sections.assets.title",
    itemKeys: [
      "help.sections.assets.item0",
      "help.sections.assets.item1",
      "help.sections.assets.item2",
      "help.sections.assets.item3",
    ],
  },
  {
    titleKey: "help.sections.security.title",
    itemKeys: [
      "help.sections.security.item0",
      "help.sections.security.item1",
      "help.sections.security.item2",
    ],
  },
];

Page({
  data: {
    title: t("help.title"),
    subtitle: t("help.subtitle"),
    quickTitle: t("help.quick.title"),
    sections: HELP_SECTIONS.map((section) => ({
      title: t(section.titleKey),
      items: section.itemKeys.map((itemKey) => t(itemKey)),
    })),
    quickLinks: QUICK_LINKS.map((link) => ({
      label: t(link.labelKey),
      capability: link.capability,
    })),
    contactTitle: t("help.contact.title"),
    contactOnline: t("help.contact.online"),
    contactHours: t("help.contact.hours"),
  },

  goQuickLink(event: MpTapEvent) {
    const capability = String(event.currentTarget.dataset.capability ?? "");
    if (capability) {
      wx.navigateTo({ url: mpCapabilityUrl(capability) });
    }
  },

  goChats() {
    wx.navigateTo({ url: mpCapabilityUrl("buyer.mall.im.chats") });
  },
});
