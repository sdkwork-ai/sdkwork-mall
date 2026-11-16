/**
 * Composition manifest for the SDKWork Mall mini program.
 *
 * Authority: `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` sections 5-7 and
 * `APP_COMPOSITION_SPEC.md`. This describes the runtime graph one launch
 * assembles: which environment document feeds it, which generated SDK families
 * it may call, which host profile satisfies the platform boundary, and which
 * capability modules contribute routes. The composition checks and the app
 * bootstrap read the same manifest, so a capability added to the registry cannot
 * silently miss its SDK family or its host capability.
 */
import type { MpHostCapability } from "@sdkwork/mall-mp-host";

import { MALL_MP_MODULES, type MallMpModuleDescriptor } from "../modules";
import type { MallMpRuntimeEnvironment } from "../runtime";

/** Generated SDK families this app is allowed to construct. */
export interface MallMpSdkFamilyDescriptor {
  readonly packageName: string;
  readonly surface: "app-api";
  /** Why the family is part of the graph; recorded for the composition audit. */
  readonly usedFor: string;
}

export const MALL_MP_SDK_FAMILIES: readonly MallMpSdkFamilyDescriptor[] = [
  {
    packageName: "@sdkwork/iam-app-sdk",
    surface: "app-api",
    usedFor: "WeChat mini-program session exchange, current-session validation and logout",
  },
  {
    packageName: "@sdkwork/im-app-sdk",
    surface: "app-api",
    usedFor: "IM notification centre (the messaging capability's notification plane)",
  },
];

/** Host capabilities the runtime graph cannot launch without. */
export const MALL_MP_REQUIRED_HOST_CAPABILITIES: readonly MpHostCapability[] = [
  "platformLogin",
  "secureStorage",
];

export interface MallMpComposition {
  readonly modules: readonly MallMpModuleDescriptor[];
  readonly requiredHostCapabilities: readonly MpHostCapability[];
  readonly requiredRuntimeEnvKeys: readonly (keyof MallMpRuntimeEnvironment)[];
  readonly sdkFamilies: readonly MallMpSdkFamilyDescriptor[];
}

export const MALL_MP_COMPOSITION: MallMpComposition = {
  modules: MALL_MP_MODULES,
  requiredHostCapabilities: MALL_MP_REQUIRED_HOST_CAPABILITIES,
  requiredRuntimeEnvKeys: ["appApiBaseUrl", "deploymentProfile", "environment", "profileId"],
  sdkFamilies: MALL_MP_SDK_FAMILIES,
};

/** Issues that make a launch impossible; empty means the graph is coherent. */
export function validateMallMpComposition(
  environment: MallMpRuntimeEnvironment,
  hostCapabilities: Iterable<MpHostCapability>,
): string[] {
  const issues: string[] = [];
  for (const key of MALL_MP_COMPOSITION.requiredRuntimeEnvKeys) {
    if (!String(environment[key] ?? "").trim()) {
      issues.push(`runtime environment is missing ${key}`);
    }
  }
  const installed = new Set(hostCapabilities);
  for (const capability of MALL_MP_COMPOSITION.requiredHostCapabilities) {
    if (!installed.has(capability)) {
      issues.push(`host profile does not implement required capability ${capability}`);
    }
  }
  if (MALL_MP_COMPOSITION.modules.length === 0) {
    issues.push("module registry is empty");
  }
  return issues;
}
