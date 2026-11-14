/**
 * Storefront first-run seeding port.
 *
 * The default dataset engine lives in `@sdkwork/mall-pc-admin-product` and writes
 * through the federated commerce backend. The storefront must not import the
 * admin package, so the app bootstrap injects this narrow port instead — the
 * same composition-root pattern the rest of the mall uses.
 *
 * A fresh install has an empty catalog. Without this seam the home page renders
 * a blank mall with no explanation and no path forward; with it the page can
 * provision the application default dataset (categories, shops, products, SKUs,
 * price ladder, campaigns, membership and CMS frame) once, automatically where
 * the runtime policy allows it, and otherwise offer an explicit one-click seed.
 */

/** Outcome of one seeding attempt. */
export type MallHomeSeedState = "succeeded" | "failed" | "unavailable";

export interface MallHomeSeedOutcome {
  /** Entities the run created; 0 for a rerun over an already seeded store. */
  readonly created: number;
  /** Operator-facing failure detail; absent on success. */
  readonly message?: string;
  readonly state: MallHomeSeedState;
}

/** Dataset slice the runtime would write by default. */
export type MallHomeSeedProfile = "minimal" | "standard" | "demo";

export interface MallHomeSeedRunOptions {
  /** Explicit slice override; the storefront's "load demo data" action uses it. */
  readonly profile?: MallHomeSeedProfile;
}

export interface MallHomeSeedProvider {
  /**
   * Whether the runtime policy allows provisioning without an operator click.
   * Non-production installs seed automatically; production requires the
   * explicit storefront action or the admin console. A function is evaluated
   * per attempt, so a policy that also depends on the live session (an
   * unauthenticated visitor must not attempt backend writes) stays correct
   * after sign-in.
   */
  readonly automatic: boolean | (() => boolean);
  /**
   * Profile written without an override. `minimal` is the production reference
   * slice: categories, the self-operated shop, membership and the CMS frame, but
   * no products. The page reads this to offer an explicit demo slice instead of
   * letting "load data" leave the catalog empty.
   */
  readonly profile: MallHomeSeedProfile;
  /**
   * Whether the visitor currently holds credentials; an anonymous visitor is
   * asked to sign in instead of being offered an action that would 401.
   */
  readonly isSignedIn?: () => boolean;
  /** Runs the idempotent default-data plan through the commerce backend. */
  run(options?: MallHomeSeedRunOptions): Promise<MallHomeSeedOutcome>;
}

let seedProvider: MallHomeSeedProvider | null = null;
let inFlight: Promise<MallHomeSeedOutcome> | null = null;
let automaticAttempted = false;

/** Registers the runtime adapter; called once from the mall PC bootstrap. */
export function configureMallHomeSeedProvider(provider: MallHomeSeedProvider | null): void {
  seedProvider = provider;
  inFlight = null;
  automaticAttempted = false;
}

export function isMallHomeSeedAvailable(): boolean {
  return seedProvider !== null;
}

function isAutomaticAllowed(provider: MallHomeSeedProvider): boolean {
  return typeof provider.automatic === "function" ? provider.automatic() : provider.automatic;
}

export function isMallHomeSeedAutomatic(): boolean {
  return seedProvider ? isAutomaticAllowed(seedProvider) : false;
}

/** Slice the runtime would write by default, when a provider is configured. */
export function getMallHomeSeedProfile(): MallHomeSeedProfile | undefined {
  return seedProvider?.profile;
}

/** Whether the current visitor can attempt a backend write. */
export function isMallHomeSeedSignedIn(): boolean {
  return seedProvider?.isSignedIn?.() ?? true;
}

/**
 * Claims the single automatic attempt allowed per page lifetime.
 *
 * Returns false when seeding cannot run automatically (no provider, production
 * policy) or when the attempt was already made, so a re-render cannot loop the
 * provisioning plan.
 */
export function claimMallHomeAutomaticSeed(): boolean {
  if (!seedProvider || !isAutomaticAllowed(seedProvider) || automaticAttempted) {
    return false;
  }
  automaticAttempted = true;
  return true;
}

function toFailure(cause: unknown): MallHomeSeedOutcome {
  return {
    created: 0,
    message: cause instanceof Error && cause.message ? cause.message : "默认数据初始化失败",
    state: "failed",
  };
}

/** Provisions the default dataset; concurrent callers share one run. */
export function runMallHomeSeed(
  options: MallHomeSeedRunOptions = {},
): Promise<MallHomeSeedOutcome> {
  if (!seedProvider) {
    return Promise.resolve({
      created: 0,
      message: "当前构建未接入后台 API，无法初始化默认数据。",
      state: "unavailable",
    });
  }
  if (inFlight) {
    return inFlight;
  }
  const task = seedProvider.run(options).then(
    (outcome): MallHomeSeedOutcome => outcome,
    toFailure,
  );
  inFlight = task;
  void task.then(
    () => {
      if (inFlight === task) {
        inFlight = null;
      }
    },
    () => {
      if (inFlight === task) {
        inFlight = null;
      }
    },
  );
  return task;
}

/** Test seam: forget the per-lifetime state without changing the provider. */
export function resetMallHomeSeedState(): void {
  inFlight = null;
  automaticAttempted = false;
}
