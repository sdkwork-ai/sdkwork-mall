/**
 * Reads the page manifest from `app.json`.
 *
 * The package is split into WeChat subpackages: the main package holds only the
 * five tab pages (the entry surface), and every other page is its own subpackage
 * root with an `index` page. This keeps the main package under the 2 MB limit
 * while preserving the exact page paths (`pages/<name>/index`), so the capability
 * registry and every navigation call stay unchanged.
 */
export function allPagePaths(appJson) {
  const main = appJson.pages ?? [];
  const subpackages = (appJson.subPackages ?? []).flatMap((entry) =>
    entry.pages.map((page) => `${entry.root}/${page}`),
  );
  return [...main, ...subpackages];
}

/** Main-package paths and the subpackage groups, for size accounting. */
export function packageGroups(appJson) {
  const mainPages = appJson.pages ?? [];
  const subpackages = (appJson.subPackages ?? []).map((entry) => ({
    root: entry.root,
    pages: entry.pages.map((page) => `${entry.root}/${page}`),
  }));
  return { mainPages, subpackages };
}
