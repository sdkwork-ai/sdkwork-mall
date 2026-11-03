import { resolveDefaultDataset, validateDefaultDataset } from "./dataset";
import { executeMallDefaultDataPlan, type MallDefaultDataReport } from "./execute";
import { buildMallDefaultDataPlan } from "./plan";
import type { MallDefaultDataPort } from "./port";
import {
  isMallDefaultDataEnvironment,
  resolveMallDefaultDataEnvironment,
  resolveMallDefaultDataProfile,
  selectMallDefaultDataSlice,
} from "./profiles";
import type {
  MallDefaultDataDataset,
  MallDefaultDataDomain,
  MallDefaultDataEnvironment,
  MallDefaultDataLocale,
  MallDefaultDataProfile,
} from "./types";
import { verifyMallDefaultData, type MallDefaultDataVerification } from "./verify";

/** Stable failure reasons for the default-data capability. */
export type MallDefaultDataErrorCode =
  | "not-configured"
  | "invalid-dataset"
  | "invalid-argument";

/** Typed business failure raised by the default-data service. */
export class MallDefaultDataError extends Error {
  readonly code: MallDefaultDataErrorCode;

  constructor(code: MallDefaultDataErrorCode, message: string) {
    super(message);
    this.name = "MallDefaultDataError";
    this.code = code;
  }
}

export interface MallDefaultDataProviderInput {
  readonly port: MallDefaultDataPort;
  readonly environment: MallDefaultDataEnvironment;
  readonly defaultLocale: MallDefaultDataLocale;
  /** Platform organization the seeded stores belong to. */
  readonly organizationId?: string;
}

export interface MallDefaultDataPlanStepPreview {
  readonly id: string;
  readonly domain: MallDefaultDataDomain;
  readonly title: string;
  readonly entityCount: number;
}

export interface MallDefaultDataPlanPreview {
  readonly environment: MallDefaultDataEnvironment;
  readonly profile: MallDefaultDataProfile;
  readonly locale: MallDefaultDataLocale;
  readonly steps: readonly MallDefaultDataPlanStepPreview[];
  readonly totals: {
    readonly categories: number;
    readonly shops: number;
    readonly products: number;
    readonly skus: number;
    readonly offers: number;
    readonly membershipPlans: number;
    readonly membershipPackages: number;
    readonly cmsEntries: number;
  };
}

let provider: MallDefaultDataProviderInput | null = null;

/** Registers the environment adapter; called once from the mall PC bootstrap. */
export function configureMallDefaultDataProvider(input: MallDefaultDataProviderInput | null): void {
  provider = input;
}

export function isMallDefaultDataConfigured(): boolean {
  return provider !== null;
}

function requireProvider(): MallDefaultDataProviderInput {
  if (!provider) {
    throw new MallDefaultDataError(
      "not-configured",
      "Mall default data port is not configured. Call configureMallDefaultDataProvider() from the mall PC bootstrap.",
    );
  }
  return provider;
}

function normalizeLocale(value: string | undefined, fallback: MallDefaultDataLocale): MallDefaultDataLocale {
  return value === "en-US" || value === "zh-CN" ? value : fallback;
}

/** Resolves the dataset slice for a locale + profile, failing fast on authored defects. */
export function resolveMallDefaultDataSlice(
  locale: MallDefaultDataLocale,
  profile: MallDefaultDataProfile,
  base?: MallDefaultDataDataset,
): MallDefaultDataDataset {
  const authored = base ?? resolveDefaultDataset("zh-CN");
  const validation = validateDefaultDataset(authored);
  if (!validation.valid) {
    const summary = validation.problems
      .slice(0, 5)
      .map((problem) => `${problem.path}: ${problem.message}`)
      .join("; ");
    throw new MallDefaultDataError(
      "invalid-dataset",
      `mall default dataset is invalid (${validation.problems.length} problems): ${summary}`,
    );
  }
  return selectMallDefaultDataSlice(resolveDefaultDataset(locale, authored), profile);
}

export interface MallDefaultDataRunRequest {
  readonly environment?: string;
  readonly locale?: string;
  readonly profile?: string;
  readonly dryRun?: boolean;
  readonly signal?: AbortSignal;
  readonly now?: () => Date;
  readonly onStepComplete?: Parameters<typeof executeMallDefaultDataPlan>[1]["onStepComplete"];
}

function resolveRunContext(request: MallDefaultDataRunRequest) {
  const active = requireProvider();
  const environment = isMallDefaultDataEnvironment(request.environment)
    ? request.environment
    : resolveMallDefaultDataEnvironment(request.environment ?? active.environment);
  const locale = normalizeLocale(request.locale, active.defaultLocale);
  const profile = resolveMallDefaultDataProfile(environment, request.profile ?? null);
  const dataset = resolveMallDefaultDataSlice(locale, profile);
  return { active, environment, locale, profile, dataset };
}

/** Plans the initialization without touching the environment. */
export function previewMallDefaultDataInitialization(
  request: MallDefaultDataRunRequest = {},
): MallDefaultDataPlanPreview {
  const { environment, locale, profile, dataset } = resolveRunContext(request);
  const steps = buildMallDefaultDataPlan(dataset, profile).map((step) => ({
    id: step.id,
    domain: step.domain,
    title: step.title,
    entityCount: step.entityCount,
  }));
  return {
    environment,
    profile,
    locale,
    steps,
    totals: {
      categories: dataset.categories.reduce(
        (total, category) => total + 1 + category.children.length,
        0,
      ),
      shops: dataset.shops.length,
      products: dataset.products.length,
      skus: dataset.products.reduce((total, product) => total + product.skus.length, 0),
      offers: dataset.offers.length,
      membershipPlans: dataset.membership.plans.length,
      membershipPackages: dataset.membership.packages.length,
      cmsEntries:
        dataset.cms.banners.length + dataset.cms.floors.length + dataset.cms.hotKeywords.length,
    },
  };
}

/** Provisions the environment's default dataset. Idempotent; safe to rerun. */
export async function runMallDefaultDataInitialization(
  request: MallDefaultDataRunRequest = {},
): Promise<MallDefaultDataReport> {
  const { active, environment, locale, profile, dataset } = resolveRunContext(request);
  return executeMallDefaultDataPlan(buildMallDefaultDataPlan(dataset, profile), {
    dataset,
    dryRun: request.dryRun ?? false,
    environment,
    locale,
    now: request.now,
    onStepComplete: request.onStepComplete,
    organizationId: active.organizationId ?? "0",
    port: active.port,
    profile,
    signal: request.signal,
  });
}

/** Reads the environment back and reports coverage against the active profile. */
export async function verifyMallDefaultDataInitialization(
  request: MallDefaultDataRunRequest = {},
): Promise<MallDefaultDataVerification> {
  const { active, environment, locale, profile, dataset } = resolveRunContext(request);
  return verifyMallDefaultData({
    dataset,
    environment,
    locale,
    now: request.now,
    port: active.port,
    profile,
  });
}
