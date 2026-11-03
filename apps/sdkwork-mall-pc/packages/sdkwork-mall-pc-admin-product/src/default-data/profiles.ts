import type {
  MallDefaultDataDataset,
  MallDefaultDataEnvironment,
  MallDefaultDataProfile,
} from "./types";

/**
 * Environment to provisioning-profile mapping.
 *
 * Production receives platform reference structure only: the catalog tree, the
 * self-operated store, membership tiers and the storefront CMS frame. Demo,
 * development, test and staging receive catalog and campaign data as well, so a
 * reviewer can complete a purchase journey in every non-production environment.
 */
export const MALL_DEFAULT_DATA_ENVIRONMENT_PROFILES: Readonly<
  Record<MallDefaultDataEnvironment, MallDefaultDataProfile>
> = {
  development: "demo",
  demo: "demo",
  test: "standard",
  staging: "standard",
  production: "minimal",
};

/** Every environment the mall ships, in deployment order. */
export const MALL_DEFAULT_DATA_ENVIRONMENTS: readonly MallDefaultDataEnvironment[] = [
  "development",
  "test",
  "demo",
  "staging",
  "production",
];

const PROFILE_ORDER: readonly MallDefaultDataProfile[] = ["minimal", "standard", "demo"];

export function isMallDefaultDataProfile(value: unknown): value is MallDefaultDataProfile {
  return typeof value === "string" && (PROFILE_ORDER as readonly string[]).includes(value);
}

export function isMallDefaultDataEnvironment(value: unknown): value is MallDefaultDataEnvironment {
  return typeof value === "string" && (MALL_DEFAULT_DATA_ENVIRONMENTS as readonly string[]).includes(value);
}

/** Normalizes a build mode or `SDKWORK_ENVIRONMENT` value to a known environment. */
export function resolveMallDefaultDataEnvironment(value: string | undefined): MallDefaultDataEnvironment {
  const normalized = (value ?? "").trim().toLowerCase();
  switch (normalized) {
    case "prod":
    case "production":
      return "production";
    case "stag":
    case "staging":
      return "staging";
    case "test":
    case "testing":
      return "test";
    case "demo":
      return "demo";
    default:
      return "development";
  }
}

/** Resolves the provisioning profile for an environment, honoring an explicit override. */
export function resolveMallDefaultDataProfile(
  environment: MallDefaultDataEnvironment,
  override?: string | null,
): MallDefaultDataProfile {
  return isMallDefaultDataProfile(override)
    ? override
    : MALL_DEFAULT_DATA_ENVIRONMENT_PROFILES[environment];
}

/**
 * Projects the authored dataset onto a provisioning profile.
 *
 * The projection is intentionally a pure slice, not a transformation: entity
 * identities (keys, codes, barcodes) never change with the profile, so a
 * `standard` environment can be upgraded to `demo` without duplicating rows.
 */
export function selectMallDefaultDataSlice(
  dataset: MallDefaultDataDataset,
  profile: MallDefaultDataProfile,
): MallDefaultDataDataset {
  if (profile === "demo") {
    return dataset;
  }

  const include = (entry: { readonly demoOnly?: boolean }) => !entry.demoOnly;

  if (profile === "standard") {
    return {
      ...dataset,
      products: dataset.products.filter(include),
      offers: dataset.offers.filter(include),
      membership: {
        ...dataset.membership,
        packages: dataset.membership.packages.filter(include),
      },
    };
  }

  return {
    ...dataset,
    shops: dataset.shops.filter((shop) => shop.businessModel === "self-operated"),
    products: [],
    offers: [],
    membership: {
      ...dataset.membership,
      packages: dataset.membership.packages.filter(include),
    },
  };
}
