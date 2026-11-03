/**
 * Bilingual copy for the default-data admin surface.
 *
 * The mall PC roots are mid-migration to catalogues (I18N_SPEC section 6.1), so
 * this package ships its copy the same way other capability packages do: one
 * typed message map, resolved from the runtime locale.
 */
export interface MallDefaultDataCopy {
  readonly pageTitle: string;
  readonly pageDescription: string;
  readonly planTitle: string;
  readonly planDescription: string;
  readonly stepsTitle: string;
  readonly totalsTitle: string;
  readonly verificationTitle: string;
  readonly verificationDescription: string;
  readonly actionDryRun: string;
  readonly actionRun: string;
  readonly actionVerify: string;
  readonly actionRetry: string;
  readonly actionRefresh: string;
  readonly running: string;
  readonly verifying: string;
  readonly stepStatusCreated: string;
  readonly stepStatusSkipped: string;
  readonly stepStatusFailed: string;
  readonly stepStatusPending: string;
  readonly checkPass: string;
  readonly checkWarn: string;
  readonly checkFail: string;
  readonly labelEnvironment: string;
  readonly labelProfile: string;
  readonly labelLocale: string;
  readonly labelEntities: string;
  readonly labelExpected: string;
  readonly labelActual: string;
  readonly labelMissing: string;
  readonly summaryCreated: string;
  readonly summaryPlanned: string;
  readonly summarySkipped: string;
  readonly summaryFailed: string;
  readonly summaryPending: string;
  readonly runSucceeded: string;
  readonly runFailed: string;
  readonly verifySucceeded: string;
  readonly verifyFailed: string;
  readonly notConfigured: string;
  readonly invalidDataset: string;
  readonly productionNotice: string;
  readonly dryRunNotice: string;
  readonly profileMinimal: string;
  readonly profileStandard: string;
  readonly profileDemo: string;
  readonly environmentDevelopment: string;
  readonly environmentTest: string;
  readonly environmentDemo: string;
  readonly environmentStaging: string;
  readonly environmentProduction: string;
}

const ZH_CN: MallDefaultDataCopy = {
  pageTitle: "默认数据初始化",
  pageDescription:
    "为当前环境初始化商城默认数据：类目树、店铺、商品与 SKU、营销活动、会员体系与首页 CMS 内容。重复执行不会产生重复数据。",
  planTitle: "初始化计划",
  planDescription: "按依赖顺序执行，任一步失败即停止，修复后可从失败步骤继续。",
  stepsTitle: "步骤",
  totalsTitle: "数据规模",
  verificationTitle: "数据完整性校验",
  verificationDescription: "只读校验，可在任意环境执行，用于确认商城功能具备所需数据。",
  actionDryRun: "试运行",
  actionRun: "执行初始化",
  actionVerify: "校验数据",
  actionRetry: "重试",
  actionRefresh: "刷新计划",
  running: "正在初始化...",
  verifying: "正在校验...",
  stepStatusCreated: "已写入",
  stepStatusSkipped: "已存在",
  stepStatusFailed: "失败",
  stepStatusPending: "未执行",
  checkPass: "通过",
  checkWarn: "待补齐",
  checkFail: "缺失",
  labelEnvironment: "环境",
  labelProfile: "初始化档位",
  labelLocale: "语言",
  labelEntities: "实体数",
  labelExpected: "应有",
  labelActual: "实有",
  labelMissing: "缺少",
  summaryCreated: "写入",
  summaryPlanned: "计划写入",
  summarySkipped: "跳过",
  summaryFailed: "失败步骤",
  summaryPending: "未执行步骤",
  runSucceeded: "默认数据初始化完成。",
  runFailed: "默认数据初始化失败，请查看失败步骤的提示。",
  verifySucceeded: "默认数据完整性校验通过，商城主要功能所需数据已就绪。",
  verifyFailed: "默认数据不完整，请先执行初始化后再校验。",
  notConfigured: "当前入口未配置后台 API，无法执行默认数据初始化。",
  invalidDataset: "默认数据集校验未通过，请检查数据文件。",
  productionNotice: "线上环境仅初始化平台基础数据（类目、自营店铺、会员体系与首页框架），不写入演示商品与活动。",
  dryRunNotice: "试运行只输出将要执行的操作，不会写入任何数据。",
  profileMinimal: "基础",
  profileStandard: "标准",
  profileDemo: "演示",
  environmentDevelopment: "开发",
  environmentTest: "测试",
  environmentDemo: "演示",
  environmentStaging: "预发",
  environmentProduction: "线上",
};

