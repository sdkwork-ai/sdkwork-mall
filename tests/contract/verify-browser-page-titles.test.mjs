import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";

/**
 * Browser page-title contract.
 *
 * The H5 and PC roots are single-page applications, so the tab title only
 * changes if the shell writes it. Before this contract both kept the entry
 * document title ("SDKWork 商城") on every route, which made browser history,
 * bookmarks and assistive-tech announcements useless for deep links.
 */
const workspaceRoot = path.resolve(import.meta.dirname, "..", "..");

function read(relativePath) {
  const absolutePath = path.join(workspaceRoot, relativePath);
  assert.ok(existsSync(absolutePath), `missing ${relativePath}`);
  return readFileSync(absolutePath, "utf8");
}

test("the H5 shell publishes the matched route title as document.title", () => {
  const shell = read("apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-shell/src/index.tsx");
  assert.match(shell, /document\.title\s*=/u);
  assert.match(shell, /navbarTitle/u);
  assert.match(shell, /appDisplayName/u);
});

test("the PC root publishes the matched route title as document.title", () => {
  const app = read("apps/sdkwork-mall-pc/src/App.tsx");
  assert.match(app, /document\.title\s*=/u);
  assert.match(app, /matchPath\(route\.path/u);
  assert.match(app, /appDisplayName/u);
});

test("both entry documents declare the same brand title", () => {
  for (const entry of [
    "apps/sdkwork-mall-h5/index.html",
    "apps/sdkwork-mall-pc/index.html",
  ]) {
    assert.match(read(entry), /<title>SDKWork 商城<\/title>/u, entry);
  }
});
