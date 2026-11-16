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
