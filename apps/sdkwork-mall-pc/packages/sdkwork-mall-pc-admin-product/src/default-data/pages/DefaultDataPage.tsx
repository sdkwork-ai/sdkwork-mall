import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, EmptyState } from "@sdkwork/ui-pc-react";

import {
  getMallDefaultDataCopy,
  getMallDefaultDataEnvironmentLabel,
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
import type { MallDefaultDataVerification } from "../verify";

export interface SdkworkMallDefaultDataPageProps {
  readonly locale?: string;
}

type BusyAction = "dry-run" | "run" | "verify" | "plan";

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

function stepStatusLabel(copy: MallDefaultDataCopy, status: MallDefaultDataReportStep["status"]): string {
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

function statusTone(status: string): string {
  if (status === "created" || status === "pass") {
    return "sdkwork-mall-pc-badge sdkwork-mall-pc-badge-success";
  }
  if (status === "failed" || status === "fail") {
    return "sdkwork-mall-pc-badge sdkwork-mall-pc-badge-danger";
  }
  if (status === "warn") {
    return "sdkwork-mall-pc-badge sdkwork-mall-pc-badge-warning";
  }
  return "sdkwork-mall-pc-badge";
}

/**
 * Platform operator surface for mall default data.
 *
 * The page is read-first: it always shows the plan for the current environment
 * before anything is written, offers an explicit dry run, and can re-verify the
 * environment without writing. Every action is idempotent.
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
      } catch (cause: unknown) {
        setError(formatError(cause, copy));
      } finally {
        setBusy(null);
      }
    },
    [copy, locale],
  );

  const handleVerify = useCallback(async () => {
    setBusy("verify");
    setError(null);
    try {
      setVerification(await verifyMallDefaultDataInitialization({ locale }));
    } catch (cause: unknown) {
      setVerification(null);
      setError(formatError(cause, copy));
    } finally {
      setBusy(null);
    }
  }, [copy, locale]);

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

  const activeProfile = preview.profile;
  const productionNotice = activeProfile === "minimal";

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
        <p className="sdkwork-mall-pc-inline-note" role="note">
          {copy.productionNotice}
        </p>
      ) : null}

      {error ? (
        <div className="sdkwork-mall-pc-inline-alert" role="alert">
          <span>{error}</span>
          <Button onClick={loadPreview} type="button" variant="outline">
            {copy.actionRetry}
          </Button>
        </div>
      ) : null}

      <section className="sdkwork-mall-pc-floor">
        <h2>{copy.totalsTitle}</h2>
        <div className="sdkwork-mall-pc-metric-row">
          {summaryCards.map((card) => (
            <div className="sdkwork-mall-pc-metric" key={card.label}>
              <strong>{card.value}</strong>
              <span>{card.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="sdkwork-mall-pc-floor">
        <h2>{copy.planTitle}</h2>
        <p>{copy.planDescription}</p>
        <div className="sdkwork-mall-pc-button-row">
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
          <caption className="sdkwork-mall-pc-visually-hidden">{copy.stepsTitle}</caption>
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
                    <div className="sdkwork-mall-pc-muted">{step.id}</div>
                  </td>
                  <td>{step.entityCount}</td>
                  <td>
                    <span className={statusTone(state?.status ?? "")} data-step-status={state?.status ?? "pending"}>
                      {stepStatusLabel(copy, state?.status ?? "pending")}
                    </span>
                    {state?.message ? <div className="sdkwork-mall-pc-muted">{state.message}</div> : null}
                    {state && state.created + state.skipped > 0 ? (
                      <div className="sdkwork-mall-pc-muted">
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
            className="sdkwork-mall-pc-inline-note"
            data-default-data-run-result={report.ok ? "ok" : "failed"}
            role="status"
          >
            {report.ok ? copy.runSucceeded : copy.runFailed}{" "}
            {report.dryRun ? `${copy.summaryPlanned} ${report.summary.planned}` : `${copy.summaryCreated} ${report.summary.created}`} ·{" "}
            {copy.summarySkipped} {report.summary.skipped} · {copy.summaryFailed} {report.summary.failed}
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
              className="sdkwork-mall-pc-inline-note"
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
                        <div className="sdkwork-mall-pc-muted">
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
          <Button disabled={busy !== null} onClick={() => void handleVerify()} type="button" variant="outline">
            {busy === "verify" ? copy.verifying : copy.actionVerify}
          </Button>
        )}
      </section>
    </div>
  );
}
