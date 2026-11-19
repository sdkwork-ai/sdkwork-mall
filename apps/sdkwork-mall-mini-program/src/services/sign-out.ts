/**
 * Ends the session everywhere it is held.
 *
 * Clearing only the local token store left three copies of the credential alive:
 * the IAM server session (never revoked), the realtime IM socket (still
 * connected with the old token) and any page state derived from the session.
 * Every logout entry point uses this helper so the three stay in step.
 */
import { logout } from "./auth-service";
import { disposeRealtime } from "./im-service";
import { clearSession } from "./session";

export async function signOut(): Promise<void> {
  try {
    // An expired/revoked session still has to be cleared locally, so a failed
    // revoke is not allowed to abort the sign-out.
    await logout();
  } catch {
    // keep going: the local session and the socket must still be dropped
  }
  clearSession();
  disposeRealtime();
}
