import { BrowserRouter } from "react-router-dom";
import { SdkworkSessionAuthBrowserRoot } from "@sdkwork/auth-pc-react";
import { SdkworkMallH5MobileShell } from "@sdkwork/mall-h5-shell";

import { AppRoutes } from "./routes/AppRoutes";
import { AuthGate } from "./AuthGate";
import { createSdkworkMallH5Runtime } from "./bootstrap/runtime";

const runtime = createSdkworkMallH5Runtime();

export function App() {
  return (
    <BrowserRouter>
      <SdkworkSessionAuthBrowserRoot>
        <AuthGate runtime={runtime}>
          <SdkworkMallH5MobileShell runtime={runtime}>
            <AppRoutes runtime={runtime} />
          </SdkworkMallH5MobileShell>
        </AuthGate>
      </SdkworkSessionAuthBrowserRoot>
    </BrowserRouter>
  );
}
