# sdkwork-mall-h5

SDKWork Mall H5 mobile storefront and buyer console (React + Vite, port 5176 in dev).

## Development

- H5: `pnpm --dir apps/sdkwork-mall-h5 dev` (port 5176, proxies `/app/v3/api` to the local gateway).
- Mini-program: open the project root in WeChat DevTools; the local gateway dev double runs on port 3900.

## Verification

- H5: `pnpm --dir apps/sdkwork-mall-h5 build` and the workspace vitest suite.
- Mini-program: `pnpm --filter sdkwork-mall-mini-program typecheck` and `node --test tests/mp-standard-architecture.test.mjs`.
