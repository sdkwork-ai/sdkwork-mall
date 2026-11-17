# 商城默认数据初始化运维手册

适用对象：平台运维、实施工程师、发布负责人。

商城默认数据由应用侧统一维护，覆盖类目、店铺、商品与 SKU、营销活动、会员体系和首页 CMS。
初始化是**幂等**的：重复执行只补齐缺失数据，不会产生重复记录。

数据集由 `scripts/generate-mall-default-dataset.mjs` 确定性生成（`pnpm dataset:generate`），
当前规模：**24 个一级类目 / 288 个二级类目 / 52 个品牌 / 19 家店铺 / 1728 款商品 / 5304 个 SKU**。
类目按行业结构组织（如手机数码→智能手机/折叠屏/游戏手机/平板/穿戴/耳机音箱，
办公耗材→A4纸/中性笔/文件夹/墨盒，工业品→轴承/电机/气动元件），每个二级类目至少 5 个非演示商品；
每个商品 3–4 个规格组合，价格区间约 5.00 – 55430.00 元，全部 SKU 带有效 EAN-13 条码。
规格字典按行业定制：手机用存储容量/配色，服饰用尺码/颜色，鞋靴用鞋码，珠宝用贵金属材质，
耗材用包装，工业品用型号，健身器材用重量，食品饮料用份量。

`pnpm check:dataset-generation` 校验提交的 JSON（含 H5 分类视觉数据）与生成模型一致；
`pnpm check:default-data` 校验规模、引用完整性、规格字典、条码校验位、价格与折扣、
类目/店铺覆盖深度和首页楼层可命中。

## 1. 环境矩阵

| 环境 | 档位 | 类目 | 店铺 | 商品/SKU | 营销活动 | 会员 | 首页 CMS |
| --- | --- | --- | --- | --- | --- | --- | --- |
| development | demo | 全量 312 | 全量 19 | 全量 1728 / 5304 | 生效 12 | 全量 | 预设 |
| demo | demo | 全量 312 | 全量 19 | 全量 1440 / 4386 | 生效 12 | 全量 | 预设 |
| test | standard | 全量 312 | 全量 19 | 非演示 1440 | 生效 11 | 非演示套餐 | 预设 |
| staging | standard | 全量 312 | 全量 19 | 非演示 1200 | 生效 11 | 非演示套餐 | 预设 |
| production | minimal | 全量 312 | 仅自营 | 无 | 无 | 全量 | 预设 |

> 全量初始化会发出约 13,400 次写入请求（类目、品牌、规格、商品、SKU、价格阶梯等）。
> 首次执行通常需要数分钟，请在前台提示「正在初始化商城默认数据…」或后台进度条期间保持页面打开。

> 自托管（standalone）安装的 production 环境按 **standard** 档位初始化（1200 款商品），
> 只有 cloud production 才使用 `minimal`。可用 `SDKWORK_MALL_SEED_PROFILE` 显式覆盖。

`minimal`（线上）只写入平台基础结构：类目树、自营店铺、会员等级与套餐、首页框架。
演示商品与营销活动不会进入线上；即使显式指定更高档位，线上创建的营销活动也一律为**草稿**，
由营销同学在后台审核后再上线。

## 2. 执行入口

### 2.1 管理后台（推荐）

1. 使用具备 `commerce.defaultData.manage` 权限的账号登录（超级管理员默认具备）。
2. 打开 `管理后台 → 默认数据初始化`（`/admin/default-data`）。
3. 页面顶部确认 **环境 / 档位 / 语言** 与目标一致。
4. 先点 **试运行**：只输出将要写入的实体数量，不产生任何写请求。
5. 再点 **执行初始化**：按依赖顺序执行，实时显示每一步状态。
6. 最后点 **校验数据**：只读校验，输出每个域“应有 / 实有 / 缺少”。

> 页面在后台 API 未配置时直接提示“无法执行”，不会发出注定失败的请求。

### 2.3 前台首次运行自动初始化

全新安装的商城不再需要先有人登录后台才能看到商品。首页读取到的目录为空时会自动进入初始化：