const EN_US: MallDefaultDataCopy = {
  pageTitle: "Default data initialization",
  pageDescription:
    "Provisions the mall defaults for this environment: category tree, shops, products and SKUs, marketing offers, membership and storefront CMS content. Reruns never duplicate data.",
  planTitle: "Initialization plan",
  planDescription: "Steps run in dependency order and stop on the first failure; rerun after a fix to continue.",
  stepsTitle: "Steps",
  totalsTitle: "Dataset size",
  verificationTitle: "Data completeness verification",
  verificationDescription: "Read-only checks, safe in any environment, proving the mall has the data it needs.",
  actionDryRun: "Dry run",
  actionRun: "Run initialization",
  actionVerify: "Verify data",
  actionRetry: "Retry",
  actionRefresh: "Refresh plan",
  running: "Initializing...",
  verifying: "Verifying...",
  stepStatusCreated: "Written",
  stepStatusSkipped: "Present",
  stepStatusFailed: "Failed",
  stepStatusPending: "Not started",
  checkPass: "Pass",
  checkWarn: "Incomplete",
  checkFail: "Missing",
  labelEnvironment: "Environment",
  labelProfile: "Profile",
  labelLocale: "Locale",
  labelEntities: "Entities",
  labelExpected: "Expected",
  labelActual: "Found",
  labelMissing: "Missing",
  summaryCreated: "Written",
  summaryPlanned: "Planned",
  summarySkipped: "Skipped",
  summaryFailed: "Failed steps",
  summaryPending: "Not started",
  runSucceeded: "Default data initialization completed.",
  runFailed: "Default data initialization failed. Review the failing step.",
  verifySucceeded: "Default data verification passed; the mall has the data its core journeys need.",
  verifyFailed: "Default data is incomplete. Run initialization first, then verify again.",
  notConfigured: "This surface has no backend API configured, so default data cannot be provisioned.",
  invalidDataset: "The default dataset failed validation. Check the dataset document.",
  productionNotice:
    "Production only provisions platform reference data (categories, the self-operated shop, membership and the CMS frame); demo products and campaigns are excluded.",
  dryRunNotice: "A dry run only reports the operations it would perform and writes nothing.",
  profileMinimal: "Minimal",
  profileStandard: "Standard",
  profileDemo: "Demo",
  environmentDevelopment: "Development",
  environmentTest: "Test",
  environmentDemo: "Demo",
  environmentStaging: "Staging",
  environmentProduction: "Production",
};

const COPY_BY_LOCALE: Readonly<Record<string, MallDefaultDataCopy>> = {
  "zh-CN": ZH_CN,
  "en-US": EN_US,
};

/** Resolves the copy bundle for a runtime locale, falling back to zh-CN. */
export function getMallDefaultDataCopy(locale: string | undefined): MallDefaultDataCopy {
  const normalized = (locale ?? "").trim();
  return COPY_BY_LOCALE[normalized] ?? COPY_BY_LOCALE["zh-CN"] ?? ZH_CN;
}

/** Localized environment label. */
export function getMallDefaultDataEnvironmentLabel(
  copy: MallDefaultDataCopy,
  environment: string,
): string {
  switch (environment) {
    case "production":
      return copy.environmentProduction;
    case "staging":
      return copy.environmentStaging;
    case "demo":
      return copy.environmentDemo;
    case "test":
      return copy.environmentTest;
    default:
      return copy.environmentDevelopment;
  }
}

/** Localized profile label. */
export function getMallDefaultDataProfileLabel(copy: MallDefaultDataCopy, profile: string): string {
  switch (profile) {
    case "minimal":
      return copy.profileMinimal;
    case "demo":
      return copy.profileDemo;
    default:
      return copy.profileStandard;
  }
}
