import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

/**
 * Page completeness and platform compatibility.
 *
 * Authority: `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` sections 1-2 and the WeChat
 * runtime contract. The dev-tool compiler resolves only TypeScript/JavaScript
 * modules and knows only the mini-program globals; a page whose template calls a
 * handler it does not declare, a half-authored page folder, or an app entry that
 * imports JSON all fail at launch, after typecheck passed.
 */
const appRoot = path.resolve(import.meta.dirname, "..");
const srcRoot = path.join(appRoot, "src");
const pagesRoot = path.join(srcRoot, "pages");

function read(file) {
  return readFileSync(file, "utf8");
}

function pageDirectories() {
  return readdirSync(pagesRoot).filter((entry) => statSync(path.join(pagesRoot, entry)).isDirectory());
}

const appJson = JSON.parse(read(path.join(srcRoot, "app.json")));
const registeredPages = appJson.pages;

test("every page folder is fully authored", () => {
  const problems = [];
  for (const page of pageDirectories()) {
    for (const file of ["index.ts", "index.wxml", "index.wxss", "index.json"]) {
      if (!existsSync(path.join(pagesRoot, page, file))) {
        problems.push(`pages/${page}/${file}`);
      }
    }
  }
  assert.deepEqual(problems, [], "every page needs index.ts, index.wxml, index.wxss and index.json");
});

test("app.json pages and the page folders agree exactly", () => {
  const declared = new Set(registeredPages);
  const folders = new Set(pageDirectories().map((page) => `pages/${page}/index`));
  assert.deepEqual([...declared].sort(), [...folders].sort(), "app.json pages must mirror src/pages");
  // Tab roots must be declared pages.
  for (const entry of appJson.tabBar.list) {
    assert.ok(declared.has(entry.pagePath), `${entry.pagePath} (tab) must be declared in pages`);
  }
});

/** Method names declared by a page module (2-space members of the Page literal). */
function declaredHandlers(source) {
  const names = new Set();
  for (const match of source.matchAll(/\n {2}(?:async )?([A-Za-z_$][\w$]*)\s*\(/gu)) {
    names.add(match[1]);
  }
  for (const match of source.matchAll(/\n {2}([A-Za-z_$][\w$]*)\s*:\s*(?:async\s*)?(?:\(|function)/gu)) {
    names.add(match[1]);
  }
  return names;
}

const EVENT_ATTRIBUTES = [
  "bindtap",
  "catchtap",
  "bindinput",
  "catchinput",
  "bindchange",
  "bindconfirm",
  "bindscrolltolower",
  "bindscroll",
  "bindsubmit",
  "bindlongpress",
  "catchlongpress",
  "bindload",
  "binderror",
];

test("every template event handler exists on its page", () => {
  const problems = [];
  for (const page of pageDirectories()) {
    const template = read(path.join(pagesRoot, page, "index.wxml"));
    const handlers = declaredHandlers(read(path.join(pagesRoot, page, "index.ts")));
    const attribute = new RegExp(`\\b(?:${EVENT_ATTRIBUTES.join("|")})="([^"{}]+)"`, "gu");
    for (const match of template.matchAll(attribute)) {
      const handler = match[1].trim();
      if (!handlers.has(handler)) {
        problems.push(`pages/${page}: ${handler}`);
      }
    }
  }
  assert.deepEqual(problems, [], "a template must not call an undeclared handler");
});

test("the app loads no JSON module and no non-mini-program global", () => {
  const problems = [];
  const scan = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink() || entry.name === "node_modules") {
        continue;
      }
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        scan(entryPath);
        continue;
      }
      if (!entry.name.endsWith(".ts")) {
        continue;
      }
      const source = read(entryPath);
      const relative = path.relative(appRoot, entryPath).replace(/\\/gu, "/");
      // The WeChat compiler emits `require("./x.json")` for a JSON import, which
      // the mini-program module system cannot resolve.
      if (/from\s+"[^"]+\.json"/u.test(source)) {
        problems.push(`${relative}: JSON import`);
      }
      if (/\bimport\.meta\b/u.test(source)) {
        problems.push(`${relative}: import.meta`);
      }
      if (/\bprocess\.env\b/u.test(source)) {
        problems.push(`${relative}: process.env`);
      }
      if (/\b(?:window|document|localStorage)\./u.test(source)) {
        problems.push(`${relative}: browser global`);
      }
    }
  };
  scan(srcRoot);
  scan(path.join(appRoot, "packages"));
  assert.deepEqual(problems, [], "platform-incompatible module or global");
});
