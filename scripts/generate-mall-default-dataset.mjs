#!/usr/bin/env node
/**
 * Mall default dataset generator.
 *
 * The shipped dataset is authored, not hand-typed per row: this script owns the
 * taxonomy (20 roots / 100 leaf categories), the brand and shop roster, and the
 * deterministic product/SKU model that turns them into the `zh-CN` base document
 * plus its `en-US` overlay. Running it regenerates both JSON files; `--check`
 * fails when the committed files drift from the model.
 *
 * Determinism is the point: the same seed always produces the same keys,
 * barcodes, prices and translations, so provisioning natural keys stay stable
 * across regenerations and reviews can diff a single file.
 *
 * Usage:
 *   node scripts/generate-mall-default-dataset.mjs            # write both documents
 *   node scripts/generate-mall-default-dataset.mjs --check    # fail on drift
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATASET_DIR =
  "apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-admin-product/src/default-data/dataset";
const ZH_PATH = `${DATASET_DIR}/mall-default-data.zh-CN.json`;
const EN_PATH = `${DATASET_DIR}/mall-default-data.en-US.json`;

const PRODUCTS_PER_LEAF = 6;
const CHECK_MODE = process.argv.slice(2).includes("--check");
/** Lowest realistic retail amount the integrity gate accepts. */
const MIN_PRICE = 5;

/* ------------------------------------------------------------------------- */
/* Deterministic randomness                                                   */
/* ------------------------------------------------------------------------- */

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = mulberry32(0x5eed2026);

function between(min, max) {
  return min + (max - min) * random();
}

/** Skews the draw toward the entry price, the way real assortments are priced. */
function betweenSkewed(min, max) {
  return min + (max - min) * Math.pow(random(), 1.6);
}

function roundMoney(value) {
  // Retail prices end in .00 or .90, never in arbitrary fractions, and never
  // below the floor a real listing would carry.
  const whole = Math.max(MIN_PRICE, Math.round(value));
  const candidate = random() < 0.5 ? whole : whole - 0.1;
  return Math.max(MIN_PRICE, candidate);
}

function formatMoney(value) {
  return value.toFixed(2);
}

