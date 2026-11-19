# REVIEW-20261119 product system commercial-readiness audit

Status: in progress (round 1: product read model; round 2: trade chain + buyer assets)
Scope: `apps/sdkwork-mall-pc` storefront/buyer flows, `scripts/dev/mock-commerce-gateway.mjs`

## 1. What was audited

| Flow | Surface | Verdict after this round |
| --- | --- | --- |
| 首页商品区（精选/新品/楼层/猜你喜欢） | PC | 两栏改为一次真实排序读取拆分，链接不再指向无效排序 |
| 类目列表（导航、排序、分页、商品卡） | PC | 分页总数修复；无效排序与伪筛选移除 |
| 搜索（关键词、类目、排序、分页、历史、相关店铺） | PC | 总数修复；排序与服务端能力对齐 |
| 商品详情（标题、价格、SKU/规格、库存、图片、加购、推荐） | PC | 响应解包、SKU 映射、规格矩阵、库存/数量联动已修 |
| 店铺页（店内商品、排序、分页） | PC | 分页与排序同源修复 |
| 加购与购物车商品行 | PC | 加购参数、登录跳转、SKU 价格来源已核 |
| 后台商品管理（商品/SKU/媒体/价格阶梯） | PC | 创建、发布、SKU 激活链路已核；媒体未播种为已知缺口 |
| 默认数据初始化 | PC | SKU 可售状态激活；数据集内容校验通过 |
| 开发/验收网关数据 | dev double | 分页信封改为 v3 规范；排序词汇与服务端一致；规格轴样例 |

## 2. Fixed in this round

### 2.0 Trade chain and buyer assets (round 2)
The full PC purchase chain was driven in a real browser against the dev double:
**login → PDP (spec/colour) → cart → checkout → cashier → payment result → order
list/detail → logistics → after-sales submission**. Fixes found by that run:

- **Cart opened with nothing selected** (`已选 0 件 / 合计 ¥0.00 / 去结算(0)`),
  although the lines were purchasable. A mall cart selects every line by default;
  the selection is now initialised once per page load and preserved across
  quantity/removal refreshes. The StrictMode double-invocation trap (deciding the
  default inside the state updater) is documented next to the code.
- **“立即购买” charged the merged cart quantity.** Adding a SKU merges into an
  existing line, so a previously present line made the order amount 2×. The PDP
  now pins the line to the selected quantity through `cart.items.update` before
  opening checkout.
- **Checkout showed ¥0.00** for a ¥3,999 line because the quota reader only
  looked for `originalAmount` while both the authority revisions and the dev
  double use `originalAmountCny`. All spellings (Camel/snake + `Cny`) are read
  from the session **and** the quote; the page falls back to the selected cart
  subtotal when a quote is missing.
- **Buyer rail contained a literal `/buyer/orders/:orderId` link.** Console rails
  now exclude dynamic routes; a detail page is reached from its list. The same
  filter applies to merchant and admin rails.
- **After-sales was only offered on completed orders.** It is now available for
  paid orders (`pending-shipment`, `pending-receipt`, `completed`), matching the
  7-day after-sales norm.
- **Wallet/points/coupons/membership pages retried forever after a failed read**
  and never left the loading state. Eighteen bootstrapping pages/components now
  stop after the first failure and wait for an explicit retry; the wallet page
  renders a retry action. The dev double also gained the account summary,
  points ledger, membership plans/benefits/packages, coupon wallet, recharge
  settings/packages and invoice statistics routes, so these pages can be
  exercised end-to-end.
- **Membership packages rendered ¥0.00 / duplicate React keys.** The mapper only
  read `price` and coerced string ids with `Number`, collapsing every package to
  `membership-package-0`. It now reads `priceAmount`/`price`/`salePrice`,
  `pointAmount`/`points`, and keys rows by the raw identity.
- **Coupon console showed 0 coupons** because it reads the JD-style `content`
  page while the dev double published only `items`; the double now publishes both
  and uses the coupon wire field names (`userCouponId`, `couponName`, `amount`,
  `minConsume`, …).
- **Home floors repeated the same products** when a CMS keyword matched nothing
  (localization mismatch): the fallback to the general list rendered six copies
  of one shelf. Unmatched floors are now hidden, and the dev double carries
  products for each default floor query (家电/服饰/护肤).
