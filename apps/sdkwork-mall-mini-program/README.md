# sdkwork-mall-mini-program

SDKWork Mall WeChat mini-program storefront (single transport seam, contract-tested).

## Development

- H5: `pnpm --dir apps/sdkwork-mall-mini-program dev` (port 5176, proxies `/app/v3/api` to the local gateway).
- Mini-program: open the project root in WeChat DevTools; the local gateway dev double runs on port 3900.

## Verification

- H5: `pnpm --dir apps/sdkwork-mall-mini-program build` and the workspace vitest suite.
- Mini-program: `pnpm --filter sdkwork-mall-mini-program typecheck` and `node --test tests/mp-standard-architecture.test.mjs`.
