/**
 * Module registry for the SDKWork Mall mini program.
 *
 * Authority: `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` section 3 (a core package
 * owns the composition surface). The registry is descriptive, not a container:
 * it records which SDKWork packages this app composes and in which role, so the
 * composition checks and the devtools diagnostics agree on one inventory instead
 * of each rediscovering it from the filesystem.
 */
export type MallMpModuleRole = "capability" | "commons" | "core" | "host" | "shell";

export interface MallMpModuleDescriptor {
  /** Reserved capability id the module contributes (`buyer.mall.im.chats`, ...). */
  readonly capabilities?: readonly string[];
  /** Workspace package name. */
  readonly packageName: string;
  readonly role: MallMpModuleRole;
  /** Domain the module owns; absent for domain-neutral modules. */
  readonly domain?: string;
}

export const MALL_MP_MODULES: readonly MallMpModuleDescriptor[] = [
  { packageName: "@sdkwork/mall-mp-core", role: "core" },
  { packageName: "@sdkwork/mall-mp-commons", role: "commons" },
  { packageName: "@sdkwork/mall-mp-host", role: "host" },
  {
    packageName: "@sdkwork/mall-mp-auth",
    role: "capability",
    domain: "account",
    capabilities: ["account.mall.login"],
  },
  {
    packageName: "@sdkwork/mall-mp-im",
    role: "capability",
    domain: "im",
    capabilities: ["buyer.mall.messages", "buyer.mall.im.chats", "buyer.mall.im.chat", "buyer.mall.im.notices"],
  },
];

/** Capability ids contributed by capability modules, in registry order. */
export function listMallMpCapabilities(): readonly string[] {
  return MALL_MP_MODULES.flatMap((module) => module.capabilities ?? []);
}

/** Modules of one role; used by composition checks and diagnostics. */
export function listMallMpModulesByRole(role: MallMpModuleRole): readonly MallMpModuleDescriptor[] {
  return MALL_MP_MODULES.filter((module) => module.role === role);
}
