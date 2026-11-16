import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  SdkworkIamH5AuthRoutes,
  createSdkworkIamH5AuthController,
} from "@sdkwork/iam-h5-auth";

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
 * Routes unauthenticated visitors through the IAM H5 auth brick.
 *
 * The login/register/recovery screens, the verification-code and OAuth flows
 * and the session controller are owned by `@sdkwork/iam-h5-auth`; this gate only
 * decides *when* to mount them and hands control back to the app as soon as the
 * shared session store reports an authenticated session. No mall package
 * implements an auth screen or appearance config
 * (`APP_H5_ARCHITECTURE_SPEC` §7, `APP_MOBILE_REACT_UI_SPEC` §4).
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

  // One controller per runtime: it holds the auth state machine and talks to the
  // injected IAM service, so rebuilding it per render would drop in-flight flows.
  const controller = useMemo(
    () => createSdkworkIamH5AuthController({ service: runtime.iamRuntime.iamService }),
    [runtime.iamRuntime],
  );

  if (decision.kind === "redirect") {
    return null;
  }

  if (decision.kind === "auth-route") {
    return (
      <SdkworkIamH5AuthRoutes
        controller={controller}
        locale={runtime.config.i18n.defaultLocale}
        onBack={() => navigate("/", { replace: true })}
      />
    );
  }

  return <>{children}</>;
}
