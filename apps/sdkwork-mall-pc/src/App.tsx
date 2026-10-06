import { BrowserRouter, HashRouter, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { SdkworkAppErrorBoundary } from "@sdkwork/appbase-pc-react";
import { SdkworkSessionAuthBrowserRoot } from "@sdkwork/auth-pc-react";
import { SdkworkMallPcSurfaceShell } from "@sdkwork/mall-pc-shell";

import { AppRoutes } from "./AppRoutes";
import { AuthGate } from "./AuthGate";
import { hasSdkworkMallPcAuthenticatedSession } from "./authGateLogic";
import { createSdkworkMallPcRuntime } from "./bootstrap/runtime";

const runtime = createSdkworkMallPcRuntime();

/**
 * Tauri webview ?? tauri:// �?https://tauri.localhost ????????�?
 * BrowserRouter ??????�?404??�?Tauri ?????? HashRouter�?
 * ?????? Tauri ????????????????�?
 */
function detectTauriEnvironment(): boolean {
  if (typeof window === "undefined") return false;
  const protocol = window.location.protocol;
  return (
    protocol === "tauri:" ||
    (protocol === "https:" && window.location.hostname === "tauri.localhost") ||
    Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__)
  );
}

const IS_TAURI_ENVIRONMENT = detectTauriEnvironment();

function MallLayout() {
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(() =>
    hasSdkworkMallPcAuthenticatedSession(runtime.session.getSnapshot()),
  );

  useEffect(() => runtime.session.subscribe((snapshot) => {
    setIsAuthenticated(hasSdkworkMallPcAuthenticatedSession(snapshot));
  }), []);

  const shell = useMemo(() => (
    <SdkworkMallPcSurfaceShell
      isAuthenticated={isAuthenticated}
      pathname={location.pathname}
      runtime={runtime}
    >
      <AppRoutes runtime={runtime} />
    </SdkworkMallPcSurfaceShell>
  ), [isAuthenticated, location.pathname]);

  return shell;
}

/** Route-level render-failure guard (FRONTEND_CODE_SPEC: error boundaries at
 * route/page level). Navigation resets the caught error via resetKeys. */
function MallErrorBoundary() {
  const location = useLocation();
  return (
    <SdkworkAppErrorBoundary
      labels={{
        description: "页面渲染出现问题，已为您保留工作区。",
        home: "返回首页",
        retry: "重试",
        title: "页面出错了",
      }}
      onGoHome={() => {
        window.location.assign("/");
      }}
      onRetry={() => {
        window.location.reload();
      }}
      resetKeys={[location.pathname]}
      variant="page"
    >
      <MallLayout />
    </SdkworkAppErrorBoundary>
  );
}

export function App() {
  const Router = IS_TAURI_ENVIRONMENT ? HashRouter : BrowserRouter;
  return (
    <Router>
      <SdkworkSessionAuthBrowserRoot>
        <AuthGate runtime={runtime}>
          <MallErrorBoundary />
        </AuthGate>
      </SdkworkSessionAuthBrowserRoot>
    </Router>
  );
}
