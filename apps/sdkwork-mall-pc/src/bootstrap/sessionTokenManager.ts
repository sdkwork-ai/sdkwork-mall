import { createTokenManager, type AuthTokenManager } from "@sdkwork/sdk-common";
import { readBootstrapAccessTokenFromProcessEnv } from "@sdkwork/iam-credential-entry";

import type { SdkworkMallPcSessionStore } from "./sessionStore";

export function createSdkworkMallPcSessionTokenManager(
  session: SdkworkMallPcSessionStore,
): AuthTokenManager {
  const tokenManager = createTokenManager();

  const hydrate = () => {
    const snapshot = session.getSnapshot();
    // Bootstrap Access-Token fallback (APP_SDK_INTEGRATION_SPEC section 4).
    // The generated SDK transports resolve `Access-Token` exclusively from
    // `getAccessToken()` and fail before dispatch when it is empty, so this
    // projection must fall back to the private credential-entry bootstrap
    // artifact whenever no interactive login session exists yet.
    tokenManager.setTokens({
      accessToken: snapshot.accessToken ?? readBootstrapAccessTokenFromProcessEnv(),
      authToken: snapshot.authToken,
      refreshToken: snapshot.refreshToken,
    });
  };

  hydrate();
  session.subscribe(() => {
    hydrate();
  });

  return tokenManager;
}
