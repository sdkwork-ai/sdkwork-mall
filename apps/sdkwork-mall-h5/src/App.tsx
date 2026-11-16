import { useEffect } from "react";
import { BrowserRouter, useLocation } from "react-router-dom";
import { SdkworkAppErrorBoundary } from "@sdkwork/appbase-pc-react";
import { SdkworkMallH5MobileShell } from "@sdkwork/mall-h5-shell";

import { AppRoutes } from "./routes/AppRoutes";
import { AuthGate } from "./AuthGate";
import { getSdkworkH5PartnerService } from "@sdkwork/mall-h5-partner";
import { registerShareAttributionResolver } from "@sdkwork/mall-h5-commons/share-attribution";

import { createSdkworkMallH5Runtime } from "./bootstrap/runtime";

const runtime = createSdkworkMallH5Runtime();

// Product/promo shares from the storefront carry the distributor's invite code.
registerShareAttributionResolver(async () => {
  try {
    return await getSdkworkH5PartnerService().resolveOwnInviteCode();
  } catch {
    return "";
  }
});

/** Persisted invite code so a signed-out visitor keeps the attribution. */
const PENDING_INVITE_KEY = "sdkwork-mall-h5-pending-invite";

/**
 * Distribution attribution for shared links: a product/distribution URL carries
 * `?invite=<code>`. Store it before the auth gate can redirect, and bind as soon
 * as an authenticated session renders (idempotent server-side).
 */
function PendingInviteCapture() {
  const location = useLocation();
  useEffect(() => {
    const invite = new URLSearchParams(location.search).get("invite")?.trim();
    if (!invite) {
      return;
    }
    try {
      window.sessionStorage.setItem(PENDING_INVITE_KEY, invite);
    } catch {
      // Storage unavailable (private mode): the next visit retries.
    }
  }, [location.search]);
  return null;
}

function PendingInviteFlush() {
  useEffect(() => {
    let invite = "";
    try {
      invite = window.sessionStorage.getItem(PENDING_INVITE_KEY) ?? "";
    } catch {
      return;
    }
    if (!invite) {
      return;
    }
    try {
      void getSdkworkH5PartnerService()
        .bindCustomerByInviteCode(invite)
        .then(() => {
          try {
            window.sessionStorage.removeItem(PENDING_INVITE_KEY);
          } catch {
            // Already bound; the leftover code only triggers an idempotent retry.
          }
        })
        .catch(() => {
          // Keep the code for the next authenticated visit.
        });
    } catch {
      // Partner provider not configured yet.
    }
  }, []);
  return null;
}

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
      <PendingInviteCapture />
      <AuthGate runtime={runtime}>
        <PendingInviteFlush />
        <MallErrorBoundary />
      </AuthGate>
    </BrowserRouter>
  );
}
