/**
 * Commerce SDK client seam for the mini-program root.
 *
 * The PC/H5 roots consume federated commerce through
 * `@sdkwork/cloudrouter-app-sdk/domains`; the mini-program runtime cannot run
 * that generated TypeScript transport, and the ecosystem has not generated a
 * mall WeChat MP SDK family yet. Until the generator ships the MP family, this
 * seam stays intentionally unimplemented and every surface that would call it
 * fails fast with guidance instead of issuing raw wx.request traffic.
 */
export function createMallMpCommerceClient(): never {
  throw new Error(
    "mall MP commerce transport is pending the generated WeChat MP SDK family; see apps/sdkwork-mall-mini-program/docs/decisions.md",
  );
}
