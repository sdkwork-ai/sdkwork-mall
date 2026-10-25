# SDKWork Mall PC

对标京东/天猫的综合电商 PC 应用：商城主站、买家工作台、商家工作台、平台 Admin 四端一体。

完整产品需求见 [`README.prd.md`](./README.prd.md)。实现遵循 [`AGENTS.md`](./AGENTS.md) 与 `../../../sdkwork-specs/` 标准。

## Quick start

```bash
pnpm --dir apps/sdkwork-mall-pc install
pnpm --dir apps/sdkwork-mall-pc run dev
```

开发地址：http://127.0.0.1:5175

## 四端架构

| Surface | 路径前缀 | 说明 |
|---------|----------|------|
| `storefront` | `/`, `/search`, `/cart`, `/product/*` | C 端购物：浏览、搜索、下单、支付 |
| `buyer` | `/buyer/*` | 买家工作台：订单、售后、地址、资产 |
| `merchant` | `/merchant/*` | 商家工作台：入驻、商品、订单、营销、结算 |
| `backend-admin` | `/admin/*` | 平台治理：商家、商品、订单、营销、风控、CMS |

- **App 根**：薄组合层 `src/App.tsx` + `src/bootstrap/*`
- **包**：`packages/sdkwork-mall-pc-*` 按能力拆分
- **SDK**：`@sdkwork/mall-commerce-service` 消费 `sdkwork-commerce-app-sdk` + `sdkwork-commerce-backend-sdk`，**禁止 raw HTTP**
- **认证**：`src/AuthGate.tsx` → IAM `/auth/*`
- **Shell**：`@sdkwork/mall-pc-shell` 按 surface 切换布局
- **路由注册**：`src/bootstrap/routes.ts` 仅从各包 `./routes` 子路径聚合元数据；`AppRoutes.tsx` 通过 `./storefront-pages`、`./buyer-pages`、`./merchant-pages`、`./admin-pages`、`./catalog-admin` 等 page 子路径 lazy 加载屏幕；跨包能力调用使用 `./search-service`、`./footprint-service`、`./favorites-service` 等 service 子路径

## 功能矩阵（PRD 对齐）

### 商城主站 (storefront)

| 模块 | 路由 | 状态 |
|------|------|------|
| 首页 / CMS 楼层 | `/` | ✅（含热门店铺 `shops.list`） |
| 搜索 / 排序 / 类目筛选 | `/search` | ✅（含相关店铺搜索） |
| 类目频道 | `/categories`, `/categories/:id` | ✅（含 `categories.retrieve`） |
| 商品详情 PDP | `/product/:id` | ✅（评价写入待 API） |
| 购物车 / 结算 / 支付结果 | `/cart`, `/checkout`, `/payment/result` | ✅ |
| 店铺首页 | `/shop/:shopId` | ✅（含关注店铺，localStorage） |
| 活动会场 | `/activity`, `/activity/:eventId` | ✅ |
| 帮助中心 | `/help` | ✅ |
| 登录注册 | `/auth/*` | ✅（IAM） |

### 买家工作台 (buyer)

| 模块 | 路由 | 状态 |
|------|------|------|
| 买家中心 | `/buyer` | ✅（含 `orders.statistics` 概览） |
| 我的订单 | `/buyer/orders` | ✅ |
| 售后中心 | `/buyer/after-sales` | ✅（含详情、进度与退货物流） |
| 收货地址 CRUD | `/buyer/addresses` | ✅ |
| 发票 / 钱包 / 优惠券 / 积分 / 会员 | `/buyer/invoices` 等 | ✅ |
| 收藏 / 足迹 / 评价 / 消息 | `/buyer/favorites` 等 | ⚠️ 收藏足迹 localStorage；评价待 API |
| 礼品卡 / 红包 | `/buyer/gift-cards` | ⚠️ 路由占位，待 gift-cards API |
| 个人资料 / 账户安全 | `/buyer/profile`, `/buyer/security` | ✅ |

### 商家工作台 (merchant)

| 模块 | 路由 | 状态 |
|------|------|------|
| 商家总览 | `/merchant` | ✅（含开店就绪 `readiness`） |
| 入驻申请（多步向导） | `/merchant/onboarding` | ✅（含申请状态回显） |
| 店铺装修 | `/merchant/shop` | ✅ |
| 商品 / 库存 / 订单 / 发货履约 | `/merchant/products` 等 | ✅（含上下架、订单详情） |
| 售后 / 客服 / 营销 / 结算 / 数据 | `/merchant/*` | ✅（商家自主营销待 API；客服渠道已接 SDK） |
| 设置中心（类目 / 品牌 / 资质 / 运费 / 退货地址） | `/merchant/settings` | ✅ |

### 平台 Admin (backend-admin)

| 模块 | 路由 | 状态 |
|------|------|------|
| 平台总览 / 报表 / 审计 | `/admin`, `/admin/reports`, `/admin/audit` | ✅（报表含营收 + 退款） |
| 商家管理 | `/admin/shops` | ✅ |
| 用户中心 | `/admin/users` | ⚠️ 待 `admin.users` API |
| 品牌中心 | `/admin/brands` | ⚠️ 部分（店铺品牌授权列表） |
| 商品治理 | `/admin/products` | ✅ |
| 订单 / 售后监管 | `/admin/orders`, `/admin/after-sales` | ✅ |
| 营销 / CMS / 会员运营 | `/admin/marketing` 等 | ✅ |
| 风控 / 举报处罚 / 结算 / 权限 | `/admin/risk` 等 | ✅（举报处罚待 API） |

图例：✅ 已实现并可走 SDK；⚠️ 部分实现或明确标注 SDK 阻塞。

## Legacy 包（未注册路由）

以下 SaaS 订阅/计费包保留在 `packages/` 供后续扩展，**不**进入 app 根 `package.json` 依赖，也不参与四端路由：

`billing`、`checkout`、`entitlement`、`offer`、`payment`、`pricing`、`subscription`、`membership-purchase`

## SDK 阻塞项（不可伪造）

以下能力在 UI 中已标注，需 commerce SDK 扩展后再接：

- 商品评价写入与媒体晒单
- 服务端收藏 / 足迹同步
- 搜索联想、同义词、品牌价格高级筛选
- 平台用户管理 (`admin.users`)
- 礼品卡 / 红包
- 真实 IM / 客服会话
- 商家自主创建营销活动
- 举报处罚工单流 (`admin.moderation`)
- 商家子账号 / 资质中心

## 验证

```bash
pnpm --dir apps/sdkwork-mall-pc run build
pnpm --dir apps/sdkwork-mall-pc run test:config
pnpm --dir apps/sdkwork-mall-pc run typecheck
```

架构契约测试：`sdks/test/verify-mall-standard-architecture.test.mjs`（9 项：57 路由覆盖、raw HTTP 禁令、模块脚手架归属、page/service 子路径策略）

## 规范索引

- 应用清单：`agent.app.config.json`
- 组件契约：`specs/component.spec.json`
- SDKWork 标准：`../../../sdkwork-specs/README.md`
