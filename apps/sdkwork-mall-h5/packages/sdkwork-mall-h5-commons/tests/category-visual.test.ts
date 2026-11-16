import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  resolveSdkworkMallH5CategoryVisual,
  SDKWORK_MALL_H5_CATEGORY_VISUAL_KEYS,
  type SdkworkMallH5CategoryTone,
} from "../src/category-visual";

/**
 * Category icons are client-derived: the commerce category API carries no icon
 * column (`CreateCategoryRequest` is a closed categoryNo/parentId/name/sortOrder
 * body). That makes the mapping a contract with the initialized dataset: every
 * category an environment seeds must resolve to a deliberate glyph, and the
 * same category must resolve identically from its key, its wire code and both
 * authored locales. Otherwise a fresh install renders generic/undefined tiles
 * and the icon changes the moment the API stops returning `categoryNo`.
 */

const DATASET_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../../apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-admin-product/src/default-data/dataset",
);

interface SeededZhCategory {
  readonly children: ReadonlyArray<{ readonly key: string; readonly name: string }>;
  readonly key: string;
  readonly name: string;
}

interface SeededPair {
  readonly enName: string;
  readonly key: string;
  readonly zhName: string;
}

function readSeededPairs(): SeededPair[] {
  const zh = JSON.parse(
    readFileSync(path.join(DATASET_DIR, "mall-default-data.zh-CN.json"), "utf8"),
  ) as { categories: readonly SeededZhCategory[] };
  const en = JSON.parse(
    readFileSync(path.join(DATASET_DIR, "mall-default-data.en-US.json"), "utf8"),
  ) as { categories: Readonly<Record<string, string>> };

  const pairs: SeededPair[] = [];
  for (const root of zh.categories) {
    pairs.push({ enName: en.categories[root.key], key: root.key, zhName: root.name });
    for (const child of root.children) {
      pairs.push({ enName: en.categories[child.key], key: child.key, zhName: child.name });
    }
  }
  return pairs;
}

const SEEDED_PAIRS = readSeededPairs();

const TONES: readonly SdkworkMallH5CategoryTone[] = [
  "amber",
  "blue",
  "cyan",
  "emerald",
  "indigo",
  "rose",
  "slate",
  "teal",
  "violet",
];

describe("storefront category visuals", () => {
  it("covers every category the default dataset initializes", () => {
    expect(SEEDED_PAIRS.length).toBeGreaterThan(0);

    const unmapped = SEEDED_PAIRS
      .filter((pair) => !SDKWORK_MALL_H5_CATEGORY_VISUAL_KEYS.includes(pair.key))
      .map((pair) => pair.key);

    expect(unmapped).toEqual([]);
  });

  it("resolves the seeded key, wire code, zh-CN name and en-US name to one glyph", () => {
    const mismatched: Array<Record<string, string>> = [];

    for (const pair of SEEDED_PAIRS) {
      const byKey = resolveSdkworkMallH5CategoryVisual({ key: pair.key });
      const byCode = resolveSdkworkMallH5CategoryVisual({
        code: `MALL-CAT-${pair.key.toUpperCase()}`,
      });
      const byZhName = resolveSdkworkMallH5CategoryVisual({ name: pair.zhName });
      const byEnName = resolveSdkworkMallH5CategoryVisual({ name: pair.enName });

      if (
        byCode.icon !== byKey.icon ||
        byZhName.icon !== byKey.icon ||
        byEnName.icon !== byKey.icon ||
        byCode.tone !== byKey.tone ||
        byZhName.tone !== byKey.tone ||
        byEnName.tone !== byKey.tone
      ) {
        mismatched.push({
          enName: pair.enName,
          key: pair.key,
          zhName: pair.zhName,
        });
      }
    }

    expect(mismatched).toEqual([]);
  });

  it("keeps a stable visual for a category no rule knows", () => {
    const first = resolveSdkworkMallH5CategoryVisual({ key: "tenant-custom", name: "自定义类目" });
    const second = resolveSdkworkMallH5CategoryVisual({ key: "tenant-custom", name: "自定义类目" });

    expect(first.icon).toBeDefined();
    expect(first.tone).toBe(second.tone);
    expect(first.icon).toBe(second.icon);
    expect(TONES).toContain(first.tone);
  });

  it("matches on the code before the localized name", () => {
    // A renamed category keeps its glyph because the code still resolves.
    const byCode = resolveSdkworkMallH5CategoryVisual({
      code: "MALL-CAT-APPLIANCE",
      name: "New Seasonal Name",
    });
    const byKey = resolveSdkworkMallH5CategoryVisual({ key: "appliance" });

    expect(byCode.icon).toBe(byKey.icon);
    expect(byCode.tone).toBe(byKey.tone);
  });
});
