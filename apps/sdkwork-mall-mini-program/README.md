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

### 为什么打出来这么大

每个页面 bundle 都由 esbuild 独立打包（小程序只认 CommonJS，无法共享 chunk），页面会
各自内联 `@sdkwork/mall-mp-core`、`-host`、`-im`、`-auth` 以及 IAM/IM/Commerce/Order/Partner
App SDK 与 `@sdkwork/sdk-common`/`im-sdk` 的完整调用链，单页约 220 KB；36 页 × ~220 KB ≈ 8 MB。
分包后每个包都在 2 MB 内；若要把总量再降一个量级，需要抽出一个共享 runtime 包供页面
`require`（页面 bundle 变薄），这是后续优化项。