- **Dev double crashed on an unknown order id** (`orderStatus(undefined)`), which
  left the order page on its skeleton. Status/pay/receipt/cancel routes now answer
  `40401`, and the PDP/cart/product fixes above are seeded with realistic data.
- Also repaired a broken `@tailwindcss/vite` workspace link (stale pnpm junction)
  by re-running the offline install; this was an environment defect, not code.

### 2.0.1 Checkout offsets, invoices and repo-wide gates (round 2b)

- **The payable amount ignored the selected offsets.** The checkout quote was
  created from cart ids only while the summary subtracted coupon, wallet and
  points. Selecting a coupon / 余额 / 积分 / 配送方式 now re-quotes through
  `createMallCheckoutQuote` with those fields, and `submitMallCheckoutOrder`
  passes the same offsets into the order body, so the charged total equals the
  displayed total.
- **Invoice list mapped every row to `unknown-invoice` and ¥0.00.** The mapper
  only read `invoiceId`/`totalAmount`; authorities and the dev double also emit
  `id`/`amountCny`. Both are accepted, and statistics accept the canonical
  `totalInvoices`/`pendingInvoices`/`completedInvoices`/`totalAmount` names.
- **Invoice from checkout is now visible end-to-end**: checkout order creation
  persists the invoice in the dev double, and the invoice centre shows
  `共 1 份 / 已开票金额 ¥2,332.50 / 测试买家 / 待开票`.
- **Order-list payment and cancellation now match the rest of the trade chain.**
  “去支付” settles the intent and hands off to the payment-result/polling surface
  (it used to refresh the list in place, so a real channel intent never reached a
  confirmation screen). Cancelling from the list or the detail page asks for
  confirmation before releasing the order.
- **Coupon claim now reflects in “我的优惠券”.** The coupon service reads the
  JD-style `content` page; the dev double only published `items` for
  `/promotions/user_coupons`, so a successful claim looked like nothing happened.
  The double now publishes both pages and the claim switches to the “my” tab with
  the new coupon.
- **Invoice dialog copy corrected**: “发票折头/折头类型” were typos for
  “发票抬头/抬头类型” in the invoice locale copy.
- **Mini-program contract failures were closed**: gift cards are reachable from
  the buyer hub, the shared reviews/gift-card notices are byte-identical,
  after-sales "load more" copy comes from the catalogue, the cart contract
  accepts the authored idempotent order seam, and the release-channel message
  matches the runtime-env contract. The i18n ratchet baseline was refreshed
  (miniProgram 153 → 173 from the concurrent MP commercial pass; PC 1866 → 1897
  for the wallet retry/success labels, cancellation confirmations, merchant
  error/retry copy, localized governance statuses, the admin SPU field and
  membership success copy); no H5 or Flutter copy was added.
- **`pnpm verify` now passes end-to-end**, including 216 node contract tests,
  vitest, i18n catalogues/baseline, dataset and default-data gates.

### 2.0.2 Admin product console and merchant workbench (round 3)

The dev double previously served only `app/v3/api`, so the platform admin and
merchant consoles could not be exercised at all. It now serves the backend
contract (`/backend/v3/api/catalog/*`, `/shops/current/*`) and reuses the same
fixtures for the merchant app-api (`/app/v3/api/shops/current/*`).

- **Admin product list** renders 15 products with pagination, status tabs and
  row actions; **admin edit** loads the real product title, gallery (mapped from
  `images`), description, category and both SKUs (`曜石黑`/`皓月白`).
- **The edit form used to leak the marketing fixture.** It started from the
  exported demo draft, so every product carried “企业版 AI 助手” copy and
  `assets.sdkwork.local` placeholder URLs that an operator could save. Create and
  edit now start from `createBlankProductDraft()`; the edit loader overlays only
  the fields the authority returns, including product images.
- **SKU list filtering/fields** in the dev double now honour `productId`, expose
  `priceAmount`/`image`/`attributes`, and the edit matrix shows the two real
  specs instead of 18 unrelated rows.
- **Admin create image slots were dead controls.** “主图/细节图/场景图…” were
  plain buttons with no click handler, so the required main image could never be
  supplied and “下一步” was unreachable. `UploadTile` now opens a file picker,
  renders the selected image as its preview, and writes `mainImageUrl`/
  `galleryImageUrls` into the draft. Verified: select category → upload a PNG
  (preview replaces the tile) → 下一步 reaches the detail/SKU step.
