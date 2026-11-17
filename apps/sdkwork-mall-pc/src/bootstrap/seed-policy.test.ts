import { afterEach, describe, expect, it } from "vitest";

import { resolveSdkworkMallPcSeedPolicy } from "./default-data-remote";

function setRuntimeEnv(values: Record<string, string>): void {
  (globalThis as Record<string, unknown>).SDKWORK_RUNTIME_ENV = values;
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>).SDKWORK_RUNTIME_ENV;
});

describe("mall seed policy", () => {
  it("fills a standalone production install with the standard catalog", () => {
    setRuntimeEnv({ deploymentProfile: "standalone" });

    const policy = resolveSdkworkMallPcSeedPolicy("production");

    // A self-hosted install is an evaluation surface: it must not start as an
    // empty store just because its lifecycle environment is "production".
    expect(policy.profile).toBe("standard");
    expect(policy.automatic).toBe(true);
  });

  it("keeps cloud production on platform reference structure only", () => {
    setRuntimeEnv({ deploymentProfile: "cloud" });

    const policy = resolveSdkworkMallPcSeedPolicy("production");

    expect(policy.profile).toBe("minimal");
    expect(policy.automatic).toBe(false);
  });

  it("lets an explicit profile override the deployment default", () => {
    setRuntimeEnv({ deploymentProfile: "cloud", SDKWORK_MALL_SEED_PROFILE: "demo" });

    const policy = resolveSdkworkMallPcSeedPolicy("production");

    expect(policy.profile).toBe("demo");
    expect(policy.automatic).toBe(true);
  });

  it("can still opt a standalone install out of product seeding", () => {
    setRuntimeEnv({ deploymentProfile: "standalone", SDKWORK_MALL_SEED_PROFILE: "minimal" });

    const policy = resolveSdkworkMallPcSeedPolicy("production");

    expect(policy.profile).toBe("minimal");
    expect(policy.automatic).toBe(false);
  });

  it("falls back to the build-time deployment profile when the runtime document is absent", () => {
    // A cloud build must not be mistaken for a self-hosted install just because
    // the served runtime-env document is missing.
    expect(resolveSdkworkMallPcSeedPolicy("production", "cloud").profile).toBe("minimal");
    expect(resolveSdkworkMallPcSeedPolicy("production", "standalone").profile).toBe("standard");
  });

  it("honours an explicit automatic flag", () => {
    setRuntimeEnv({ deploymentProfile: "cloud", SDKWORK_MALL_AUTO_SEED: "1" });

    const policy = resolveSdkworkMallPcSeedPolicy("production");

    expect(policy.profile).toBe("minimal");
    expect(policy.automatic).toBe(true);
  });
});
