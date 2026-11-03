import type { MallDefaultDataCheck, MallDefaultDataVerification } from "./verify";

/** Buyer, merchant and platform journeys the initialized data must unlock. */
export type MallDefaultDataJourneyId =
  | "storefront.home"
  | "storefront.categories"
  | "storefront.search"
  | "storefront.cart"
  | "storefront.checkout"
  | "storefront.activity"
  | "buyer.membership"
  | "buyer.coupons"
  | "buyer.orders"
  | "buyer.after-sales"
  | "admin.products"
  | "admin.shops"
  | "admin.marketing";

export interface MallDefaultDataJourney {
  readonly id: MallDefaultDataJourneyId;
  /** Verification checks whose data this journey renders. */
  readonly requires: readonly string[];
  /** Mounted mall PC route that opens the journey. */
  readonly href: string;
  /**
   * Transactional journeys start empty by design: their rows are produced by a
   * real purchase, so initialization must not fabricate them.
   */
  readonly transactional?: boolean;
}

/**
 * The end-to-end walkthrough, in the order an operator should review it.
 *
 * Every entry points at a mounted route and names the verification checks that
 * supply its data, so "can I show the whole app?" becomes a computed answer
 * instead of a manual checklist.
 */
export const MALL_DEFAULT_DATA_JOURNEYS: readonly MallDefaultDataJourney[] = [
  {
    id: "storefront.home",
    requires: ["catalog.coverage", "cms.storefront"],
    href: "/",
  },
  {
    id: "storefront.categories",
    requires: ["catalog.coverage", "catalog.categories"],
    href: "/categories",
  },
  {
    id: "storefront.search",
    requires: ["catalog.coverage", "catalog.products"],
    href: "/search",
  },
  {
    id: "storefront.cart",
    requires: ["catalog.skus"],
    href: "/cart",
  },
  {
    id: "storefront.checkout",
    requires: ["catalog.skus"],
    href: "/checkout",
  },
  {
    id: "storefront.activity",
    requires: ["promotions.offers"],
    href: "/activity",
  },
  {
    id: "buyer.membership",
    requires: ["membership.plans", "membership.package-groups", "membership.packages"],
    href: "/buyer/membership",
  },
  {
    id: "buyer.coupons",
    requires: ["promotions.offers"],
    href: "/buyer/coupons",
  },
  {
    id: "buyer.orders",
    requires: [],
    href: "/buyer/orders",
    transactional: true,
  },
  {
    id: "buyer.after-sales",
    requires: [],
    href: "/buyer/after-sales",
    transactional: true,
  },
  {
    id: "admin.products",
    requires: ["catalog.categories", "catalog.products", "catalog.skus"],
    href: "/admin/products",
  },
  {
    id: "admin.shops",
    requires: ["shops.stores"],
    href: "/admin/shops",
  },
  {
    id: "admin.marketing",
    requires: ["promotions.offers"],
    href: "/admin/marketing",
  },
];

export type MallDefaultDataJourneyStatus = "ready" | "partial" | "blocked";

export interface MallDefaultDataJourneyReport {
  readonly id: MallDefaultDataJourneyId;
  readonly href: string;
  readonly status: MallDefaultDataJourneyStatus;
  readonly transactional: boolean;
  /** Required check ids that pass. */
  readonly ready: readonly string[];
  /** Required check ids that are missing or incomplete. */
  readonly missing: readonly string[];
}

function statusForRequirement(check: MallDefaultDataCheck | undefined): "ready" | "partial" | "missing" {
  if (!check) {
    return "missing";
  }
  if (check.status === "pass") {
    return "ready";
  }
  return check.status === "warn" ? "partial" : "missing";
}

/**
 * Projects a verification report onto the journey walkthrough.
 *
 * A journey is `ready` when every required check passes, `partial` when some
 * data exists but is incomplete, and `blocked` when a required check is missing
 * entirely. Transactional journeys carry no data requirement: they become
 * meaningful once the operator completes a real purchase.
 */
export function reportMallDefaultDataJourneys(
  verification: Pick<MallDefaultDataVerification, "checks">,
): readonly MallDefaultDataJourneyReport[] {
  const checksById = new Map(verification.checks.map((check) => [check.id, check]));
  return MALL_DEFAULT_DATA_JOURNEYS.map((journey) => {
    const ready: string[] = [];
    const missing: string[] = [];
    let partial = false;
    for (const requirement of journey.requires) {
      const state = statusForRequirement(checksById.get(requirement));
      if (state === "ready") {
        ready.push(requirement);
      } else {
        missing.push(requirement);
        partial = partial || state === "partial";
      }
    }
    const status: MallDefaultDataJourneyStatus =
      missing.length === 0 ? "ready" : ready.length === 0 && !partial ? "blocked" : "partial";
    return {
      id: journey.id,
      href: journey.href,
      status,
      transactional: journey.transactional ?? false,
      ready,
      missing,
    };
  });
}