- **Draft save generated no SPU code.** Validation required `spuNo`, but the
  form exposed no field for it, so “保存草稿” always failed with “请填写 SPU
  编码”; the footer error was also hidden below `lg`. Added a visible
  “SPU 编码” field (auto-generated when left blank), and the submit status now
  renders at every viewport width.
- **Every create still failed with “请选择商品所属类目”** after the form showed a
  selected leaf: `buildProductCreatePayload` normalised against the module-level
  demo category tree, which does not know authority ids (`cat-digital-phone`),
  so the id was silently dropped. Normalisation now only enforces leaf status
  when the live tree is supplied, and the payload takes the first non-empty
  authority id. Verified end-to-end:
  `新增商品 → 选择题 → 主图上传 → 下一步 → SKU 编码/价格/库存 → 保存草稿` returns
  `已创建商品 spu-admin-1011，同步 1 个 SKU` and redirects to the product edit
  page. Unit coverage asserts authority ids survive normalisation/payload.
- Remaining authority gaps are the media **upload** endpoint (images are carried
  as URL/data-URL metadata until it lands) and inventory write streams
  (“库存创建接口待补齐” is surfaced in the form).
- **Merchant workbench** (`/merchant`, products, orders, inventory) now loads:
  dashboard metrics, product rows with 下架/上架, order 详情/发货, and real stock
  quantities. Status values are normalised to lower case before the action
  comparisons (an authority `PUBLISHED`/`PAID` previously hid every button), the
  stock reader accepts `availableStock`, and each list has an error + retry path
  instead of a permanent spinner.
- **Merchant commands** verified in the browser: create draft → 上架 button
  appears; 发货 on the demo order → `已创建发货单`, order becomes `shipped`, the
  action disappears; inventory shows 50/30/80/… available.
- The remaining merchant entries were smoke-tested: onboarding, shop decoration,
  fulfilment, after-sales, marketing, data and settings all render without a
  crash; shop decoration’s channel read (`shops/current/channels`) is now served
  by the double and the fulfilment list normalises `PAID`/`SHIPPED` statuses.
- Still authority-gated: the SKU/price/inventory **write** contracts
  (“库存创建接口待补齐”) and media upload remain upstream work; the admin create
  flow stops at the category/attribute step in the dev double.

### 2.0.3 Platform governance sweep (round 4)

All `/admin/*` routes were opened with the super-admin role against the dev
double; missing backend reads were added so each page renders real data instead
of a skeleton:

- **平台总览** shows GMV/订单数/新增用户/待审核 from `reports/commerce_overview`.
- **商家管理** lists the shop with localized 审核状态/经营状态 (the raw
  `approved`/`active` strings used to be printed verbatim) and 通过/暂停 actions.
- **订单监管**, **售后监管**, **会员管理** (levels, packages, members, benefits),
  **营销平台**, **内容 CMS**, **财务结算**, **数据报表**, **审计日志** and
  **风控中心** all load their fixtures without console errors.
- 用户中心/权限管理/举报处罚 remain explicit “待 SDK” placeholders where the
  authority has no API; they state the pending contract instead of faking data.
- Dev-double routes added: `shops`, `orders`, `after_sales/requests`,
  `memberships/plans|packages|package_groups|levels|benefits|members`,
  `audit/commerce_events`, `risk/signals`, `reports/commerce_overview`.

### 2.0.4 Wallet operations and invoice centre (round 5)

- **Recharge dialog** showed “0 points / 预计价格 ¥0.00” and duplicate React
  keys: the authority package reader expects `points`/`priceAmount` (the double
  emitted `pointAmount`/`price`), and non-numeric package ids collapsed to `0`.
  The double now emits both spellings, the mapper keeps a unique fallback id,
  and the first package is preselected (10,000/30,000 points at ¥100/¥300).
- **Wallet mutations were silent.** Recharge and withdraw closed the dialog with
  no confirmation; the controller now records a success message
  (“充值订单已创建…”, “提现申请已提交…”) rendered as a success notice.
- **Withdraw called `POST /withdrawals/requests`** (not `/wallet/withdrawals`);
  the double now serves that route. Required fields, destination selection and
  the “提现后预计余额” preview work.
