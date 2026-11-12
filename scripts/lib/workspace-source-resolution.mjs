/**
 * Vite module-resolution extension order for the Mall web renderers.
 *
 * Workspace packages are consumed as *source*: their `package.json#exports`
 * points at `src/index.ts`, and internal imports inside those packages are
 * extensionless (`export * from '../generated/server-openapi/src/index'`).
 * Vite's default extension list tries `.js` before `.ts`, so an extensionless
 * import silently binds to a gitignored `tsc` artifact left next to the
 * authored source (`src/*.js`, `generated/server-openapi/src/*.js`).
 *
 * That makes a build depend on accidental build output. When the compiled
 * sibling is older than the TypeScript source it shadows, the entry (resolved
 * through `exports` -> `src/index.ts`) and its internal modules (resolved
 * through the stale `.js`) come from different revisions. The production
 * bundle then mixes a generated SDK base class with a composed facade that
 * expects newer generated namespaces, and the very first construction throws —
 * observed on the deployed portal as:
 *
 *   Uncaught (in promise) TypeError: Cannot read properties of undefined
 *     (reading 'demandClaims')
 *     at new SdkworkAppClient (index.ts:46:48)
 *     at createClient (index.ts:60:10)
 *
 * `src/index.ts` of `@sdkwork/order-app-sdk` reads
 * `this.orderDemandClaims.demandClaims`, so it must be paired with the same
 * generation of `generated/server-openapi/src/sdk.ts` that declares
 * `orderDemandClaims`. Binding the base class to an older `.js` leaves that
 * member `undefined`.
 *
 * Authored TypeScript is the authority for source-linked workspace packages
 * (SDK_SPEC / CODE_STYLE_SPEC section 7: generated and compiled output is never
 * the source of truth), so the TypeScript extensions must be tried first.
 * `.mjs` / `.js` / `.jsx` remain available for real JavaScript modules, and
 * `.json` stays last as in the Vite default list.
 */
export const WORKSPACE_SOURCE_RESOLVE_EXTENSIONS = Object.freeze([
  '.mts',
  '.ts',
  '.tsx',
  '.mjs',
  '.js',
  '.jsx',
  '.json',
]);
