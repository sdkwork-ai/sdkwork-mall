/**
 * Session and token context for the SDKWork Mall mini program.
 *
 * Authority: `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` section 7 and
 * `IAM_LOGIN_INTEGRATION_SPEC.md` section 5. Authentication belongs to
 * `sdkwork-iam`: the reusable WeChat mini-program session module lives in
 * `@sdkwork/iam-mp-core/session-wechat` and owns the persisted dual-token store,
 * the token-manager twin and the exchange/revalidation lifecycle. This module is
 * the mall-side adapter over it, so the app has one session implementation and
 * no IAM copy of its own.
 *
 * `MpStorage` satisfies the IAM module's key/value contract structurally, so the
 * host profile is the only thing the app injects.
 */
import {
  IAM_MP_WECHAT_SESSION_STORAGE_KEY,
  createIamMpWechatSessionStore,
  createIamMpWechatTokenManager,
  isIamMpWechatSessionComplete,
  type IamMpWechatSession,
  type IamMpWechatSessionStore,
  type IamMpWechatTokenManager,
} from "@sdkwork/iam-mp-core/session-wechat";
import type { MpStorage } from "@sdkwork/mall-mp-host";

export {
  IAM_MP_WECHAT_DEVICE_STORAGE_KEY,
  IAM_MP_WECHAT_PROVIDER_CODE,
  IAM_MP_WECHAT_SESSION_STORAGE_KEY,
  createIamMpWechatSessionManager,
  createIamMpWechatSessionStore,
  createIamMpWechatTokenManager,
  extractIamMpWechatSessionPayload,
  type IamMpKeyValueStorage,
  type IamMpWechatSession,
  type IamMpWechatSessionClient,
  type IamMpWechatSessionManager,
  type IamMpWechatSessionReason,
  type IamMpWechatSessionRestoreResult,
  type IamMpWechatSessionStore,
  type IamMpWechatTokenManager,
} from "@sdkwork/iam-mp-core/session-wechat";

/** Persisted session key owned by the IAM module. */
export const MP_SESSION_STORAGE_KEY = IAM_MP_WECHAT_SESSION_STORAGE_KEY;

/** Mall view of the IAM session snapshot. */
export type MpSessionSnapshot = IamMpWechatSession;
export type MpSessionStore = IamMpWechatSessionStore;
export type MpTokenManager = IamMpWechatTokenManager;

/**
 * Creates the one session store over platform storage.
 *
 * @param storage - Host storage adapter (wx storage in production).
 */
export function createMpSessionStore(storage: MpStorage): MpSessionStore {
  return createIamMpWechatSessionStore(storage);
}

/** Token manager handed to generated app SDKs; reads the same store. */
export function createMpSessionTokenManager(store: MpSessionStore): MpTokenManager {
  return createIamMpWechatTokenManager(store);
}

/** True when both credentials are present (what the gateway needs). */
export function isMpSessionComplete(snapshot: MpSessionSnapshot | null | undefined): snapshot is MpSessionSnapshot {
  return isIamMpWechatSessionComplete(snapshot);
}
