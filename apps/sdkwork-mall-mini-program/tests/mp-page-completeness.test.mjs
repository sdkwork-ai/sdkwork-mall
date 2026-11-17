import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import { allPagePaths } from "../scripts/app-pages.mjs";

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
const registeredPages = allPagePaths(appJson);

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

test("the dev tool runs the bundled package, not TypeScript sources", () => {
  // The WeChat dev tool cannot compile workspace TypeScript packages that live
  // outside the project root; when it fails it keeps the last successful package
  // (which is how a stale `app.ts` kept requiring a JSON module). The project
  // therefore points at `dist/`, produced by `scripts/build-miniprogram.mjs`.
  const projectConfig = JSON.parse(read(path.join(appRoot, "project.config.json")));
  assert.equal(projectConfig.miniprogramRoot, "dist/");
  assert.deepEqual(projectConfig.setting.useCompilerPlugins, [], "no TS plugin runs over the built package");

  const packageJson = JSON.parse(read(path.join(appRoot, "package.json")));
  assert.ok(packageJson.scripts["build:mp"], "a build:mp script must produce dist/");
  assert.match(packageJson.scripts.build, /build-miniprogram\.mjs/u, "the default build must bundle");
  assert.match(packageJson.scripts["build:standalone"], /build-miniprogram\.mjs/u);
  assert.match(packageJson.scripts["build:cloud"], /build-miniprogram\.mjs/u);

  const bundler = read(path.join(appRoot, "scripts/build-miniprogram.mjs"));
  assert.match(bundler, /allPagePaths\(appJson\)/u, "every page declared in app.json becomes an entry");
  assert.match(bundler, /format: "cjs"/u);
  assert.match(bundler, /nodeBuiltinStub/u, "Node-only SDK transports are stubbed, not required at runtime");
});

test("the loader-compatibility env shim mirrors the generated module", () => {
  // The WeChat compiler derives the module id `runtime-env.json.js` from a JSON
  // import. An older compiled bundle that still requires it must resolve to the
  // same values the build materializes; drift here would silently point a stale
  // build at another API host.
  const shim = read(path.join(srcRoot, "runtime-env.json.js"));
  const generated = read(path.join(srcRoot, "bootstrap", "runtime-env.generated.ts"));
  const readValue = (source, key) => {
    const match = source.match(new RegExp(`"${key}"\\s*:\\s*"([^"]*)"|${key}\\s*:\\s*"([^"]*)"`, "u"));
    return match ? (match[1] ?? match[2]) : "";
  };
  for (const key of ["deploymentProfile", "environment", "profileId", "platformApiGatewayHttpUrl"]) {
    assert.ok(readValue(shim, key), `shim is missing ${key}`);
    assert.equal(readValue(shim, key), readValue(generated, key), `shim ${key} drifted from runtime-env.generated.ts`);
  }
  assert.equal(
    readValue(shim, "commerceAppApiBaseUrl"),
    `${readValue(generated, "platformApiGatewayHttpUrl")}/app/v3/api`,
    "shim commerceAppApiBaseUrl must be derived from the projected gateway",
  );
  assert.match(shim, /module\.exports = \{/u, "the shim must be a CommonJS module");
});

test("no module dereferences globalThis outside the guarded scope helper", () => {
  // Base library 3.18 in the dev tool does not reliably expose `globalThis`
  // ("Cannot read property '…' of undefined"), so all scope resolution funnels
  // through `packages/sdkwork-mall-mp-host/src/scope.ts`, which guards every use.
  const problems = [];
  const SCOPE_HELPER = "packages/sdkwork-mall-mp-host/src/scope.ts";
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
      const relative = path.relative(appRoot, entryPath).replace(/\\/gu, "/");
      if (relative === SCOPE_HELPER) {
        continue;
      }
      // Strip comments so prose that mentions the global does not trip the guard.
      const source = read(entryPath)
        .replace(/\/\*[\s\S]*?\*\//gu, "")
        .replace(/^[ \t]*\/\/.*$/gmu, "");
      if (/\bglobalThis\b/u.test(source)) {
        problems.push(relative);
      }
    }
  };
  scan(srcRoot);
  scan(path.join(appRoot, "packages"));
  assert.deepEqual(problems, [], "use resolvePlatformScope/resolveGlobalObject/resolveSharedScope instead");
});

