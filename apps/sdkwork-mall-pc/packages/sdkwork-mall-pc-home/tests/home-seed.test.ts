import { afterEach, describe, expect, it, vi } from "vitest";

import {
  claimMallHomeAutomaticSeed,
  configureMallHomeSeedProvider,
  getMallHomeSeedProfile,
  isMallHomeSeedAutomatic,
  isMallHomeSeedAvailable,
  isMallHomeSeedRefreshNeeded,
  resetMallHomeSeedState,
  runMallHomeSeed,
} from "../src/home-seed";

afterEach(() => {
  configureMallHomeSeedProvider(null);
  resetMallHomeSeedState();
  vi.restoreAllMocks();
});

describe("mall home seed provider", () => {
  it("reports unavailable when the runtime injected no port", async () => {
    expect(isMallHomeSeedAvailable()).toBe(false);
    expect(isMallHomeSeedAutomatic()).toBe(false);
    expect(getMallHomeSeedProfile()).toBeUndefined();
    expect(claimMallHomeAutomaticSeed()).toBe(false);

    const outcome = await runMallHomeSeed();

    expect(outcome.state).toBe("unavailable");
    expect(outcome.created).toBe(0);
  });

  it("allows exactly one automatic claim per page lifetime", () => {
    configureMallHomeSeedProvider({
      automatic: true,
      profile: "demo",
      run: () => Promise.resolve({ created: 3, state: "succeeded" }),
    });

    expect(claimMallHomeAutomaticSeed()).toBe(true);
    expect(claimMallHomeAutomaticSeed()).toBe(false);
  });

  it("never claims automatically when the runtime policy forbids it", () => {
    configureMallHomeSeedProvider({
      automatic: false,
      profile: "minimal",
      run: () => Promise.resolve({ created: 0, state: "succeeded" }),
    });

    expect(claimMallHomeAutomaticSeed()).toBe(false);
    expect(getMallHomeSeedProfile()).toBe("minimal");
  });

  it("reports whether a dataset revision still needs topping up", () => {
    expect(isMallHomeSeedRefreshNeeded()).toBe(false);

    configureMallHomeSeedProvider({
      automatic: true,
      needsRefresh: () => true,
      profile: "standard",
      run: () => Promise.resolve({ created: 0, state: "succeeded" }),
    });

    expect(isMallHomeSeedRefreshNeeded()).toBe(true);
  });

  it("deduplicates concurrent seeding runs", async () => {
    const run = vi.fn(() => Promise.resolve({ created: 7, state: "succeeded" as const }));
    configureMallHomeSeedProvider({ automatic: false, profile: "demo", run });

    const [first, second] = await Promise.all([runMallHomeSeed(), runMallHomeSeed()]);

    expect(run).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
    expect(first).toMatchObject({ created: 7, state: "succeeded" });
  });

  it("forwards an explicit profile override to the provider", async () => {
    const run = vi.fn(() => Promise.resolve({ created: 2, state: "succeeded" as const }));
    configureMallHomeSeedProvider({ automatic: false, profile: "minimal", run });

    await runMallHomeSeed({ profile: "demo" });

    expect(run).toHaveBeenCalledWith({ profile: "demo" });
  });

  it("turns a thrown provisioning failure into a typed outcome", async () => {
    configureMallHomeSeedProvider({
      automatic: false,
      profile: "demo",
      run: () => Promise.reject(new Error("商品与 SKU：403 forbidden")),
    });

    const outcome = await runMallHomeSeed();

    expect(outcome.state).toBe("failed");
    expect(outcome.message).toContain("403 forbidden");
  });
});
