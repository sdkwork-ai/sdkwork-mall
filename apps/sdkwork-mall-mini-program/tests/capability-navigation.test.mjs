import { existsSync, readdirSync, readFileSync } from "node:fs";
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

test("every capability id referenced by a page exists in the registry", () => {
  // mpCapabilityUrl() throws on an unknown id, so a typo is a dead navigation
  // at runtime. This caught `account.login` being passed while the registry
  // publishes the canonical `account.mall.login`.
  const registryIds = new Set(registryEntries().map((entry) => entry.routeId));
  const violations = [];
  for (const modulePath of collectPageModules(join(sourceRoot, "pages"))) {
    const source = readFileSync(modulePath, "utf8");
    const relative = modulePath.replace(sourceRoot, "").replace(/\\/gu, "/");
    const referenced = [
      ...[...source.matchAll(/mpCapabilityUrl\(\s*"([^"]+)"/gu)].map((match) => match[1]),
      ...[...source.matchAll(/capability:\s*"([^"]+)"/gu)].map((match) => match[1]),
    ];
    for (const routeId of referenced) {
      if (!registryIds.has(routeId)) {
        violations.push(`${relative} → ${routeId}`);
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Unknown capability ids (mpCapabilityUrl would throw at runtime):\n${violations.join("\n")}`,
  );
});

test("no mini-program capability page is an orphan screen", () => {
  // Tab capabilities are entered from the tabBar. Every other capability page
  // needs an entry from another page module; the owning page directory is
  // excluded so a page cannot reference itself.
  const tabRouteIds = new Set([
    "storefront.mall.home",
    "storefront.mall.categories",
    "storefront.mall.cart",
    "buyer.mall.dashboard",
  ]);
  const pagesDirectory = join(sourceRoot, "pages");
  const allModules = collectPageModules(pagesDirectory);

  const orphans = [];
  for (const entry of registryEntries()) {
    if (tabRouteIds.has(entry.routeId)) {
      continue;
    }
    const ownerDirectory = join(pagesDirectory, entry.page.split("/")[1]);
    const referenced = allModules
      .filter((modulePath) => !modulePath.startsWith(ownerDirectory))
      .some((modulePath) => readFileSync(modulePath, "utf8").includes(entry.routeId));
    if (!referenced) {
      orphans.push(`${entry.routeId} (${entry.page})`);
    }
  }

  assert.deepEqual(
    orphans,
    [],
    `Capability pages with no in-app entry (implemented but unreachable):\n${orphans.join("\n")}`,
  );
});

test("every mini-program error state offers a recovery path", () => {
  // A page that renders an error with no way to retry forces the buyer to kill
  // and reopen the mini program. Pages either enable pull-down refresh or bind
  // a retry action in the error block. The login form is exempt: its error is a
  // rejected credential, retried by submitting the form again.
  //
  // The rule keys off `{{error}}` rather than the `mp-error` class: a page that
  // renders its error through another class (the product page used `mp-empty`)
  // would otherwise escape the gate while still trapping the buyer.
  const pagesRoot = join(sourceRoot, "pages");
  const exempt = new Set(["login"]);
  const violations = [];

  for (const entry of readdirSync(pagesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || exempt.has(entry.name)) {
      continue;
    }
    const wxmlPath = join(pagesRoot, entry.name, "index.wxml");
    const jsonPath = join(pagesRoot, entry.name, "index.json");
    if (!existsSync(wxmlPath)) {
      continue;
    }
    const wxml = readFileSync(wxmlPath, "utf8");
    const rendersError = /\{\{\s*error\s*\}\}/u.test(wxml);
    if (!rendersError && !wxml.includes("mp-error")) {
      continue;
    }
    if (rendersError && !wxml.includes("mp-error")) {
      violations.push(`${entry.name} (renders {{error}} without the mp-error recovery block)`);
      continue;
    }
    const pullDown = existsSync(jsonPath)
      ? Boolean(JSON.parse(readFileSync(jsonPath, "utf8")).enablePullDownRefresh)
      : false;
    if (!pullDown && !wxml.includes('bindtap="retry"')) {
      violations.push(entry.name);
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Error states with no retry or pull-down recovery:\n${violations.join("\n")}`,
  );
});