test("card surfaces stay rectangular (flat storefront)", () => {
  // Rounded cards exposed the page background at every corner, which is why the
  // storefront uses rectangular card surfaces; pills, avatars and inputs keep
  // their radius. This guard keeps a stray `border-radius` from regressing.
  const CARD_SELECTOR = /(card|hero|panel|section|banner|notice|row|item-image|product-image)/iu;
  const INTERACTIVE = /(input|textarea|btn|chip|tag|badge|dot|avatar|checkbox|pill|search)/iu;
  const ROUND = /999rpx|50%/u;
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
      if (!entry.name.endsWith(".wxss")) {
        continue;
      }
      const lines = read(entryPath).split(/\r?\n/u);
      let selector = "";
      for (const line of lines) {
        if (/^\s*[.#][^{]*\{\s*$/u.test(line)) {
          selector = line.trim().replace(/\s*\{$/u, "");
        }
        const radius = line.match(/border-radius\s*:\s*([^;]+);/u);
        if (!radius || !CARD_SELECTOR.test(selector) || INTERACTIVE.test(selector) || ROUND.test(radius[1])) {
          continue;
        }
        // `!important` is allowed: the flat surfaces are pinned that way.
        const value = radius[1].replace(/\s*!important$/iu, "").trim();
        if (value !== "0") {
          problems.push(`${path.relative(appRoot, entryPath).replace(/\\/gu, "/")} [${selector}] ${radius[1].trim()}`);
        }
      }
    }
  };
  scan(srcRoot);
  assert.deepEqual(problems, [], "card surfaces must use border-radius: 0");
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
test("page bundles load the one shared runtime instead of inlining the SDK", () => {
  // The SDK graph is bundled once into dist/shared/runtime.js; a page bundle that
  // inlines it again would grow the package past the 2 MB limit (it did: 8.2 MB).
  const dist = path.join(appRoot, "dist");
  if (!existsSync(dist)) {
    assert.ok(true, "dist is absent; run build:mp before the package guard");
    return;
  }
  assert.ok(existsSync(path.join(dist, "shared", "runtime.js")), "dist/shared/runtime.js must exist");
  const problems = [];
  const pagesRoot = path.join(dist, "pages");
  const bundles = [];
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name === "index.js") {
        bundles.push(full);
      }
    }
  };
  walk(pagesRoot);
  for (const bundle of bundles) {
    const source = read(bundle);
    const relative = path.relative(dist, bundle).replace(/\\/gu, "/");
    if (!source.includes("shared/runtime.js")) {
      problems.push(relative + ": does not require the shared runtime");
    }
    if (source.includes("Access-Token")) {
      problems.push(relative + ": inlines SDK transport code");
    }
  }
  assert.ok(bundles.length >= 30, "expected every page bundle");
  assert.deepEqual(problems, []);
});

test("the dist folder is a self-contained dev-tool project", () => {
  // Opening the dev tool on a parent directory makes it count sources and
  // node_modules as package code (the repository alone is ~2 GB). dist ships its
  // own project.config.json so it can be opened directly.
  const dist = path.join(appRoot, "dist");
  if (!existsSync(dist)) {
    assert.ok(true, "dist is absent; run build:mp first");
    return;
  }
  const config = JSON.parse(read(path.join(dist, "project.config.json")));
  assert.equal(config.miniprogramRoot, "./", "dist must be its own project root");
  assert.equal(config.compileType, "miniprogram");
  const distAppJson = JSON.parse(read(path.join(dist, "app.json")));
  assert.ok((distAppJson.subPackages ?? []).length >= 20, "subpackages must be declared in dist/app.json");
});

test("stylesheets contain no stray at-sign or unbalanced braces", () => {
  // A leftover "@" line (PowerShell here-string escape) made the dev tool fail with
  // "./pages/home/index.wxss(301:1): unexpected token '@'" and blocked the compile.
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
      if (!entry.name.endsWith(".wxss")) {
        continue;
      }
      const source = read(entryPath);
      const relative = path.relative(appRoot, entryPath).replace(/\\/gu, "/");
      for (const [index, line] of source.split(/\r?\n/u).entries()) {
        const trimmed = line.trim();
        if (trimmed.startsWith("@") && !/^@(import|media|supports|keyframes|-webkit-keyframes|font-face|charset)\b/u.test(trimmed)) {
          problems.push(relative + ":" + (index + 1) + " stray " + JSON.stringify(trimmed));
        }
      }
      const opens = (source.match(/\{/gu) ?? []).length;
      const closes = (source.match(/\}/gu) ?? []).length;
      if (opens !== closes) {
        problems.push(relative + ": unbalanced braces " + opens + "/" + closes);
      }
    }
  };
  scan(srcRoot);
  assert.deepEqual(problems, [], "stylesheets must be valid");
});

test("bundles polyfill the web globals the appservice lacks", () => {
  // WeChat appservice has no TextEncoder/TextDecoder, atob/btoa, queueMicrotask or
  // URLSearchParams; sdk-common and im-sdk call all of them. After upload the app
  // crashed with "TextEncoder is not defined", so the shims are part of the bundle.
  const dist = path.join(appRoot, "dist");
  if (!existsSync(dist)) {
    assert.ok(true, "dist is absent; run build:mp first");
    return;
  }
  const bundles = [path.join(dist, "app.js"), path.join(dist, "shared", "runtime.js")];
  for (const bundle of bundles) {
    const source = read(bundle);
    for (const marker of ["MpTextEncoder", "MpTextDecoder", "__sdkworkBase64Chars", "MpURLSearchParams"]) {
      assert.ok(source.includes(marker), path.relative(dist, bundle) + " must define " + marker);
    }
  }
});