| 运行时环境 | 默认档位 | 是否自动初始化 | 前台行为 |
| --- | --- | --- | --- |
| development / demo | demo | 是 | 首次打开首页即自动写入完整数据集，写入完成后自动刷新页面数据 |
| test / staging | standard | 是 | 同上，写入非演示档位 |
| **standalone production（自托管安装）** | **standard** | **是** | 首次打开即写入 1200 款非演示商品，避免自托管安装开箱为空商城 |
| **cloud production（线上正式环境）** | **minimal** | **否** | 首页提示「商城还没有商品数据」，由运维显式点击后再写入 |

- **幂等**：前台自动初始化与后台「执行初始化」是同一套计划，重复触发只补齐缺失实体。
- **需要登录**：自动初始化只在已登录（持有会话凭据）时执行；匿名访客看到的是「登录并初始化」入口，
  不会发出注定 401 的写请求。
- **升级自动补齐**：应用内置数据集版本号（`MALL_DEFAULT_DATA_REVISION`）。安装包升级后，
  即便商城已有旧数据，首次打开也会在后台按自然键补齐新增类目/商品/SKU，
  不需要人工比对或清库；该过程只新增、不删除运营数据。
- **生产安全**：cloud production 默认档位只写平台基础结构（类目、自营店铺、会员与首页框架），
  不写商品；需要完整体验时可点击「载入演示数据（含商品）」，该操作显式选择 `demo` 档位，
  生产环境的营销活动仍强制为草稿。自托管安装如需退回"只写结构"，设置
  `SDKWORK_MALL_SEED_PROFILE=minimal` 即可。
- **失败可见**：初始化失败会在首页显示失败步骤与原因，并提供「重试初始化」；
  补齐失败也会显示「默认数据更新失败」横幅，不再出现"空白商城但没有任何提示"的情况。
- **后端不可达**：首页四个数据源全部失败时显示「首页暂不可用」与真实错误信息，
  与"目录尚未初始化"区分开；单区失败只降级该区块并给出重试。

运行时开关（写入 `runtime-env.json` 或对应环境变量，浏览器端经 `SDKWORK_RUNTIME_ENV` 读取）：

| 键 | 取值 | 作用 |
| --- | --- | --- |
| `SDKWORK_MALL_SEED_PROFILE` | `minimal` / `standard` / `demo` | 强制指定初始化档位；在 production 指定 `demo` 表示显式选择演示数据 |
| `SDKWORK_MALL_AUTO_SEED` | `1` / `0` | 强制开启或关闭前台自动初始化；缺省时非 `minimal` 档位自动开启 |


### 2.2 发布流水线

部署完成后由运维在目标环境执行一次后台初始化。仓库内的离线门禁：

```bash
pnpm check:default-data        # 数据集完整性 + 语言覆盖 + 档位 + 环境资产
pnpm audit:default-data        # 人类可读报告
```

离线门禁不访问后端，验证的是“数据是否专业完整、所有环境是否具备运行资产”。

## 3. 自然键与幂等规则

| 实体 | 自然键 | 示例 |
| --- | --- | --- |
| 类目 | `categoryNo` | `MALL-CAT-PHONE` |
| 商品（SPU） | `spuNo` | `MALL-SPU-AURORA-X1-PRO` |
| SKU | `skuNo` | `MALL-SKU-AURORA-X1-PRO-256-OBSIDIAN` |
| 店铺 | 店铺名称（同时写入 `operationConfig.sdkworkMallSeedKey`） | `星野商城自营旗舰店` |
| 营销活动 | `code` | `MALL-SECKILL-DIGITAL` |
| 会员等级 / 套餐组 / 套餐 | `code` | `MALL-MEMBER-GOLD` / `MALL-MEMBER-YEARLY` / `MALL-PKG-GOLD-YEARLY` |

自然键不随语言或档位变化。因此 `standard` 环境可以原地升级为 `demo`，无需清理数据。

## 4. 安全边界