- **Ledger rows shared one React key** because the fallback was `Date.now()`;
  rows now use `historyId`/`transactionId`/`id` with an index fallback, and the
  double publishes point-ledger entries with `historyId`. Cash/points entries
  also carry `transactionTypeName`/`remarks`/`createdAt`, so the wallet activity
  shows “订单奖励 / 充值赠送 / 充值 / 订单支付” instead of “Wallet transaction”
  and no longer renders a 1970 timestamp. Recharge package titles read
  “30,000 积分” rather than “30000 points”.
- **Invoice centre**: “新建草稿” creates a real draft (企业/个人, tax number,
  amount) that appears in 开票历史 with ¥100.00; detail loads line items and
  “提交发票” moves it to 待开票. The double now returns the created invoice
  (not `{}`), serves `/invoices/{id}/items` as a bare array and
  `/invoices/{id}/submissions|cancellations`.
- **Recharge cashier handoff** now works: the wallet result exposes the
  order-service `cashierUrl`, the success notice offers “去支付”, and the mock
  recharge order is payable through the real cashier (`wallet → 充值 → 去支付 →
  立即支付 → 支付成功`). The dialog no longer stops at a silent close.
- **Invoice edit** loads the draft with title/tax number/total, “保存修改”
  persists it (`/invoices/{id}` PATCH) and the list/detail refresh to the new
  title. The detail drawer’s “折头/折头类型” copy was also corrected to
  “抬头/抬头类型”.
- Remaining: invoice cancel only applies to completed invoices (draft cancel
  needs authority semantics), real 开票 downloads and voucher files are still
  authority-gated.
- **Mini-program contract re-opened by the concurrent v1 surface change** was
  closed again: reviews/gift cards are reachable from the buyer hub, the home
  “更多 ›” and checkout trust strip moved into the catalogue, and the shared-copy
  checks stay byte-identical. `pnpm verify` is green again.

### 2.0.5 Buyer assets and distribution (round 6)

- **分销中心 loaded nothing** because the dev double had no partner routes. It
  now serves `/partner_join`, `/partner_join/applications/mine`, and
  `/partner_center{,/team,/commissions,/withdrawals}`; the centre reads the flat
  wire record (`availableBalance`, `teamSize`, `inviteCode`, …) and the page
  shows 团队 5 / 直属 2 / 客户 18, invite `SDK8F2K`, ¥1,280.50 available and
  ¥3,560.00 lifetime commission.
- **Every ratio rendered as 0.08%/0.15%** instead of 8%/15%: the centre contract
  sends percentage points (`"8.00"`), not fractions. The double now publishes
  percent units for levels, rules and commission records.
- **个人资料 showed “-”** for nickname/email/phone/level: the account summary
  fixture only carried wallet fields. It now carries `displayName/email/phone/
  membershipLevel`.
- Verified locally-backed surfaces: PDP 收藏 → 我的收藏 lists the product with
  “取消收藏”; browsing writes 浏览足迹 with timestamp; 地址管理 creates a new
  address, marks it default and persists the list; 消息中心 lists notifications
  by category. Favorites/footprint remain browser-local by design until the
  commerce favorites / T1 footprint APIs land, and the pages say so.
- **买家中心 duplicate React key**: the coupon wallet payload carries
  `userCouponId` (no `id`), so both coupons mapped to the key `""`. The hub now
  falls back to `userCouponId/couponId` and `couponName`; `/buyer` renders with
  no duplicate-key warning.

### 2.0.6 H5 cross-end alignment (round 8)

- **H5 offers a “销量” sort the authority does not implement.** The catalog
  segment now mirrors PC: 综合 / 价格↑(`price-asc`) / 价格↓(`price-desc`) / 上新
  (`newest`). Home “新品” links to `?sort=newest`, “热卖”/更多 to the default
  listing, and PDP recommendations no longer request `sort=sales`. The
  mini-program home hot floor and “新品” quick entry were aligned the same way,
  and the parity contract now rejects `sort: "sales"` in both roots.
- **H5 checkout showed the pre-discount total after selecting a coupon or
  deduction.** The shop mobile brick fetched the quote once on mount and its
  `createQuote` input only carried `cartItemIds`. Fixed forward where the gap
  lives:
  - `sdkwork-shop` brick `CheckoutService.createQuote` now accepts
    `couponId/deliveryMethod/usePoints/useWallet`, and `CheckoutPage` re-prices
    when any of them changes;
  - the mall H5 adapter forwards those fields into
    `createMallH5CheckoutQuote`, which serialises them into the session and
    passes them to the created order.
