/**
 * Mall default data contract.
 *
 * A single locale-aware dataset describes everything the mall needs before an
 * operator can shop, sell or govern: catalog categories, shops, products with
 * SKUs, marketing offers, membership plans and storefront CMS content.
 *
 * The dataset is *data*, not copy: authored locale text lives in JSON documents
 * under `dataset/`, the environment profile decides which slice is provisioned,
 * and `plan.ts` turns the slice into a deterministic, idempotent operation list.
 */

/** Deployment environment the mall surface runs in. */
export type MallDefaultDataEnvironment =
  | "development"
  | "demo"
  | "test"
  | "staging"
  | "production";

/** Provisioning profile: how much default data an environment receives. */
export type MallDefaultDataProfile = "minimal" | "standard" | "demo";

/** Locales the dataset ships. `zh-CN` is the authored base, `en-US` an overlay. */
export type MallDefaultDataLocale = "zh-CN" | "en-US";

/** Business domains a plan step may belong to. */
export type MallDefaultDataDomain =
  | "catalog"
  | "shop"
  | "promotion"
  | "membership"
  | "cms"
  | "verification";

export interface MallDefaultDataCategoryChild {
  readonly key: string;
  readonly name: string;
  readonly sortOrder: number;
}

export interface MallDefaultDataCategory {
  readonly key: string;
  readonly name: string;
  readonly sortOrder: number;
  readonly children: readonly MallDefaultDataCategoryChild[];
}

export interface MallDefaultDataShop {
  /** Stable natural key; also written into shop operation config for idempotency. */
  readonly key: string;
  readonly name: string;
  readonly description: string;
  /** Platform-owned store, brand flagship or specialty merchant. */
  readonly shopType: "official" | "brand" | "specialty";
  /** `self-operated` stores ship as the platform's own seller. */
  readonly businessModel: "self-operated" | "merchant";
  readonly defaultCurrencyCode: string;
  readonly timezone: string;
}

export interface MallDefaultDataSku {
  readonly key: string;
  readonly title: string;
  /** Decimal amount in major currency units, e.g. `"4299.00"`. */
  readonly price: string;
  readonly listPrice: string;
  readonly barcode: string;
}

export interface MallDefaultDataProduct {
  readonly key: string;
  readonly shopKey: string;
  readonly categoryKey: string;
  readonly brand: string;
  readonly title: string;
  readonly subtitle: string;
  readonly description: string;
  readonly productType: "physical" | "digital" | "service";
  readonly skus: readonly MallDefaultDataSku[];
  readonly keywords: readonly string[];
  /** Only provisioned for the demo profile. */
  readonly demoOnly?: boolean;
}

export type MallDefaultDataOfferActivityType =
  | "flash-sale"
  | "limited-rush"
  | "brand-day"
  | "member-day"
  | "new-launch"
  | "big-promo";

export interface MallDefaultDataOffer {
  readonly key: string;
  readonly code: string;
  readonly title: string;
  readonly description: string;
  readonly activityType: MallDefaultDataOfferActivityType;
  readonly discountText: string;
  readonly highlight: string;
  /** Only provisioned outside the `minimal` profile. */
  readonly demoOnly?: boolean;
}

export interface MallDefaultDataMembershipPlan {
  readonly key: string;
  readonly code: string;
  readonly name: string;
  readonly rank: number;
  readonly benefits: readonly string[];
}

export interface MallDefaultDataMembershipPackageGroup {
  readonly key: string;
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly billingCycle: "monthly" | "yearly";
  readonly durationDays: number;
  readonly sortWeight: number;
}

export interface MallDefaultDataMembershipPackage {
  readonly key: string;
  readonly code: string;
  readonly name: string;
  readonly planKey: string;
  readonly groupKey: string;
  readonly priceAmount: string;
  readonly durationDays: number;
  readonly currencyCode: string;
  /** Only provisioned for the demo profile. */
  readonly demoOnly?: boolean;
}

export interface MallDefaultDataCmsBanner {
  readonly key: string;
  readonly title: string;
  readonly subtitle: string;
  readonly linkUrl: string;
  readonly sortOrder: number;
}

export interface MallDefaultDataCmsFloor {
  readonly key: string;
  readonly title: string;
  readonly productQuery: string;
  readonly sortOrder: number;
}

export interface MallDefaultDataCmsHotKeyword {
  readonly key: string;
  readonly keyword: string;
  readonly sortOrder: number;
}

export interface MallDefaultDataCms {
  readonly banners: readonly MallDefaultDataCmsBanner[];
  readonly floors: readonly MallDefaultDataCmsFloor[];
  readonly hotKeywords: readonly MallDefaultDataCmsHotKeyword[];
}

/** Authored (zh-CN) default dataset document. */
export interface MallDefaultDataDataset {
  readonly schemaVersion: 1;
  readonly locale: MallDefaultDataLocale;
  readonly categories: readonly MallDefaultDataCategory[];
  readonly shops: readonly MallDefaultDataShop[];
  readonly products: readonly MallDefaultDataProduct[];
  readonly offers: readonly MallDefaultDataOffer[];
  readonly membership: {
    readonly plans: readonly MallDefaultDataMembershipPlan[];
    readonly packageGroups: readonly MallDefaultDataMembershipPackageGroup[];
    readonly packages: readonly MallDefaultDataMembershipPackage[];
  };
  readonly cms: MallDefaultDataCms;
}

/** Locale overlay document: keyed translations for the authored dataset. */
export interface MallDefaultDataLocaleOverlay {
  readonly schemaVersion: 1;
  readonly locale: MallDefaultDataLocale;
  readonly categories: Readonly<Record<string, string>>;
  readonly shops: Readonly<Record<string, { readonly name?: string; readonly description?: string }>>;
  readonly products: Readonly<
    Record<
      string,
      {
        readonly title?: string;
        readonly subtitle?: string;
        readonly description?: string;
        readonly skus?: Readonly<Record<string, string>>;
      }
    >
  >;
  readonly offers: Readonly<
    Record<string, { readonly title?: string; readonly description?: string }>
  >;
  readonly membership: {
    readonly plans: Readonly<
      Record<string, { readonly name?: string; readonly benefits?: readonly string[] }>
    >;
    readonly packageGroups: Readonly<Record<string, { readonly name?: string; readonly description?: string }>>;
    readonly packages: Readonly<Record<string, { readonly name?: string }>>;
  };
  readonly cms: {
    readonly banners: Readonly<Record<string, { readonly title?: string; readonly subtitle?: string }>>;
    readonly floors: Readonly<Record<string, string>>;
    readonly hotKeywords: Readonly<Record<string, string>>;
  };
}

/** Dataset integrity problem: one authored defect, addressable by path. */
export interface MallDefaultDataProblem {
  readonly path: string;
  readonly message: string;
}

/** Result of validating a dataset document. */
export interface MallDefaultDataValidation {
  readonly valid: boolean;
  readonly problems: readonly MallDefaultDataProblem[];
}
