# sdkwork-mall-mini-program

SDKWork Mall WeChat mini-program storefront (brick composition, contract-tested).

## Development

The WeChat dev tool loads the **bundled package** in `dist/` (`project.config.json`
`miniprogramRoot`), not the TypeScript sources: the application composes SDKWork
workspace packages whose `exports` point at TypeScript sources outside this
project, which the dev tool's TypeScript plugin cannot compile. Running the
sources directly leaves the tool on its last successful package — the cause of the
"module 'runtime-env.json.js' is not defined" launch failure.

```bash
# one shot: materialize the runtime env, then bundle app + every page
pnpm --filter sdkwork-mall-mini-program build

# rebuild on edit while the dev tool is open
pnpm --filter sdkwork-mall-mini-program build:mp:watch
```

Then open `apps/sdkwork-mall-mini-program` in WeChat DevTools and compile. The
local gateway dev double runs on port 3900.

- `src/` is the authored source of truth (tests, typecheck, guards read it).
- `dist/` is generated (git-ignored) by `scripts/build-miniprogram.mjs`.
- `scripts/build-runtime.mjs` writes `src/bootstrap/runtime-env.generated.ts`
  (and the loader shim `src/runtime-env.json.js`).

## Verification

- `pnpm --filter sdkwork-mall-mini-program typecheck`
- `node --test "apps/sdkwork-mall-mini-program/tests/*.test.mjs"` (page completeness,
  tab bar parity inputs, block ownership, i18n bindings)
- `pnpm exec vitest run apps/sdkwork-mall-mini-program/tests`
- `pnpm --filter sdkwork-mall-mini-program build` must succeed before opening the
  dev tool.
- `pnpm --filter sdkwork-mall-mini-program smoke:mp` boots the built package headlessly
  (stub `wx`/`App`/`Page`), runs `app.onLaunch`/`onShow` plus every page lifecycle and
  fails on the first error; `smoke:mp -- --hot-reload` additionally clears the
  runtime/host/services state first, reproducing a dev-tool hot reload that skips
  `app.onLaunch`.

## 微信包体与分包（官方限制）

- 官方限制：**主包 ≤ 2 MB，单个分包 ≤ 2 MB，总计 ≤ 20 MB**。
- 布局：主包只放 `app.*` + 5 个 tab 页（首页/分类/消息/购物车/我的）+ tab 图标；其余 31 个页面
  各自作为分包根（`{ "root": "pages/<name>", "pages": ["index"] }`），页面路径保持不变
  （`pages/<name>/index`），能力路由与跳转无需修改。
- 首页/分类/我的通过 `preloadRule` 预下载常用分包（搜索、商品、订单、收藏），避免首次跳转白屏。
- `pnpm --filter sdkwork-mall-mini-program build:mp` 会在构建结束时打印并校验包体：
  `[mall-mp] package budget: main ... KB, 31 subpackages (largest ... KB), total ... KB`；
  任一包超限则构建失败。
- 当前实测：主包 ≈ 1.68 MB，最大分包 ≈ 250 KB，总计 ≈ 8.2 MB。

### 共享 runtime（同一份 SDK 只打一次）

小程序只认 CommonJS、不能共享 chunk，早期每个页面 bundle 都会内联整套 SDK
（`mall-mp-core`/`-host`/`-im`/`-auth` + IAM/IM/Commerce/Order/Partner App SDK +
`sdk-common`/`im-sdk`），单页约 220 KB，36 页 ≈ 8 MB。

现在构建分两步：

1. `dist/shared/runtime.js`：把 `src/` 直接引用的 `@sdkwork/*` 运行时模块（5 个入口）
   和 `src/i18n` 目录**各打一次**，以 `{ "spec": module }` 注册表形式导出；
2. 每个页面 bundle 只保留页面代码，`@sdkwork/*` 与 `../../i18n` 的 import 被改写为
   `require("../../shared/runtime.js")["spec"]`（构建后按目录深度重写相对路径）。

runtime 位于主包 `dist/shared/`，所有分包都能 require。守卫
`page bundles load the one shared runtime` 会检查每个页面 bundle 都 require 共享 runtime、
且不再内联 SDK 传输层代码。

实测（当前）：主包 711 KB，最大分包 40.5 KB，总计 **1118 KB**（约 1.09 MB），
相比改造前的 8.2 MB 降低约 7.5 倍。