test("no text asset starts with a UTF-8 BOM", () => {
  // The WXSS compiler fails with "unexpected '\uFEFF' at pos 1" and reports the
  // whole package as broken; PowerShell-authored edits used to add one.
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
      if (!/\.(wxss|wxml|json|js|wxs)$/u.test(entry.name)) {
        continue;
      }
      const bytes = readFileSync(entryPath);
      if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
        problems.push(path.relative(appRoot, entryPath).replace(/\\/gu, "/"));
      }
    }
  };
  scan(srcRoot);
  const dist = path.join(appRoot, "dist");
  if (existsSync(dist)) {
    scan(dist);
  }
  assert.deepEqual(problems, [], "text assets must not start with a BOM");
});

test("buyer page carries every icon it renders", () => {
  // The first version dropped the icon field in resolveLinks, so the template built
  // "/assets/icons/undefined.png": order rows showed icons, service tiles did not.
  const source = read(path.join(srcRoot, "pages", "buyer", "index.ts"));
  assert.match(source, /icon: link\.icon/u, "resolveLinks must carry the icon");
  const names = [...source.matchAll(/icon: "([a-z-]+)"/gu)].map((match) => match[1]);
  assert.ok(names.length >= 14, "expected an icon per entry");
  const missing = names.filter((name) => !existsSync(path.join(srcRoot, "assets", "icons", name + ".png")));
  assert.deepEqual(missing, [], "every referenced icon must ship as a PNG");
});

test("cards are edge-to-edge without an outline or elevation", () => {
  // A 1rpx card border renders as a light strip along every card edge (the "white
  // edge" seen left of all pages), and a page root with horizontal padding adds a
  // gutter on top of it.
  const app = read(path.join(srcRoot, "app.wxss"));
  assert.match(app, /\.mp-card,\s*\n\s*\.mp-section\s*\{[^}]*border:\s*0 !important;/u, "card outline removed");
  assert.match(app, /\.mp-card,\s*\n\s*\.mp-section\s*\{[^}]*box-shadow:\s*none !important;/u, "card elevation removed");
  assert.match(app, /\.mp-product-card\s*\{[^}]*border:\s*0 !important;/u, "product tiles are flat");
  const problems = [];
  for (const directory of readdirSync(path.join(srcRoot, "pages"))) {
    const filePath = path.join(srcRoot, "pages", directory, "index.wxss");
    if (!existsSync(filePath)) {
      continue;
    }
    const lines = read(filePath).split(/\r?\n/u);
    let selector = "";
    for (const line of lines) {
      if (/^\s*[.#][^{]*\{\s*$/u.test(line)) {
        selector = line.trim().replace(/\s*\{$/u, "");
      }
      const match = line.match(/^\s*(padding|margin)\s*:\s*([^;]+);/u);
      if (!match || !/^\.page-/u.test(selector)) {
        continue;
      }
      const values = match[2].trim().split(/\s+/u);
      if (values.length >= 2 && (values[1] === "24rpx" || values[1] === "20rpx" || values[1] === "30rpx")) {
        problems.push(directory + " " + selector + " " + line.trim());
      }
    }
  }
  assert.deepEqual(problems, [], "page roots must not inset content horizontally");
});

test("templates only reference assets that exist and avoid grid layout", () => {
  // Two failures observed in the dev tool: a `/assets/...png` icon that was never
  // shipped (empty glyph) and `display: grid` collapsing tiles so labels wrapped one
  // character per line. Both are cheap to guard here.
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
      if (!entry.name.endsWith(".wxml")) {
        continue;
      }
      const source = read(entryPath);
      for (const match of source.matchAll(/src="(\/assets\/[^"{}]+\.png)"/gu)) {
        const asset = path.join(srcRoot, match[1].replace(/^\//u, ""));
        if (!existsSync(asset)) {
          problems.push(`${path.relative(appRoot, entryPath).replace(/\\/gu, "/")}: missing ${match[1]}`);
        }
      }
    }
  };
  scan(srcRoot);
  assert.deepEqual(problems, [], "templates must reference shipped assets");
});

test("stylesheets avoid CSS grid (unsupported on older base libraries)", () => {
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
      if (!entry.name.endsWith(".wxss")) {
        continue;
      }
      const source = read(entryPath).replace(/\/\*[\s\S]*?\*\//gu, "");
      if (/display\s*:\s*grid|grid-template/iu.test(source)) {
        problems.push(path.relative(appRoot, entryPath).replace(/\\/gu, "/"));
      }
    }
  };
  scan(srcRoot);
  assert.deepEqual(problems, [], "use flex-wrap instead of grid");
});
