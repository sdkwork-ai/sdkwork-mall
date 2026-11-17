/**
 * Lightweight default-data provider registry.
 *
 * The provisioning *engine* (plan, dataset, executor) is heavy and lives in
 * `default-data-service.ts`; the app bootstrap and the storefront seed port only
 * need to register the environment adapter and read its state. Keeping that
 * registry in its own module lets the bootstrap stay out of the dataset chunk:
 * the dataset is only downloaded when an operator or the first-run seed actually
 * provisions data.
 */
import type { MallDefaultDataPort } from "./port";
import type {
  MallDefaultDataEnvironment,
  MallDefaultDataLocale,
  MallDefaultDataProfile,
} from "./types";

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
  /**
   * Profile this deployment resolves to (already accounting for the deployment
   * profile, e.g. a self-hosted production install gets `standard`). Consumers
   * that do not pass an explicit profile — the admin console's preview/run and
   * the storefront first-run seed — use it instead of the plain environment
   * mapping, so both surfaces agree on what will be written.
   */
  readonly defaultProfile?: MallDefaultDataProfile;
  /** Platform organization the seeded stores belong to. */
  readonly organizationId?: string;
}

let provider: MallDefaultDataProviderInput | null = null;
let bootstrapper: (() => Promise<void>) | null = null;

/** Registers the environment adapter; called once from the mall PC bootstrap. */
export function configureMallDefaultDataProvider(input: MallDefaultDataProviderInput | null): void {
  provider = input;
}

/**
 * Registers the lazy adapter builder.
 *
 * The bootstrap owns SDK client construction and the dataset chunk, so it
 * cannot run eagerly at first paint. Consumers that need provisioning call
 * `ensureMallDefaultDataConfigured()` first; the admin console does so before
 * previewing, and the storefront seed port does so before running.
 */
export function configureMallDefaultDataBootstrapper(
  input: (() => Promise<void>) | null,
): void {
  bootstrapper = input;
}

export function isMallDefaultDataConfigured(): boolean {
  return provider !== null;
}

/** Whether a lazy adapter builder is registered (real app bootstrap only). */
export function hasMallDefaultDataBootstrapper(): boolean {
  return bootstrapper !== null;
}

export function requireMallDefaultDataProvider(): MallDefaultDataProviderInput {
  if (!provider) {
    throw new MallDefaultDataError(
      "not-configured",
      "Mall default data port is not configured. Call configureMallDefaultDataProvider() from the mall PC bootstrap.",
    );
  }
  return provider;
}

/** Builds the adapter on first use; a no-op when it is already configured. */
export async function ensureMallDefaultDataConfigured(): Promise<void> {
  if (provider || !bootstrapper) {
    return;
  }
  await bootstrapper();
}
