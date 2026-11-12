/**
 * Vite `resolve.extensions` order that prefers authored workspace TypeScript
 * over gitignored compiled `.js` siblings.
 */
export declare const WORKSPACE_SOURCE_RESOLVE_EXTENSIONS: readonly [
  '.mts',
  '.ts',
  '.tsx',
  '.mjs',
  '.js',
  '.jsx',
  '.json',
];
