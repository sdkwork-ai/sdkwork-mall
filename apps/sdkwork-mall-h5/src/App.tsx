import { BrowserRouter, useLocation } from "react-router-dom";
import { SdkworkAppErrorBoundary } from "@sdkwork/appbase-pc-react";
import { SdkworkSessionAuthBrowserRoot } from "@sdkwork/auth-pc-react";
import { SdkworkMallH5MobileShell } from "@sdkwork/mall-h5-shell";

import { AppRoutes } from "./routes/AppRoutes";
import { AuthGate } from "./AuthGate";
import { createSdkworkMallH5Runtime } from "./bootstrap/runtime";

const runtime = createSdkworkMallH5Runtime();

/** Route-level render-failure guard (FRONTEND_CODE_SPEC: error boundaries at
 * route/page level). Navigation resets the caught error via resetKeys. */
function MallErrorBoundary() {
  const location = useLocation();
  return (
    <SdkworkAppErrorBoundary
      labels={{
        description: "页面渲染出现问题，请重试或返回首页。",
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
      <SdkworkMallH5MobileShell runtime={runtime}>
        <AppRoutes runtime={runtime} />
      </SdkworkMallH5MobileShell>
    </SdkworkAppErrorBoundary>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <SdkworkSessionAuthBrowserRoot>
        <AuthGate runtime={runtime}>
          <MallErrorBoundary />
        </AuthGate>
      </SdkworkSessionAuthBrowserRoot>
    </BrowserRouter>
  );
}
