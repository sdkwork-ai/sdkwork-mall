import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button, EmptyState } from "@sdkwork/ui-pc-react";

import {
  getMallDefaultDataCopy,
  getMallDefaultDataEnvironmentLabel,
  getMallDefaultDataJourneyTitle,
  getMallDefaultDataProfileLabel,
  type MallDefaultDataCopy,
} from "../copy";
import {
  MallDefaultDataError,
  previewMallDefaultDataInitialization,
  runMallDefaultDataInitialization,
  verifyMallDefaultDataInitialization,
  type MallDefaultDataPlanPreview,
} from "../default-data-service";
import type { MallDefaultDataReport, MallDefaultDataReportStep } from "../execute";
import {
  reportMallDefaultDataJourneys,
  type MallDefaultDataJourneyReport,
  type MallDefaultDataJourneyStatus,
} from "../journeys";
import type { MallDefaultDataVerification } from "../verify";

export interface SdkworkMallDefaultDataPageProps {
  readonly locale?: string;
}

type BusyAction = "dry-run" | "run" | "verify" | "plan";

const BADGE_BASE = "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium";
const NOTE_CLASS =
  "mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200";
const ALERT_CLASS =
  "mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200";
const ROW_CLASS = "mt-3 flex flex-wrap items-center gap-2";
const MUTED_CLASS = "mt-1 text-xs text-slate-500 dark:text-slate-400";
const METRIC_ROW_CLASS = "mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4";
const METRIC_CLASS = "rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700";
const METRIC_VALUE_CLASS = "block text-lg font-semibold text-slate-900 dark:text-slate-100";
const METRIC_LABEL_CLASS = "text-xs text-slate-500 dark:text-slate-400";
const FLOW_LIST_CLASS = "mt-3 space-y-2";
const FLOW_ITEM_CLASS =
  "flex items-start gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700";
const FLOW_INDEX_CLASS =
  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300";
const FLOW_BODY_CLASS = "min-w-0 flex-1";
const FLOW_LINK_CLASS = "text-sm font-medium text-blue-600 hover:underline dark:text-blue-400";

function formatError(cause: unknown, copy: MallDefaultDataCopy): string {
  if (cause instanceof MallDefaultDataError) {
    if (cause.code === "not-configured") {
      return copy.notConfigured;
    }
    if (cause.code === "invalid-dataset") {
      return copy.invalidDataset;
    }
    return cause.message;
  }
  return cause instanceof Error && cause.message ? cause.message : copy.runFailed;
}

function stepStatusLabel(
  copy: MallDefaultDataCopy,
  status: MallDefaultDataReportStep["status"],
): string {
  switch (status) {
    case "created":
      return copy.stepStatusCreated;
    case "skipped":
      return copy.stepStatusSkipped;
    case "failed":
      return copy.stepStatusFailed;
    default:
      return copy.stepStatusPending;
  }
}

function checkStatusLabel(copy: MallDefaultDataCopy, status: "pass" | "warn" | "fail"): string {
  if (status === "pass") {
    return copy.checkPass;
  }
  return status === "warn" ? copy.checkWarn : copy.checkFail;
}

function journeyStatusLabel(
  copy: MallDefaultDataCopy,
  status: MallDefaultDataJourneyStatus,
): string {
  switch (status) {
    case "ready":
      return copy.journeyReady;
    case "partial":
      return copy.journeyPartial;
    default:
      return copy.journeyBlocked;
  }
}

function statusTone(status: string): string {
  if (status === "created" || status === "pass" || status === "ready") {
    return `${BADGE_BASE} border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200`;
  }
  if (status === "failed" || status === "fail" || status === "blocked") {
    return `${BADGE_BASE} border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200`;
  }
  if (status === "warn" || status === "partial") {
    return `${BADGE_BASE} border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200`;
  }
  return `${BADGE_BASE} border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300`;
}

