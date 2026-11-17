import {
  Apple,
  Baby,
  BatteryCharging,
  Beef,
  Bike,
  Bone,
  BookOpen,
  Boxes,
  Cable,
  Cake,
  Camera,
  Car,
  Carrot,
  Cog,
  Coffee,
  Cookie,
  CookingPot,
  Cross,
  Drill,
  Droplets,
  Dumbbell,
  Flower2,
  Footprints,
  Gamepad2,
  Gem,
  Gift,
  Glasses,
  Guitar,
  HardHat,
  Headphones,
  HeartPulse,
  Keyboard,
  Lamp,
  Laptop,
  LayoutGrid,
  Mic,
  Milk,
  Monitor,
  Music,
  Package,
  Palette,
  PawPrint,
  Piano,
  Pill,
  Plane,
  Plug,
  Printer,
  Puzzle,
  Refrigerator,
  Ruler,
  Shirt,
  Shovel,
  ShoppingBag,
  ShowerHead,
  Shapes,
  Smartphone,
  Sofa,
  Sparkles,
  Speaker,
  Sprout,
  Tablet,
  Tag,
  Tent,
  Trophy,
  Tv,
  Utensils,
  WashingMachine,
  Watch,
  Wheat,
  Wind,
  Wine,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { SDKWORK_MALL_H5_SEEDED_CATEGORIES } from "./category-seeded-taxonomy";

/**
 * Storefront category presentation.
 *
 * The commerce category API carries no icon column (`CreateCategoryRequest`
 * is a closed body of categoryNo/parentId/name/sortOrder), so every client has
 * to derive the glyph. Deriving it from the array index — what the home grid
 * used to do — means the same category changes icon whenever the server order
 * changes and a beauty category can end up with a coffee cup.
 *
 * Resolution order:
 * 1. the stable category key (`MALL-CAT-DIGITAL` → `digital`), which is what
 *    the default dataset seeds and what survives name localization;
 * 2. the localized name, matched by explicit keyword rules for the default
 *    dataset's first- and second-level taxonomy (zh-CN + en-US);
 * 3. a generic keyword rule for common commerce categories a tenant adds;
 * 4. a deterministic fallback so a category never renders without an icon.
 */

/** Accent used by the tinted icon tile that fronts a category. */
export type SdkworkMallH5CategoryTone =
  | "amber"
  | "blue"
  | "cyan"
  | "emerald"
  | "indigo"
  | "rose"
  | "slate"
  | "teal"
  | "violet";

export interface SdkworkMallH5CategoryVisual {
  readonly icon: LucideIcon;
  readonly tone: SdkworkMallH5CategoryTone;
}

export interface SdkworkMallH5CategoryInput {
  /** Stable category code from the API, for example `MALL-CAT-DIGITAL`. */
  readonly code?: string | null;
  /** Seed key or code fragment, for example `digital`. */
  readonly key?: string | null;
  /** Localized display name. */
  readonly name?: string | null;
}

interface SdkworkMallH5CategoryRule extends SdkworkMallH5CategoryVisual {
  readonly keys: readonly string[];
  readonly namePattern: RegExp;
}

/** First-level taxonomy of the seeded dataset; matched before any child rule. */
const ROOT_RULES: readonly SdkworkMallH5CategoryRule[] = [
  {
    icon: Smartphone,
    keys: ["digital", "electronics", "phone-digital"],
    namePattern: /数码|digital/iu,
    tone: "blue",
  },
  {
    icon: Laptop,
    keys: ["computer", "computers", "office"],
    namePattern: /电脑办公|computer/iu,
    tone: "indigo",
  },
  {
    icon: WashingMachine,
    keys: ["appliance", "appliances", "home-appliance"],
    // Deliberately not a bare `appliance`: "Kitchen Appliances" is a
    // second-level category and must reach its own cooking rule.
    namePattern: /家用电器|家电|home appliance/iu,
    tone: "teal",
  },
  {
    icon: Shirt,
    keys: ["fashion", "apparel", "clothing"],
    namePattern: /服饰|鞋包|fashion|apparel/iu,
    tone: "cyan",
  },
  {
    icon: Sparkles,
    keys: ["beauty", "personal-care", "cosmetics"],
    namePattern: /美妆|个护|beauty/iu,
    tone: "rose",
  },
  {
    icon: Carrot,
    keys: ["grocery", "fresh", "food"],
    namePattern: /食品|生鲜|grocery/iu,
    tone: "emerald",
  },
  {
    icon: Dumbbell,
    keys: ["sports", "sport"],
    namePattern: /运动户外|sports/iu,
    tone: "amber",
  },
  {
    icon: Baby,
    keys: ["baby", "kids", "maternal"],
    namePattern: /母婴|baby/iu,
    tone: "violet",
  },
];

/** Second-level taxonomy of the seeded dataset. Runs before generic rules. */
const CHILD_RULES: readonly SdkworkMallH5CategoryRule[] = [
  {
    icon: Smartphone,
    keys: ["phone", "phones", "smartphone"],
    namePattern: /智能手机|手机|smartphone|smart phone/iu,
    tone: "blue",
  },
  {
    icon: Tablet,
    keys: ["tablet", "tablets", "pad"],
    namePattern: /平板|tablet/iu,
    tone: "blue",
  },
  {
    icon: Watch,
    keys: ["wearable", "wearables", "smartwatch"],
    namePattern: /穿戴|智能手表|wearable/iu,
    tone: "blue",
  },
  {
    icon: Headphones,
    keys: ["audio", "headphone", "speaker"],
    namePattern: /耳机|音箱|音频|audio|headphone|speaker/iu,
    tone: "blue",
  },
  {
    icon: Laptop,
    keys: ["laptop", "laptops", "notebook"],
    namePattern: /笔记本|laptop|notebook/iu,
    tone: "indigo",
  },
  {
    icon: Monitor,
    keys: ["monitor", "monitors", "display"],
    namePattern: /显示器|monitor/iu,
    tone: "indigo",
  },
  {
    icon: Keyboard,
    keys: ["peripheral", "peripherals", "keyboard", "mouse"],
    namePattern: /键鼠|外设|keyboard|mouse|peripheral/iu,
    tone: "indigo",
  },
  {
    icon: Tv,
    keys: ["tv", "television"],
    namePattern: /电视|television|\btv\b/iu,
    tone: "teal",
  },
  {
    icon: Refrigerator,
    keys: ["refrigerator", "fridge"],
    namePattern: /冰箱|fridge|refrigerator/iu,
    tone: "teal",
  },
  {
    icon: WashingMachine,
    keys: ["washer", "washing-machine"],
    namePattern: /洗衣机|washer|washing machine/iu,
    tone: "teal",
  },
  {
    icon: CookingPot,
    keys: ["kitchen", "kitchen-appliance"],
    namePattern: /厨房|cooker|microwave|oven|kitchen/iu,
    tone: "teal",
  },
  {
    icon: Shirt,
    keys: ["menswear", "men"],
    // `\b` keeps "Womenswear" (which contains "menswear") out of this rule.
    namePattern: /\bmenswear\b|男装|men'?s wear/iu,
    tone: "cyan",
  },
  {
    icon: Shirt,
    keys: ["womenswear", "women"],
    namePattern: /\bwomenswear\b|女装|women'?s wear/iu,
    tone: "cyan",
  },
  {
    icon: Footprints,
    keys: ["sneakers", "shoes"],
    namePattern: /运动鞋|球鞋|sneaker|shoe/iu,
    tone: "cyan",
  },
  {
    icon: ShoppingBag,
    keys: ["bag", "bags", "luggage"],
    namePattern: /箱包|背包|bag|luggage/iu,
    tone: "cyan",
  },
  {
    icon: Droplets,
    keys: ["skincare"],
    namePattern: /护肤|skincare|skin care/iu,
    tone: "rose",
  },
  {
    icon: Palette,
    keys: ["makeup"],
    namePattern: /彩妆|makeup|cosmetic/iu,
    tone: "rose",
  },
  {
    icon: ShowerHead,
    keys: ["haircare", "hair-care"],
    namePattern: /洗护|haircare|hair care/iu,
    tone: "rose",
  },
  {
    icon: Wheat,
    keys: ["grain", "rice-oil"],
    namePattern: /粮油|调味|大米|grain|rice|oil|seasoning/iu,
    tone: "emerald",
  },
  {
    icon: Cookie,
    keys: ["snacks"],
    namePattern: /零食|snack/iu,
    tone: "emerald",
  },
  {
    icon: Apple,
    keys: ["fruit"],
    namePattern: /水果|fruit/iu,
    tone: "emerald",
  },
  {
    icon: Dumbbell,
    keys: ["fitness"],
    namePattern: /健身|fitness|gym/iu,
    tone: "amber",
  },
  {
    icon: Tent,
    keys: ["outdoor", "camping"],
    namePattern: /户外|outdoor|camping|hiking/iu,
    tone: "amber",
  },
  {
    icon: Milk,
    keys: ["formula", "baby-food"],
    namePattern: /奶粉|辅食|formula|baby food/iu,
    tone: "violet",
  },
  {
    icon: Puzzle,
    keys: ["toys"],
    namePattern: /玩具|toys?\b|puzzle/iu,
    tone: "violet",
  },
];

/** Categories a tenant may add that the seeded taxonomy does not cover. */
const GENERIC_RULES: readonly SdkworkMallH5CategoryRule[] = [
  {
    icon: BookOpen,
    keys: ["books", "book", "stationery", "media"],
    namePattern: /图书|书籍|文具|book/iu,
    tone: "amber",
  },
  {
    icon: Car,
    keys: ["auto", "car", "vehicle"],
    namePattern: /汽车|车品|autos?|cars?\b/iu,
    tone: "slate",
  },
  {
    icon: PawPrint,
    keys: ["pet", "pets"],
    namePattern: /宠物|pet/iu,
    tone: "amber",
  },
  {
    icon: Gem,
    keys: ["jewelry", "jewellery", "luxury"],
    namePattern: /珠宝|饰品|jewel/iu,
    tone: "rose",
  },
  {
    icon: Sofa,
    keys: ["home", "furniture", "home-living"],
    namePattern: /家居|家具|home|furniture/iu,
    tone: "teal",
  },
  {
    icon: HeartPulse,
    keys: ["health", "pharmacy", "medicine"],
    namePattern: /健康|医药|保健|health|pharmacy/iu,
    tone: "emerald",
  },
  {
    icon: Gamepad2,
    keys: ["game", "games", "gaming"],
    namePattern: /游戏|game/iu,
    tone: "violet",
  },
  {
    icon: Camera,
    keys: ["camera", "photography"],
    namePattern: /相机|摄影|camera/iu,
    tone: "slate",
  },
  {
    icon: Plane,
    keys: ["travel", "tourism"],
    namePattern: /旅行|旅游|travel/iu,
    tone: "cyan",
  },
  {
    icon: Utensils,
    keys: ["dining", "food-service", "restaurant"],
    namePattern: /餐饮|美食|dining|restaurant/iu,
    tone: "amber",
  },
  {
    icon: Gift,
    keys: ["gift", "gifts", "holiday"],
    namePattern: /礼品|礼物|gift/iu,
    tone: "rose",
  },
  {
    icon: Coffee,
    keys: ["coffee", "tea", "drinks"],
    namePattern: /咖啡|茶叶|饮料|coffee|\btea\b/iu,
    tone: "amber",
  },
];

const ALL_RULES: readonly SdkworkMallH5CategoryRule[] = [
  ...ROOT_RULES,
  ...CHILD_RULES,
  ...GENERIC_RULES,
];

/**
 * Seeded taxonomy glyphs by icon name.
 *
 * `category-seeded-taxonomy.ts` stores the icon as a string so the generated
 * table stays data; this map is the single place that binds those names to
 * lucide components.
 */
const ICON_BY_NAME: Readonly<Record<string, LucideIcon | undefined>> = {
  Apple,
  Baby,
  BatteryCharging,
  Beef,
  Bike,
  Bone,
  BookOpen,
  Boxes,
  Cable,
  Cake,
  Camera,
  Car,
  Carrot,
  Cog,
  Coffee,
  Cookie,
  CookingPot,
  Cross,
  Drill,
  Droplets,
  Dumbbell,
  Flower2,
  Footprints,
  Gamepad2,
  Gem,
  Gift,
  Glasses,
  Guitar,
  HardHat,
  Headphones,
  HeartPulse,
  Keyboard,
  Lamp,
  Laptop,
  LayoutGrid,
  Mic,
  Milk,
  Monitor,
  Music,
  Package,
  Palette,
  PawPrint,
  Piano,
  Pill,
  Plane,
  Plug,
  Printer,
  Puzzle,
  Refrigerator,
  Ruler,
  Shirt,
  Shovel,
  ShoppingBag,
  ShowerHead,
  Shapes,
  Smartphone,
  Sofa,
  Sparkles,
  Speaker,
  Sprout,
  Tablet,
  Tag,
  Tent,
  Trophy,
  Tv,
  Utensils,
  WashingMachine,
  Watch,
  Wheat,
  Wind,
  Wine,
  Wrench,
  Zap,
};

const SEEDED_VISUAL_BY_KEY = new Map<string, SdkworkMallH5CategoryVisual>();
const SEEDED_KEY_BY_NAME = new Map<string, string>();

for (const category of SDKWORK_MALL_H5_SEEDED_CATEGORIES) {
  const icon = ICON_BY_NAME[category.icon];
  if (icon) {
    SEEDED_VISUAL_BY_KEY.set(category.key, { icon, tone: category.tone });
  }
  SEEDED_KEY_BY_NAME.set(category.zhName, category.key);
  SEEDED_KEY_BY_NAME.set(category.enName, category.key);
}


/**
 * Every category key that resolves through an explicit rule. The default
 * dataset contract test uses it to prove that initializing an environment
 * covers the whole seeded taxonomy.
 */
export const SDKWORK_MALL_H5_CATEGORY_VISUAL_KEYS: readonly string[] = [
  ...SDKWORK_MALL_H5_SEEDED_CATEGORIES.map((category) => category.key),
  ...ALL_RULES.flatMap((rule) => rule.keys),
];

const FALLBACK_VISUALS: readonly SdkworkMallH5CategoryVisual[] = [
  { icon: Shapes, tone: "slate" },
  { icon: Boxes, tone: "teal" },
  { icon: Tag, tone: "indigo" },
  { icon: Package, tone: "amber" },
  { icon: LayoutGrid, tone: "violet" },
];

/** `MALL-CAT-SMARTPHONE` / `Smartphone` both normalise to `smartphone`. */
function normalizeCategoryKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^mall-cat-/u, "")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
}

function hashCategorySeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pickFallbackVisual(seed: string): SdkworkMallH5CategoryVisual {
  return FALLBACK_VISUALS[hashCategorySeed(seed) % FALLBACK_VISUALS.length];
}

function matchRule(
  rules: readonly SdkworkMallH5CategoryRule[],
  name: string,
): SdkworkMallH5CategoryRule | undefined {
  return rules.find((rule) => rule.namePattern.test(name));
}

/**
 * Resolves the tile glyph and accent for one category.
 *
 * Never returns `undefined`: an unmapped category gets a stable fallback so the
 * grid cannot render a blank tile when a tenant invents a new category.
 */
export function resolveSdkworkMallH5CategoryVisual(
  category: SdkworkMallH5CategoryInput,
): SdkworkMallH5CategoryVisual {
  const key = normalizeCategoryKey(category.key ?? category.code ?? "");

  // The seeded taxonomy is a closed, authored set: resolve it by key first and
  // then by its exact zh/en names, so a category that arrives without a code
  // still gets the same deliberate glyph instead of a regex guess.
  if (key) {
    const seeded = SEEDED_VISUAL_BY_KEY.get(key);
    if (seeded) {
      return seeded;
    }
  }

  const name = (category.name ?? "").trim();
  if (name) {
    const seededKey = SEEDED_KEY_BY_NAME.get(name);
    if (seededKey) {
      const seeded = SEEDED_VISUAL_BY_KEY.get(seededKey);
      if (seeded) {
        return seeded;
      }
    }

    if (key) {
      const keyed = ALL_RULES.find((rule) => rule.keys.includes(key));
      if (keyed) {
        return { icon: keyed.icon, tone: keyed.tone };
      }
    }

    const matched =
      matchRule(ROOT_RULES, name) ?? matchRule(CHILD_RULES, name) ?? matchRule(GENERIC_RULES, name);
    if (matched) {
      return { icon: matched.icon, tone: matched.tone };
    }
  } else if (key) {
    const keyed = ALL_RULES.find((rule) => rule.keys.includes(key));
    if (keyed) {
      return { icon: keyed.icon, tone: keyed.tone };
    }
  }

  return pickFallbackVisual(key || name || "category");
}