- Verified in the browser: coupon ¥300 → `¥3,999 − ¥300 = ¥3,699`; adding
  wallet+points → `¥3,999 − ¥1,666.50 = ¥2,332.50`; submit opens the order
  cashier and completes without console errors.
- The upstream brick change is a sibling-repository edit
  (`sdkwork-shop/.../sdkwork-shop-mobile-react-shopping`), kept minimal and
  additive; H5 typecheck passes with it.

### 2.0.7 Cross-end build/test matrix (round 12)

- **H5**: typecheck + full browser purchase flow (round 8); checkout re-prices
  with coupon/wallet/points and submits to the cashier.
- **Mini-program**: `tsc --noEmit` clean; production-style build emits 37 entries
  (1,545.1 KB, 31 subpackages); `smoke:mp` boots the bundle and walks **36 pages**
  with 12 requests, 0 toasts, and no boot/page-lifecycle errors.
- **Flutter**: `flutter analyze` reports **No issues found**; `flutter test`
  passes **35/35** (route reachability, i18n runtime, logistics parsing, buyer
  account pages, gift-card fallback, shell tabs and visual capture).
- Contract parity (titles/routes/shared copy/i18n catalogues) is covered by the
  216 node tests that run inside `pnpm verify`.

Remaining cross-end work is device-level visual review (WeChat DevTools, real
Flutter targets) and any MP-specific coupon/deduction quote behaviour that the
JS boot smoke cannot observe.

### 2.0.8 Membership purchase and plan flows (round 13)

- The dev double had no purchase endpoint, so “立即升级” failed with
  `POST /memberships/purchases` missing. Added the command fixture; the page now
  completes the purchase and shows **“操作成功 / 会员已开通，权益立即生效”**.
- Purchase, upgrade and renewal each record a distinct success message
  (`会员已开通…`, `会员已升级…`, `会员已续费…`) instead of silently reloading the
  dashboard after a successful mutation.

### 2.0.9 Address book operations (round 14)

- The dev fixture only carried legacy `receiverName`/`addressLine`; the edit
  form therefore opened with `收件人` and empty province/city/detail for the
  seeded address. The fixture now publishes structured
  `name/phone/province/city/district/detail/tag`, matching the create payload.
- Verified: 新增李四 → 设为默认 (badge moves) → 编辑张三 pre-fills
  `张三 / 13800000000 / 浙江省 / 杭州市 / 西湖区 / 文一路 96 号` → 保存 updates
  the row; delete and default toggling stay available. 删除 now asks for
  confirmation before the destructive write.

### 2.1 列表分页全部失效（P0）

`searchMallProducts` / `searchMallShops` 只读 `payload.total`，而 v3 分页信封是
`pageInfo.totalItems`（int64 字符串）。总数因此退化为当前页条数，所有列表页永远只有 1 页。
现在同时兼容 `pageInfo.totalItems`、`pageInfo.total`、`total`，并回退到当前页条数。
覆盖：类目列表、搜索结果、店铺页、首页类目/商品读取。

### 2.2 排序选项与后端能力不一致（P0）

真实 catalog 只映射 `price-asc` / `price-desc`，其余值静默回退到发布时间排序；
dev double 只认 `sales` / `price_asc` / `price_desc` / `newest`。结果是“销量/好评”永远无效，
“价格排序”在真后端有效而在 dev double 无效，首页“热卖”和“新品”在真后端返回同一批商品。

- 全站排序统一为 `综合`、`价格升序(price-asc)`、`价格降序(price-desc)`、`上新(newest)`；
- 移除没有数据支撑的“销量/好评”；
- 首页一次 `newest` 读取 16 件，拆成“新品首发(前 8)”与“精选推荐(后 8)”，不再重复；
- 楼层/购物车/店铺页的 `sales`/`created_at` 调用一并清理；
- dev double 接受规范排序值，并输出规范分页信封，避免再次掩盖前端缺陷。

### 2.3 伪筛选与错误计数（P0）

