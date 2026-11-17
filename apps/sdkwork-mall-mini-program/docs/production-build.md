# 小程序环境与生产构建

本文档对应当前实现，权威规范是
`../sdkwork-specs/APP_RUNTIME_ENV_SPEC.md`（§2 生命周期矩阵、§3.1 打包面的
EnvConfig 投影）与 `APP_MINI_PROGRAM_UI_SPEC.md`。

## 1. 环境模型

小程序是**打包面**：每个生命周期环境产出一个包，运行时不读取第二份部署配置。

| 维度 | 取值 |
| --- | --- |
| 部署面（deployment profile） | `cloud`（默认，app manifest 只声明 cloud）、`standalone` |
| 生命周期（environment） | `development`、`test`、`staging`、`demo`、`production` |

组合成 10 个 profile（`<profile>.<environment>`），每个 profile 对应一个已提交的
配置文件：

```
apps/sdkwork-mall-mini-program/config/mini-program/runtime-env.<profile>.json
```

该文件由规范工具生成，**不要手改**：

```bash
pnpm workflow:materialize-topology-env      # 拓扑层 → etc/topology/*.env
pnpm workflow:materialize-client-env        # 拓扑 + 应用 overlay → 30 个 client env 文件
pnpm env:check                              # 校验已提交文件是否最新（CI 用）
```

小程序 profile 包含：

- `SDKWORK_*_APPLICATION_PUBLIC_HTTP_URL` / `SDKWORK_*_PLATFORM_API_GATEWAY_HTTP_URL`
  （设备可访问的网关域名，H5/PC 使用同一部署配置）；
- `SDKWORK_ENVIRONMENT` / `SDKWORK_DEPLOYMENT_PROFILE` / `SDKWORK_PROFILE_ID` /
  `SDKWORK_RUNTIME_TARGET=mini-program`；
- 公共应用 token `SDKWORK_ACCESS_TOKEN`（三段式 JWT，构建期由 IAM 公钥签发面生成；
  不含任何会话凭据）。

本应用的 `etc/env.cloud.development.env` 覆盖开发环境的网关：手机无法访问
开发者机器的 `127.0.0.1:3900`，所以开发包指向设备可访问的
`https://api-dev.sdkwork.com`。真机想连本地后端时，用 DevTools 控制台注入
`__SDKWORK_MALL_MP_RUNTIME_ENV__`（调试用，不进入产物）。

## 2. 构建流程（规范顺序）

```
materialize 拓扑 → materialize client env → 校验 profile → 生成 EnvConfig → 打包
```

`scripts/build-runtime.mjs` 调用规范生成器
`sdkwork-specs/tools/generate-app-env-config.mjs` 把选中的 profile 投影为
`src/bootstrap/runtime-env.generated.ts`（`ENV_CONFIG`）；运行时只 import 该模块，
不解析 JSON、不硬编码域名。生成器会在以下情况**构建失败**：

- profile 文件缺失或 `SDKWORK_ACCESS_TOKEN` 缺失/非三段式 JWT；
- token 的 `app_id`、`environment`、`deployment_profile` 与目标 profile 不一致。

随后 `scripts/build-miniprogram.mjs` 用 esbuild 把 `src/` 与共享运行时打进
`dist/`（分包 + 主包体积预算检查）。

## 3. 各环境构建命令

仓库根执行（推荐）：

```bash
pnpm env:materialize          # 只有拓扑/环境配置变化时需要
pnpm build:mp:dev             # cloud.development（默认开发包）
pnpm build:mp:prod            # cloud.production（生产包）
pnpm build:mp:demo            # cloud.demo
```

也可以在小程序目录执行：

```bash
pnpm --dir apps/sdkwork-mall-mini-program run build:mp:test
pnpm --dir apps/sdkwork-mall-mini-program run build:mp:staging
pnpm --dir apps/sdkwork-mall-mini-program run build:mp:standalone:prod
pnpm --dir apps/sdkwork-mall-mini-program run env:check        # profile/投影是否最新
```

构建产物 `apps/sdkwork-mall-mini-program/dist/` 被 `project.config.json` 的
`miniprogramRoot: "dist/"` 直接打开。

## 4. 生产发布步骤

1. **确认 profile 与域名**
   `pnpm env:check`；确认 `config/mini-program/runtime-env.cloud.production.json`
   的网关为 `https://api.sdkwork.com`。
2. **构建生产包**
   `pnpm build:mp:prod`。构建日志会打印预算与 build id
   （`2026-…Z`），DevTools 控制台与首页页脚也显示同一个 id，用于确认没有旧缓存。
3. **微信公众平台配置**
   - 小程序后台 → 开发管理 → 服务器域名：把 `https://api.sdkwork.com`
     加入 `request` 合法域名（以及 `uploadFile`/`downloadFile` 若用到）；
   - 业务域名 / WebView 域名按需配置；
   - `project.config.json` 的 `appid` 为 `wxceca927f6ff4957f`（SDKWork 商城小程序）。
4. **上传与版本**
   用微信开发者工具打开 `apps/sdkwork-mall-mini-program`（或 `dist/`）→ 上传，
   填写版本号与备注；"体验版"选择对应环境验证，最后在后台"提交审核 → 发布"。
   发布后 `wx.getAccountInfoSync().miniProgram.envVersion === 'release'`；
   若包内 profile 不是 production，运行时会打印告警（见 `readRuntimeEnv`）。
5. **发布后自检**
   - 首页/登录/下单/支付/订单详情（含"分销伙伴"行）走通；
   - DevTools 编译产物与线上包 build id 一致；
   - 若出现接口 401/域名错误，先核对合法域名与 token 的 `app_id`/`environment`。

## 5. 约束与排错

- **禁止**手改 `config/mini-program/*.json`、`src/bootstrap/runtime-env.generated.ts`、
  `src/runtime-env.json.js`（后两者是构建产物）。
- **禁止**在 `src/` 中硬编码部署域名；契约测试
  `tests/mp-runtime-env.test.mjs` 会失败。
- 拓扑/profile 变更后忘记重新 materialize：`pnpm env:check` 与
  `scripts/build-runtime.mjs --check` 会报 stale。
- 小程序包体积上限：主包/分包各 ≤2MB、总计 ≤20MB；`build-miniprogram.mjs`
  超出即失败（当前约 1.47MB / 37 个入口）。
- 回滚：小程序的回滚在微信公众平台"版本管理"执行（回退到上一个线上版本）；
  仓库侧用 `git revert` 修复前滚，遵循 `ROLLBACK_RESTRICTION_SPEC.md`。
