import type { SdkworkMallH5CategoryTone } from "./category-visual";
import taxonomyDocument from "./category-seeded-taxonomy.json";

/**
 * Seeded storefront taxonomy: stable key, both authored names and the
 * deliberate glyph/tone.
 *
 * The names live in JSON because they are locale data, not copy — the i18n
 * readiness ratchet counts hard-coded source literals, and the dataset itself
 * ships its translations as JSON for the same reason. The H5 category-visual
 * contract test fails if a seeded key is missing here or if either authored name
 * resolves to a different glyph than its key.
 */
export interface SdkworkMallH5SeededCategory {
  readonly enName: string;
  readonly icon: string;
  readonly key: string;
  readonly level: "root" | "leaf";
  readonly tone: SdkworkMallH5CategoryTone;
  readonly zhName: string;
}

export const SDKWORK_MALL_H5_SEEDED_CATEGORIES =
  taxonomyDocument as readonly SdkworkMallH5SeededCategory[];