类目页与搜索页的品牌、价格区间、包邮、自营、现货筛选都是**只过滤当前 20 行**，
头部却显示“共 N 件（筛选自 total 件）”，跨页后完全失真。由于 catalog 列表接口只接受
`q` / `category_id` / `shop_id` / `product_type` / `sort`，本轮移除这些伪筛选，
保留服务端真实支持的类目、排序、相关店铺与分页；待后端提供筛选参数后再恢复。

### 2.4 商品卡价格语义（P1）

字段缺失时不再显示“询价”（B2B 语义），改为“暂无报价”，避免把缺数据误读为可询价商品。
商品卡映射新增对 `salePriceMinor` + `minorUnitExponent`、`media[].resourceSnapshot.url`
的读取，后端一旦聚合价格/主图即可直接展示，无需再改前端。

### 2.5 PDP 面包屑与购物车信封（P1）

- PDP 从商品 `categoryId` 解析类目名并补“首页 > 类目 > 店铺 > 商品”面包屑；
  类目读取失败只丢一层，不影响商品页。
- 购物车 `cart/current` 兼容 `data.item` 与扁平两种信封；行金额支持十进制字符串、
  `lineTotal` / `lineTotalCny`，无法解析时保持 `null`（显示“暂无报价”），不再伪造 `0.00`。
- 购物车行价格/标题/规格名/主图同时兼容 `spu` / `sku` 嵌套与扁平字段。

### 2.6 商品详情规格选择（上一轮，已回归）

参见 `REVIEW-20261114-fresh-install-empty-catalog.md` 的 2026-11-19 小节：
`data.item` 解包、SKU 规范金额/销售轴映射、按轴分组选择、库存/数量联动、
无可售 SKU 时的显式降级，以及种子 SKU 激活。

## 3. Remaining blockers for commercial delivery

These are **upstream read-model gaps**, not app defects. The current catalog app API
(`/app/v3/api/catalog/products*`) returns `ProductResponse`, which has no price, media or
SKU rows; the composed commerce contract the storefront consumes has no product-SKU
collection. Therefore, on a real catalog backend:

1. **列表/搜索卡片无价格、无主图**：需要 catalog 列表投影返回
   `salePriceMinor` / `listPriceMinor` / `minorUnitExponent` / `primaryImageUrl`
   （取 `commerce_product_sku` 最低可售价与 `commerce_product_media` 首图）。
   Frontend already reads these fields.
2. **详情无 SKU**：需要 `GET /catalog/products/{productId}` 内嵌 `skus`，或开放
   `GET /catalog/products/{productId}/skus` 到 app SDK。Catalog service 已具备
   `list_skus_page`，最小改动是在 app-api 详情响应中组装 `skus`。当前 mall PC
   消费的 `@sdkwork/cloudrouter-app-sdk/domains` 里 `catalog.products` 只有
   `list/retrieve`（无 `skus` 子集合），所以前端无法直接补拉；尝试在 app 侧
   补拉会在类型检查阶段失败，已回退并把该路径保留给上游。
3. **无库存**：库存属于 `sdkwork-inventory`，catalog 不持有库存。需要门店前台聚合投影，
   或在 SKU 读模型中增加可售库存字段；在此之前详情只显示“库存信息待确认”，不阻断加购。
4. **无销量/评分**：目录没有 sales/rating 列，所以“销量/好评”排序与卡片统计暂不可交付；
   已从 UI 移除，避免展示假数据。
5. **服务端筛选**：品牌/价格区间/服务标签需要 catalog 列表新增查询参数
   （`brand_id` 已存在于 domain query，但 app-api 未透出；价格区间需按最低 SKU 价过滤）。

Recommended upstream change set (one PR each, in dependency order):

- `sdkwork-merchandise`: extend `SpuRecord` + list/retrieve SQL with
  `min_sale_price_minor`, `min_list_price_minor`, `currency_code`, `minor_unit_exponent`,
  `primary_image_url`, `brand_name`; add `skus` to the detail read model.
- `sdkwork-catalog`: add those fields (and `skus`) to the app-api `CatalogProduct` /
  product-detail schema, plus an app-api SKU collection for direct reads.
- `scripts/dev/mock-commerce-gateway.mjs`: keep in sync (already emits the frontend shape).
- No mall SDK regeneration is required for additive response fields because the federated
  commerce client is generic; typed contract updates still belong to the authority repos.

## 4. Verification for this round