/**
 * Platform operator surface for mall default data.
 *
 * The page is read-first: it always shows the plan for the current environment
 * before anything is written, offers an explicit dry run, re-verifies after a
 * successful run, and finally maps the data onto the end-to-end walkthrough so
 * a demo or onboarding session can show the whole application.
 */
export function SdkworkMallDefaultDataPage({ locale }: SdkworkMallDefaultDataPageProps) {
  const copy = getMallDefaultDataCopy(locale);
  const [preview, setPreview] = useState<MallDefaultDataPlanPreview | null>(null);
  const [report, setReport] = useState<MallDefaultDataReport | null>(null);
  const [verification, setVerification] = useState<MallDefaultDataVerification | null>(null);
  const [stepStates, setStepStates] = useState<Record<string, MallDefaultDataReportStep>>({});
  const [busy, setBusy] = useState<BusyAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPreview = useCallback(() => {
    setBusy("plan");
    setError(null);
    try {
      setPreview(previewMallDefaultDataInitialization({ locale }));
    } catch (cause: unknown) {
      setPreview(null);
      setError(formatError(cause, copy));
    } finally {
      setBusy(null);
    }
  }, [copy, locale]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  const totals = preview?.totals;
  const summaryCards = useMemo(
    () =>
      totals
        ? [
            { label: "categories", value: totals.categories },
            { label: "shops", value: totals.shops },
            { label: "products", value: totals.products },
            { label: "skus", value: totals.skus },
            { label: "offers", value: totals.offers },
            { label: "membership plans", value: totals.membershipPlans },
            { label: "membership packages", value: totals.membershipPackages },
            { label: "cms entries", value: totals.cmsEntries },
          ]
        : [],
    [totals],
  );

  const runVerification = useCallback(async () => {
    try {
      setVerification(await verifyMallDefaultDataInitialization({ locale }));
    } catch (cause: unknown) {
      setVerification(null);
      setError(formatError(cause, copy));
    }
  }, [copy, locale]);

  const handleRun = useCallback(
    async (dryRun: boolean) => {
      setBusy(dryRun ? "dry-run" : "run");
      setError(null);
      setReport(null);
      setStepStates({});
      try {
        const result = await runMallDefaultDataInitialization({
          dryRun,
          locale,
          onStepComplete: (step) => {
            setStepStates((current) => ({ ...current, [step.id]: step }));
          },
        });
        setReport(result);
        // A successful run immediately re-checks the environment so the flow
        // guide reflects the new state without a second click.
        if (result.ok && !dryRun) {
          await runVerification();
        }
      } catch (cause: unknown) {
        setError(formatError(cause, copy));
      } finally {
        setBusy(null);
      }
    },
    [copy, locale, runVerification],
  );

  const handleVerify = useCallback(async () => {
    setBusy("verify");
    setError(null);
    await runVerification();
    setBusy(null);
  }, [runVerification]);

  if (!preview) {
    return (
      <EmptyState
        actions={
          <Button onClick={loadPreview} type="button" variant="outline">
            {copy.actionRetry}
          </Button>
        }
        description={error ?? copy.pageDescription}
        title={copy.pageTitle}
      />
    );
  }

  const productionNotice = preview.profile === "minimal";

  return (
    <div className="sdkwork-mall-pc-default-data">
      <header className="sdkwork-mall-pc-page-header">
        <div>
          <h1>{copy.pageTitle}</h1>
          <p>{copy.pageDescription}</p>
        </div>
        <div className="sdkwork-mall-pc-chip-row">
          <span className={statusTone("")} data-default-data-environment={preview.environment}>
            {copy.labelEnvironment}: {getMallDefaultDataEnvironmentLabel(copy, preview.environment)}
          </span>
          <span className={statusTone("")} data-default-data-profile={preview.profile}>
            {copy.labelProfile}: {getMallDefaultDataProfileLabel(copy, preview.profile)}
          </span>
          <span className={statusTone("")} data-default-data-locale={preview.locale}>
            {copy.labelLocale}: {preview.locale}
          </span>
        </div>
      </header>

      {productionNotice ? (
        <p className={NOTE_CLASS} role="note">
          {copy.productionNotice}
        </p>
      ) : null}

      {error ? (
        <div className={ALERT_CLASS} role="alert">
          <span>{error}</span>
          <Button onClick={loadPreview} type="button" variant="outline">
            {copy.actionRetry}
          </Button>
        </div>
      ) : null}

      <section className="sdkwork-mall-pc-floor">
        <h2>{copy.totalsTitle}</h2>
        <div className={METRIC_ROW_CLASS}>
          {summaryCards.map((card) => (
            <div className={METRIC_CLASS} key={card.label}>
              <strong className={METRIC_VALUE_CLASS}>{card.value}</strong>
              <span className={METRIC_LABEL_CLASS}>{card.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="sdkwork-mall-pc-floor">
        <h2>{copy.planTitle}</h2>
        <p>{copy.planDescription}</p>
        <div className={ROW_CLASS}>
          <Button
            disabled={busy !== null}
            onClick={() => void handleRun(true)}
            type="button"
            variant="outline"
          >
            {busy === "dry-run" ? copy.running : copy.actionDryRun}
          </Button>
          <Button disabled={busy !== null} onClick={() => void handleRun(false)} type="button">
            {busy === "run" ? copy.running : copy.actionRun}
          </Button>
          <Button
            disabled={busy !== null}
            onClick={() => void handleVerify()}
            type="button"
            variant="outline"
          >
            {busy === "verify" ? copy.verifying : copy.actionVerify}
          </Button>
        </div>
        <table className="sdkwork-mall-pc-table" data-default-data-plan>
          <caption className="sr-only">{copy.stepsTitle}</caption>
          <thead>
            <tr>
              <th scope="col">{copy.stepsTitle}</th>
              <th scope="col">{copy.labelEntities}</th>
              <th scope="col">{copy.stepStatusPending}</th>
            </tr>
          </thead>
          <tbody>
            {preview.steps.map((step) => {
              const state = stepStates[step.id];
              return (
                <tr data-default-data-step={step.id} key={step.id}>
                  <td>
                    <strong>{step.title}</strong>
                    <div className={MUTED_CLASS}>{step.id}</div>
                  </td>
                  <td>{step.entityCount}</td>
                  <td>
                    <span
                      className={statusTone(state?.status ?? "")}
                      data-step-status={state?.status ?? "pending"}
                    >
                      {stepStatusLabel(copy, state?.status ?? "pending")}
                    </span>
                    {state?.message ? <div className={MUTED_CLASS}>{state.message}</div> : null}
                    {state && state.created + state.skipped > 0 ? (
                      <div className={MUTED_CLASS}>
                        {copy.summaryCreated} {state.created} · {copy.summarySkipped} {state.skipped}
                      </div>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {report ? (
          <p
            className={NOTE_CLASS}
            data-default-data-run-result={report.ok ? "ok" : "failed"}
            role="status"
          >
            {report.ok ? copy.runSucceeded : copy.runFailed}{" "}
            {report.dryRun
              ? `${copy.summaryPlanned} ${report.summary.planned}`
              : `${copy.summaryCreated} ${report.summary.created}`}{" "}
            · {copy.summarySkipped} {report.summary.skipped} · {copy.summaryFailed}{" "}
            {report.summary.failed}
            {report.dryRun ? ` · ${copy.dryRunNotice}` : ""}
          </p>
        ) : null}
      </section>

      <section className="sdkwork-mall-pc-floor">
        <h2>{copy.verificationTitle}</h2>
        <p>{copy.verificationDescription}</p>
        {verification ? (
          <>
            <p
              className={NOTE_CLASS}
              data-default-data-verification={verification.ok ? "ok" : "failed"}
              role="status"
            >
              {verification.ok ? copy.verifySucceeded : copy.verifyFailed}
            </p>
            <table className="sdkwork-mall-pc-table">
              <thead>
                <tr>
                  <th scope="col">{copy.verificationTitle}</th>
                  <th scope="col">{copy.labelExpected}</th>
                  <th scope="col">{copy.labelActual}</th>
                  <th scope="col">{copy.stepStatusPending}</th>
                </tr>
              </thead>
              <tbody>
                {verification.checks.map((check) => (
                  <tr data-default-data-check={check.id} key={check.id}>
                    <td>{check.label}</td>
                    <td>{check.expected}</td>
                    <td>{check.actual}</td>
                    <td>
                      <span className={statusTone(check.status)} data-check-status={check.status}>
                        {checkStatusLabel(copy, check.status)}
                      </span>
                      {check.missing.length > 0 ? (
                        <div className={MUTED_CLASS}>
                          {copy.labelMissing}: {check.missing.slice(0, 3).join(", ")}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <Button
            disabled={busy !== null}
            onClick={() => void handleVerify()}
            type="button"
            variant="outline"
          >
            {busy === "verify" ? copy.verifying : copy.actionVerify}
          </Button>
        )}
      </section>

      <FlowGuide
        busy={busy !== null}
        copy={copy}
        onVerify={() => void handleVerify()}
        verification={verification}
      />
    </div>
  );
}

/**
 * End-to-end walkthrough.
 *
 * Initialization is only useful if an operator can then show the whole product.
 * This section turns the verification report into an ordered journey list with
 * readiness badges and direct links, so a demo or onboarding session never
 * dead-ends on an empty page.
 */
function FlowGuide({
  busy,
  copy,
  onVerify,
  verification,
}: {
  busy: boolean;
  copy: MallDefaultDataCopy;
  onVerify: () => void;
  verification: MallDefaultDataVerification | null;
}) {
  const journeys = useMemo<readonly MallDefaultDataJourneyReport[]>(
    () => (verification ? reportMallDefaultDataJourneys(verification) : []),
    [verification],
  );

  return (
    <section className="sdkwork-mall-pc-floor" data-default-data-flow-guide>
      <h2>{copy.flowSectionTitle}</h2>
      <p>{copy.flowSectionDescription}</p>
      {verification ? (
        <>
          <p className={MUTED_CLASS} data-default-data-flow-checked-at={verification.checkedAt}>
            {copy.flowCheckedAt}: {new Date(verification.checkedAt).toLocaleString()}
          </p>
          <ol className={FLOW_LIST_CLASS}>
            {journeys.map((journey, index) => (
              <li className={FLOW_ITEM_CLASS} data-default-data-journey={journey.id} key={journey.id}>
                <span className={FLOW_INDEX_CLASS}>{index + 1}</span>
                <div className={FLOW_BODY_CLASS}>
                  <strong>{getMallDefaultDataJourneyTitle(copy, journey.id)}</strong>
                  <span
                    className={`${statusTone(journey.status)} ml-2`}
                    data-journey-status={journey.status}
                  >
                    {journeyStatusLabel(copy, journey.status)}
                  </span>
                  {journey.missing.length > 0 ? (
                    <div className={MUTED_CLASS}>
                      {copy.labelMissing}: {journey.missing.join(", ")}
                    </div>
                  ) : null}
                  {journey.transactional ? (
                    <div className={MUTED_CLASS}>{copy.journeyTransactionalNote}</div>
                  ) : null}
                </div>
                <Link className={FLOW_LINK_CLASS} to={journey.href}>
                  {copy.journeyOpen}
                </Link>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <Button disabled={busy} onClick={onVerify} type="button" variant="outline">
          {busy ? copy.verifying : copy.actionVerify}
        </Button>
      )}
      <div className={ROW_CLASS}>
        <Link className="sdkwork-mall-pc-hero-cta" to="/">
          {copy.openStorefront}
        </Link>
        <Button disabled={busy} onClick={onVerify} type="button" variant="outline">
          {busy ? copy.verifying : copy.actionVerify}
        </Button>
      </div>
    </section>
  );
}
