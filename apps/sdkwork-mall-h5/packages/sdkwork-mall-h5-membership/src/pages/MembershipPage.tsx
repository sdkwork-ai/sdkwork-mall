import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Crown, Headphones, Percent, ShieldCheck, Star } from "lucide-react";

import { formatMallH5Cny } from "@sdkwork/mall-h5-commons";
import { listMallH5PaymentMethods } from "@sdkwork/mall-h5-cart/cart-service";
import { SdkworkMallH5ErrorState } from "@sdkwork/mall-h5-commons/error-state";

import {
  loadMallH5Membership,
  purchaseMallH5Membership,
  type MallH5MembershipPackage,
  type MallH5MembershipStatus,
} from "../membership-service";

/** 会员权益展示位（静态权益目录；开通后的动态权益随服务端下发）。 */
const MEMBER_BENEFITS = [
  {
    icon: Percent,
    titleKey: "membership.benefits.price.title",
    descriptionKey: "membership.benefits.price.description",
  },
  {
    icon: Star,
    titleKey: "membership.benefits.points.title",
    descriptionKey: "membership.benefits.points.description",
  },
  {
    icon: Headphones,
    titleKey: "membership.benefits.support.title",
    descriptionKey: "membership.benefits.support.description",
  },
  {
    icon: ShieldCheck,
    titleKey: "membership.benefits.afterSales.title",
    descriptionKey: "membership.benefits.afterSales.description",
  },
] as const;

export function SdkworkMallH5MembershipPage() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<MallH5MembershipStatus | null>(null);
  const [packages, setPackages] = useState<MallH5MembershipPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyPackageId, setBusyPackageId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const data = await loadMallH5Membership();
    setStatus(data.status);
    setPackages(data.packages);
  }, []);

  useEffect(() => {
    let active = true;
    reload()
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : t("membership.loadFailed"));
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [reload, t]);

  async function handlePurchase(packageId: number) {
    setBusyPackageId(packageId);
    setMessage(null);
    setError(null);
    try {
      // The membership service charges the selected method server-side; the
      // client only names the channel it wants to pay with.
      const methods = await listMallH5PaymentMethods().catch(() => []);
      const paymentMethod = methods[0]?.code;
      if (!paymentMethod) {
        setMessage(t("membership.plans.payFailed"));
        return;
      }
      const result = await purchaseMallH5Membership({ packageId, paymentMethod });
      if (result.status === "completed") {
        setMessage(t("membership.plans.success"));
        await reload();
        return;
      }
      if (result.status === "pending") {
        setMessage(t("membership.plans.pending"));
        return;
      }
      setMessage(t("membership.plans.failed"));
    } catch (cause: unknown) {
      setMessage(cause instanceof Error ? cause.message : t("membership.plans.failed"));
    } finally {
      setBusyPackageId(null);
    }
  }

  if (loading) {
    return <div className="sdk-h5-page sdk-h5-loading">{t("membership.loading")}</div>;
  }

  return (
    <div className="sdk-h5-page">
      <h1 className="sdk-h5-visually-hidden">{t("membership.title")}</h1>

      {error ? <SdkworkMallH5ErrorState message={error} /> : null}
      {message ? <div className="sdk-h5-notice sdk-h5-notice-warning">{message}</div> : null}

      <section className="sdk-h5-banner">
        <Crown aria-hidden="true" size={22} />
        <h1>{status?.levelName || t("membership.defaultLevel")}</h1>
        <p>{t("membership.heroSubtitle")}</p>
        {status?.expireTime ? (
          <p>{t("membership.plans.expire", { date: status.expireTime })}</p>
        ) : null}
      </section>

      <section className="sdk-h5-section">
        <h2>{t("membership.benefits.title")}</h2>
        <div className="sdk-h5-benefit-grid">
          {MEMBER_BENEFITS.map((benefit) => {
            const Icon = benefit.icon;
            return (
              <div className="sdk-h5-benefit-item" key={benefit.titleKey}>
                <span className="sdk-h5-benefit-icon" aria-hidden="true">
                  <Icon size={18} />
                </span>
                <strong>{t(benefit.titleKey)}</strong>
                <span className="sdk-h5-muted">{t(benefit.descriptionKey)}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="sdk-h5-section">
        <h2>{t("membership.plans.title")}</h2>
        {packages.length === 0 ? (
          <div className="sdk-h5-empty">{t("membership.plans.empty")}</div>
        ) : (
          packages.map((plan) => (
            <div className="sdk-h5-coupon-row" key={plan.id}>
              <div>
                <strong>{plan.name}</strong>
                {plan.recommended ? (
                  <em className="sdk-h5-address-default">{t("membership.plans.recommended")}</em>
                ) : null}
                {plan.durationDays != null ? (
                  <div className="sdk-h5-muted">
                    {t("membership.plans.duration", { days: plan.durationDays })}
                  </div>
                ) : null}
                {plan.description ? <div className="sdk-h5-muted">{plan.description}</div> : null}
                <div className="sdk-h5-muted">{formatMallH5Cny(plan.priceCny)}</div>
              </div>
              <button
                className="sdk-h5-button sdk-h5-button-primary"
                disabled={busyPackageId !== null}
                onClick={() => void handlePurchase(plan.id)}
                type="button"
              >
                {busyPackageId === plan.id
                  ? t("membership.plans.opening")
                  : status?.isMember
                    ? t("membership.plans.renew")
                    : t("membership.plans.open")}
              </button>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
