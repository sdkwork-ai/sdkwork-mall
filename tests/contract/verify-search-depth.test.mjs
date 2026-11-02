import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";

/**
 * Search-depth contract.
 *
 * A shopper expects two affordances on the search screen: hot terms to start
 * from and a local history to return to. H5, the mini program and Flutter had
 * both; PC had CMS hot terms but never recorded a history, so a PC buyer lost
 * every previous query on navigation.
 */
const workspaceRoot = path.resolve(import.meta.dirname, "..", "..");

const ROOTS = [
  {
    name: "pc",
    file: "apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-search/src/pages/SearchPage.tsx",
    patterns: ["hotKeywords", "SEARCH_HISTORY_KEY", "搜索历史", "clearSearchHistory"],
  },
  {
    name: "h5",
    file: "apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-catalog/src/pages/CatalogPage.tsx",
    patterns: ["热搜", "搜索历史", "HOT_SEARCH_KEYWORDS", "clearMallH5SearchHistory"],
  },
  {
    name: "miniProgram",
    file: "apps/sdkwork-mall-mini-program/src/pages/search/index.ts",
    patterns: ["hotKeywords", "history", "HISTORY_KEY"],
  },
  {
    name: "flutter",
    file: "apps/sdkwork-mall-flutter-mobile/lib/pages/search_page.dart",
    patterns: ["_hotKeywords", "_history", "search.history"],
  },
];

function read(relativePath) {
  assert.ok(existsSync(path.join(workspaceRoot, relativePath)), `missing ${relativePath}`);
  return readFileSync(path.join(workspaceRoot, relativePath), "utf8");
}

test("every root offers hot search terms and a local search history", () => {
  for (const entry of ROOTS) {
    const source = read(entry.file);
    for (const pattern of entry.patterns) {
      assert.ok(
        source.includes(pattern),
        `${entry.name} search must contain ${JSON.stringify(pattern)}`,
      );
    }
  }
});
