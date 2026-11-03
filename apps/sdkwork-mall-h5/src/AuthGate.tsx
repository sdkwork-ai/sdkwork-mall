import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  SdkworkIamAuthRoutes,
  type SdkworkIamAuthRoutesProps,
} from "@sdkwork/auth-pc-react";

import {
  resolveSdkworkMallH5AuthLocale,
  resolveSdkworkMallH5AuthRuntimeConfig,
} from "./bootstrap/authConfig";
import { createSdkworkMallH5AuthAppearance } from "./bootstrap/authAppearance";
import type { SdkworkMallH5Runtime } from "./bootstrap/runtime";
import {
  hasSdkworkMallH5AuthenticatedSession,
  resolveSdkworkMallH5AuthGateDecision,
} from "./authGateLogic";

export interface AuthGateProps {
  children: ReactNode;
  runtime: SdkworkMallH5Runtime;
}

/**
 * Routes unauthenticated visitors through the IAM login/register/recovery
 * surface.
 *
 * The auth screens replace the storefront shell (no tab bar), so this gate owns
 * the whole viewport on `/auth/*` and hands control back to the app as soon as
 * the session store reports an authenticated session.
 */
export function AuthGate({ children, runtime }: AuthGateProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState(() => runtime.session.getSnapshot());

  useEffect(() => runtime.session.subscribe(setSnapshot), [runtime.session]);

  const decision = useMemo(
    () =>
      resolveSdkworkMallH5AuthGateDecision({
        hasSession: hasSdkworkMallH5AuthenticatedSession(snapshot),
        homePath: "/",
        location,
      }),
    [location, snapshot],
  );

  useEffect(() => {
    if (decision.kind !== "redirect") {
      return;
    }
    navigate(decision.to, { replace: true });
  }, [decision, navigate]);

  const authProps = useMemo<SdkworkIamAuthRoutesProps>(
    () => ({
      appearance: createSdkworkMallH5AuthAppearance(),
      basePath: "/auth",
      getRuntime: () => runtime.iamRuntime,
      homePath: "/",
      locale: resolveSdkworkMallH5AuthLocale(runtime.config.i18n.defaultLocale),
      runtimeConfig: resolveSdkworkMallH5AuthRuntimeConfig(),
      viewportMode: "flow",
    }),
    [runtime.config.i18n.defaultLocale, runtime.iamRuntime],
  );

  if (decision.kind === "redirect") {
    return null;
  }

  if (decision.kind === "auth-route") {
    return <SdkworkIamAuthRoutes {...authProps} />;
  }

  return <>{children}</>;
}
