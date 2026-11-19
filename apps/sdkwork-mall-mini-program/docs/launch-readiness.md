# 商业化交付清单（v1）

本文回答一个具体问题：**当前小程序包能否上线、上线后哪些能力可用、哪些被刻意隐藏、还缺什么。**
它不是路线图；路线图在 `docs/decisions.md`。

## 1. v1 交付范围

| 链路 | 已交付 |
| --- | --- |
| 发现 | 首页（分类/秒杀/店铺/热卖/新品/足迹/服务入口）、分类、搜索（历史/热词/排序/类目筛选）、活动会场与详情、店铺 |
| 商品 | 商品详情（图集/价格/销量/规格/SKU/库存/加购/立即购买/优惠券/推荐） |
| 交易 | 购物车（勾选/改量/删除/合计）、结算（地址/配送/优惠券/钱包/积分/礼品卡码/发票/备注/报价）、收银台（支付方式/应付金额/微信支付）、支付结果（服务端轮询确认） |
| 订单 | 订单列表（状态 tab/分页/取消/确认收货/售后入口）、订单详情、售后中心（申请/撤销/退货物流/进度）、物流页（无运单时的诚实空态 + 客服入口）、发票 |
| 账户 | 登录（微信/密码）、个人资料、账户安全（改密）、会员中心、钱包/积分、收藏/足迹、地址、设置、退出登录 |
| 服务 | 消息中心、客服会话、聊天（文本/图片/已读/轮询+实时）、帮助中心、活动详情 |

## 2. 刻意隐藏的能力（无已发布 API）

| 能力 | 处理 | 恢复条件 |
| --- | --- | --- |
| 商品评价 | 商品页评价卡片移除；买家中心「我的评价」入口隐藏；评价页保留代码但不可达 | 商品评价 app-api 发布后，恢复入口与提交表单 |
| 礼品卡/红包 | 买家中心入口隐藏；帮助页文案不再承诺入口 | commerce gift-cards API 发布后 |
| 订单物流 | 订单列表「查看物流」入口隐藏；订单详情仅在 `shipmentIds` 非空时显示；物流页提供「联系客服查询物流」 | order app-api 提供订单→运单关联或订单级运单列表 |

这些页面仍保留在代码与路由中，但没有任何购物者入口，避免“点进去永远是空页/敬请期待”的体验。

## 3. 已知上游约束

1. **报价不含优惠/运费**：`checkout.sessions` / quotes 的请求体是 `CommerceOperationCommand`（`additionalProperties: true`），没有定义 `couponId` / `deliveryMethod`。客户端把买家确认的报价原样用于下单，优惠在订单创建后应用；失败会以 warning 明确告知。发票/运费金额以服务端最终结算为准。
2. **订单无运单关联**：`OrderDetailResponse` 无 `shipmentIds`，只有 `/shipments/{shipmentId}` 路由。
3. **积分分批**：commerce SDK 未暴露 points lots，页面展示余额 + 即将过期积分，不伪造分批。

## 4. 上线前配置检查

- [ ] 用生产 profile 构建：`pnpm --dir apps/sdkwork-mall-mini-program run build:mp:prod`；`readRuntimeEnv` 在 release 渠道 + 非 production profile 时会直接抛错（fail-closed）。
- [ ] `SDKWORK_DEPLOY_APPLICATION_ID`（或 `..._SDKWORK_MALL_MINI_PROGRAM`）已配置，生成包内 access token 的 `app_id` 不再是占位符。
- [ ] 小程序后台合法域名包含 app-api / WebSocket 网关；`project.config.json` 指向 `dist/`。
- [ ] IAM：微信小程序登录 provider `wechat_mini_program` 已在租户配置；隐私协议、用户协议 URL 可访问。
- [ ] 支付：微信支付商户号/证书就绪，`wx.requestPayment` 参数由服务端签发；`signType` 以服务端返回为准（缺省按 MD5）。
- [ ] 客服会话：IM 会话与通知服务可连通；未读数会体现在「消息」tab 角标。
- [ ] 监控：关注 `[sdkwork-mall] runtime bootstrap failed`、`technical error masked`、订单创建 `Idempotency-Key` 冲突。

## 5. 质量门禁（每次提交）

```bash
pnpm --dir apps/sdkwork-mall-mini-program exec tsc --noEmit
node apps/sdkwork-mall-mini-program/scripts/build-miniprogram.mjs
node apps/sdkwork-mall-mini-program/scripts/smoke-miniprogram.mjs
pnpm exec vitest run apps/sdkwork-mall-mini-program/tests
node --test "apps/sdkwork-mall-mini-program/tests/*.test.mjs"
node ../sdkwork-specs/tools/check-app-sdk-consumer-imports.mjs --workspace .
```

当前基线（2026-11-19）：typecheck 0、构建 37 entries、smoke 36 页 PASS、vitest 88/88、node 54/54、SDK consumer-import 门禁 passed。

## 6. 明确不在 v1 内

- 商品评价（写评价/晒单/评分）
- 订单物流轨迹（依赖上游运单关联）
- 礼品卡/红包余额与兑换
- 积分分批明细
- 多语言（当前仅 zh-CN）
