/**
 * Cross-bundle shared-state keys.
 *
 * The published package is bundled per entry (app + every page), so module-level
 * variables are not shared between entries. Runtime, host profile, IM services and
 * the launch bootstrap live in the shared cross-bundle store under these keys.
 */
export const MP_RUNTIME_SHARED_KEY = "__SDKWORK_MALL_MP_RUNTIME__";
export const MP_RUNTIME_BOOTSTRAP_SHARED_KEY = "__SDKWORK_MALL_MP_RUNTIME_BOOTSTRAP__";
export const MP_HOST_SHARED_KEY = "__SDKWORK_MALL_MP_HOST__";
export const MP_IM_SERVICES_SHARED_KEY = "__SDKWORK_MALL_MP_IM_SERVICES__";
