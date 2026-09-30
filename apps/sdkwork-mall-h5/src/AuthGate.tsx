import { lazy, type ReactNode, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { SdkworkIamAuthRoutes } from "@sdkwork/auth-pc-react";

import {
  resolveSdkworkMallH5AuthAppearance,
  resolveSdkworkMallH5AuthLocale,
  resolveSdkworkMallH5AuthRuntimeConfig,
} from "./bootstrap/authConfig";
import type { SdkworkMallH5Runtime } from "./bootstrap/runtime";
import {
  hasSdkworkMallH5AuthenticatedSession,
  resolveSdkworkMallH5AuthGateDecision,
} from "./authGateLogic";

export interface AuthGateProps {
  children: ReactNode;
  runtime: SdkworkMallH5Runtime;
}

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

  if (decision.kind === "redirect") {
    return null;
  }

  if (decision.kind === "auth-route") {
    const authProps = {
      appearance: resolveSdkworkMallH5AuthAppearance(),
      basePath: "/auth",
      getRuntime: () => runtime.iamRuntime,
      homePath: "/",
      locale: resolveSdkworkMallH5AuthLocale(runtime.config.i18n.defaultLocale),
      runtimeConfig: resolveSdkworkMallH5AuthRuntimeConfig(),
      viewportMode: "flow" as const,
    };

    return <SdkworkIamAuthRoutes {...(authProps as unknown as Parameters<typeof SdkworkIamAuthRoutes>[0])} />;
  }

  return <>{children}</>;
}