- **不会删除任何数据**：初始化只读后写，不包含删除或覆盖整表的操作。
- **不覆盖运营编辑**：首页 CMS 预设按语言只应用一次，之后运营在 CMS 中的修改不会被重跑覆盖。
- **失败即停**：任一步失败立即停止，后续步骤标记为“未执行”，避免在缺失外键的情况下继续写入。
- **线上活动为草稿**：线上创建的营销活动状态固定为 `draft`，需要人工审核上线。
- **试运行无副作用**：试运行不写业务数据、不写 CMS、不写本地标记。

## 5. 校验与验收

“校验数据”通过的标准：所有检查项为 **通过**。

| 检查项 | 含义 |
| --- | --- |
| catalog.categories | 类目树（含子类目）全部可读 |
| shops.stores | 店铺可按名称读取 |
| catalog.products | 已发布日期商品全部可读 |
| catalog.skus | SKU 全部可读 |
| promotions.offers | 营销活动编码完整 |
| membership.plans | 会员等级完整 |
| membership.package-groups | 会员套餐组完整 |
| membership.packages | 会员套餐完整 |
| cms.storefront | 首页 CMS 预设已应用 |
| catalog.coverage | 每个二级类目、每家店铺都至少有一个商品（非演示档位） |

### 5.1 完整流程引导

“校验数据”成功后，页面下方会生成**完整流程引导**：13 个业务入口按推荐顺序排列，逐项标出
「就绪 / 部分就绪 / 待初始化」，并提供直达链接。演示与培训时按顺序打开即可看完整个应用：

1. 商城首页与 CMS 内容 → 2. 类目导航 → 3. 搜索与筛选 → 4. 购物车 → 5. 确认订单与支付
→ 6. 活动会场与秒杀 → 7. 会员中心与套餐购买 → 8. 领券中心 → 9. 我的订单 → 10. 售后中心
→ 11. 后台商品治理 → 12. 后台店铺管理 → 13. 后台营销平台。

说明：

- 每个流程标注其依赖的校验项；缺哪一项会直接列出，便于回头补齐。
- 「我的订单」「售后中心」属于**交易型流程**，数据在真实下单后产生，初始化不会伪造交易数据；
  页面会明确提示这一点。
- 执行成功的初始化会自动触发一次校验，引导列表实时刷新，无需再次点击。
- 页面底部固定提供「打开商城首页预览」，演示时一键回到前台。

业务验收建议顺序：首页 → 类目 → 搜索 → 商品详情 → 加购 → 结算 → 支付结果 → 订单 → 售后 → 会员购买。

## 6. 故障处理

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 页面提示“当前入口未配置后台 API” | 该构建没有 `backendApiBaseUrl` | 使用配置了后台 API 的构建/环境入口 |
| 某步骤失败并提示 `forced failure` 等 | 后端拒绝请求或权限不足 | 查看该步骤提示，确认后台 API 与账号权限后重试 |
| 校验项显示“待补齐” | 数据只写入了部分 | 重新执行初始化（自动补齐缺失实体） |
| 商品存在但门店不显示 | 商品与店铺是独立维度，商品在平台目录层 | 在“商家管理”中确认店铺审核状态 |
| 首页仍是旧内容 | 运营已在 CMS 中自定义，预设不会覆盖 | 在 CMS 页面按需调整，或清空本地 CMS 配置后重跑 |

## 7. English summary

Mall default data is provisioned per environment from one locale-aware dataset:

- **Profiles**: `demo` (development/demo), `standard` (test/staging), `minimal`
  (production = platform reference data only).
- **Idempotent**: stable natural keys; reruns only add what is missing.
- **Safe**: never deletes, never overwrites operator CMS edits, stops on the first
  failure, and always seeds production campaigns as drafts.
- **Entry points**: admin console at `/admin/default-data` (plan → dry run → run →
  verify), plus the offline gate `pnpm check:default-data`.
- **Demo-ready**: verification projects onto 13 ordered journeys with readiness
  badges and direct links; every leaf category and shop has a non-demo product, so
  no storefront listing is an empty-state dead end. A successful run re-verifies
  automatically. Orders and after-sales stay empty by design until a real purchase.

Authority: `DATABASE_FRAMEWORK_SPEC.md` §6.4, `FRONTEND_SPEC.md`, `TEST_SPEC.md`.