function ean13(sequence) {
  const body = `690${String(sequence).padStart(9, "0")}`;
  let sum = 0;
  for (let index = 0; index < 12; index += 1) {
    sum += Number(body[index]) * (index % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return `${body}${check}`;
}

/* ------------------------------------------------------------------------- */
/* Attribute dictionaries                                                     */
/* ------------------------------------------------------------------------- */

/**
 * Spec dimension: `values` is a list of `[zh, en, priceFactor]`. A SKU picks one
 * value per dimension, and the factors multiply the leaf's base price.
 */
const ATTRS = {
  storage: {
    nameZh: "存储容量",
    nameEn: "Storage",
    key: "storage",
    values: [
      ["8GB+256GB", "8GB+256GB", 1],
      ["12GB+256GB", "12GB+256GB", 1.08],
      ["16GB+512GB", "16GB+512GB", 1.26],
      ["24GB+1TB", "24GB+1TB", 1.52],
    ],
  },
  capacity: {
    nameZh: "容量",
    nameEn: "Capacity",
    key: "capacity",
    values: [
      ["256GB", "256GB", 1],
      ["512GB", "512GB", 1.28],
      ["1TB", "1TB", 1.62],
    ],
  },
  color: {
    nameZh: "配色",
    nameEn: "Color",
    key: "color",
    values: [
      ["曜石黑", "Obsidian Black", 1],
      ["星河银", "Galaxy Silver", 1],
      ["远峰蓝", "Alpine Blue", 1],
      ["晨曦金", "Dawn Gold", 1.02],
      ["云雾白", "Mist White", 1],
    ],
  },
  apparelColor: {
    nameZh: "颜色",
    nameEn: "Colour",
    key: "apparel-color",
    values: [
      ["燕麦色", "Oatmeal", 1],
      ["雾霾蓝", "Haze Blue", 1],
      ["炭黑", "Charcoal", 1],
      ["奶油白", "Cream White", 1],
    ],
  },
  size: {
    nameZh: "尺码",
    nameEn: "Size",
    key: "size",
    values: [
      ["S", "S", 1],
      ["M", "M", 1],
      ["L", "L", 1],
      ["XL", "XL", 1.02],
    ],
  },
  shoeSize: {
    nameZh: "鞋码",
    nameEn: "Shoe Size",
    key: "shoe-size",
    values: [
      ["38", "EU 38", 1],
      ["40", "EU 40", 1],
      ["42", "EU 42", 1],
      ["44", "EU 44", 1],
    ],
  },
  net: {
    nameZh: "净含量",
    nameEn: "Net Weight",
    key: "net",
    values: [
      ["500g", "500g", 1],
      ["1kg", "1kg", 1.72],
      ["2.5kg", "2.5kg", 3.9],
    ],
  },
  pack: {
    nameZh: "规格",
    nameEn: "Pack Size",
    key: "pack",
    values: [
      ["单件装", "Single Pack", 1],
      ["两件装", "2-Pack", 1.86],
      ["家庭装", "Family Pack", 2.64],
    ],
  },
  portion: {
    nameZh: "份量",
    nameEn: "Portion",
    key: "portion",
    values: [
      ["单份装", "Single", 1],
      ["双份装", "Double", 1.85],
      ["家庭装", "Family", 3.4],
    ],
  },
  flavor: {
    nameZh: "口味",
    nameEn: "Flavor",
    key: "flavor",
    values: [
      ["原味", "Original", 1],
      ["清爽青柠", "Lime", 1],
      ["醇香可可", "Cocoa", 1.02],
    ],
  },
  material: {
    nameZh: "材质",
    nameEn: "Material",
    key: "material",
    values: [
      ["天然棉麻", "Cotton Linen", 1],
      ["头层牛皮", "Full-grain Leather", 1.4],
      ["轻量铝合金", "Aluminium Alloy", 1.2],
      ["天然实木", "Solid Wood", 1.3],
      ["304 不锈钢", "Stainless Steel", 1.15],
    ],
  },
  power: {
    nameZh: "功率",
    nameEn: "Power",
    key: "power",
    values: [
      ["标准版", "Standard", 1],
      ["增强版", "Plus", 1.22],
      ["旗舰版", "Pro", 1.48],
    ],
  },
  precious: {
    nameZh: "材质",
    nameEn: "Material",
    key: "precious",
    values: [
      ["足金", "Fine Gold", 1],
      ["铂金", "Platinum", 1.15],
      ["18K 金", "18K Gold", 0.72],
      ["S925 银", "S925 Silver", 0.28],
    ],
  },
  shade: {
    nameZh: "色号",
    nameEn: "Shade",
    key: "shade",
    values: [
      ["豆沙色", "Dusty Rose", 1],
      ["正红色", "Classic Red", 1],
      ["珊瑚橘", "Coral", 1],
      ["枫叶棕", "Maple Brown", 1],
    ],
  },
  grade: {
    nameZh: "型号",
    nameEn: "Model",
    key: "grade",
    values: [
      ["标准型", "Standard", 1],
      ["加强型", "Heavy Duty", 1.25],
      ["定制型", "Custom", 1.6],
    ],
  },
  bundle: {
    nameZh: "包装",
    nameEn: "Bundle",
    key: "bundle",
    values: [
      ["单包", "Single Pack", 1],
      ["五包装", "5-Pack", 4.6],
      ["整箱装", "Case", 9.5],
    ],
  },
  weight: {
    nameZh: "重量",
    nameEn: "Weight",
    key: "weight",
    values: [
      ["5kg", "5kg", 1],
      ["10kg", "10kg", 1.8],
      ["20kg", "20kg", 3.2],
    ],
  },
  people: {
    nameZh: "人数",
    nameEn: "Capacity",
    key: "people",
    values: [
      ["2 人", "2-person", 1],
      ["3 人", "3-person", 1.4],
      ["4 人", "4-person", 1.9],
    ],
  },
  ballSize: {
    nameZh: "规格",
    nameEn: "Size",
    key: "ball-size",
    values: [
      ["5 号", "Size 5", 1],
      ["7 号", "Size 7", 1.18],
    ],
  },
  potSize: {
    nameZh: "盆径",
    nameEn: "Pot Size",
    key: "pot-size",
    values: [
      ["小盆", "Small", 1],
      ["中盆", "Medium", 1.6],
      ["大盆", "Large", 2.4],
    ],
  },
  format: {
    nameZh: "规格",
    nameEn: "Format",
    key: "format",
    values: [
      ["标准款", "Standard", 1],
      ["加长款", "Extended", 1.15],
      ["加大款", "Oversized", 1.3],
    ],
  },
  rim: {
    nameZh: "尺寸",
    nameEn: "Rim Size",
    key: "rim",
    values: [
      ["16 寸", "16 inch", 1],
      ["17 寸", "17 inch", 1.12],
      ["18 寸", "18 inch", 1.25],
    ],
  },
  edition: {
    nameZh: "版本",
    nameEn: "Edition",
    key: "edition",
    values: [
      ["标准版", "Standard Edition", 1],
      ["纪念版", "Collector's Edition", 1.3],
      ["限定礼盒版", "Limited Gift Edition", 1.6],
    ],
  },
};

/** Attribute sets by retail kind. */
const ATTR_SETS = {
  phone: ["storage", "color"],
  computer: ["storage", "color"],
  tablet: ["storage", "color"],
  audio: ["color"],
  appliance: ["power", "color"],
  apparel: ["size", "apparelColor"],
  shoe: ["shoeSize", "apparelColor"],
  bag: ["material", "apparelColor"],
  beauty: ["pack"],
  grocery: ["portion"],
  beverage: ["portion"],
  baby: ["pack", "size"],
  toy: ["edition"],
  sports: ["size", "apparelColor"],
  home: ["material", "color"],
  auto: ["edition"],
  book: ["edition"],
  jewelry: ["precious"],
  pet: ["portion"],
  health: ["pack"],
  tools: ["power"],
  instrument: ["edition"],
  gift: ["pack"],
  garden: ["portion"],
  generic: ["edition"],
};

/**
 * Per-leaf attribute overrides for cases a retail-kind default would mis-type:
 * a rose bouquet has no flavour, a beer crate is sold by portion, a diamond ring
 * by precious metal rather than fabric.
 */
const LEAF_ATTR_OVERRIDES = {
  "monitor": ["edition"],
  "mechanical-keyboard": ["color"],
  "mouse": ["color"],
  "printer": ["edition"],
  "scanner": ["edition"],
  "projector": ["edition"],
  "smart-watch": ["color"],
  "smart-band": ["color"],
  "earbuds": ["color"],
  "bluetooth-speaker": ["color"],
  "smart-glasses": ["color"],
  "action-camera": ["storage","color"],
  "smart-tv": ["edition"],
  "lipstick": ["shade"],
  "foundation": ["shade"],
  "perfume": ["pack"],
  "beauty-device": ["edition"],
  "strap": ["edition"],
  "yoga-mat": ["edition"],
  "dumbbells": ["weight"],
  "sleeping-bag": ["edition"],
  "bedding-set": ["material"],
  "quilt": ["material"],
  "pillow": ["material"],
  "sofa": ["material"],
  "desk": ["material"],
  "wardrobe": ["material"],
  "wok": ["material"],
  "tableware": ["material"],
  "shelf": ["material"],
  "table-lamp": ["edition"],
  "tyres": ["edition"],
  "car-seat": ["edition"],
  "floor-mats": ["edition"],
  "car-film": ["edition"],
  "sunshade": ["edition"],
  "leash": ["edition"],
  "cat-tree": ["edition"],
  "pet-bed": ["edition"],
  "pet-bowl": ["edition"],
  "jewelry-care": ["pack"],
  "jewelry-box": ["material"],
  "laser-measure": ["edition"],
  "screws": ["edition"],
  "tape-measure": ["edition"],
  "spirit-level": ["edition"],
  "cut-gloves": ["size"],
  "safety-helmet": ["edition"],
  "baby-food": ["pack"],
  "wipes": ["pack"],
  "infant-formula": ["pack"],
  "diapers": ["size"],
  "stroller": ["edition"],
  "child-car-seat": ["edition"],
  "treadmill": ["edition"],
  "road-bike": ["edition"],
  "basketball": ["edition"],
  "football": ["edition"],
  "tent": ["edition"],
  "greeting-card": ["pack"],
  "souvenir": ["pack"],
  "fruit-basket": ["pack"],
  "birthday-cake": ["pack"],
  "chocolate-gift": ["pack"],
  "aroma-gift": ["pack"],
  "rose-bouquet": ["pack"],
  "preserved-flower": ["pack"],
  "holiday-gift-box": ["pack"],
  "engraved-gift": ["edition"],
  "flower-pot": ["material"],
  "garden-tools": ["power"],
  "watering-can": ["edition"],
  "drip-irrigation": ["edition"],
  "pothos": ["edition"],
  "succulent": ["edition"],
  "flower-seeds": ["pack"],
  "vegetable-seeds": ["pack"],
  "compound-fertilizer": ["pack"],
  "potting-soil": ["pack"],
  "engine-oil": ["edition"],
  "ceramic-coating": ["edition"],
  "car-vacuum": ["edition"],
  "car-charger": ["color"],
  "microphone": ["color"],
  "whiteboard": ["edition"],
  "shredder": ["edition"],
  "medical-masks": ["pack"],
  "first-aid-kit": ["pack"],
  "tent": ["people"],
  "basketball": ["ballSize"],
  "football": ["ballSize"],
  "pothos": ["potSize"],
  "succulent": ["potSize"],
  "flower-pot": ["potSize"],
  "yoga-mat": ["format"],
  "sleeping-bag": ["format"],
  "treadmill": ["format"],
  "road-bike": ["format"],
  "watering-can": ["format"],
  "drip-irrigation": ["format"],
  "tyres": ["rim"],
  "car-seat": ["color"],
  "sunshade": ["color"],
  "cat-tree": ["material"],
  "jewelry-box": ["material"],
};

/* ------------------------------------------------------------------------- */
/* Model pools                                                               */
/* ------------------------------------------------------------------------- */

const SERIES = {
  digital: ["AURORA", "NEBULA", "PRIME"],
  computer: ["NUCLEUS", "VECTOR", "MATRIX"],
  appliance: ["CIRRUS", "HALO", "TERRA"],
  fashion: ["LUMI", "ATELIER", "MIST"],
  beauty: ["HYDRA", "VELVET", "CICA"],
  grocery: ["HARVEST", "ORIGIN", "FARM"],
  baby: ["SPROUT", "BUDDY", "LULLA"],
  sports: ["TRAIL", "PULSE", "APEX"],
  home: ["NEST", "FORMA", "OAK"],
  auto: ["RIDGE", "MOTOR", "DRIVE"],
  books: ["INK", "PAGE", "FOLIO"],
  jewelry: ["AURUM", "LUSTRE", "GEM"],
  pet: ["PAW", "WHISKER", "TAIL"],
  health: ["VITA", "HERB", "PULSE"],
  tools: ["FORGE", "GRIP", "STEEL"],
  instrument: ["SONIC", "TEMPO", "CHORD"],
  gift: ["BLOOM", "WISH", "RIBBON"],
  accessory: ["LINK", "SNAP", "EDGE"],
  garden: ["GREEN", "BLOOM", "ROOT"],
  beverage: ["MOON", "BREW", "SPRING"],
  mobile: ["AURORA", "NEBULA", "PRIME"],
  "shoes-bags": ["LUMI", "ATELIER", "MIST"],
  office: ["WENXI", "STAPLE", "LEAF"],
  industrial: ["BEARX", "VOLT", "FORGE"],
  cleaning: ["PURE", "CLEAN", "FRESH"],
};

const MODEL_POOLS = {
  tech: [
    ["X1 Pro", "X1 Pro"],
    ["X2", "X2"],
    ["Note 12", "Note 12"],
    ["Lite 3", "Lite 3"],
    ["Max 2", "Max 2"],
  ],
  apparel: [
    ["经典款", "Classic"],
    ["轻奢款", "Premium"],
    ["2026 新款", "2026 Edition"],
    ["基础款", "Essential"],
  ],
  shoe: [
    ["缓震跑鞋", "Cushioned Runner"],
    ["轻量训练鞋", "Light Trainer"],
    ["城市通勤鞋", "City Commuter"],
    ["户外徒步鞋", "Trail Hiker"],
  ],
  consumable: [
    ["经典装", "Classic"],
    ["优选装", "Select"],
    ["臻选装", "Premium"],
    ["超值装", "Value"],
  ],
  gift: [
    ["经典款", "Classic"],
    ["精致款", "Refined"],
    ["臻选款", "Curated"],
    ["尊享款", "Prestige"],
  ],
  generic: [
    ["标准款", "Standard"],
    ["升级款", "Upgraded"],
    ["轻享款", "Lite"],
    ["专业款", "Professional"],
  ],
};

/* ------------------------------------------------------------------------- */
/* Taxonomy                                                                  */
/* ------------------------------------------------------------------------- */

/**
 * Root -> leaves. Every leaf authors: key, names, noun, price band, kind
 * (model pool + attribute set), and product type.
 */
/**
 * Root -> leaves. Every leaf authors: key, names, price band and retail kind
 * (model pool + attribute set). Keys are globally unique across the tree.
 */
/**
 * Root -> leaves. Every leaf authors: key, names, price band and retail kind
 * (model pool + attribute set). Keys are globally unique across the tree.
 */
const TAXONOMY = [
  {
    key: "mobile",
    name: "手机数码",
    nameEn: "Phones & Digital",
    pitchZh: "旗舰影像、长续航与全场景生态，移动办公与娱乐都从容。",
    pitchEn: "Flagship imaging, long battery life and a full device ecosystem.",
    brands: ["xingye", "yunqi", "polarday"],
    leaves: [
      ["smartphone", "智能手机", "Smartphones", "智能手机", "Smartphones", [1299, 8999], "phone"],
      ["foldable-phone", "折叠屏手机", "Foldable Phones", "折叠屏手机", "Foldable Phones", [6999, 19999], "phone"],
      ["gaming-phone", "游戏手机", "Gaming Phones", "游戏手机", "Gaming Phones", [2999, 9999], "phone"],
      ["tablet", "平板电脑", "Tablets", "平板电脑", "Tablets", [1099, 6999], "phone"],
      ["smart-watch", "智能手表", "Smartwatches", "智能手表", "Smartwatches", [299, 4999], "phone"],
      ["smart-band", "智能手环", "Fitness Bands", "智能手环", "Fitness Bands", [99, 599], "phone"],
      ["earbuds", "无线耳机", "Wireless Earbuds", "无线耳机", "Wireless Earbuds", [99, 2499], "audio"],
      ["bluetooth-speaker", "蓝牙音箱", "Bluetooth Speakers", "蓝牙音箱", "Bluetooth Speakers", [99, 1999], "audio"],
      ["smart-glasses", "智能眼镜", "Smart Glasses", "智能眼镜", "Smart Glasses", [999, 4999], "audio"],
      ["action-camera", "运动相机", "Action Cameras", "运动相机", "Action Cameras", [599, 3999], "computer"],
      ["kids-watch", "儿童手表", "Kids Smartwatches", "儿童手表", "Kids Smartwatches", [199, 1999], "phone"],
      ["sports-earbuds", "运动耳机", "Sports Earbuds", "运动耳机", "Sports Earbuds", [99, 1499], "audio"],
    ],
  },
  {
    key: "computer",
    name: "电脑办公",
    nameEn: "Computers & Office",
    pitchZh: "高色域屏幕、全功能接口与稳定性能，办公创作一步到位。",
    pitchEn: "Wide-gamut displays, full ports and dependable performance for work.",
    brands: ["xingye", "inkshadow", "qcloud"],
    leaves: [
      ["laptop", "轻薄笔记本", "Ultrabooks", "轻薄笔记本", "Ultrabooks", [3299, 15999], "computer"],
      ["gaming-laptop", "游戏笔记本", "Gaming Laptops", "游戏笔记本", "Gaming Laptops", [5999, 24999], "computer"],
      ["desktop-pc", "台式整机", "Desktop PCs", "台式整机", "Desktop PCs", [2999, 19999], "computer"],
      ["all-in-one-pc", "一体机", "All-in-One PCs", "一体机", "All-in-One PCs", [3999, 15999], "computer"],
      ["monitor", "显示器", "Monitors", "显示器", "Monitors", [599, 8999], "computer"],
      ["mechanical-keyboard", "机械键盘", "Mechanical Keyboards", "机械键盘", "Mechanical Keyboards", [99, 1999], "accessory"],
      ["mouse", "鼠标", "Mice", "鼠标", "Mice", [49, 999], "accessory"],
      ["printer", "打印机", "Printers", "打印机", "Printers", [399, 4999], "office"],
      ["scanner", "扫描仪", "Scanners", "扫描仪", "Scanners", [299, 3999], "office"],
      ["projector", "投影仪", "Projectors", "投影仪", "Projectors", [999, 9999], "tv"],
      ["drawing-tablet", "绘图板", "Drawing Tablets", "绘图板", "Drawing Tablets", [299, 4999], "computer"],
      ["mini-pc", "迷你主机", "Mini PCs", "迷你主机", "Mini PCs", [1499, 8999], "computer"],
    ],
  },
  {
    key: "appliance",
    name: "家用电器",
    nameEn: "Home Appliances",
    pitchZh: "一级能效、静音运行与智能联动，把家务交给更懂生活的机器。",
    pitchEn: "Energy-efficient, quiet and connected appliances for everyday chores.",
    brands: ["yunqi", "egret", "sunglow"],
    leaves: [
      ["smart-tv", "智能电视", "Smart TVs", "智能电视", "Smart TVs", [1599, 12999], "tv"],
      ["refrigerator", "冰箱", "Refrigerators", "冰箱", "Refrigerators", [1299, 9999], "appliance"],
      ["washer", "洗衣机", "Washers", "洗衣机", "Washers", [1499, 8999], "appliance"],
      ["air-conditioner", "空调", "Air Conditioners", "空调", "Air Conditioners", [1999, 9999], "appliance"],
      ["range-hood", "油烟机", "Range Hoods", "油烟机", "Range Hoods", [999, 5999], "appliance"],
      ["gas-stove", "燃气灶", "Gas Stoves", "燃气灶", "Gas Stoves", [799, 4999], "appliance"],
      ["dishwasher", "洗碗机", "Dishwashers", "洗碗机", "Dishwashers", [2999, 9999], "appliance"],
      ["air-purifier", "空气净化器", "Air Purifiers", "空气净化器", "Air Purifiers", [299, 4999], "appliance"],
      ["vacuum-cleaner", "吸尘器", "Vacuum Cleaners", "吸尘器", "Vacuum Cleaners", [299, 3999], "appliance"],
      ["water-heater", "电热水器", "Water Heaters", "电热水器", "Water Heaters", [799, 4999], "appliance"],
      ["electric-fan", "电风扇", "Electric Fans", "电风扇", "Electric Fans", [99, 1999], "appliance"],
      ["humidifier", "加湿器", "Humidifiers", "加湿器", "Humidifiers", [99, 1999], "appliance"],
    ],
  },
  {
    key: "fashion",
    name: "服饰内衣",
    nameEn: "Fashion & Underwear",
    pitchZh: "天然面料与立体剪裁，通勤、休闲与居家都得体。",
    pitchEn: "Natural fabrics and considered tailoring for work, weekend and home.",
    brands: ["shiguang", "suye", "mistral"],
    leaves: [
      ["men-tshirt", "男士T恤", "Men's T-Shirts", "男士T恤", "Men's T-Shirts", [59, 399], "apparel"],
      ["men-shirt", "男士衬衫", "Men's Shirts", "男士衬衫", "Men's Shirts", [129, 699], "apparel"],
      ["women-knitwear", "女士针织衫", "Women's Knitwear", "女士针织衫", "Women's Knitwear", [159, 1299], "apparel"],
      ["women-dress", "女士连衣裙", "Women's Dresses", "女士连衣裙", "Women's Dresses", [199, 1599], "apparel"],
      ["hoodie", "卫衣", "Hoodies", "卫衣", "Hoodies", [129, 799], "apparel"],
      ["down-jacket", "羽绒服", "Down Jackets", "羽绒服", "Down Jackets", [399, 2999], "apparel"],
      ["jeans", "牛仔裤", "Jeans", "牛仔裤", "Jeans", [129, 899], "apparel"],
      ["underwear", "内衣", "Underwear", "内衣", "Underwear", [39, 299], "apparel"],
      ["loungewear", "家居服", "Loungewear", "家居服", "Loungewear", [89, 599], "apparel"],
      ["socks", "袜子", "Socks", "袜子", "Socks", [9, 99], "apparel"],
      ["suits", "西装", "Suits", "西装", "Suits", [399, 3999], "apparel"],
      ["skirts", "半身裙", "Skirts", "半身裙", "Skirts", [99, 999], "apparel"],
    ],
  },
  {
    key: "shoes-bags",
    name: "鞋靴箱包",
    nameEn: "Shoes & Bags",
    pitchZh: "耐磨结构、舒适楦型与精细皮具工艺。",
    pitchEn: "Durable structures, comfortable lasts and fine leather craft.",
    brands: ["shiguang", "mistral", "suye"],
    leaves: [
      ["running-shoes", "运动鞋", "Running Shoes", "运动鞋", "Running Shoes", [199, 1599], "shoe"],
      ["casual-shoes", "休闲鞋", "Casual Shoes", "休闲鞋", "Casual Shoes", [159, 999], "shoe"],
      ["leather-shoes", "皮鞋", "Leather Shoes", "皮鞋", "Leather Shoes", [299, 1999], "shoe"],
      ["boots", "靴子", "Boots", "靴子", "Boots", [299, 1999], "shoe"],
      ["sandals", "凉鞋", "Sandals", "凉鞋", "Sandals", [99, 699], "shoe"],
      ["backpack", "双肩包", "Backpacks", "双肩包", "Backpacks", [99, 999], "bag"],
      ["handbag", "手提包", "Handbags", "手提包", "Handbags", [129, 3999], "bag"],
      ["suitcase", "行李箱", "Suitcases", "行李箱", "Suitcases", [299, 2999], "bag"],
      ["wallet", "钱包", "Wallets", "钱包", "Wallets", [59, 999], "bag"],
      ["belt", "腰带", "Belts", "腰带", "Belts", [69, 599], "bag"],
      ["slippers", "拖鞋", "Slippers", "拖鞋", "Slippers", [29, 399], "shoe"],
      ["waist-bags", "腰包", "Waist Bags", "腰包", "Waist Bags", [59, 599], "bag"],
    ],
  },
  {
    key: "beauty",
    name: "美妆个护",
    nameEn: "Beauty & Care",
    pitchZh: "温和配方与实证功效，敏感肌也能安心使用。",
    pitchEn: "Gentle formulas with proven actives for sensitive skin.",
    brands: ["mubai", "cottona", "bloomish"],
    leaves: [
      ["serum", "精华", "Serums", "精华", "Serums", [89, 1299], "beauty"],
      ["face-cream", "面霜", "Face Creams", "面霜", "Face Creams", [59, 999], "beauty"],
      ["mask", "面膜", "Face Masks", "面膜", "Face Masks", [19, 399], "beauty"],
      ["cleanser", "洁面", "Cleansers", "洁面", "Cleansers", [29, 299], "beauty"],
      ["lipstick", "口红", "Lipsticks", "口红", "Lipsticks", [49, 399], "beauty"],
      ["foundation", "粉底", "Foundations", "粉底", "Foundations", [59, 599], "beauty"],
      ["perfume", "香水", "Perfumes", "香水", "Perfumes", [99, 1999], "beauty"],
      ["shampoo", "洗发水", "Shampoos", "洗发水", "Shampoos", [29, 499], "beauty"],
      ["body-wash", "沐浴露", "Body Washes", "沐浴露", "Body Washes", [19, 199], "beauty"],
      ["beauty-device", "美容仪", "Beauty Devices", "美容仪", "Beauty Devices", [399, 5999], "accessory"],
      ["eye-cream", "眼霜", "Eye Creams", "眼霜", "Eye Creams", [59, 899], "beauty"],
      ["body-lotion", "身体乳", "Body Lotions", "身体乳", "Body Lotions", [29, 299], "beauty"],
    ],
  },
  {
    key: "grocery",
    name: "食品生鲜",
    nameEn: "Food & Fresh",
    pitchZh: "产地直采、冷链直达，配料表干净，吃得放心。",
    pitchEn: "Direct-sourced and cold-chain delivered with clean ingredient lists.",
    brands: ["shanhai", "grainly", "fruity"],
    leaves: [
      ["rice", "大米", "Rice", "大米", "Rice", [19, 199], "grocery"],
      ["cooking-oil", "食用油", "Cooking Oil", "食用油", "Cooking Oil", [29, 199], "grocery"],
      ["nuts", "坚果", "Nuts", "坚果", "Nuts", [19, 149], "grocery"],
      ["biscuits", "饼干", "Biscuits", "饼干", "Biscuits", [9, 79], "grocery"],
      ["fresh-fruit", "新鲜水果", "Fresh Fruit", "新鲜水果", "Fresh Fruit", [9, 89], "grocery"],
      ["beef", "牛肉", "Beef", "牛肉", "Beef", [29, 399], "grocery"],
      ["eggs", "鸡蛋", "Eggs", "鸡蛋", "Eggs", [9, 59], "grocery"],
      ["seasoning", "调味品", "Seasonings", "调味品", "Seasonings", [9, 79], "grocery"],
      ["instant-food", "方便食品", "Instant Food", "方便食品", "Instant Food", [5, 59], "grocery"],
      ["dairy", "乳制品", "Dairy", "乳制品", "Dairy", [9, 129], "grocery"],
      ["honey", "蜂蜜", "Honey", "蜂蜜", "Honey", [19, 199], "grocery"],
      ["frozen-food", "冷冻食品", "Frozen Food", "冷冻食品", "Frozen Food", [9, 129], "grocery"],
    ],
  },
  {
    key: "baby",
    name: "母婴玩具",
    nameEn: "Baby & Toys",
    pitchZh: "安全材质与成长友好设计，陪伴每一步。",
    pitchEn: "Safe materials and growth-friendly design for every milestone.",
    brands: ["qimu", "kidgo", "fawnly"],
    leaves: [
      ["infant-formula", "婴幼儿奶粉", "Infant Formula", "婴幼儿奶粉", "Infant Formula", [89, 599], "baby"],
      ["baby-food", "辅食", "Baby Food", "辅食", "Baby Food", [19, 199], "baby"],
      ["diapers", "纸尿裤", "Diapers", "纸尿裤", "Diapers", [59, 399], "baby"],
      ["wipes", "湿巾", "Baby Wipes", "湿巾", "Baby Wipes", [9, 79], "baby"],
      ["kidswear", "童装", "Kids' Clothing", "童装", "Kids' Clothing", [39, 599], "apparel"],
      ["kids-shoes", "童鞋", "Kids' Shoes", "童鞋", "Kids' Shoes", [79, 499], "shoe"],
      ["building-blocks", "积木", "Building Blocks", "积木", "Building Blocks", [39, 499], "toy"],
      ["early-toys", "早教玩具", "Early Learning Toys", "早教玩具", "Early Learning Toys", [29, 399], "toy"],
      ["stroller", "婴儿车", "Strollers", "婴儿车", "Strollers", [499, 4999], "appliance"],
      ["child-car-seat", "安全座椅", "Child Car Seats", "安全座椅", "Child Car Seats", [499, 4999], "appliance"],
      ["kids-tableware", "儿童餐具", "Kids Tableware", "儿童餐具", "Kids Tableware", [29, 299], "home"],
      ["play-mat", "爬行垫", "Play Mats", "爬行垫", "Play Mats", [59, 499], "home"],
    ],
  },
  {
    key: "sports",
    name: "运动户外",
    nameEn: "Sports & Outdoors",
    pitchZh: "专业结构与轻量材料，训练和远行都更省力。",
    pitchEn: "Purpose-built structures and lightweight materials for training and travel.",
    brands: ["senyu", "gale", "summit"],
    leaves: [
      ["treadmill", "跑步机", "Treadmills", "跑步机", "Treadmills", [1299, 9999], "appliance"],
      ["yoga-mat", "瑜伽垫", "Yoga Mats", "瑜伽垫", "Yoga Mats", [39, 399], "grocery"],
      ["dumbbells", "哑铃", "Dumbbells", "哑铃", "Dumbbells", [59, 999], "grocery"],
      ["tent", "帐篷", "Tents", "帐篷", "Tents", [99, 2999], "sports"],
      ["sleeping-bag", "睡袋", "Sleeping Bags", "睡袋", "Sleeping Bags", [99, 899], "apparel"],
      ["hiking-shoes", "登山鞋", "Hiking Shoes", "登山鞋", "Hiking Shoes", [199, 1599], "shoe"],
      ["bike-helmet", "骑行头盔", "Bike Helmets", "骑行头盔", "Bike Helmets", [99, 599], "apparel"],
      ["road-bike", "公路自行车", "Road Bikes", "公路自行车", "Road Bikes", [1999, 19999], "sports"],
      ["basketball", "篮球", "Basketballs", "篮球", "Basketballs", [59, 599], "sports"],
      ["football", "足球", "Footballs", "足球", "Footballs", [49, 399], "sports"],
      ["badminton", "羽毛球拍", "Badminton Rackets", "羽毛球拍", "Badminton Rackets", [99, 1999], "sports"],
      ["swim-goggles", "泳镜", "Swim Goggles", "泳镜", "Swim Goggles", [39, 399], "apparel"],
    ],
  },
  {
    key: "home",
    name: "家居家装",
    nameEn: "Home & Living",
    pitchZh: "耐用结构与简约设计，让家更舒适也更好打理。",
    pitchEn: "Durable structures and clean lines that keep a home comfortable.",
    brands: ["muli", "cozylife", "forme"],
    leaves: [
      ["bedding-set", "四件套", "Bedding Sets", "四件套", "Bedding Sets", [99, 1999], "home"],
      ["quilt", "被子", "Quilts", "被子", "Quilts", [199, 1999], "home"],
      ["pillow", "枕头", "Pillows", "枕头", "Pillows", [59, 599], "home"],
      ["sofa", "沙发", "Sofas", "沙发", "Sofas", [999, 9999], "home"],
      ["desk", "书桌", "Desks", "书桌", "Desks", [199, 3999], "home"],
      ["wardrobe", "衣柜", "Wardrobes", "衣柜", "Wardrobes", [599, 8999], "home"],
      ["wok", "炒锅", "Woks", "炒锅", "Woks", [59, 599], "home"],
      ["tableware", "餐具", "Tableware", "餐具", "Tableware", [29, 499], "home"],
      ["shelf", "置物架", "Shelving", "置物架", "Shelving", [39, 999], "home"],
      ["table-lamp", "台灯", "Table Lamps", "台灯", "Table Lamps", [79, 999], "home"],
      ["curtains", "窗帘", "Curtains", "窗帘", "Curtains", [99, 1999], "home"],
      ["rugs", "地毯", "Rugs", "地毯", "Rugs", [99, 3999], "home"],
    ],
  },
  {
    key: "auto",
    name: "汽车用品",
    nameEn: "Auto & Accessories",
    pitchZh: "车规级用料与严苛测试，适配主流车型。",
    pitchEn: "Automotive-grade materials tested for mainstream models.",
    brands: ["ridge", "ridex"],
    leaves: [
      ["engine-oil", "机油", "Engine Oil", "机油", "Engine Oil", [99, 599], "grocery"],
      ["tyres", "轮胎", "Tyres", "轮胎", "Tyres", [199, 1999], "auto"],
      ["dash-cam", "行车记录仪", "Dash Cams", "行车记录仪", "Dash Cams", [199, 2999], "computer"],
      ["car-charger", "车载充电器", "Car Chargers", "车载充电器", "Car Chargers", [19, 199], "accessory"],
      ["car-seat", "车载安全座椅", "Car Safety Seats", "车载安全座椅", "Car Safety Seats", [499, 4999], "auto"],
      ["floor-mats", "脚垫", "Floor Mats", "脚垫", "Floor Mats", [99, 999], "auto"],
      ["car-film", "车膜", "Window Films", "车膜", "Window Films", [399, 2999], "auto"],
      ["ceramic-coating", "镀晶", "Ceramic Coatings", "镀晶", "Ceramic Coatings", [59, 499], "grocery"],
      ["car-vacuum", "车载吸尘器", "Car Vacuums", "车载吸尘器", "Car Vacuums", [99, 899], "appliance"],
      ["sunshade", "遮阳挡", "Sunshades", "遮阳挡", "Sunshades", [19, 199], "auto"],
      ["car-fridge", "车载冰箱", "Car Fridges", "车载冰箱", "Car Fridges", [299, 1999], "appliance"],
      ["steering-cover", "方向盘套", "Steering Covers", "方向盘套", "Steering Covers", [39, 399], "auto"],
    ],
  },
  {
    key: "books",
    name: "图书文娱",
    nameEn: "Books & Media",
    pitchZh: "优质内容与精良印制，值得反复翻阅。",
    pitchEn: "Quality writing and fine printing worth returning to.",
    brands: ["modu", "paperly"],
    leaves: [
      ["novels", "小说", "Novels", "小说", "Novels", [19, 199], "book"],
      ["essays", "文学散文", "Essays", "文学散文", "Essays", [19, 149], "book"],
      ["business-books", "经管", "Business Books", "经管", "Business Books", [29, 299], "book"],
      ["investing-books", "投资理财", "Investing Books", "投资理财", "Investing Books", [29, 199], "book"],
      ["computer-books", "计算机", "Computer Books", "计算机", "Computer Books", [39, 399], "book"],
      ["science-books", "科普", "Science Books", "科普", "Science Books", [19, 199], "book"],
      ["picture-books", "童书绘本", "Picture Books", "童书绘本", "Picture Books", [19, 199], "book"],
      ["art-albums", "艺术画册", "Art Albums", "艺术画册", "Art Albums", [49, 899], "book"],
      ["exam-books", "教辅", "Study Guides", "教辅", "Study Guides", [19, 99], "book"],
      ["magazines", "杂志", "Magazines", "杂志", "Magazines", [9, 59], "book"],
      ["history-books", "历史", "History Books", "历史", "History Books", [19, 199], "book"],
      ["psychology-books", "心理学", "Psychology Books", "心理学", "Psychology Books", [29, 199], "book"],
    ],
  },
  {
    key: "jewelry",
    name: "珠宝配饰",
    nameEn: "Jewelry",
    pitchZh: "贵金属与天然宝石，工艺细节经得起近看。",
    pitchEn: "Precious metals and natural stones finished for close inspection.",
    brands: ["linlang", "aurum"],
    leaves: [
      ["gold-necklace", "黄金项链", "Gold Necklaces", "黄金项链", "Gold Necklaces", [299, 29999], "jewelry"],
      ["diamond-ring", "钻石戒指", "Diamond Rings", "钻石戒指", "Diamond Rings", [599, 49999], "jewelry"],
      ["pearl-earrings", "珍珠耳饰", "Pearl Earrings", "珍珠耳饰", "Pearl Earrings", [99, 9999], "jewelry"],
      ["silver-bracelet", "银手链", "Silver Bracelets", "银手链", "Silver Bracelets", [129, 2999], "jewelry"],
      ["mechanical-watch", "机械腕表", "Mechanical Watches", "机械腕表", "Mechanical Watches", [999, 49999], "jewelry"],
      ["gem-pendant", "宝石吊坠", "Gem Pendants", "宝石吊坠", "Gem Pendants", [299, 9999], "jewelry"],
      ["couple-rings", "情侣对戒", "Couple Rings", "情侣对戒", "Couple Rings", [199, 9999], "jewelry"],
      ["baby-lock", "长命锁", "Baby Lock Pendants", "长命锁", "Baby Lock Pendants", [299, 4999], "jewelry"],
      ["jewelry-care", "珠宝保养", "Jewelry Care", "珠宝保养", "Jewelry Care", [19, 99], "beauty"],
      ["jewelry-box", "首饰盒", "Jewelry Boxes", "首饰盒", "Jewelry Boxes", [29, 299], "home"],
      ["gold-bangle", "黄金手镯", "Gold Bangles", "黄金手镯", "Gold Bangles", [999, 49999], "jewelry"],
      ["brooch", "胸针", "Brooches", "胸针", "Brooches", [99, 4999], "jewelry"],
    ],
  },
  {
    key: "pet",
    name: "宠物生活",
    nameEn: "Pet Supplies",
    pitchZh: "营养配比与舒适设计，照顾毛孩子的日常。",
    pitchEn: "Balanced nutrition and comfortable designs for everyday pet care.",
    brands: ["pawly", "meowdo"],
    leaves: [
      ["dog-food", "狗粮", "Dog Food", "狗粮", "Dog Food", [39, 699], "pet"],
      ["cat-food", "猫粮", "Cat Food", "猫粮", "Cat Food", [39, 699], "pet"],
      ["pet-treats", "宠物零食", "Pet Treats", "宠物零食", "Pet Treats", [9, 99], "pet"],
      ["cat-litter", "猫砂", "Cat Litter", "猫砂", "Cat Litter", [19, 199], "grocery"],
      ["pet-toys", "宠物玩具", "Pet Toys", "宠物玩具", "Pet Toys", [19, 199], "toy"],
      ["pet-shampoo", "宠物沐浴露", "Pet Shampoo", "宠物沐浴露", "Pet Shampoo", [19, 199], "beauty"],
      ["cat-tree", "猫爬架", "Cat Trees", "猫爬架", "Cat Trees", [99, 999], "home"],
      ["pet-bed", "宠物窝", "Pet Beds", "宠物窝", "Pet Beds", [49, 799], "home"],
      ["leash", "牵引绳", "Leashes", "牵引绳", "Leashes", [19, 199], "bag"],
      ["pet-bowl", "食盆", "Pet Bowls", "食盆", "Pet Bowls", [19, 199], "home"],
      ["pet-stroller", "宠物推车", "Pet Strollers", "宠物推车", "Pet Strollers", [199, 1999], "home"],
      ["cat-scratcher", "猫抓板", "Cat Scratchers", "猫抓板", "Cat Scratchers", [19, 199], "home"],
    ],
  },
  {
    key: "health",
    name: "医药保健",
    nameEn: "Health & Wellness",
    pitchZh: "科学配方与可追溯原料，日常养护更安心。",
    pitchEn: "Evidence-based formulas and traceable ingredients for daily wellness.",
    brands: ["welness", "herbao"],
    leaves: [
      ["vitamins", "维生素", "Vitamins", "维生素", "Vitamins", [29, 399], "health"],
      ["protein-powder", "蛋白粉", "Protein Powder", "蛋白粉", "Protein Powder", [99, 699], "health"],
      ["fish-oil", "鱼油", "Fish Oil", "鱼油", "Fish Oil", [59, 399], "health"],
      ["blood-pressure-monitor", "血压计", "Blood Pressure Monitors", "血压计", "Blood Pressure Monitors", [129, 1999], "accessory"],
      ["glucose-meter", "血糖仪", "Glucose Meters", "血糖仪", "Glucose Meters", [99, 999], "accessory"],
      ["neck-massager", "颈椎按摩仪", "Neck Massagers", "颈椎按摩仪", "Neck Massagers", [99, 1999], "accessory"],
      ["fascia-gun", "筋膜枪", "Fascia Guns", "筋膜枪", "Fascia Guns", [199, 1999], "appliance"],
      ["eye-massager", "护眼仪", "Eye Massagers", "护眼仪", "Eye Massagers", [99, 999], "accessory"],
      ["first-aid-kit", "急救包", "First Aid Kits", "急救包", "First Aid Kits", [39, 399], "home"],
      ["medical-masks", "医用口罩", "Medical Masks", "医用口罩", "Medical Masks", [9, 99], "grocery"],
      ["calcium", "钙片", "Calcium Supplements", "钙片", "Calcium Supplements", [29, 299], "health"],
      ["probiotics", "益生菌", "Probiotics", "益生菌", "Probiotics", [49, 399], "health"],
    ],
  },
  {
    key: "tools",
    name: "五金工具",
    nameEn: "Tools & Hardware",
    pitchZh: "工业级精度与耐用材质，专业施工与家庭维修都适用。",
    pitchEn: "Industrial precision and durable materials for pros and home repairs.",
    brands: ["ironix", "toolpro"],
    leaves: [
      ["drill", "电钻", "Drills", "电钻", "Drills", [199, 3999], "tools"],
      ["angle-grinder", "角磨机", "Angle Grinders", "角磨机", "Angle Grinders", [199, 1999], "tools"],
      ["wrench-set", "扳手套装", "Wrench Sets", "扳手套装", "Wrench Sets", [49, 1999], "tools"],
      ["screwdriver", "螺丝刀", "Screwdrivers", "螺丝刀", "Screwdrivers", [19, 299], "tools"],
      ["screws", "螺丝", "Screws", "螺丝", "Screws", [9, 99], "industrial"],
      ["tape-measure", "卷尺", "Tape Measures", "卷尺", "Tape Measures", [9, 59], "industrial"],
      ["laser-measure", "激光测距仪", "Laser Measures", "激光测距仪", "Laser Measures", [99, 1999], "accessory"],
      ["spirit-level", "水平仪", "Spirit Levels", "水平仪", "Spirit Levels", [29, 299], "industrial"],
      ["cut-gloves", "防割手套", "Cut-resistant Gloves", "防割手套", "Cut-resistant Gloves", [19, 199], "apparel"],
      ["safety-helmet", "安全帽", "Safety Helmets", "安全帽", "Safety Helmets", [19, 199], "industrial"],
      ["rotary-hammer", "电锤", "Rotary Hammers", "电锤", "Rotary Hammers", [299, 2999], "tools"],
      ["cutting-disc", "切割片", "Cutting Discs", "切割片", "Cutting Discs", [5, 99], "industrial"],
    ],
  },
  {
    key: "instrument",
    name: "乐器影音",
    nameEn: "Instruments & A/V",
    pitchZh: "稳定音准与扎实做工，练习与演出都能胜任。",
    pitchEn: "Stable tuning and solid build for practice and performance.",
    brands: ["sonix", "rhythm"],
    leaves: [
      ["acoustic-guitar", "民谣吉他", "Acoustic Guitars", "民谣吉他", "Acoustic Guitars", [399, 9999], "instrument"],
      ["electric-guitar", "电吉他", "Electric Guitars", "电吉他", "Electric Guitars", [999, 19999], "instrument"],
      ["digital-piano", "电钢琴", "Digital Pianos", "电钢琴", "Digital Pianos", [899, 19999], "instrument"],
      ["electronic-keyboard", "电子琴", "Electronic Keyboards", "电子琴", "Electronic Keyboards", [399, 9999], "instrument"],
      ["drum-kit", "架子鼓", "Drum Kits", "架子鼓", "Drum Kits", [999, 19999], "instrument"],
      ["violin", "小提琴", "Violins", "小提琴", "Violins", [399, 19999], "instrument"],
      ["microphone", "麦克风", "Microphones", "麦克风", "Microphones", [199, 4999], "audio"],
      ["effect-pedal", "效果器", "Effect Pedals", "效果器", "Effect Pedals", [99, 2999], "instrument"],
      ["ukulele", "尤克里里", "Ukuleles", "尤克里里", "Ukuleles", [99, 999], "instrument"],
      ["music-accessories", "乐器配件", "Music Accessories", "乐器配件", "Music Accessories", [19, 299], "instrument"],
      ["erhu", "二胡", "Erhu", "二胡", "Erhu", [299, 4999], "instrument"],
      ["saxophone", "萨克斯", "Saxophones", "萨克斯", "Saxophones", [1999, 29999], "instrument"],
    ],
  },
  {
    key: "gift",
    name: "礼品鲜花",
    nameEn: "Gifts & Flowers",
    pitchZh: "当日达配送与精选包装，把心意完整送到。",
    pitchEn: "Same-day delivery and thoughtful packaging that arrives intact.",
    brands: ["flora", "gifty"],
    leaves: [
      ["rose-bouquet", "玫瑰花束", "Rose Bouquets", "玫瑰花束", "Rose Bouquets", [69, 999], "gift"],
      ["preserved-flower", "永生花", "Preserved Flowers", "永生花", "Preserved Flowers", [129, 999], "gift"],
      ["holiday-gift-box", "节日礼盒", "Holiday Gift Boxes", "节日礼盒", "Holiday Gift Boxes", [29, 499], "gift"],
      ["birthday-cake", "生日蛋糕", "Birthday Cakes", "生日蛋糕", "Birthday Cakes", [59, 399], "grocery"],
      ["chocolate-gift", "巧克力礼盒", "Chocolate Gifts", "巧克力礼盒", "Chocolate Gifts", [19, 199], "grocery"],
      ["engraved-gift", "定制刻字", "Engraved Gifts", "定制刻字", "Engraved Gifts", [29, 599], "gift"],
      ["greeting-card", "贺卡", "Greeting Cards", "贺卡", "Greeting Cards", [9, 59], "office"],
      ["aroma-gift", "香薰礼盒", "Aroma Gift Sets", "香薰礼盒", "Aroma Gift Sets", [59, 499], "beauty"],
      ["fruit-basket", "果篮", "Fruit Baskets", "果篮", "Fruit Baskets", [99, 599], "grocery"],
      ["souvenir", "伴手礼", "Souvenirs", "伴手礼", "Souvenirs", [19, 199], "gift"],
      ["gift-card", "礼品卡", "Gift Cards", "礼品卡", "Gift Cards", [50, 2000], "gift"],
      ["balloon-decor", "气球布置", "Balloon Decor", "气球布置", "Balloon Decor", [99, 999], "gift"],
    ],
  },
  {
    key: "garden",
    name: "农资园艺",
    nameEn: "Garden & Farm",
    pitchZh: "适合家庭种植的配方与工具，阳台也能有好收成。",
    pitchEn: "Home-gardening formulas and tools for productive balconies.",
    brands: ["greenly", "gardena"],
    leaves: [
      ["pothos", "绿萝", "Pothos", "绿萝", "Pothos", [19, 199], "garden"],
      ["succulent", "多肉", "Succulents", "多肉", "Succulents", [9, 99], "garden"],
      ["flower-seeds", "花卉种子", "Flower Seeds", "花卉种子", "Flower Seeds", [5, 39], "garden"],
      ["vegetable-seeds", "蔬菜种子", "Vegetable Seeds", "蔬菜种子", "Vegetable Seeds", [5, 29], "garden"],
      ["compound-fertilizer", "复合肥", "Compound Fertilizer", "复合肥", "Compound Fertilizer", [9, 99], "garden"],
      ["potting-soil", "营养土", "Potting Soil", "营养土", "Potting Soil", [9, 59], "garden"],
      ["flower-pot", "花盆", "Flower Pots", "花盆", "Flower Pots", [9, 99], "home"],
      ["garden-tools", "园艺工具", "Garden Tools", "园艺工具", "Garden Tools", [29, 299], "tools"],
      ["watering-can", "浇水壶", "Watering Cans", "浇水壶", "Watering Cans", [19, 99], "garden"],
      ["drip-irrigation", "自动灌溉", "Drip Irrigation", "自动灌溉", "Drip Irrigation", [29, 299], "garden"],
      ["pruning-shears", "园艺剪刀", "Pruning Shears", "园艺剪刀", "Pruning Shears", [19, 199], "tools"],
      ["plant-stand", "花架", "Plant Stands", "花架", "Plant Stands", [29, 499], "home"],
    ],
  },
  {
    key: "beverage",
    name: "酒水饮料",
    nameEn: "Drinks",
    pitchZh: "原产地直采与规范储运，口感到手如初。",
    pitchEn: "Origin-sourced with controlled storage and shipping.",
    brands: ["shanhai", "moonbrew"],
    leaves: [
      ["mineral-water", "矿泉水", "Mineral Water", "矿泉水", "Mineral Water", [5, 59], "beverage"],
      ["soda-water", "苏打水", "Soda Water", "苏打水", "Soda Water", [5, 49], "beverage"],
      ["green-tea", "绿茶", "Green Tea", "绿茶", "Green Tea", [29, 599], "beverage"],
      ["black-tea", "红茶", "Black Tea", "红茶", "Black Tea", [29, 599], "beverage"],
      ["coffee-beans", "咖啡豆", "Coffee Beans", "咖啡豆", "Coffee Beans", [39, 299], "beverage"],
      ["drip-coffee", "挂耳咖啡", "Drip Coffee", "挂耳咖啡", "Drip Coffee", [19, 299], "beverage"],
      ["juice-drink", "果汁", "Juice", "果汁", "Juice", [5, 59], "beverage"],
      ["craft-beer", "精酿啤酒", "Craft Beer", "精酿啤酒", "Craft Beer", [9, 199], "beverage"],
      ["red-wine", "红酒", "Red Wine", "红酒", "Red Wine", [59, 999], "beverage"],
      ["baijiu", "白酒", "Baijiu", "白酒", "Baijiu", [59, 1299], "beverage"],
      ["milk-tea", "奶茶", "Milk Tea", "奶茶", "Milk Tea", [5, 59], "beverage"],
      ["rice-wine", "黄酒", "Rice Wine", "黄酒", "Rice Wine", [19, 399], "beverage"],
    ],
  },
  {
    key: "accessory",
    name: "数码配件",
    nameEn: "Digital Accessories",
    pitchZh: "兼容主流设备与安全快充协议，随身携带不占地方。",
    pitchEn: "Compatible with mainstream devices and fast-charge standards.",
    brands: ["xingye", "linkpro"],
    leaves: [
      ["gan-charger", "氮化镓充电器", "GaN Chargers", "氮化镓充电器", "GaN Chargers", [49, 499], "accessory"],
      ["braided-cable", "数据线", "Braided Cables", "数据线", "Braided Cables", [19, 199], "accessory"],
      ["magnetic-powerbank", "移动电源", "Power Banks", "移动电源", "Power Banks", [89, 699], "accessory"],
      ["phone-case", "手机壳", "Phone Cases", "手机壳", "Phone Cases", [19, 199], "accessory"],
      ["tempered-glass", "钢化膜", "Screen Protectors", "钢化膜", "Screen Protectors", [9, 99], "accessory"],
      ["desk-stand", "桌面支架", "Desk Stands", "桌面支架", "Desk Stands", [29, 299], "accessory"],
      ["selfie-stick", "自拍杆", "Selfie Sticks", "自拍杆", "Selfie Sticks", [19, 199], "accessory"],
      ["memory-card", "存储卡", "Memory Cards", "存储卡", "Memory Cards", [29, 399], "accessory"],
      ["card-reader", "读卡器", "Card Readers", "读卡器", "Card Readers", [19, 99], "accessory"],
      ["cleaning-kit", "清洁套装", "Cleaning Kits", "清洁套装", "Cleaning Kits", [9, 59], "accessory"],
      ["wireless-charger", "无线充电器", "Wireless Chargers", "无线充电器", "Wireless Chargers", [49, 399], "accessory"],
      ["phone-cooler", "手机散热器", "Phone Coolers", "手机散热器", "Phone Coolers", [39, 299], "accessory"],
    ],
  },
  {
    key: "office",
    name: "办公耗材",
    nameEn: "Office Supplies",
    pitchZh: "日常办公的高频消耗品，稳定供应、开票便捷。",
    pitchEn: "High-frequency office consumables with reliable supply and invoicing.",
    brands: ["wenxi", "staple", "leafly"],
    leaves: [
      ["a4-paper", "A4纸", "A4 Paper", "A4纸", "A4 Paper", [15, 99], "office"],
      ["gel-pens", "中性笔", "Gel Pens", "中性笔", "Gel Pens", [9, 59], "office"],
      ["notebooks", "笔记本", "Notebooks", "笔记本", "Notebooks", [9, 59], "office"],
      ["folders", "文件夹", "Folders", "文件夹", "Folders", [5, 39], "office"],
      ["stapler", "订书机", "Staplers", "订书机", "Staplers", [9, 59], "office"],
      ["stamps", "印章", "Stamps", "印章", "Stamps", [9, 99], "office"],
      ["ink-cartridge", "墨盒", "Ink Cartridges", "墨盒", "Ink Cartridges", [39, 299], "office"],
      ["label-paper", "标签纸", "Label Paper", "标签纸", "Label Paper", [9, 59], "office"],
      ["whiteboard", "白板", "Whiteboards", "白板", "Whiteboards", [99, 999], "office"],
      ["shredder", "碎纸机", "Shredders", "碎纸机", "Shredders", [199, 999], "office"],
      ["calculators", "计算器", "Calculators", "计算器", "Calculators", [19, 199], "office"],
      ["file-cabinets", "文件柜", "File Cabinets", "文件柜", "File Cabinets", [199, 1999], "home"],
    ],
  },
  {
    key: "industrial",
    name: "工业品",
    nameEn: "Industrial Supplies",
    pitchZh: "工业级规格与稳定供货，支持批量采购。",
    pitchEn: "Industrial-grade specifications with stable supply for bulk purchase.",
    brands: ["bearx", "voltway", "ironix"],
    leaves: [
      ["bearings", "轴承", "Bearings", "轴承", "Bearings", [9, 299], "industrial"],
      ["motors", "电机", "Motors", "电机", "Motors", [99, 1999], "industrial"],
      ["pneumatic-parts", "气动元件", "Pneumatic Parts", "气动元件", "Pneumatic Parts", [19, 999], "industrial"],
      ["hydraulic-parts", "液压件", "Hydraulic Parts", "液压件", "Hydraulic Parts", [29, 1999], "industrial"],
      ["sensors", "传感器", "Sensors", "传感器", "Sensors", [19, 999], "industrial"],
      ["relays", "继电器", "Relays", "继电器", "Relays", [9, 199], "industrial"],
      ["power-cables", "电缆", "Power Cables", "电缆", "Power Cables", [9, 299], "industrial"],
      ["distribution-box", "配电箱", "Distribution Boxes", "配电箱", "Distribution Boxes", [99, 1999], "industrial"],
      ["industrial-adhesive", "工业胶粘剂", "Industrial Adhesives", "工业胶粘剂", "Industrial Adhesives", [9, 99], "industrial"],
      ["ppe-suits", "劳保用品", "PPE Supplies", "劳保用品", "PPE Supplies", [29, 299], "industrial"],
      ["inverters", "变频器", "Inverters", "变频器", "Inverters", [199, 2999], "industrial"],
      ["reducers", "减速机", "Reducers", "减速机", "Reducers", [199, 3999], "industrial"],
    ],
  },
  {
    key: "cleaning",
    name: "清洁日化",
    nameEn: "Home Cleaning",
    pitchZh: "高效去污与温和配方，覆盖全屋清洁场景。",
    pitchEn: "Effective cleaning with gentle formulas for the whole home.",
    brands: ["purity", "cleano", "sunglow"],
    leaves: [
      ["laundry-liquid", "洗衣液", "Laundry Detergent", "洗衣液", "Laundry Detergent", [19, 99], "cleaning"],
      ["dish-soap", "洗洁精", "Dish Soap", "洗洁精", "Dish Soap", [9, 59], "cleaning"],
      ["disinfectant", "消毒液", "Disinfectant", "消毒液", "Disinfectant", [9, 59], "cleaning"],
      ["toilet-cleaner", "洁厕灵", "Toilet Cleaner", "洁厕灵", "Toilet Cleaner", [9, 39], "cleaning"],
      ["facial-tissues", "抽纸", "Facial Tissues", "抽纸", "Facial Tissues", [9, 59], "cleaning"],
      ["toilet-paper", "卷纸", "Toilet Paper", "卷纸", "Toilet Paper", [9, 59], "cleaning"],
      ["trash-bags", "垃圾袋", "Trash Bags", "垃圾袋", "Trash Bags", [5, 39], "cleaning"],
      ["mop", "拖把", "Mops", "拖把", "Mops", [19, 199], "cleaning"],
      ["cleaning-cloths", "抹布", "Cleaning Cloths", "抹布", "Cleaning Cloths", [5, 39], "cleaning"],
      ["air-freshener", "空气清新剂", "Air Fresheners", "空气清新剂", "Air Fresheners", [9, 39], "cleaning"],
      ["glass-cleaner", "玻璃清洁剂", "Glass Cleaner", "玻璃清洁剂", "Glass Cleaner", [9, 39], "cleaning"],
      ["mite-spray", "除螨喷雾", "Mite Spray", "除螨喷雾", "Mite Spray", [19, 99], "cleaning"],
    ],
  },
];

/* ------------------------------------------------------------------------- */
/* Brands and shops                                                          */
/* ------------------------------------------------------------------------- */

const BRANDS = [
  ["xingye", "星野", "Xingye", "星野智能：旗舰手机、平板与可穿戴的星系产品线。", "Xingye: flagship phones, tablets and wearables from the Aurora line."],
  ["yunqi", "云栖", "Yunqi", "云栖家电：以静音、节能与智能联动见长的全屋家电品牌。", "Yunqi: quiet, efficient and connected home appliances."],
  ["polarday", "极昼", "Polarday", "极昼影像：面向创作者的高画质影像设备。", "Polarday: high-image-quality cameras for creators."],
  ["inkshadow", "墨影", "Inkshadow", "墨影科技：为设计与开发人群打造的生产力硬件。", "Inkshadow: productivity hardware for designers and developers."],
  ["qcloud", "擎云", "Qcloud", "擎云商用：稳定可靠的办公与打印方案。", "Qcloud: dependable office and printing solutions."],
  ["egret", "白鹭", "Egret", "白鹭电器：小体积、大容量的厨房与生活电器。", "Egret: compact yet capable kitchen and living appliances."],
  ["sunglow", "沐光", "Sunglow", "沐光环境：空气与水健康的家庭解决方案。", "Sunglow: home solutions for cleaner air and water."],
  ["shiguang", "拾光", "Shiguang", "拾光服饰：天然面料与克制设计的日常衣橱。", "Shiguang: an everyday wardrobe of natural fabrics and restrained design."],
  ["suye", "素野", "Suye", "素野：轻户外与城市通勤之间的平衡穿着。", "Suye: balanced pieces between light outdoor and city commute."],
  ["mistral", "山岚", "Mistral", "山岚皮具：耐用结构与手工细节的箱包品牌。", "Mistral: bags with durable structure and hand-finished details."],
  ["mubai", "沐白", "Mubai", "沐白护肤：以实证功效为核心的温和配方。", "Mubai: gentle formulas built around proven actives."],
  ["cottona", "初棉", "Cottona", "初棉：敏感肌可用的棉感彩妆与洗护。", "Cottona: cotton-soft makeup and care for sensitive skin."],
  ["bloomish", "花间", "Bloomish", "花间香氛：东方调与自然气息的香氛作品。", "Bloomish: fragrances blending oriental notes with nature."],
  ["shanhai", "山海", "Shanhai", "山海食品：产地直采的原味食材与零食。", "Shanhai: direct-sourced ingredients and snacks."],
  ["grainly", "稻源", "Grainly", "稻源：从田间到餐桌的粮油品牌。", "Grainly: grain and oil from field to table."],
  ["fruity", "果野", "Fruity", "果野：当季鲜果与冷链直配。", "Fruity: seasonal fruit with cold-chain delivery."],
  ["qimu", "栖木", "Qimu", "栖木母婴：安全材质与成长友好设计。", "Qimu: safe materials and growth-friendly design."],
  ["kidgo", "童行", "Kidgo", "童行：让出行与玩耍更轻松的童品品牌。", "Kidgo: children's gear that makes travel and play easier."],
  ["fawnly", "小鹿", "Fawnly", "小鹿玩具：益智与安全并重的玩具。", "Fawnly: toys that balance learning and safety."],
  ["senyu", "森屿", "Senyu", "森屿户外：轻量化露营与健身装备。", "Senyu: lightweight camping and fitness gear."],
  ["gale", "疾风", "Gale", "疾风运动：为速度与耐力训练设计。", "Gale: designed for speed and endurance training."],
  ["summit", "峰行", "Summit", "峰行：面向长途徒步与登山的专业装备。", "Summit: professional gear for long hikes and climbs."],
  ["muli", "木里", "Muli", "木里家居：实木与天然材质的生活器物。", "Muli: solid wood and natural materials for daily living."],
  ["cozylife", "暖居", "Cozylife", "暖居：让家更舒适的软装与收纳。", "Cozylife: soft furnishings and storage that make home cosier."],
  ["forme", "简舍", "Forme", "简舍：极简结构与耐用工艺。", "Forme: minimalist structures with durable craft."],
  ["ridge", "途岳", "Ridge", "途岳汽车：车规级用料的养护与配件。", "Ridge: automotive-grade care and accessories."],
  ["ridex", "驰野", "Ridex", "驰野：面向长途与复杂路况的车载装备。", "Ridex: in-car gear for long drives and rough roads."],
  ["modu", "墨读", "Modu", "墨读文化：文学与思想类精品出版。", "Modu: finely published literature and ideas."],
  ["paperly", "纸间", "Paperly", "纸间：艺术、生活与童书的出版品牌。", "Paperly: art, lifestyle and children's books."],
  ["linlang", "琳琅", "Linlang", "琳琅珠宝：足金与天然宝石的日常首饰。", "Linlang: everyday jewellery in fine gold and natural stones."],
  ["aurum", "金阶", "Aurum", "金阶：高阶材质与工艺的珠宝腕表。", "Aurum: jewellery and watches in premium materials."],
  ["pawly", "爪印", "Pawly", "爪印宠物：营养主粮与日常护理。", "Pawly: balanced food and daily care for pets."],
  ["meowdo", "喵坞", "Meowdo", "喵坞：为猫犬设计的生活用品。", "Meowdo: living essentials designed for cats and dogs."],
  ["welness", "康野", "Welness", "康野健康：科学配比的日常营养。", "Welness: everyday nutrition with scientific ratios."],
  ["herbao", "本草", "Herbao", "本草堂：药食同源的养生配方。", "Herbao: wellness formulas from food-grade herbs."],
  ["ironix", "铁匠", "Ironix", "铁匠工具：工业级精度的手动与电动工具。", "Ironix: industrial-precision hand and power tools."],
  ["toolpro", "工博", "Toolpro", "工博：测量、紧固与劳保的专业选择。", "Toolpro: measuring, fastening and safety essentials."],
  ["sonix", "音潮", "Sonix", "音潮乐器：稳定音准与扎实做工。", "Sonix: stable tuning and solid build."],
  ["rhythm", "律动", "Rhythm", "律动影音：练习与演出级音频设备。", "Rhythm: audio gear for practice and stage."],
  ["flora", "花礼", "Flora", "花礼：当日达鲜花与礼盒。", "Flora: same-day flowers and gift boxes."],
  ["gifty", "礼遇", "Gifty", "礼遇：节日礼赠与定制礼品。", "Gifty: festive gifting and custom presents."],
  ["linkpro", "极链", "Linkpro", "极链配件：兼容主流设备的快充与保护。", "Linkpro: fast charging and protection for mainstream devices."],
  ["greenly", "绿野", "Greenly", "绿野园艺：家庭种植的配方与工具。", "Greenly: home-gardening formulas and tools."],
  ["gardena", "园丁", "Gardena", "园丁：耐用的园艺与浇灌装备。", "Gardena: durable garden and watering equipment."],
  ["moonbrew", "醉月", "Moonbrew", "醉月酒饮：小批量精酿与低度酒。", "Moonbrew: small-batch craft and low-ABV drinks."],
  ["wenxi", "文曦", "Wenxi", "文曦办公：为团队提供稳定耐用的办公耗材。", "Wenxi: dependable, durable office consumables for teams."],
  ["staple", "标点", "Staple", "标点：文具与桌面办公的日常选择。", "Staple: everyday stationery and desktop office supplies."],
  ["leafly", "简页", "Leafly", "简页：简约设计与环保用料的纸品品牌。", "Leafly: paper goods with minimal design and recycled materials."],
  ["purity", "净澈", "Purity", "净澈：高效去污的全屋清洁配方。", "Purity: effective whole-home cleaning formulas."],
  ["cleano", "洁灵", "Cleano", "洁灵：温和不伤手的日化清洁品牌。", "Cleano: gentle household cleaning that is kind to hands."],
  ["bearx", "承轴", "Bearx", "承轴工业：轴承与传动件的稳定供应。", "Bearx: stable supply of bearings and transmission parts."],
  ["voltway", "电通", "Voltway", "电通：工业电气与配电解决方案。", "Voltway: industrial electrical and distribution solutions."],
];

const BRAND_BY_KEY = new Map(BRANDS.map(([key, zh, en, descZh, descEn]) => [
  key,
  { key, nameZh: zh, nameEn: en, descZh, descEn },
]));

const SHOPS = [
  ["official", "星野商城自营旗舰店", "Xingye Mall Flagship Store", "平台自营，正品直发，全场满 99 元包邮，支持 7 天无理由退换。", "Platform-operated store with direct shipping, free delivery over ¥99 and 7-day returns.", "official", "self-operated"],
  ["xingye-flagship", "星野官方旗舰店", "Xingye Official Store", "手机、平板与可穿戴官方直营，享官方质保。", "Official store for phones, tablets and wearables with manufacturer warranty.", "brand", "merchant"],
  ["yunqi-flagship", "云栖家电旗舰店", "Yunqi Appliance Store", "全屋家电官方直营，送装一体服务。", "Official home-appliance store with delivery and installation.", "brand", "merchant"],
  ["shiguang-flagship", "拾光服饰旗舰店", "Shiguang Fashion Store", "天然面料日常衣橱，支持 30 天无忧退换。", "Everyday wardrobe in natural fabrics with 30-day returns.", "brand", "merchant"],
  ["mubai-flagship", "沐白美妆旗舰店", "Mubai Beauty Store", "实证功效护肤与彩妆，正品保障。", "Proven-actives skincare and makeup, authenticity guaranteed.", "brand", "merchant"],
  ["shanhai-flagship", "山海食品旗舰店", "Shanhai Food Store", "产地直采食材，冷链直达。", "Origin-sourced ingredients delivered by cold chain.", "brand", "merchant"],
  ["qimu-flagship", "栖木母婴旗舰店", "Qimu Baby Store", "母婴全品类官方店，安全材质可追溯。", "Official baby store with traceable, safe materials.", "brand", "merchant"],
  ["senyu-flagship", "森屿户外旗舰店", "Senyu Outdoor Store", "轻量化露营与健身装备，专业售后。", "Lightweight camping and fitness gear with professional support.", "brand", "merchant"],
  ["muli-flagship", "木里家居旗舰店", "Muli Home Store", "实木与天然材质家居家饰。", "Solid-wood and natural-material home furnishings.", "brand", "merchant"],
  ["ridge-flagship", "途岳汽车用品店", "Ridge Auto Store", "车规级养护与配件，适配主流车型。", "Automotive-grade care and accessories for mainstream models.", "brand", "merchant"],
  ["linlang-flagship", "琳琅珠宝旗舰店", "Linlang Jewellery Store", "足金与天然宝石首饰，支持复检。", "Fine gold and natural-stone jewellery with re-inspection.", "brand", "merchant"],
  ["pawly-flagship", "爪印宠物旗舰店", "Pawly Pet Store", "营养主粮与日常护理，宠粮可溯源。", "Balanced food and daily care with traceable ingredients.", "brand", "merchant"],
  ["sonix-flagship", "音潮乐器旗舰店", "Sonix Instrument Store", "乐器与音频设备，支持调音售后。", "Instruments and audio gear with setup support.", "brand", "merchant"],
  ["flora-flagship", "花礼鲜花旗舰店", "Flora Flower Store", "当日达鲜花与节日礼盒。", "Same-day flowers and festive gift boxes.", "specialty", "merchant"],
  ["ironix-flagship", "铁匠工具旗舰店", "Ironix Tools Store", "工业级工具，正品授权与终身维护。", "Industrial-grade tools with authorised warranty and lifetime service.", "brand", "merchant"],
  ["greenly-flagship", "绿野园艺旗舰店", "Greenly Garden Store", "家庭园艺配方、工具与绿植。", "Home-gardening formulas, tools and plants.", "specialty", "merchant"],
  ["office-flagship", "文曦办公旗舰店", "Wenxi Office Store", "办公耗材与文具一站式采购，支持企业开票。", "One-stop office supplies and stationery with business invoicing.", "specialty", "merchant"],
  ["industrial-flagship", "承轴工业品旗舰店", "Bearx Industrial Store", "轴承、电机与电气元件，批量采购享阶梯价。", "Bearings, motors and electrical parts with volume pricing.", "brand", "merchant"],
  ["cleaning-flagship", "净澈清洁旗舰店", "Purity Cleaning Store", "全屋清洁日化，家庭装更划算。", "Whole-home cleaning essentials with value family packs.", "brand", "merchant"],
];

/** Brand -> storefront shop; every brand maps to exactly one shop. */
const SHOP_BY_BRAND = {
  xingye: "xingye-flagship",
  yunqi: "yunqi-flagship",
  polarday: "xingye-flagship",
  inkshadow: "xingye-flagship",
  qcloud: "xingye-flagship",
  egret: "yunqi-flagship",
  sunglow: "yunqi-flagship",
  shiguang: "shiguang-flagship",
  suye: "shiguang-flagship",
  mistral: "shiguang-flagship",
  mubai: "mubai-flagship",
  cottona: "mubai-flagship",
  bloomish: "mubai-flagship",
  shanhai: "shanhai-flagship",
  grainly: "shanhai-flagship",
  fruity: "shanhai-flagship",
  qimu: "qimu-flagship",
  kidgo: "qimu-flagship",
  fawnly: "qimu-flagship",
  senyu: "senyu-flagship",
  gale: "senyu-flagship",
  summit: "senyu-flagship",
  muli: "muli-flagship",
  cozylife: "muli-flagship",
  forme: "muli-flagship",
  ridge: "ridge-flagship",
  ridex: "ridge-flagship",
  modu: "official",
  paperly: "official",
  linlang: "linlang-flagship",
  aurum: "linlang-flagship",
  pawly: "pawly-flagship",
  meowdo: "pawly-flagship",
  welness: "official",
  herbao: "official",
  ironix: "ironix-flagship",
  toolpro: "ironix-flagship",
  sonix: "sonix-flagship",
  rhythm: "sonix-flagship",
  flora: "flora-flagship",
  gifty: "flora-flagship",
  linkpro: "xingye-flagship",
  greenly: "greenly-flagship",
  gardena: "greenly-flagship",
  moonbrew: "shanhai-flagship",
  "wenxi": "office-flagship",
  "staple": "office-flagship",
  "leafly": "office-flagship",
  "purity": "cleaning-flagship",
  "cleano": "cleaning-flagship",
  "bearx": "industrial-flagship",
  "voltway": "industrial-flagship",
};

/* ------------------------------------------------------------------------- */
/* Product generation                                                        */
/* ------------------------------------------------------------------------- */

/** Value selection for SKUs by attribute key. */
function skuValuesFor(attrKey, productIndex) {
  const attr = ATTRS[attrKey];
  if (attrKey === "storage" || attrKey === "capacity") {
    return attr.values.slice(0, productIndex % 2 === 0 ? 2 : 3);
  }
  if (attrKey === "color" || attrKey === "apparelColor") {
    return attr.values.slice(0, 2);
  }
  return attr.values.slice(0, 3);
}

function buildVariants(modelPool, series) {
  const pool = MODEL_POOLS[modelPool] ?? MODEL_POOLS.generic;
  const seriesList = Array.isArray(series) ? series : ["PRIME"];
  const variants = [];
  for (const seriesCode of seriesList) {
    for (const [zh, en] of pool) {
      variants.push({ series: seriesCode, modelZh: zh, modelEn: en });
    }
  }
  return variants;
}

const KIND_TO_POOL = {
  "phone": "tech",
  "computer": "tech",
  "audio": "tech",
  "accessory": "tech",
  "apparel": "apparel",
  "shoe": "shoe",
  "bag": "apparel",
  "grocery": "consumable",
  "beverage": "consumable",
  "baby": "consumable",
  "pet": "consumable",
  "health": "consumable",
  "gift": "gift",
  "office": "consumable",
  "cleaning": "consumable",
  "tv": "generic",
  "appliance": "generic",
  "toy": "generic",
  "sports": "generic",
  "home": "generic",
  "auto": "generic",
  "book": "generic",
  "jewelry": "generic",
  "tools": "generic",
  "instrument": "generic",
  "garden": "generic",
  "industrial": "generic",
};

const KIND_TO_ATTR_SET = {
  "phone": ["storage","color"],
  "computer": ["storage","color"],
  "audio": ["color"],
  "accessory": ["color"],
  "tv": ["edition"],
  "appliance": ["edition"],
  "apparel": ["size","apparelColor"],
  "shoe": ["shoeSize","apparelColor"],
  "bag": ["material","apparelColor"],
  "beauty": ["pack"],
  "grocery": ["portion"],
  "beverage": ["portion"],
  "baby": ["pack","size"],
  "toy": ["edition"],
  "sports": ["edition"],
  "home": ["material","color"],
  "auto": ["edition"],
  "book": ["edition"],
  "jewelry": ["precious"],
  "pet": ["portion"],
  "health": ["pack"],
  "tools": ["power"],
  "instrument": ["edition"],
  "gift": ["pack"],
  "garden": ["portion"],
  "office": ["bundle"],
  "industrial": ["grade"],
  "cleaning": ["portion"],
};

function buildCategories() {
  return TAXONOMY.map((root, rootIndex) => ({
    key: root.key,
    name: root.name,
    sortOrder: (rootIndex + 1) * 10,
    children: root.leaves.map(([key, name], leafIndex) => ({
      key,
      name,
      sortOrder: (leafIndex + 1) * 10,
    })),
  }));
}

function buildShops() {
  return SHOPS.map(([key, name, nameEn, descZh, descEn, shopType, businessModel]) => ({
    key,
    name,
    description: descZh,
    shopType,
    businessModel,
    defaultCurrencyCode: "CNY",
    timezone: "Asia/Shanghai",
    nameEn,
    descEn,
  }));
}

function buildBrands() {
  return BRANDS.map(([key, name, nameEn, descZh, descEn]) => ({
    key,
    name,
    description: descZh,
    nameEn,
    descEn,
  }));
}

let barcodeSequence = 0;

function nextBarcode() {
  barcodeSequence += 1;
  return ean13(barcodeSequence);
}

const SINGULAR_ENGLISH_OVERRIDES = {
  "Mice": "Mouse",
  "Jeans": "Jeans",
  "Shelving": "Shelving",
  "Kids' Shoes": "Kids' Shoes",
  "Pothos": "Pothos",
};

/** Turns a plural category label into the noun used in a product title. */
function singularEnglish(name) {
  const override = SINGULAR_ENGLISH_OVERRIDES[name];
  if (override) {
    return override;
  }
  if (/ies$/iu.test(name)) {
    return name.replace(/ies$/iu, "y");
  }
  if (/(?:ses|ches|shes|xes)$/iu.test(name)) {
    return name.replace(/es$/iu, "");
  }
  if (/s$/iu.test(name) && name.length > 3) {
    return name.slice(0, -1);
  }
  return name;
}

function buildProducts() {
  const products = [];
  for (const root of TAXONOMY) {
    for (const leaf of root.leaves) {
      const [leafKey, leafName, leafNameEn, nounZh, , band, kind] = leaf;
      const nounEn = singularEnglish(leafNameEn);
      const series = SERIES[root.key];
      const pool = KIND_TO_POOL[kind] ?? "generic";
      const variants = buildVariants(pool, series);
      const attrKeys = LEAF_ATTR_OVERRIDES[leafKey] ?? KIND_TO_ATTR_SET[kind] ?? [];

      for (let index = 0; index < PRODUCTS_PER_LEAF; index += 1) {
        const brandKey = root.brands[index % root.brands.length];
        const brand = BRAND_BY_KEY.get(brandKey);
        if (!brand) {
          throw new Error("unknown brand " + brandKey + " at leaf " + leafKey);
        }
        const variant = variants[index % variants.length];
        const productKey = `${leafKey}-${String(index + 1).padStart(2, "0")}`;
        const productType = "physical";
        const basePrice = roundMoney(betweenSkewed(band[0], band[1]) * (1 - index * 0.012));
        const titleZh = `${brand.nameZh} ${variant.series} ${variant.modelZh} ${nounZh}`;
        const titleEn = `${brand.nameEn} ${variant.series} ${variant.modelEn} ${nounEn}`;
        const discountRate = index % 3 === 0 ? between(0.06, 0.28) : 0;
        const listPrice = discountRate > 0
          ? Math.max(basePrice, roundMoney(basePrice / (1 - discountRate)))
          : basePrice;
        const specNamesZh = attrKeys.map((attrKey) => ATTRS[attrKey].nameZh).join("、");
        const specNamesEn = attrKeys.map((attrKey) => ATTRS[attrKey].nameEn).join(", ");
        const dims = attrKeys.map((attrKey) => ({
          attrKey,
          values: skuValuesFor(attrKey, index),
        }));

        const skus = buildSkus({
          productKey,
          productType,
          dims,
          basePrice,
          listPrice,
        });

        products.push({
          key: productKey,
          shopKey: SHOP_BY_BRAND[brandKey] ?? "official",
          categoryKey: leafKey,
          brand: brand.nameZh,
          brandKey,
          title: titleZh,
          subtitle: `${leafName} · ${variant.modelZh} · ${root.pitchZh.split("，")[0]}`,
          description: `${titleZh}。${root.pitchZh}${specNamesZh ? `支持${specNamesZh}多种规格组合，` : ""}由${brand.nameZh}官方直供，附带正品质保与 7 天无理由退换，大部分地区次日达。`,
          productType,
          skus,
          keywords: [leafName, root.name, brand.nameZh, variant.series, variant.modelZh, "官方正品", "包邮", "次日达"],
          demoOnly: index === PRODUCTS_PER_LEAF - 1 ? true : undefined,
          titleEn,
          subtitleEn: `${leafNameEn} · ${variant.modelEn} · ${root.pitchEn.split(",")[0]}`,
          descriptionEn: `${titleEn}. ${root.pitchEn}${specNamesEn ? ` Available in multiple ${specNamesEn} combinations.` : ""} Shipped directly by ${brand.nameEn} with authenticity guarantee, 7-day returns and next-day delivery in most areas.`,
          nounEn,
          series: variant.series,
        });
      }
    }
  }
  return products;
}

function buildSkus({ productKey, productType, dims, basePrice, listPrice }) {
  if (dims.length === 0) {
    return [{
      key: `${productKey}-01`,
      title: "标准规格",
      titleEn: "Standard",
      price: formatMoney(basePrice),
      listPrice: formatMoney(Math.max(basePrice, listPrice)),
      barcode: productType === "physical" ? nextBarcode() : "",
    }];
  }
  const combinations = [];
  const [first, second] = dims;
  for (const firstValue of first.values) {
    if (!second) {
      combinations.push([{ dim: first, value: firstValue }]);
      continue;
    }
    for (const secondValue of second.values) {
      combinations.push([
        { dim: first, value: firstValue },
        { dim: second, value: secondValue },
      ]);
    }
  }
  return combinations.slice(0, 4).map((combination, index) => {
    const factor = combination.reduce((product, entry) => product * entry.value[2], 1);
    const price = Math.max(MIN_PRICE, roundMoney(basePrice * factor));
    const list = listPrice > basePrice
      ? Math.max(price, roundMoney(listPrice * factor))
      : price;
    const titleZh = combination.map((entry) => entry.value[0]).join(" ");
    const titleEn = combination.map((entry) => entry.value[1]).join(" ");
    return {
      key: `${productKey}-${String(index + 1).padStart(2, "0")}`,
      title: titleZh,
      titleEn,
      price: formatMoney(price),
      listPrice: formatMoney(list),
      barcode: productType === "physical" ? nextBarcode() : "",
      values: Object.fromEntries(
        combination.map((entry) => [ATTRS[entry.dim.attrKey].nameZh, entry.value[0]]),
      ),
    };
  });
}

/* ------------------------------------------------------------------------- */
/* Static blocks                                                             */
/* ------------------------------------------------------------------------- */

function buildOffers() {
  return [
    ["seckill-digital", "MALL-SECKILL-DIGITAL", "数码秒杀专场", "Digital Flash Sale", "每日 10 点、20 点两场，手机数码低至 5 折，限量 500 台。", "Two sessions daily at 10:00 and 20:00, up to 50% off, 500 units per session.", "flash-sale", "低至 5 折", "限量 500 台 · 每场 2 小时"],
    ["brand-day-xingye", "MALL-BRAND-DAY-XINGYE", "星野品牌日", "Xingye Brand Day", "星野全系产品满 3000 减 300，赠延保服务。", "¥300 off every ¥3000 across Xingye, with extended warranty for free.", "brand-day", "满 3000 减 300", "仅限品牌日 24 小时"],
    ["member-day", "MALL-MEMBER-DAY", "会员日专享", "Member Day", "会员日双倍积分，黄金及以上会员额外 95 折。", "Double points on Member Day, plus 5% off for Gold members and above.", "member-day", "双倍积分", "每月 8 日 0 点开始"],
    ["new-launch", "MALL-NEW-LAUNCH", "新品首发", "New Launch", "新品首发 7 天，尝鲜价限量供应。", "New arrivals for 7 days at launch pricing, limited stock.", "new-launch", "尝鲜价", "首发 7 天 · 限量供应"],
    ["big-promo-618", "MALL-BIG-PROMO-618", "618 年中大促", "618 Mid-year Sale", "跨店满 300 减 50，家电以旧换新补贴 10%。", "¥50 off every ¥300 across stores, plus 10% trade-in subsidy on appliances.", "big-promo", "满 300 减 50", "跨店可叠加 · 大促 3 天"],
    ["limited-rush", "MALL-LIMITED-RUSH", "限时抢购", "Limited Rush", "每日 3 场限时抢购，售完即止。", "Three rush sessions daily while stocks last.", "limited-rush", "低至 3 折", "售完即止"],
    ["seckill-appliance", "MALL-SECKILL-APPLIANCE", "家电焕新季", "Appliance Refresh", "冰箱洗衣机以旧换新，至高补贴 800 元。", "Trade in old fridges and washers for up to ¥800 subsidy.", "flash-sale", "至高补贴 800 元", "限时 5 天"],
    ["brand-day-mubai", "MALL-BRAND-DAY-MUBAI", "沐白美妆日", "Mubai Beauty Day", "护肤正装买一送一，赠正装小样。", "Buy one get one on skincare, with deluxe samples.", "brand-day", "买一送一", "赠品送完即止"],
    ["member-day-grocery", "MALL-MEMBER-DAY-GROCERY", "生鲜会员日", "Fresh Member Day", "生鲜会员日满 199 减 40，冷链包邮。", "¥40 off ¥199 on fresh groceries, cold-chain shipping included.", "member-day", "满 199 减 40", "每周三会员专享"],
    ["big-promo-double11", "MALL-BIG-PROMO-DOUBLE11", "双 11 预售", "Double 11 Presale", "预售定金翻倍抵扣，尾款再享跨店满减。", "Deposits double as credit, plus cross-store discounts on balance.", "big-promo", "定金翻倍", "预售 10 天"],
    ["limited-rush-home", "MALL-LIMITED-RUSH-HOME", "家居限时闪购", "Home Flash Sale", "家居好物限时闪购，每天 12 点开抢。", "Daily flash sale on home essentials at 12:00.", "limited-rush", "低至 4 折", "每天 12 点开抢"],
    ["demo-only-launch", "MALL-DEMO-LAUNCH", "演示专享活动", "Demo Preview Campaign", "仅用于演示环境的预览活动，不会进入正式环境。", "Preview campaign for demo environments only.", "new-launch", "演示专享", "仅演示环境", true],
  ].map(([key, code, title, titleEn, description, descriptionEn, activityType, discountText, highlight, demoOnly]) => ({
    key,
    code,
    title,
    titleEn,
    description,
    descriptionEn,
    activityType,
    discountText,
    highlight,
    demoOnly,
  }));
}

function buildMembership() {
  const plans = [
    {
      key: "bronze", code: "MALL-MEMBER-BRONZE", name: "青铜会员", nameEn: "Bronze Member", rank: 1,
      benefits: ["生日礼包", "专属客服"],
      benefitsEn: ["Birthday gift pack", "Dedicated support"],
    },
    {
      key: "silver", code: "MALL-MEMBER-SILVER", name: "白银会员", nameEn: "Silver Member", rank: 2,
      benefits: ["生日礼包", "专属客服", "每月 2 张免邮券"],
      benefitsEn: ["Birthday gift pack", "Dedicated support", "2 free-shipping coupons monthly"],
    },
    {
      key: "gold", code: "MALL-MEMBER-GOLD", name: "黄金会员", nameEn: "Gold Member", rank: 3,
      benefits: ["生日礼包", "专属客服", "每月 4 张免邮券", "会员日 95 折"],
      benefitsEn: ["Birthday gift pack", "Dedicated support", "4 free-shipping coupons monthly", "5% off on Member Day"],
    },
    {
      key: "platinum", code: "MALL-MEMBER-PLATINUM", name: "铂金会员", nameEn: "Platinum Member", rank: 4,
      benefits: ["生日礼包", "专属客服", "每月 8 张免邮券", "会员日 9 折", "专属新品优先购"],
      benefitsEn: ["Birthday gift pack", "Dedicated support", "8 free-shipping coupons monthly", "10% off on Member Day", "Priority access to new arrivals"],
    },
  ];
  const packageGroups = [
    {
      key: "monthly", code: "MALL-MEMBER-MONTHLY", name: "月度会员", nameEn: "Monthly Membership",
      description: "按月订阅，随时可取消。", descriptionEn: "Billed monthly, cancel anytime.",
      billingCycle: "monthly", durationDays: 30, sortWeight: 10,
    },
    {
      key: "quarterly", code: "MALL-MEMBER-QUARTERLY", name: "季度会员", nameEn: "Quarterly Membership",
      description: "按季订阅，享 9 折优惠。", descriptionEn: "Billed quarterly with 10% savings.",
      billingCycle: "monthly", durationDays: 90, sortWeight: 20,
    },
    {
      key: "yearly", code: "MALL-MEMBER-YEARLY", name: "年度会员", nameEn: "Annual Membership",
      description: "按年订阅，享 8 折优惠。", descriptionEn: "Billed yearly with 20% savings.",
      billingCycle: "yearly", durationDays: 365, sortWeight: 30,
    },
    {
      key: "lifetime", code: "MALL-MEMBER-LIFETIME", name: "终身会员", nameEn: "Lifetime Membership",
      description: "一次购买，长期有效。", descriptionEn: "One-time purchase, valid for life.",
      billingCycle: "yearly", durationDays: 36500, sortWeight: 40,
    },
  ];
  const packages = [
    ["pkg-silver-monthly", "MALL-PKG-SILVER-MONTHLY", "白银月度套餐", "Silver Monthly", "silver", "monthly", "19.00", 30],
    ["pkg-gold-monthly", "MALL-PKG-GOLD-MONTHLY", "黄金月度套餐", "Gold Monthly", "gold", "monthly", "39.00", 30],
    ["pkg-gold-yearly", "MALL-PKG-GOLD-YEARLY", "黄金年度套餐", "Gold Annual", "gold", "yearly", "388.00", 365],
    ["pkg-platinum-yearly", "MALL-PKG-PLATINUM-YEARLY", "铂金年度套餐", "Platinum Annual", "platinum", "yearly", "688.00", 365],
    ["pkg-platinum-lifetime", "MALL-PKG-PLATINUM-LIFETIME", "铂金终身套餐", "Platinum Lifetime", "platinum", "lifetime", "1999.00", 36500],
    ["pkg-silver-demo", "MALL-PKG-SILVER-DEMO", "白银体验套餐", "Silver Trial", "silver", "monthly", "9.90", 30, true],
  ].map(([key, code, name, nameEn, planKey, groupKey, priceAmount, durationDays, demoOnly]) => ({
    key,
    code,
    name,
    nameEn,
    planKey,
    groupKey,
    priceAmount,
    durationDays,
    currencyCode: "CNY",
    demoOnly,
  }));
  return { plans, packageGroups, packages };
}

function buildCms() {
  const banners = [
    ["banner-flash-sale", "限时秒杀", "Limited-time flash sale", "全品类限时优惠，低至 5 折", "Up to 50% off across categories", "/activity", 10],
    ["banner-brand-day", "品牌日", "Brand Day", "大牌专享优惠券，满 3000 减 300", "Brand coupons: ¥300 off ¥3000", "/activity", 20],
    ["banner-new-arrivals", "新品首发", "New Arrivals", "2026 春季新品抢先看", "First look at 2026 spring arrivals", "/search?q=AURORA", 30],
    ["banner-membership", "会员中心", "Membership", "开通会员，享双倍积分与免邮", "Double points and free shipping for members", "/membership", 40],
    ["banner-appliance", "家电焕新", "Appliance Refresh", "以旧换新，至高补贴 800 元", "Trade-in subsidy up to ¥800", "/categories/appliance", 50],
    ["banner-grocery", "生鲜直达", "Fresh Delivery", "产地直采，冷链包邮", "Origin-sourced with cold-chain delivery", "/categories/grocery", 60],
    ["banner-coupon", "领券中心", "Coupon Centre", "每日上新优惠券", "New coupons every day", "/coupon", 70],
    ["banner-help", "售后服务", "After-sales", "7 天无理由退换，极速退款", "7-day returns and fast refunds", "/help", 80],
  ].map(([key, title, titleEn, subtitle, subtitleEn, linkUrl, sortOrder]) => ({
    key, title, titleEn, subtitle, subtitleEn, linkUrl, sortOrder,
  }));

  const floors = [
    ["floor-aurora", "AURORA 星环专场", "AURORA Collection", "AURORA", 10],
    ["floor-nucleus", "NUCLEUS 生产力", "NUCLEUS Productivity", "NUCLEUS", 20],
    ["floor-yunqi", "云栖家电", "CIRRUS Home", "CIRRUS", 30],
    ["floor-lumi", "LUMI 日常衣橱", "LUMI Wardrobe", "LUMI", 40],
    ["floor-hydra", "HYDRA 护肤", "HYDRA Skincare", "HYDRA", 50],
    ["floor-harvest", "HARVEST 粮油", "HARVEST Pantry", "HARVEST", 60],
    ["floor-trail", "TRAIL 户外", "TRAIL Outdoors", "TRAIL", 70],
    ["floor-nest", "NEST 家居", "NEST Living", "NEST", 80],
  ].map(([key, title, titleEn, productQuery, sortOrder]) => ({
    key, title, titleEn, productQuery, sortOrder,
  }));

  const hotKeywords = [
    ["kw-phone", "手机", "phone"],
    ["kw-laptop", "笔记本", "laptop"],
    ["kw-tv", "电视", "TV"],
    ["kw-skincare", "护肤", "skincare"],
    ["kw-sneakers", "跑鞋", "sneakers"],
    ["kw-snack", "零食", "snacks"],
    ["kw-baby", "奶粉", "formula"],
    ["kw-tool", "电钻", "drill"],
    ["kw-jewelry", "项链", "necklace"],
    ["kw-coffee", "咖啡", "coffee"],
    ["kw-petfood", "狗粮", "dog food"],
    ["kw-camping", "帐篷", "tent"],
  ].map(([key, keyword, keywordEn], index) => ({
    key, keyword, keywordEn, sortOrder: (index + 1) * 10,
  }));

  return { banners, floors, hotKeywords };
}

/* ------------------------------------------------------------------------- */
/* Document assembly                                                         */
/* ------------------------------------------------------------------------- */

function findLeafNameEn(leafKey) {
  for (const root of TAXONOMY) {
    for (const leaf of root.leaves) {
      if (leaf[0] === leafKey) {
        return leaf[2];
      }
    }
  }
  return undefined;
}

function buildDocuments() {
  const products = buildProducts();
  const categories = buildCategories();
  const shops = buildShops();
  const brands = buildBrands();
  const offers = buildOffers();
  const membership = buildMembership();
  const cms = buildCms();

  const categoryAttributes = [];
  for (const root of TAXONOMY) {
    for (const leaf of root.leaves) {
      const [leafKey, , , , , , kind] = leaf;
      const attrKeys = LEAF_ATTR_OVERRIDES[leafKey] ?? KIND_TO_ATTR_SET[kind] ?? [];
      for (const attrKey of attrKeys) {
        const attr = ATTRS[attrKey];
        categoryAttributes.push({
          key: `${leafKey}-${attr.key}`,
          categoryKey: leafKey,
          attributeName: attr.nameZh,
          attributeNameEn: attr.nameEn,
          values: attr.values.map(([zh]) => zh),
          valuesEn: Object.fromEntries(attr.values.map(([zh, en]) => [zh, en])),
        });
      }
    }
  }

  const zh = {
    schemaVersion: 1,
    locale: "zh-CN",
    categories: categories.map(({ key, name, sortOrder, children }) => ({ key, name, sortOrder, children })),
    brands: brands.map(({ key, name, description }) => ({ key, name, description })),
    categoryAttributes: categoryAttributes.map(
      ({ key, categoryKey, attributeName, values }) => ({ key, categoryKey, attributeName, values }),
    ),
    shops: shops.map(({ key, name, description, shopType, businessModel, defaultCurrencyCode, timezone }) => ({
      key, name, description, shopType, businessModel, defaultCurrencyCode, timezone,
    })),
    products: products.map(
      ({ titleEn, subtitleEn, descriptionEn, nounEn, series, ...product }) => ({
        ...product,
        skus: product.skus.map(({ titleEn: _skuTitleEn, ...sku }) => sku),
      }),
    ),
    offers: offers.map(({ titleEn, descriptionEn, ...offer }) => offer),
    membership: {
      plans: membership.plans.map(({ nameEn, benefitsEn, ...plan }) => plan),
      packageGroups: membership.packageGroups.map(({ nameEn, descriptionEn, ...group }) => group),
      packages: membership.packages.map(({ nameEn, ...entry }) => entry),
    },
    cms: {
      banners: cms.banners.map(({ titleEn, subtitleEn, ...banner }) => banner),
      floors: cms.floors.map(({ titleEn, ...floor }) => floor),
      hotKeywords: cms.hotKeywords.map(({ keywordEn, ...keyword }) => keyword),
    },
  };

  const en = {
    schemaVersion: 1,
    locale: "en-US",
    brands: Object.fromEntries(brands.map((brand) => [
      brand.key,
      { name: brand.nameEn, description: brand.descEn },
    ])),
    categoryAttributes: Object.fromEntries(categoryAttributes.map((attribute) => [
      attribute.key,
      { attributeName: attribute.attributeNameEn, values: attribute.valuesEn },
    ])),
    categories: Object.fromEntries(
      categories.flatMap((category) => [
        [category.key, TAXONOMY.find((root) => root.key === category.key)?.nameEn ?? category.name],
        ...category.children.map((child) => [
          child.key,
          findLeafNameEn(child.key) ?? child.name,
        ]),
      ]),
    ),
    shops: Object.fromEntries(shops.map((shop) => [
      shop.key,
      { name: shop.nameEn, description: shop.descEn },
    ])),
    products: Object.fromEntries(products.map((product) => [
      product.key,
      {
        title: product.titleEn,
        subtitle: product.subtitleEn,
        description: product.descriptionEn,
        skus: Object.fromEntries(product.skus.map((sku) => [sku.key, sku.titleEn])),
      },
    ])),
    offers: Object.fromEntries(offers.map((offer) => [
      offer.key,
      { title: offer.titleEn, description: offer.descriptionEn },
    ])),
    membership: {
      plans: Object.fromEntries(membership.plans.map((plan) => [
        plan.key,
        { name: plan.nameEn, benefits: plan.benefitsEn },
      ])),
      packageGroups: Object.fromEntries(membership.packageGroups.map((group) => [
        group.key,
        { name: group.nameEn, description: group.descriptionEn },
      ])),
      packages: Object.fromEntries(membership.packages.map((entry) => [
        entry.key,
        { name: entry.nameEn },
      ])),
    },
    cms: {
      banners: Object.fromEntries(cms.banners.map((banner) => [
        banner.key,
        { title: banner.titleEn, subtitle: banner.subtitleEn },
      ])),
      floors: Object.fromEntries(cms.floors.map((floor) => [floor.key, floor.titleEn])),
      hotKeywords: Object.fromEntries(cms.hotKeywords.map((keyword) => [keyword.key, keyword.keywordEn])),
    },
  };

  return { zh, en };
}


/* ------------------------------------------------------------------------- */
/* H5 storefront taxonomy projection                                         */
/* ------------------------------------------------------------------------- */

const H5_TAXONOMY_PATH =
  "apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-commons/src/category-seeded-taxonomy.json";

/**
 * Icon/tone per retail kind, used by the H5 storefront category tiles.
 *
 * The H5 app cannot import this dataset (separate application root), so the
 * generator projects the seeded taxonomy into a data file there. The H5
 * category-visual contract test fails if a seeded key is missing or a name
 * resolves to a different glyph than its key.
 */
const H5_KIND_VISUALS = {
  phone: ["Smartphone", "blue"],
  computer: ["Laptop", "indigo"],
  audio: ["Headphones", "blue"],
  accessory: ["Cable", "blue"],
  tv: ["Tv", "teal"],
  appliance: ["WashingMachine", "teal"],
  apparel: ["Shirt", "cyan"],
  shoe: ["Footprints", "cyan"],
  bag: ["ShoppingBag", "cyan"],
  beauty: ["Sparkles", "rose"],
  grocery: ["Carrot", "emerald"],
  beverage: ["Wine", "amber"],
  baby: ["Baby", "violet"],
  toy: ["Puzzle", "violet"],
  sports: ["Dumbbell", "amber"],
  home: ["Sofa", "teal"],
  auto: ["Car", "slate"],
  book: ["BookOpen", "amber"],
  jewelry: ["Gem", "rose"],
  pet: ["PawPrint", "amber"],
  health: ["HeartPulse", "emerald"],
  tools: ["Wrench", "indigo"],
  instrument: ["Music", "violet"],
  gift: ["Gift", "rose"],
  garden: ["Sprout", "emerald"],
  office: ["Package", "slate"],
  industrial: ["Cog", "slate"],
  cleaning: ["Droplets", "blue"],
};

const H5_ROOT_VISUALS = {
  "mobile": ["Smartphone", "blue"],
  "computer": ["Laptop", "indigo"],
  "appliance": ["WashingMachine", "teal"],
  "fashion": ["Shirt", "cyan"],
  "shoes-bags": ["Footprints", "cyan"],
  "beauty": ["Sparkles", "rose"],
  "grocery": ["Carrot", "emerald"],
  "baby": ["Baby", "violet"],
  "sports": ["Dumbbell", "amber"],
  "home": ["Sofa", "teal"],
  "auto": ["Car", "slate"],
  "books": ["BookOpen", "amber"],
  "jewelry": ["Gem", "rose"],
  "pet": ["PawPrint", "amber"],
  "health": ["HeartPulse", "emerald"],
  "tools": ["Wrench", "indigo"],
  "instrument": ["Music", "violet"],
  "gift": ["Gift", "rose"],
  "garden": ["Sprout", "emerald"],
  "beverage": ["Wine", "amber"],
  "accessory": ["Cable", "blue"],
  "office": ["Package", "slate"],
  "industrial": ["Cog", "slate"],
  "cleaning": ["Droplets", "blue"],
};

function buildH5Taxonomy() {
  const rows = [];
  for (const root of TAXONOMY) {
    const rootVisual = H5_ROOT_VISUALS[root.key] ?? ["Package", "slate"];
    rows.push({
      key: root.key,
      zhName: root.name,
      enName: root.nameEn,
      icon: rootVisual[0],
      tone: rootVisual[1],
      level: "root",
    });
    for (const leaf of root.leaves) {
      const kind = leaf[6];
      const visual = H5_KIND_VISUALS[kind] ?? rootVisual;
      rows.push({
        key: leaf[0],
        zhName: leaf[1],
        enName: leaf[2],
        icon: visual[0],
        tone: visual[1],
        level: "leaf",
      });
    }
  }
  return rows;
}

/* ------------------------------------------------------------------------- */
/* Entrypoint                                                                */
/* ------------------------------------------------------------------------- */

const { zh, en } = buildDocuments();
const zhText = `${JSON.stringify(zh, null, 2)}\n`;
const enText = `${JSON.stringify(en, null, 2)}\n`;
const h5Text = `${JSON.stringify(buildH5Taxonomy(), null, 2)}\n`;

if (CHECK_MODE) {
  const problems = [];
  for (const [relativePath, expected] of [[ZH_PATH, zhText], [EN_PATH, enText], [H5_TAXONOMY_PATH, h5Text]]) {
    const actual = readFileSync(path.join(workspaceRoot, relativePath), "utf8");
    if (actual !== expected) {
      problems.push(relativePath);
    }
  }
  if (problems.length > 0) {
    process.stdout.write(`default dataset is out of date: ${problems.join(", ")}\n`);
    process.stdout.write("run `pnpm dataset:generate` and commit the result.\n");
    process.exitCode = 1;
  } else {
    process.stdout.write("default dataset matches the generator.\n");
  }
} else {
  writeFileSync(path.join(workspaceRoot, ZH_PATH), zhText, "utf8");
  writeFileSync(path.join(workspaceRoot, EN_PATH), enText, "utf8");
  writeFileSync(path.join(workspaceRoot, H5_TAXONOMY_PATH), h5Text, "utf8");
  const skus = zh.products.reduce((total, product) => total + product.skus.length, 0);
  const leaves = zh.categories.reduce((total, category) => total + category.children.length, 0);
  process.stdout.write(
    `wrote ${ZH_PATH}, ${EN_PATH} and ${H5_TAXONOMY_PATH}\n` +
      `  roots ${zh.categories.length} | leaves ${leaves} | brands ${zh.brands.length} | ` +
      `shops ${zh.shops.length} | products ${zh.products.length} | skus ${skus}\n`,
  );
}
