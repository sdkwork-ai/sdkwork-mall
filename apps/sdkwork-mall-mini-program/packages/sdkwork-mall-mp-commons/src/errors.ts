/**
 * Error message mapping shared by every mall mini-program capability.
 *
 * A capability must never surface a raw platform `errMsg` or a JSON dump: the
 * message goes through here so the buyer sees one sentence and the developer
 * fallback never leaks an internal identifier.
 */
export interface MpErrorLike {
  readonly code?: string | number;
  readonly message?: unknown;
  readonly traceId?: string;
}

export function errorMessage(cause: unknown, fallback: string): string {
  if (cause instanceof Error && cause.message) {
    return cause.message;
  }
  if (cause && typeof cause === "object") {
    const candidate = cause as MpErrorLike;
    if (typeof candidate.message === "string" && candidate.message) {
      return candidate.message;
    }
  }
  if (typeof cause === "string" && cause) {
    return cause;
  }
  return fallback;
}

/** True when the failure is an auth rejection rather than a transient error. */
export function isAuthorizationError(cause: unknown): boolean {
  if (cause && typeof cause === "object") {
    const candidate = cause as { code?: unknown; statusCode?: unknown };
    if (candidate.statusCode === 401 || candidate.statusCode === 403) {
      return true;
    }
    if (candidate.code === 40101 || candidate.code === 40301) {
      return true;
    }
  }
  const message = cause instanceof Error ? cause.message : String(cause ?? "");
  return /\b401\b/u.test(message) || /\b403\b/u.test(message) || /unauthorized/iu.test(message);
}
