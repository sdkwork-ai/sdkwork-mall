import type { Location } from "react-router-dom";

import {
  hasSdkworkMallPcIamSession,
  type SdkworkMallPcSessionSnapshot,
} from "./bootstrap/sessionStore";

export type SdkworkMallPcAuthGateDecision =
  | { kind: "product-route" }
  | { kind: "auth-route" }
  | { kind: "redirect"; replace: true; to: string };

const AUTH_BASE_PATH = "/auth";
const AUTH_LOGIN_PATH = "/auth/login";
/**
 * Provider callback of the website's OAuth client. It is an OAuth hop, not an
 * account page, so the gate renders the shared auth brick there instead of the
 * storefront; the IAM H5 auth brick mounts it at
 * `IAM_H5_AUTH_ROUTES.callbackPath`.
 */
const AUTH_OAUTH_CALLBACK_PATH = "/oauth/callback";
const DEFAULT_HOME_PATH = "/";

export function hasSdkworkMallPcAuthenticatedSession(
  snapshot: SdkworkMallPcSessionSnapshot,
): boolean {
  return hasSdkworkMallPcIamSession(snapshot);
}

export function buildSdkworkMallPcAuthLoginRedirect(location: Pick<Location, "pathname" | "search" | "hash">): string {
  const returnPath = `${normalizePathname(location.pathname)}${location.search ?? ""}${location.hash ?? ""}`;
  return `${AUTH_LOGIN_PATH}?redirect=${encodeURIComponent(returnPath)}`;
}

export function sanitizeSdkworkMallPcAuthRedirect(value: string | null | undefined): string {
  if (!value) {
    return DEFAULT_HOME_PATH;
  }

  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return DEFAULT_HOME_PATH;
  }

  if (!decoded.startsWith("/") || decoded.startsWith("//")) {
    return DEFAULT_HOME_PATH;
  }

  const redirectUrl = new URL(decoded, "http://sdkwork-commerce.local");
  if (isAuthRoute(redirectUrl.pathname)) {
    return DEFAULT_HOME_PATH;
  }

  return `${redirectUrl.pathname}${redirectUrl.search}${redirectUrl.hash}`;
}

export function resolveSdkworkMallPcAuthGateDecision({
  hasSession,
  homePath = DEFAULT_HOME_PATH,
  location,
}: {
  hasSession: boolean;
  homePath?: string;
  location: Pick<Location, "pathname" | "search" | "hash">;
}): SdkworkMallPcAuthGateDecision {
  const pathname = normalizePathname(location.pathname);
  if (isAuthRoute(pathname)) {
    if (!hasSession) {
      return { kind: "auth-route" };
    }

    const redirect = new URLSearchParams((location.search ?? "").replace(/^\?/u, "")).get("redirect");
    return {
      kind: "redirect",
      replace: true,
      to: sanitizeSdkworkMallPcAuthRedirect(redirect) || normalizePathname(homePath),
    };
  }

  // Storefront and other public routes stay reachable without a session.
  // Per-route auth enforcement lives in AppRoutes ProtectedRoute.
  return { kind: "product-route" };
}

function isAuthRoute(pathname: string): boolean {
  return pathname === AUTH_BASE_PATH
    || pathname.startsWith(`${AUTH_BASE_PATH}/`)
    || pathname === AUTH_OAUTH_CALLBACK_PATH;
}

function normalizePathname(pathname: string): string {
  const normalized = pathname.trim();
  if (!normalized) {
    return DEFAULT_HOME_PATH;
  }
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}
