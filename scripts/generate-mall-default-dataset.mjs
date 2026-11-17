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

const PRODUCTS_PER_LEAF = 11;
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
      ["18K 金", "18K Gold", 0.72],
      ["S925 银", "S925 Silver", 0.28],
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
  fruit: ["portion"],
  meat: ["portion"],
  grain: ["portion"],
  seasoning: ["portion"],
  "pet-food": ["portion"],
  "pet-treat": ["pack"],
  supplement: ["portion"],
  fertilizer: ["portion"],
  "garden-supply": ["portion"],
  formula: ["pack"],
  tea: ["pack"],
  coffee: ["pack"],
  water: ["portion"],
  juice: ["portion"],
  alcohol: ["portion"],
  snacks: ["pack", "flavor"],
  chocolate: ["pack", "flavor"],
  cake: ["pack"],
  watch: ["edition"],
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
    ["家庭装", "Family Pack"],
    ["尝鲜装", "Trial Pack"],
    ["礼盒装", "Gift Box"],
    ["随身装", "On-the-go"],
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
const TAXONOMY = [
  {
    key: "digital",
    name: "手机数码",
    nameEn: "Phones & Digital",
    pitchZh: "旗舰芯片、高刷护眼屏与全天候续航，日常与重度使用都从容。",
    pitchEn: "Flagship silicon, a high-refresh display and all-day battery life.",
    brands: ["xingye", "yunqi", "polarday"],
    leaves: [
      ["phone", "智能手机", "Smartphones", "智能手机", "Smartphone", [1299, 8999], "tech"],
      ["tablet", "平板电脑", "Tablets", "平板电脑", "Tablet", [1099, 6999], "tech"],
      ["wearable", "智能穿戴", "Wearables", "智能手表", "Smartwatch", [299, 3999], "tech"],
      ["audio", "耳机音箱", "Audio", "无线耳机", "Wireless Earbuds", [99, 2499], "tech"],
      ["camera", "摄影摄像", "Cameras", "微单相机", "Mirrorless Camera", [1999, 18999], "tech"],
    ],
  },
  {
    key: "computer",
    name: "电脑办公",
    nameEn: "Computers & Office",
    pitchZh: "高色域屏幕、全功能接口与长续航，办公创作一步到位。",
    pitchEn: "Wide-gamut display, full ports and long battery life for work and creation.",
    brands: ["xingye", "inkshadow", "qcloud"],
    leaves: [
      ["laptop", "笔记本电脑", "Laptops", "轻薄笔记本", "Ultrabook", [3299, 15999], "tech"],
      ["desktop", "台式整机", "Desktops", "台式主机", "Desktop PC", [2999, 19999], "tech"],
      ["monitor", "显示器", "Monitors", "显示器", "Monitor", [599, 8999], "tech"],
      ["peripheral", "键鼠外设", "Keyboards & Mice", "机械键盘", "Mechanical Keyboard", [99, 1999], "generic"],
      ["printer", "打印办公", "Printers", "打印机", "Printer", [399, 4999], "generic"],
    ],
  },
  {
    key: "appliance",
    name: "家用电器",
    nameEn: "Home Appliances",
    pitchZh: "一级能效、静音运行与智能联动，把家务交给更懂生活的机器。",
    pitchEn: "Energy-efficient, quiet and app-connected appliances for everyday chores.",
    brands: ["yunqi", "egret", "sunglow"],
    leaves: [
      ["tv", "电视", "TVs", "智能电视", "Smart TV", [1599, 12999], "tech"],
      ["refrigerator", "冰箱", "Refrigerators", "风冷冰箱", "Frost-free Refrigerator", [1299, 9999], "generic"],
      ["washer", "洗衣机", "Washers", "洗烘一体机", "Washer-Dryer", [1499, 8999], "generic"],
      ["kitchen", "厨房电器", "Kitchen Appliances", "蒸烤一体机", "Steam Oven", [399, 6999], "generic"],
      ["air", "生活电器", "Home Comfort", "空气净化器", "Air Purifier", [299, 4999], "generic"],
    ],
  },
  {
    key: "fashion",
    name: "服饰鞋包",
    nameEn: "Fashion",
    pitchZh: "精选天然面料与立体剪裁，通勤与休闲都能穿出质感。",
    pitchEn: "Natural fabrics and considered tailoring for work and weekend.",
    brands: ["shiguang", "suye", "mistral"],
    leaves: [
      ["menswear", "男士上装", "Men's Tops", "男士大衣", "Men's Coat", [199, 2999], "apparel"],
      ["womenswear", "女士上装", "Women's Tops", "女士针织衫", "Women's Knitwear", [159, 2599], "apparel"],
      ["pants", "裤装", "Trousers", "直筒长裤", "Straight Trousers", [99, 1299], "apparel"],
      ["sneakers", "运动鞋", "Sneakers", "缓震跑鞋", "Cushioned Sneakers", [199, 1599], "shoe"],
      ["bag", "箱包", "Bags", "通勤托特包", "Commuter Tote", [129, 3999], "bag"],
    ],
  },
  {
    key: "beauty",
    name: "美妆个护",
    nameEn: "Beauty & Care",
    pitchZh: "温和配方与实证功效，敏感肌也能安心使用。",
    pitchEn: "Gentle formulas with proven actives, suitable for sensitive skin.",
    brands: ["mubai", "cottona", "bloomish"],
    leaves: [
      ["skincare", "护肤", "Skincare", "保湿精华", "Hydrating Serum", [39, 1299], "beauty"],
      ["makeup", "彩妆", "Makeup", "丝绒口红", "Matte Lipstick", [29, 699], "beauty"],
      ["haircare", "洗护", "Hair Care", "氨基酸洗发水", "Amino Shampoo", [29, 499], "beauty"],
      ["fragrance", "香水", "Fragrance", "淡香水", "Eau de Toilette", [99, 1999], "beauty"],
      ["device", "美容仪器", "Beauty Devices", "射频美容仪", "RF Beauty Device", [399, 5999], "generic"],
    ],
  },
  {
    key: "grocery",
    name: "食品生鲜",
    nameEn: "Food & Fresh",
    pitchZh: "产地直采、冷链直达，配料表干净，吃得放心。",
    pitchEn: "Direct-sourced and cold-chain delivered, with clean ingredient lists.",
    brands: ["shanhai", "grainly", "fruity"],
    leaves: [
      ["grain", "米面粮油", "Rice & Oil", "稻花香大米", "Daohuaxiang Rice", [15, 199], "consumable"],
      ["snacks", "休闲零食", "Snacks", "每日坚果", "Daily Nuts", [9, 99], "consumable"],
      ["fruit", "新鲜水果", "Fresh Fruit", "赣南脐橙", "Navel Oranges", [9, 89], "consumable"],
      ["meat", "肉禽蛋品", "Meat & Eggs", "冷鲜牛排", "Chilled Steak", [29, 399], "consumable"],
      ["seasoning", "调味品", "Seasoning", "初榨橄榄油", "Extra Virgin Olive Oil", [9, 79], "consumable"],
    ],
  },
  {
    key: "baby",
    name: "母婴玩具",
    nameEn: "Baby & Toys",
    pitchZh: "安全材质与贴心设计，陪伴成长每一步。",
    pitchEn: "Safe materials and thoughtful design for every growth milestone.",
    brands: ["qimu", "kidgo", "fawnly"],
    leaves: [
      ["formula", "奶粉辅食", "Formula & Food", "有机配方奶粉", "Organic Formula", [89, 599], "consumable"],
      ["diaper", "纸尿裤", "Diapers", "超薄成长裤", "Ultra-thin Pants", [59, 399], "consumable"],
      ["toy", "益智玩具", "Toys", "大颗粒积木", "Building Blocks", [39, 899], "toy"],
      ["stroller", "童车出行", "Strollers", "轻便婴儿车", "Lightweight Stroller", [499, 4999], "generic"],
      ["kidswear", "童装童鞋", "Kids' Wear", "纯棉连体衣", "Cotton Bodysuit", [39, 599], "apparel"],
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
      ["fitness", "健身训练", "Fitness", "家用跑步机", "Home Treadmill", [299, 8999], "generic"],
      ["camping", "户外露营", "Camping", "自动速开帐篷", "Pop-up Tent", [99, 2999], "generic"],
      ["cycling", "骑行装备", "Cycling", "公路自行车", "Road Bike", [999, 19999], "generic"],
      ["outdoor-wear", "户外服饰", "Outdoor Wear", "三合一冲锋衣", "3-in-1 Jacket", [299, 2999], "apparel"],
      ["ball", "球类运动", "Ball Sports", "比赛级篮球", "Match Basketball", [59, 599], "generic"],
    ],
  },
  {
    key: "home",
    name: "家居家装",
    nameEn: "Home & Living",
    pitchZh: "耐用结构与简约设计，让家更舒适也更好打理。",
    pitchEn: "Durable structures and clean lines that make a home comfortable and easy to keep.",
    brands: ["muli", "cozylife", "forme"],
    leaves: [
      ["bedding", "床上用品", "Bedding", "长绒棉四件套", "Cotton Bedding Set", [99, 1999], "generic"],
      ["furniture", "家具", "Furniture", "实木书桌", "Solid Wood Desk", [299, 8999], "generic"],
      ["kitchenware", "厨具", "Kitchenware", "不粘炒锅", "Non-stick Wok", [59, 1299], "generic"],
      ["storage", "收纳整理", "Storage", "多层置物架", "Shelving Unit", [39, 999], "generic"],
      ["lighting", "灯饰照明", "Lighting", "护眼落地灯", "Floor Lamp", [79, 1999], "generic"],
    ],
  },
  {
    key: "auto",
    name: "汽车用品",
    nameEn: "Auto & Accessories",
    pitchZh: "车规级用料与严苛测试，适配主流车型。",
    pitchEn: "Automotive-grade materials and strict testing for mainstream models.",
    brands: ["ridge", "ridex"],
    leaves: [
      ["car-care", "汽车养护", "Car Care", "镀晶封釉套装", "Ceramic Coating Kit", [39, 499], "generic"],
      ["car-electronics", "车载电器", "Car Electronics", "行车记录仪", "Dash Cam", [199, 2999], "tech"],
      ["car-parts", "车载配件", "Car Parts", "车载充电器", "Car Charger", [19, 199], "generic"],
      ["car-seat", "儿童安全座椅", "Child Car Seats", "安全座椅", "Child Car Seat", [499, 4999], "generic"],
      ["car-tire", "轮胎轮毂", "Tyres", "静音舒适轮胎", "Comfort Tyre", [399, 2999], "generic"],
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
      ["literature", "文学小说", "Literature", "长篇小说", "Novel", [19, 199], "book"],
      ["business", "经管励志", "Business", "商业管理书", "Business Book", [29, 299], "book"],
      ["techbook", "科技计算机", "Technology", "技术实践指南", "Tech Guide", [39, 399], "book"],
      ["children-book", "童书绘本", "Children's Books", "精装绘本", "Picture Book", [19, 199], "book"],
      ["artbook", "艺术生活", "Art & Lifestyle", "艺术画册", "Art Album", [49, 899], "book"],
    ],
  },
  {
    key: "jewelry",
    name: "珠宝配饰",
    nameEn: "Jewelry",
    pitchZh: "贵金属与天然宝石，工艺细节经得起近看。",
    pitchEn: "Precious metals and natural stones finished to stand up to close inspection.",
    brands: ["linlang", "aurum"],
    leaves: [
      ["necklace", "项链", "Necklaces", "足金项链", "Gold Necklace", [299, 9999], "jewelry"],
      ["ring", "戒指", "Rings", "钻石戒指", "Diamond Ring", [599, 29999], "jewelry"],
      ["earring", "耳饰", "Earrings", "珍珠耳钉", "Pearl Studs", [99, 4999], "jewelry"],
      ["bracelet", "手链", "Bracelets", "银质手链", "Silver Bracelet", [129, 3999], "jewelry"],
      ["watch", "腕表", "Watches", "机械腕表", "Mechanical Watch", [999, 39999], "jewelry"],
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
      ["pet-food", "宠物主粮", "Pet Food", "全价成犬粮", "Adult Dog Food", [39, 299], "consumable"],
      ["pet-treat", "宠物零食", "Pet Treats", "冻干鸡肉粒", "Freeze-dried Chicken", [9, 99], "consumable"],
      ["pet-toy", "宠物玩具", "Pet Toys", "耐咬磨牙玩具", "Chew Toy", [19, 199], "generic"],
      ["pet-care", "宠物洗护", "Pet Grooming", "宠物沐浴露", "Pet Shampoo", [19, 299], "generic"],
      ["pet-bed", "宠物窝垫", "Pet Beds", "四季宠物窝", "Pet Bed", [49, 799], "generic"],
    ],
  },
  {
    key: "health",
    name: "医药健康",
    nameEn: "Health & Wellness",
    pitchZh: "科学配方与可追溯原料，日常养护更安心。",
    pitchEn: "Evidence-based formulas and traceable ingredients for daily wellness.",
    brands: ["welness", "herbao"],
    leaves: [
      ["supplement", "营养保健", "Supplements", "复合维生素", "Multivitamin", [29, 399], "consumable"],
      ["medical-device", "医疗器械", "Devices", "电子血压计", "Blood Pressure Monitor", [129, 1999], "generic"],
      ["massager", "按摩养生", "Massagers", "颈椎按摩仪", "Neck Massager", [99, 1999], "generic"],
      ["optical", "视力健康", "Eye Care", "防蓝光眼镜", "Blue-light Glasses", [99, 999], "generic"],
      ["first-aid", "家庭常备", "First Aid", "家庭急救箱", "First Aid Kit", [39, 399], "generic"],
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
      ["power-tool", "电动工具", "Power Tools", "无刷电钻", "Brushless Drill", [199, 3999], "generic"],
      ["hand-tool", "手动工具", "Hand Tools", "棘轮扳手套装", "Socket Wrench Set", [49, 1999], "generic"],
      ["fastener", "紧固件", "Fasteners", "不锈钢螺丝套装", "Stainless Screw Kit", [19, 299], "generic"],
      ["measure", "测量工具", "Measuring", "激光测距仪", "Laser Measure", [99, 1999], "generic"],
      ["safety", "劳保防护", "Safety Gear", "防割手套", "Cut-resistant Gloves", [19, 299], "generic"],
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
      ["guitar", "吉他", "Guitars", "单板民谣吉他", "Acoustic Guitar", [399, 9999], "generic"],
      ["keyboard", "键盘乐器", "Keyboards", "电钢琴", "Digital Piano", [899, 19999], "generic"],
      ["audio-gear", "专业音响", "Audio Gear", "蓝牙音箱", "Bluetooth Speaker", [99, 3999], "tech"],
      ["microphone", "麦克风", "Microphones", "电容麦克风", "Condenser Mic", [199, 4999], "tech"],
      ["music-accessory", "乐器配件", "Music Accessories", "效果器踏板", "Effect Pedal", [99, 2999], "generic"],
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
      ["flower", "鲜花花束", "Flowers", "99 枝玫瑰花束", "99-rose Bouquet", [69, 999], "generic"],
      ["gift-box", "礼盒礼券", "Gift Boxes", "节日礼盒", "Festive Gift Box", [29, 499], "consumable"],
      ["cake", "烘焙甜点", "Bakery", "生日蛋糕", "Birthday Cake", [59, 399], "consumable"],
      ["chocolate", "巧克力", "Chocolate", "黑巧克力礼盒", "Dark Chocolate Box", [19, 199], "consumable"],
      ["custom-gift", "定制礼品", "Custom Gifts", "定制刻字礼品", "Engraved Gift", [29, 599], "generic"],
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
      ["charger", "充电器", "Chargers", "氮化镓充电器", "GaN Charger", [49, 499], "tech"],
      ["powerbank", "移动电源", "Power Banks", "磁吸移动电源", "Magnetic Power Bank", [89, 699], "tech"],
      ["cable", "数据线", "Cables", "编织快充线", "Braided Cable", [19, 199], "tech"],
      ["case", "保护壳膜", "Cases & Films", "磁吸保护壳", "Magnetic Case", [29, 299], "tech"],
      ["stand", "支架配件", "Stands", "桌面升降支架", "Desk Stand", [39, 599], "generic"],
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
      ["plant", "绿植盆栽", "Plants", "观叶绿植盆栽", "Indoor Plant", [19, 399], "generic"],
      ["seed", "种子种球", "Seeds", "花卉种子套装", "Flower Seed Kit", [5, 39], "generic"],
      ["fertilizer", "肥料营养", "Fertilizer", "缓释复合肥", "Slow-release Fertilizer", [9, 99], "consumable"],
      ["garden-tool", "园艺工具", "Garden Tools", "园艺工具套装", "Garden Tool Set", [29, 899], "generic"],
      ["garden-supply", "园艺用品", "Garden Supplies", "自动浇灌系统", "Auto Watering System", [29, 299], "consumable"],
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
      ["water", "饮用水", "Water", "天然矿泉水", "Mineral Water", [5, 59], "consumable"],
      ["tea", "茶叶", "Tea", "明前龙井", "Longjing Tea", [29, 599], "consumable"],
      ["coffee", "咖啡", "Coffee", "精品挂耳咖啡", "Drip Coffee", [19, 299], "consumable"],
      ["juice", "果汁饮料", "Juice", "NFC 鲜榨果汁", "NFC Juice", [5, 59], "consumable"],
      ["alcohol", "酒类", "Alcohol", "精酿啤酒", "Craft Beer", [9, 199], "consumable"],
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
  const pool = MODEL_POOLS[modelPool];
  const variants = [];
  for (const seriesCode of series) {
    for (const [zh, en] of pool) {
      variants.push({ series: seriesCode, modelZh: zh, modelEn: en });
    }
  }
  return variants;
}

const KIND_TO_POOL = {
  tech: "tech",
  computer: "tech",
  tablet: "tech",
  audio: "tech",
  appliance: "generic",
  apparel: "apparel",
  shoe: "shoe",
  bag: "apparel",
  beauty: "generic",
  grocery: "consumable",
  beverage: "consumable",
  baby: "consumable",
  toy: "generic",
  sports: "generic",
  home: "generic",
  auto: "generic",
  book: "generic",
  jewelry: "generic",
  pet: "consumable",
  health: "consumable",
  tools: "generic",
  instrument: "generic",
  gift: "consumable",
  garden: "generic",
};

const KIND_TO_ATTR_SET = {
  tech: "computer",
  computer: "computer",
  tablet: "tablet",
  audio: "audio",
  appliance: "appliance",
  apparel: "apparel",
  shoe: "shoe",
  bag: "bag",
  beauty: "beauty",
  grocery: "grocery",
  consumable: "grocery",
  beverage: "beverage",
  baby: "baby",
  toy: "toy",
  sports: "sports",
  home: "home",
  auto: "auto",
  book: "book",
  jewelry: "jewelry",
  pet: "pet",
  health: "health",
  tools: "tools",
  instrument: "instrument",
  gift: "gift",
  garden: "garden",
  generic: "generic",
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

function buildProducts() {
  const products = [];
  for (const root of TAXONOMY) {
    for (const leaf of root.leaves) {
      const [leafKey, leafName, , nounZh, nounEn, band, kind] = leaf;
      const series = SERIES[root.key];
      const pool = KIND_TO_POOL[kind] ?? "generic";
      const variants = buildVariants(pool, series);
      const attrSetKey = KIND_TO_ATTR_SET[kind] ?? "generic";
      const attrKeys = LEAF_ATTR_OVERRIDES[leafKey] ?? ATTR_SETS[attrSetKey] ?? [];

      for (let index = 0; index < PRODUCTS_PER_LEAF; index += 1) {
        const brandKey = root.brands[index % root.brands.length];
        const brand = BRAND_BY_KEY.get(brandKey);
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
          subtitle: `${leafName} · ${root.pitchZh.split("，")[0]}`,
          description: `${titleZh}。${root.pitchZh}商品支持 7 天无理由退换，大部分地区次日达。`,
          productType,
          skus,
          keywords: [leafName, root.name, brand.nameZh, variant.series, "官方正品"],
          demoOnly: index === PRODUCTS_PER_LEAF - 1 ? true : undefined,
          titleEn,
          subtitleEn: `${root.nameEn} · ${root.pitchEn}`,
          descriptionEn: `${titleEn}. ${root.pitchEn} 7-day returns and next-day delivery in most areas.`,
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
      const attrSetKey = KIND_TO_ATTR_SET[kind] ?? "generic";
      const attrKeys = LEAF_ATTR_OVERRIDES[leafKey] ?? ATTR_SETS[attrSetKey] ?? [];
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
/* Entrypoint                                                                */
/* ------------------------------------------------------------------------- */

const { zh, en } = buildDocuments();
const zhText = `${JSON.stringify(zh, null, 2)}\n`;
const enText = `${JSON.stringify(en, null, 2)}\n`;

if (CHECK_MODE) {
  const problems = [];
  for (const [relativePath, expected] of [[ZH_PATH, zhText], [EN_PATH, enText]]) {
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
  const skus = zh.products.reduce((total, product) => total + product.skus.length, 0);
  const leaves = zh.categories.reduce((total, category) => total + category.children.length, 0);
  process.stdout.write(
    `wrote ${ZH_PATH} and ${EN_PATH}\n` +
      `  roots ${zh.categories.length} | leaves ${leaves} | brands ${zh.brands.length} | ` +
      `shops ${zh.shops.length} | products ${zh.products.length} | skus ${skus}\n`,
  );
}
