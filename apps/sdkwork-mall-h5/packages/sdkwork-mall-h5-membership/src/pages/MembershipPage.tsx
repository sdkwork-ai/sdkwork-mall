import { MembershipSubscriptionPage } from "@sdkwork/membership-mobile-react-subscription";

/**
 * Membership centre. The screen (level hero, benefits, plans, payment method
 * picker, purchase feedback) is owned by the membership subscription brick; the
 * mall membership package only injects its service through
 * `src/membership-brick.ts`.
 */
export function SdkworkMallH5MembershipPage() {
  return <MembershipSubscriptionPage />;
}
