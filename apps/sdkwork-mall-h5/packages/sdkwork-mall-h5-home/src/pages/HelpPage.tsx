import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { LifeBuoy } from "lucide-react";

interface HelpSection {
  itemKeys: readonly string[];
  titleKey: string;
}

const HELP_SECTIONS: readonly HelpSection[] = [
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

const QUICK_LINKS: ReadonlyArray<{ labelKey: string; path: string }> = [
  { labelKey: "help.quick.orders", path: "/buyer/orders" },
  { labelKey: "help.quick.afterSales", path: "/buyer/after-sales" },
  { labelKey: "help.quick.invoices", path: "/buyer/invoices" },
  { labelKey: "help.quick.messages", path: "/buyer/messages" },
  { labelKey: "help.quick.giftCards", path: "/buyer/gift-cards" },
  { labelKey: "help.quick.security", path: "/buyer/security" },
];

export function SdkworkMallH5HelpPage() {
  const { t } = useTranslation();

  return (
    <div className="sdk-h5-page">
      <h1 className="sdk-h5-visually-hidden">{t("help.title")}</h1>

      <section className="sdk-h5-section">
        <h2>
          <LifeBuoy aria-hidden="true" size={18} /> {t("help.title")}
        </h2>
        <p className="sdk-h5-muted">{t("help.subtitle")}</p>
      </section>

      <section className="sdk-h5-section">
        <h2>{t("help.quick.title")}</h2>
        <div className="sdk-h5-quick-grid">
          {QUICK_LINKS.map((link) => (
            <Link className="sdk-h5-quick-grid-item" key={link.path} to={link.path}>
              <span>{t(link.labelKey)}</span>
            </Link>
          ))}
        </div>
      </section>

      {HELP_SECTIONS.map((section) => (
        <section className="sdk-h5-section" key={section.titleKey}>
          <h2>{t(section.titleKey)}</h2>
          <ul className="sdk-h5-help-list">
            {section.itemKeys.map((itemKey) => (
              <li key={itemKey}>{t(itemKey)}</li>
            ))}
          </ul>
        </section>
      ))}

      <section className="sdk-h5-section">
        <h2>{t("help.contact.title")}</h2>
        <div className="sdk-h5-cell-group">
          <Link className="sdk-h5-cell" to="/buyer/chats">
            <span className="sdk-h5-cell-label">{t("help.contact.online")}</span>
            <span className="sdk-h5-cell-value sdk-h5-muted">{t("help.contact.hours")}</span>
          </Link>
          <div className="sdk-h5-cell">
            <span className="sdk-h5-cell-label">{t("help.contact.partner")}</span>
            <span className="sdk-h5-cell-value sdk-h5-muted">{t("help.contact.partnerHint")}</span>
          </div>
        </div>
      </section>
    </div>
  );
}
