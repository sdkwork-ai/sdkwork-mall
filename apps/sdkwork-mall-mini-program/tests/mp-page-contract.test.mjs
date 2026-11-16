import { createRequire } from "node:module";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { strict as assert } from "node:assert";
import { test } from "node:test";

/**
 * Mini-program page contract guards.
 *
 * WXML templates are not type-checked: `tsc` happily accepts a page whose
 * template reads `{{allCount}}` while `data` only publishes `selectedIds`, and
 * the bug shows up as a checkbox that never ticks. These tests close that gap
 * by cross-checking every template binding, i18n key, pagination field and
 * style unit against the page's own module.
 */

const require = createRequire(import.meta.url);
const sourceRoot = fileURLToPath(new URL("../src/", import.meta.url));
const pagesRoot = join(sourceRoot, "pages");

function pageDirectories() {
  return readdirSync(pagesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function readPage(name, extension) {
  const path = join(pagesRoot, name, `index.${extension}`);
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

/** Template-scope identifiers: the wx:for defaults plus any renamed alias. */
function loopAliases(wxml) {
  const aliases = new Set(["item", "index"]);
  for (const match of wxml.matchAll(/wx:for-(?:item|index)="([^"]+)"/gu)) {
    aliases.add(match[1]);
  }
  return aliases;
}

const EXPRESSION_KEYWORDS = new Set([
  "false",
  "in",
  "instanceof",
  "new",
  "null",
  "of",
  "true",
  "typeof",
  "undefined",
  "void",
]);

/** Top-level identifiers referenced by `{{ … }}` bindings. */
function bindingIdentifiers(wxml) {
  const identifiers = new Set();
  for (const match of wxml.matchAll(/\{\{([\s\S]*?)\}\}/gu)) {
    const expression = match[1]
      .replace(/'[^']*'/gu, "''")
      .replace(/"[^"]*"/gu, '""');
    for (const token of expression.matchAll(/(?:^|[^.\w$])([A-Za-z_$][\w$]*)/gu)) {
      const name = token[1];
      if (!EXPRESSION_KEYWORDS.has(name)) {
        identifiers.add(name);
      }
    }
  }
  return identifiers;
}

/**
 * Every property name mentioned anywhere in the page module (data literal,
 * `setData` patch, view-model interface). A template binding that is absent
 * here is bound to nothing.
 */
function declaredNames(moduleSource) {
  const names = new Set();
  for (const match of moduleSource.matchAll(/(?:^|[\s,{(\[])(["']?)([A-Za-z_$][\w$.]*)\1\s*:/gmu)) {
    names.add(match[2]);
  }
  return names;
}

test("every wxml binding resolves to a name the page module declares", () => {
  const violations = [];
  for (const page of pageDirectories()) {
    const wxml = readPage(page, "wxml");
    const moduleSource = readPage(page, "ts");
    if (!wxml || !moduleSource) {
      continue;
    }
    const scope = loopAliases(wxml);
    const declared = declaredNames(moduleSource);
    for (const identifier of bindingIdentifiers(wxml)) {
      if (scope.has(identifier) || declared.has(identifier)) {
        continue;
      }
      violations.push(`${page}: {{${identifier}}} is not published by index.ts`);
    }
  }

  assert.deepEqual(violations, [], `Template bindings without page data:\n${violations.join("\n")}`);
});

test("every t() key used by a page exists in the zh-CN catalogue", () => {
  const messages = {};
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const entryPath = join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(entryPath);
      } else if (entry.name === "messages.js") {
        const fragment = require(entryPath);
        const collect = (node, prefix) => {
          for (const key of Object.keys(node)) {
            const value = node[key];
            const path = prefix ? `${prefix}.${key}` : key;
            if (value !== null && typeof value === "object") {
              collect(value, path);
            } else {
              messages[path] = String(value);
            }
          }
        };
        collect(fragment, "");
      }
    }
  };
  walk(join(sourceRoot, "i18n", "zh-CN"));

  const missing = [];
  for (const page of pageDirectories()) {
    const moduleSource = readPage(page, "ts");
    for (const match of moduleSource.matchAll(/\bt\(\s*["']([^"']+)["']/gu)) {
      const key = match[1];
      if (!Object.prototype.hasOwnProperty.call(messages, key)) {
        missing.push(`${page}: ${key}`);
      }
    }
  }

  assert.deepEqual(
    [...new Set(missing)],
    [],
    `Missing i18n keys (t() would render the raw key):\n${missing.join("\n")}`,
  );
});

test("list services read the PageInfo contract field, not a legacy total", () => {
  const services = join(sourceRoot, "services");
  const violations = [];
  for (const entry of readdirSync(services, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".ts")) {
      continue;
    }
    const source = readFileSync(join(services, entry.name), "utf8");
    // `pageInfo.total` does not exist on API_SPEC §16 PageInfo, so a guard
    // built on it is always true and only the first page ever renders. A
    // `pageInfo` value may still be *mapped* into a local `total` field; only a
    // direct `.total` member read is the defect.
    if (/pageInfo(?:\s*as\s+[^;)\n]+\)?)?\s*(?:\?\.|\.)\s*total\b(?!Items|Pages)/u.test(source)) {
      violations.push(`${entry.name}: reads a non-contract pageInfo.total`);
    }
  }

  assert.deepEqual(violations, [], violations.join("\n"));
  const catalog = readFileSync(join(services, "catalog-service.ts"), "utf8");
  const orders = readFileSync(join(services, "order-service.ts"), "utf8");
  assert.match(catalog, /readPageInfo/u, "catalog list must normalize PageInfo");
  assert.match(orders, /readPageInfo/u, "order list must normalize PageInfo");
});

test("page styles stay in rpx so they scale with the device", () => {
  const violations = [];
  for (const page of pageDirectories()) {
    const wxss = readPage(page, "wxss");
    if (!wxss) {
      continue;
    }
    for (const match of wxss.matchAll(/\d+(?:\.\d+)?px/gu)) {
      violations.push(`${page}: ${match[0]}`);
    }
  }

  assert.deepEqual(violations, [], `Use rpx instead of px:\n${violations.join("\n")}`);
});

test("shareable storefront surfaces publish a share card", () => {
  const shareable = [
    "activity",
    "activity-detail",
    "category",
    "home",
    "order-detail",
    "product",
    "search",
    "shop",
  ];
  for (const page of shareable) {
    const moduleSource = readPage(page, "ts");
    assert.match(
      moduleSource,
      /onShareAppMessage\s*\(/u,
      `${page} must expose onShareAppMessage so the page can be forwarded`,
    );
  }
});

test("pull-to-refresh is declared and always stops the spinner", () => {
  const violations = [];
  for (const page of pageDirectories()) {
    const json = readPage(page, "json");
    const moduleSource = readPage(page, "ts");
    if (!json) {
      continue;
    }
    let config;
    try {
      config = JSON.parse(json);
    } catch {
      violations.push(`${page}: index.json is not valid JSON`);
      continue;
    }
    if (!config.enablePullDownRefresh) {
      continue;
    }
    if (!/onPullDownRefresh\s*\(/u.test(moduleSource)) {
      violations.push(`${page}: enablePullDownRefresh without onPullDownRefresh`);
    } else if (!/stopPullDownRefresh/u.test(moduleSource)) {
      violations.push(`${page}: pull-to-refresh never calls wx.stopPullDownRefresh`);
    }
  }

  assert.deepEqual(violations, [], violations.join("\n"));
});

test("destructive cart and address actions ask for confirmation", () => {
  // Authority: pages must ask through the host feedback adapter, not by
  // assembling a platform `showModal` literal.
  const cart = readPage("cart", "ts");
  const address = readPage("address", "ts");
  assert.match(cart, /platform\.confirm/u, "cart deletion must confirm before removing lines");
  assert.match(address, /platform\.confirm/u, "address deletion must confirm before removing the row");
});

test("the app root never calls platform globals directly", () => {
  // Authority: MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md section 8. Every WeChat API
  // lives in `@sdkwork/mall-mp-host`; the root goes through the `platform`
  // facade or the injected host adapters.
  const stripProse = (source) => source
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .replace(/^[ \t]*\/\/.*$/gmu, "")
    .replace(/`(?:[^`\\]|\\.)*`/gu, "``")
    .replace(/'(?:[^'\\\n]|\\.)*'/gu, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/gu, '""');
  const violations = [];
  for (const file of collectTypeScriptFiles(sourceRoot)) {
    if (/\bwx\.[a-zA-Z]/u.test(stripProse(readFileSync(file, "utf8")))) {
      violations.push(file.replace(sourceRoot, "").replace(/\\/gu, "/"));
    }
  }
  assert.deepEqual(violations, [], `Move these platform calls behind the host facade:\n${violations.join("\n")}`);
});

/** Every `.ts` file under a directory tree. */
function collectTypeScriptFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTypeScriptFiles(entryPath));
    } else if (entry.name.endsWith(".ts")) {
      files.push(entryPath);
    }
  }
  return files;
}
