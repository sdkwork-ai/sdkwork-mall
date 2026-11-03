import {
  createMallDefaultDataExecutionState,
  type MallDefaultDataStep,
  type MallDefaultDataStepContext,
} from "./plan";
import type { MallDefaultDataPort } from "./port";
import type {
  MallDefaultDataDataset,
  MallDefaultDataDomain,
  MallDefaultDataEnvironment,
  MallDefaultDataLocale,
  MallDefaultDataProfile,
} from "./types";

/** Execution status of one plan step. */
export type MallDefaultDataStepStatus = "created" | "skipped" | "failed" | "pending";

export interface MallDefaultDataReportStep {
  readonly id: string;
  readonly domain: MallDefaultDataDomain;
  readonly title: string;
  readonly status: MallDefaultDataStepStatus;
  readonly created: number;
  /** Entities a dry run would create; always 0 for a real run. */
  readonly planned: number;
  readonly skipped: number;
  readonly durationMs: number;
  readonly message?: string;
  readonly details: readonly string[];
}

export interface MallDefaultDataReportSummary {
  readonly created: number;
  readonly planned: number;
  readonly skipped: number;
  readonly failed: number;
  readonly pending: number;
}

/** Full outcome of one initialization run. */
export interface MallDefaultDataReport {
  readonly environment: MallDefaultDataEnvironment;
  readonly profile: MallDefaultDataProfile;
  readonly locale: MallDefaultDataLocale;
  readonly dryRun: boolean;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly steps: readonly MallDefaultDataReportStep[];
  readonly summary: MallDefaultDataReportSummary;
  readonly ok: boolean;
}

export interface MallDefaultDataExecutionOptions {
  readonly port: MallDefaultDataPort;
  readonly dataset: MallDefaultDataDataset;
  readonly environment: MallDefaultDataEnvironment;
  readonly profile: MallDefaultDataProfile;
  readonly locale: MallDefaultDataLocale;
  readonly organizationId?: string;
  readonly dryRun?: boolean;
  readonly signal?: AbortSignal;
  readonly now?: () => Date;
  /** Called after each step settles, for live progress in the admin surface. */
  readonly onStepComplete?: (step: MallDefaultDataReportStep) => void;
}

function toMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return String(error ?? "unknown error");
}

/**
 * Executes the plan sequentially.
 *
 * Sequential execution is required, not incidental: every later step consumes
 * ids produced by an earlier one. A failing step stops the run so a partial
 * failure cannot cascade into writes with missing foreign keys; the report still
 * lists every remaining step as `pending` so the operator sees the restart
 * point.
 */
export async function executeMallDefaultDataPlan(
  plan: readonly MallDefaultDataStep[],
  options: MallDefaultDataExecutionOptions,
): Promise<MallDefaultDataReport> {
  const now = options.now ?? (() => new Date());
  const startedAt = now().toISOString();
  const state = createMallDefaultDataExecutionState();
  const assertActive = () => {
    if (options.signal?.aborted) {
      throw new Error("default data initialization aborted");
    }
  };
  const dryRun = options.dryRun ?? false;
  const context: MallDefaultDataStepContext = {
    port: options.port,
    dataset: options.dataset,
    profile: options.profile,
    environment: options.environment,
    dryRun,
    organizationId: options.organizationId ?? "0",
    state,
    assertActive,
  };

  const reportSteps: MallDefaultDataReportStep[] = [];
  let failed = false;

  for (const step of plan) {
    if (failed) {
      reportSteps.push({
        id: step.id,
        domain: step.domain,
        title: step.title,
        status: "pending",
        created: 0,
        planned: 0,
        skipped: 0,
        durationMs: 0,
        details: [],
      });
      continue;
    }

    const stepStartedAt = Date.now();
    try {
      const outcome = await step.run(context);
      const reportStep: MallDefaultDataReportStep = {
        id: step.id,
        domain: step.domain,
        title: step.title,
        // A dry run writes nothing, so its step is reported as skipped and its
        // entity count is surfaced as `planned` instead of `created`.
        status: dryRun ? "skipped" : outcome.status,
        created: dryRun ? 0 : outcome.created,
        planned: dryRun ? outcome.created : 0,
        skipped: outcome.skipped,
        durationMs: Date.now() - stepStartedAt,
        details: outcome.details,
      };
      reportSteps.push(reportStep);
      options.onStepComplete?.(reportStep);
    } catch (error: unknown) {
      failed = true;
      const reportStep: MallDefaultDataReportStep = {
        id: step.id,
        domain: step.domain,
        title: step.title,
        status: "failed",
        created: 0,
        planned: 0,
        skipped: 0,
        durationMs: Date.now() - stepStartedAt,
        message: toMessage(error),
        details: [],
      };
      reportSteps.push(reportStep);
      options.onStepComplete?.(reportStep);
    }
  }

  const summary = reportSteps.reduce<MallDefaultDataReportSummary>(
    (totals, step) => ({
      created: totals.created + step.created,
      planned: totals.planned + step.planned,
      skipped: totals.skipped + step.skipped,
      failed: totals.failed + (step.status === "failed" ? 1 : 0),
      pending: totals.pending + (step.status === "pending" ? 1 : 0),
    }),
    { created: 0, planned: 0, skipped: 0, failed: 0, pending: 0 },
  );

  return {
    environment: options.environment,
    profile: options.profile,
    locale: options.locale,
    dryRun,
    startedAt,
    finishedAt: now().toISOString(),
    steps: reportSteps,
    summary,
    ok: summary.failed === 0,
  };
}
