import { configureMembershipSubscriptionRuntime } from "@sdkwork/membership-mobile-react-subscription";
import { listMallH5PaymentMethods } from "@sdkwork/mall-h5-cart/cart-service";

import {
  loadMallH5Membership,
  purchaseMallH5Membership,
  type MallH5MembershipPackage,
  type MallH5MembershipStatus,
} from "./membership-service";

interface MembershipCentre {
  packages: MallH5MembershipPackage[];
  status: MallH5MembershipStatus | null;
}

let centre: Promise<MembershipCentre> | null = null;

function loadCentre(): Promise<MembershipCentre> {
  centre ??= loadMallH5Membership();
  return centre;
}

/**
 * Binds the mall membership service to the membership subscription brick.
 *
 * The brick owns the membership screen (level hero, benefits, plans, payment
 * method picker, purchase feedback); the mall only projects its membership
 * service and the cart payment-method catalogue.
 */
export function configureSdkworkMallH5MembershipBrick(): void {
  configureMembershipSubscriptionRuntime({
    async loadPaymentMethods() {
      const methods = await listMallH5PaymentMethods().catch(() => []);
      return methods.map((method) => ({ code: method.code, label: method.label }));
    },
    async loadPlans() {
      const { packages } = await loadCentre();
      return packages.map((plan) => ({
        ...(plan.description ? { description: plan.description } : {}),
        durationDays: plan.durationDays,
        id: plan.id,
        name: plan.name,
        priceCny: plan.priceCny,
        recommended: plan.recommended,
      }));
    },
    async loadStatus() {
      const { status } = await loadCentre();
      return status
        ? {
            ...(status.expireTime ? { expireAt: status.expireTime } : {}),
            isMember: status.isMember,
            levelName: status.levelName,
          }
        : null;
    },
    async purchase(input) {
      const result = await purchaseMallH5Membership({
        packageId: input.planId,
        paymentMethod: input.paymentMethod,
      });
      centre = null;
      return { status: result.status };
    },
  });
}