- `pnpm typecheck`, PC app `tsc --noEmit`: pass
- `pnpm test:vitest`: 102 files / 392 tests pass (includes search pagination,
  home shelf split, PDP mapping, cart envelope and default-selection paths)
- `pnpm run check:default-data`, `check:dataset-generation`, `check:app-composition`,
  `pnpm --dir apps/sdkwork-mall-pc run test:config`, `pnpm run build:pc:prod`: pass
- dev double probed at `/catalog/products?page=1&page_size=2&sort=price-asc`:
  canonical `pageInfo.totalItems`, sorted rows, detail includes `attributes` + `skus`
- Browser E2E against the dev double (Chrome CDP, no Playwright dependency):
  - login → PDP colour switch (¥3,999 → ¥4,099) → add to cart
  - cart defaults to all-selected, quantity 1→2 updates the subtotal and checkout count
  - checkout shows the server amount (no ¥0.00), cashier pays, result page shows success
  - order list/detail, logistics timeline, confirm receipt, after-sales submission
    (`¥100.00`, status 待审核, 撤销/修改 actions) all render without console errors
  - wallet (¥1,280.50 / 8,600 points), points, coupons (2 available, ¥50 max),
    membership (¥39/¥388, 500/6,000 points, current level) and invoices render with
    no retry loops
  - checkout with coupon + 余额 + 积分: summary `¥3,999 - ¥1,666.50 = ¥2,332.50`;
    the created order stores the same `¥2,332.50`, and the invoice created from
    checkout appears in 发票中心 with `共 1 份 / ¥2,332.50`
  - platform admin: product list (15 rows), product edit (real title/gallery/2
    SKUs after the blank-draft fix), full product creation (category + file
    upload + SKU price/stock → 保存草稿 → `spu-admin-1011` → edit page),
    dashboard metrics, shops with localized statuses, orders, after-sales,
    membership, CMS, audit, risk and settlement
  - merchant: dashboard metrics, draft creation, product publish/unpublish,
    order list/detail/发货 (status becomes `shipped`), inventory quantities, and
    the onboarding/shop/fulfilment/after-sales/marketing/data/settings pages
  - wallet: recharge packages 10,000/30,000 points at ¥100/¥300, confirm shows
    “充值订单已创建…/去支付”, cashier pays and reaches the success result;
    withdraw validates amount/name/account and shows “提现申请已提交…”;
    ledger rows have unique keys
  - invoice centre: 新建草稿 (¥100/企业) appears in 开票历史, detail loads the
    line item, 编辑 → 保存修改 persists title/tax/amount, and 提交发票 moves the
    invoice to 待开票
  - distribution: approved partner centre with team 5/2/18, invite SDK8F2K,
    8%/15% ratios, ¥1,280.50 available, ¥3,560.00 lifetime commission; profile
    shows 开发买家 / buyer@example.com / 138****0000 / 黄金会员
  - favorites and footprint record the browsed phone; address create adds
    “李四 / 13900000000 / 浙江省 杭州市 西湖区”, 设为默认 moves the badge, and
    编辑张三 pre-fills the structured fields before saving
  - H5: login → PDP (曜石黑/皓月白, 库存 50) → checkout with coupon+wallet+points
    shows `¥2,332.50`, submit opens the cashier and completes
  - mini-program: 37-entry build, 36-page smoke (12 requests, 0 errors)
  - Flutter: `flutter analyze` clean, 35/35 widget/route/i18n/logistics tests
  - membership: 立即升级 → 操作成功 / 会员已开通，权益立即生效 (no console errors)
  - buyer hub `/buyer` renders coupons/activities/orders with no duplicate-key
    warning after the coupon-id fallback

> `pnpm verify` is green: 216 node contract tests, vitest (393+), i18n
> catalogues/baseline, dataset and default-data gates all pass. The mini-program
> contract failures listed in round 2a were fixed as part of 2.0.1.

## 5. Next rounds

1. Finish the platform admin surface (product create submit/media, shop review,
   membership/order governance) and the merchant marketing/data fixtures.
2. Extend the browser E2E to order cancel/repay, invoice issuance from the invoice
   centre, coupon claim, wallet recharge/withdraw and points upgrade.
3. Implement the upstream list/detail projection above and verify the real catalog
   response shape against the storefront mappers.
4. Restore server-side facets once the query parameters exist.
5. Re-run the full matrix on H5 / mini-program / Flutter with the now-green contract
   suite.
