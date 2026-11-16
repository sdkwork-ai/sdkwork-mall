import { Gift, Ticket } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

/**
 * Gift cards / red packets entry.
 *
 * The commerce gift-card purchase and red-packet APIs are not published yet, so
 * this surface explains the status and exposes the capability that *is* live:
 * voucher (coupon code) redemption through the order brick.
 */
export function SdkworkMallH5GiftCardsPage() {
  const { t } = useTranslation();
  return (
    <div className="sdk-h5-page">
      <h1 className="sdk-h5-visually-hidden">{t("giftCards.title")}</h1>

      <section className="sdk-h5-section">
        <h2>
          <Gift aria-hidden="true" size={18} /> {t("giftCards.section")}
        </h2>
        <div className="sdk-h5-empty">{t("giftCards.empty")}</div>
        <p className="sdk-h5-muted">{t("giftCards.hint")}</p>
      </section>

      <div className="sdk-h5-action-row sdk-h5-action-row-full">
        <Link className="sdk-h5-button sdk-h5-button-primary" to="/buyer/vouchers">
          <Ticket aria-hidden="true" size={16} /> {t("giftCards.redeem")}
        </Link>
        <Link className="sdk-h5-button sdk-h5-button-secondary" to="/buyer/wallet">
          {t("giftCards.wallet")}
        </Link>
      </div>
    </div>
  );
}
