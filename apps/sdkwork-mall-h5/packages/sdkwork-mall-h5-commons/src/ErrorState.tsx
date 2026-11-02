/**
 * Shared load-failure banner with a retry action.
 *
 * Every H5 data page eventually fails (offline, expired session, gateway
 * hiccup). Before this primitive each page rendered its own red `<div>` with no
 * way to recover except reloading the whole app. The banner keeps the alert
 * semantics, offers a retry, and defaults to a page reload so a page does not
 * have to wire anything to get a working recovery path.
 */
export interface SdkworkMallH5ErrorStateProps {
  /** Retry button label, defaults to 重试. */
  actionLabel?: string;
  /** Human-readable failure message already resolved by the page. */
  message: string;
  /** Custom recovery action; defaults to reloading the current page. */
  onRetry?: () => void;
}

function reloadCurrentPage(): void {
  if (typeof window !== "undefined") {
    window.location.reload();
  }
}

export function SdkworkMallH5ErrorState({
  actionLabel = "重试",
  message,
  onRetry,
}: SdkworkMallH5ErrorStateProps) {
  return (
    <div className="sdk-h5-error" role="alert">
      <span>{message}</span>
      <button className="sdk-h5-link-button" onClick={onRetry ?? reloadCurrentPage} type="button">
        {actionLabel}
      </button>
    </div>
  );
}
