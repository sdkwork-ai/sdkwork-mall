# 商城默认数据初始化运维手册

适用对象：平台运维、实施工程师、发布负责人。

商城默认数据由应用侧统一维护，覆盖类目、店铺、商品与 SKU、营销活动、会员体系和首页 CMS。
初始化是**幂等**的：重复执行只补齐缺失数据，不会产生重复记录。

## 1. 环境矩阵

| 环境 | 档位 | 类目 | 店铺 | 商品/SKU | 营销活动 | 会员 | 首页 CMS |
| --- | --- | --- | --- | --- | --- | --- | --- |
| development | demo | 全量 | 全量 | 全量 | 生效 | 全量 | 预设 |
| demo | demo | 全量 | 全量 | 全量 | 生效 | 全量 | 预设 |
| test | standard | 全量 | 全量 | 非演示 | 生效 | 非演示套餐 | 预设 |
| staging | standard | 全量 | 全量 | 非演示 | 生效 | 非演示套餐 | 预设 |
| production | minimal | 全量 | 仅自营 | 无 | 无 | 全量 | 预设 |

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
