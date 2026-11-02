import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { strict as assert } from "node:assert";
import { test } from "node:test";

/**
 * Mini-program capability navigation guard.
 *
 * Pages navigate by capability route id through `routes/capabilities.ts`; the
 * registry is the only place that knows a physical page path. This keeps the
 * same route identity as the PC, H5 and Flutter roots and means a renamed page
 * is a one-line change in the registry.
 */

const sourceRoot = fileURLToPath(new URL("../src/", import.meta.url));
const registryPath = join(sourceRoot, "routes", "capabilities.ts");
const registrySource = readFileSync(registryPath, "utf8");

function collectPageModules(directory) {
  const modules = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      modules.push(...collectPageModules(entryPath));
    } else if (entry.name.endsWith(".ts")) {
      modules.push(entryPath);
    }
  }
  return modules;
}

function registryEntries() {
  const entries = [];
  for (const match of registrySource.matchAll(
    /\{ routeId: "([^"]+)", page: "([^"]+)" \}/gu,
  )) {
    entries.push({ page: match[2], routeId: match[1] });
  }
  return entries;
}

test("mini-program page modules navigate by capability id, never by page path", () => {
  const violations = [];
  for (const modulePath of collectPageModules(join(sourceRoot, "pages"))) {
    const source = readFileSync(modulePath, "utf8");
    if (source.includes("/pages/")) {
      violations.push(modulePath.replace(sourceRoot, "").replace(/\\/gu, "/"));
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Use mpCapabilityUrl() from routes/capabilities.ts instead of hard-coded page paths:\n${violations.join("\n")}`,
  );
});

test("capability registry and app.json declare the same pages", () => {
  const appJson = JSON.parse(readFileSync(join(sourceRoot, "app.json"), "utf8"));
  const registeredPages = new Set(registryEntries().map((entry) => entry.page));
  const declaredPages = new Set(appJson.pages);

  const missingFromRegistry = [...declaredPages].filter((page) => !registeredPages.has(page));
  const missingFromAppJson = [...registeredPages].filter((page) => !declaredPages.has(page));

  assert.deepEqual(missingFromRegistry, [], `pages missing from routes/capabilities.ts: ${missingFromRegistry.join(", ")}`);
  assert.deepEqual(missingFromAppJson, [], `registry pages missing from app.json: ${missingFromAppJson.join(", ")}`);
});

test("capability registry route ids are unique and follow the canonical shape", () => {
  const seen = new Set();
  for (const entry of registryEntries()) {
    assert.match(
      entry.routeId,
      /^(storefront|buyer|account)\.[a-z0-9-]+\.[a-z0-9-]+(\.[a-z0-9-]+)*$/u,
      `route id must follow <surface>.<domain>.<capability...>: ${entry.routeId}`,
    );
    assert.ok(!seen.has(entry.routeId), `duplicate capability route id: ${entry.routeId}`);
    seen.add(entry.routeId);
  }
});

test("tab capabilities are reachable with switchTab rather than navigateTo", () => {
  // wx.navigateTo cannot open a tabBar page; the registry classifies the tab
  // destinations so callers pick the right API.
  const tabBlock = registrySource.slice(registrySource.indexOf("MP_TAB_CAPABILITY_ROUTES"));
  for (const expected of [
    "storefront.mall.home",
    "storefront.mall.categories",
    "storefront.mall.cart",
    "buyer.mall.dashboard",
  ]) {
    assert.ok(tabBlock.includes(`"${expected}"`), `tab capability ${expected} must be classified`);
  }
});
