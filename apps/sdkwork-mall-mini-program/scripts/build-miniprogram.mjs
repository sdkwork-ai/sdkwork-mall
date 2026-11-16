#!/usr/bin/env node
/**
 * Builds the runnable mini-program package.
 *
 * Why a build step: the WeChat dev-tool TypeScript plugin compiles only what it
 * can resolve inside the project, and this application composes SDKWork workspace
 * packages whose `exports` point at TypeScript sources (siblings outside the
 * project root). When the plugin cannot resolve those, the tool keeps the last
 * successful package.
 *
 * Two outputs are produced:
 *
 * 1. `dist/shared/runtime.js` — every `@sdkwork/*` runtime module the application
 *    consumes, bundled **once**. Mini programs only load CommonJS and cannot share
 *    chunks between packages, so without this file each page bundle inlined the
 *    whole SDK graph (~220 KB × 36 pages ≈ 8 MB, well over the 2 MB limit).
 * 2. One thin bundle per entry (app + pages). Bare `@sdkwork/*` imports are
 *    rewritten to a lookup in the shared runtime, so a page bundle carries only its
 *    own page code and the i18n fragments it uses.
 *
 * The shared runtime lives in the main package (its `dist/shared/` folder), which
 * every subpackage can require, so both requirements hold: one SDK copy and the
 * official subpackage size limits.
 */
import { createRequire } from "node:module";
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { allPagePaths } from "./app-pages.mjs";

const require = createRequire(import.meta.url);
const esbuild = require("esbuild");

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = path.join(appRoot, "src");
const packagesRoot = path.join(appRoot, "packages");
const outRoot = path.join(appRoot, "dist");
const sharedRoot = path.join(outRoot, "shared");
const sharedRuntimeFile = path.join(sharedRoot, "runtime.js");

const appJson = JSON.parse(readFileSync(path.join(srcRoot, "app.json"), "utf8").replace(/^\uFEFF/u, ""));
const appJsonProjectConfig = JSON.parse(readFileSync(path.join(appRoot, "project.config.json"), "utf8").replace(/^\uFEFF/u, ""));

/** Entry modules: the app plus every page declared in app.json (main + subpackages). */
const entryPoints = [
  path.join(srcRoot, "app.ts"),
  ...allPagePaths(appJson).map((page) => path.join(srcRoot, `${page}.ts`)),
];

for (const entry of entryPoints) {
  if (!statSync(entry, { throwIfNoEntry: false })?.isFile()) {
    console.error(`[mall-mp] missing entry: ${path.relative(appRoot, entry)}`);
    process.exit(1);
  }
}

const BUILD_ID = new Date().toISOString();
const WATCH = process.argv.includes("--watch");
const SHARED_PATH_PLACEHOLDER = "__SDKWORK_SHARED_RUNTIME_PATH__";
const SHARED_STORE_PLACEHOLDER = "__SDKWORK_SHARED_STORE_PATH__";
const APP_I18N_SPEC = "@sdkwork-app/i18n";
const APP_I18N_FILE = path.join(srcRoot, "i18n", "index.ts");

/**
 * Collects the bare `@sdkwork/*` specifiers that entries import as values.
 *
 * The shared runtime exposes exactly these modules; type-only imports are skipped
 * (esbuild erases them and some type packages have no runtime entry point).
 */
function collectSharedSpecifiers() {
  const found = new Map();
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name.startsWith(".")) {
        continue;
      }
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(full);
        continue;
      }
      if (!entry.name.endsWith(".ts")) {
        continue;
      }
      const source = readFileSync(full, "utf8");
      const pattern = /^[ \t]*import\s+(?!type\b)[^;]*?from\s+"(@sdkwork\/[^"]+)"/gmu;
      for (const match of source.matchAll(pattern)) {
        found.set(match[1], full);
      }
      for (const match of source.matchAll(/^[ \t]*export\s+[^;]*?from\s+"(@sdkwork\/[^"]+)"/gmu)) {
        found.set(match[1], full);
      }
    }
  };
  visit(srcRoot);
  const resolved = new Map();
  for (const [specifier, importer] of found) {
    try {
      resolved.set(specifier, createRequire(importer).resolve(specifier));
    } catch {
      try {
        resolved.set(specifier, createRequire(path.join(appRoot, "package.json")).resolve(specifier));
      } catch {
        console.warn(`[mall-mp] shared runtime: cannot resolve ${specifier} (type-only import?)`);
      }
    }
  }
  return [...resolved.entries()].sort(([a], [b]) => a.localeCompare(b));
}

/**
 * Global shims prepended to every bundle.
 *
 * `@sdkwork/sdk-common` calls the bare globals `fetch`, `AbortController` and
 * `AbortSignal`. The WeChat appservice does not reliably expose `globalThis`, so
 * assigning to the global object does not guarantee those variables exist. A
 * bundle-scoped `var` shadow is defined instead, delegating to the host HTTP
 * adapter the app installs on the platform scope (`wx`).
 */
const GLOBAL_SHIMS = `
var __sdkworkGlobal = (typeof wx !== "undefined" && wx) || (typeof globalThis !== "undefined" && globalThis) || {};
var __sdkworkSharedStore = require(${SHARED_STORE_PLACEHOLDER});
var __sdkworkFetchImpl = function (input, init) {
  var impl = __sdkworkSharedStore.__SDKWORK_MALL_MP_FETCH__ || __sdkworkGlobal.__SDKWORK_MALL_MP_FETCH__ || (typeof globalThis !== "undefined" && globalThis.fetch);
  if (typeof impl !== "function") {
    throw new Error("SDK fetch is not installed; call installMpFetch from the app bootstrap");
  }
  return impl(input, init);
};
var fetch = __sdkworkFetchImpl;
var AbortSignal = __sdkworkSharedStore.__SDKWORK_MALL_MP_ABORT_SIGNAL__ || __sdkworkGlobal.__SDKWORK_MALL_MP_ABORT_SIGNAL__ || (function () {
  function MpAbortSignal() {
    this.aborted = false;
    this.__listeners = [];
  }
  MpAbortSignal.prototype.addEventListener = function (type, handler) {
    if (type === "abort" && typeof handler === "function") this.__listeners.push(handler);
  };
  MpAbortSignal.prototype.removeEventListener = function (type, handler) {
    if (type !== "abort") return;
    const index = this.__listeners.indexOf(handler);
    if (index >= 0) this.__listeners.splice(index, 1);
  };
  MpAbortSignal.prototype.__dispatchAbort = function () {
    if (this.aborted) return;
    this.aborted = true;
    var listeners = this.__listeners.slice();
    for (var i = 0; i < listeners.length; i += 1) listeners[i]();
    this.__listeners.length = 0;
  };
  return MpAbortSignal;
})();
var AbortController = __sdkworkSharedStore.__SDKWORK_MALL_MP_ABORT_CONTROLLER__ || __sdkworkGlobal.__SDKWORK_MALL_MP_ABORT_CONTROLLER__ || (function () {
  function MpAbortController() {
    this.signal = new AbortSignal();
  }
  MpAbortController.prototype.abort = function () {
    this.signal.__dispatchAbort();
  };
  return MpAbortController;
})();
`;

/** Page/app bundles additionally resolve their `@sdkwork/*` imports here. */
const SHARED_ACCESS_SHIM = `
var __sdkworkSharedRuntime = require(${SHARED_PATH_PLACEHOLDER});
function __sdkworkSharedModule(name) {
  return __sdkworkSharedRuntime[name];
}
`;

/**
 * Stubs Node built-ins that SDK transport packages reference for their
 * server-side transports (`node:net`, `node:dgram`, ...).
 */
function nodeBuiltinStub() {
  const NODE_BUILTINS = new Set([
    "assert", "buffer", "child_process", "crypto", "dgram", "dns", "events", "fs",
    "http", "http2", "https", "net", "os", "path", "perf_hooks", "process",
    "querystring", "readline", "stream", "string_decoder", "tls", "tty", "url",
    "util", "v8", "vm", "worker_threads", "zlib",
  ]);
  return {
    name: "node-builtin-stub",
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        const bare = args.path.replace(/^node:/u, "");
        if (args.path.startsWith("node:") || NODE_BUILTINS.has(bare)) {
          return { namespace: "node-stub", path: args.path };
        }
        return undefined;
      });
      build.onLoad({ filter: /.*/, namespace: "node-stub" }, () => ({
        contents: "module.exports = {};",
        loader: "js",
      }));
    },
  };
}

/** Routes a bare `@sdkwork/*` import to the one shared runtime instance. */
function sharedSdkPlugin(specifiers) {
  const shared = new Set(specifiers);
  return {
    name: "sdkwork-shared-runtime",
    setup(build) {
      build.onResolve({ filter: /^@sdkwork\// }, (args) => {
        if (!shared.has(args.path)) {
          return undefined;
        }
        return { path: args.path, namespace: "sdkwork-shared" };
      });
      // Pages import the i18n module by relative path; route that shared module
      // into the runtime too so the catalogue is bundled once, not 36 times.
      build.onResolve({ filter: /^\.{1,2}\// }, (args) => {
        if (!args.importer) {
          return undefined;
        }
        const candidate = path.resolve(path.dirname(args.importer), args.path);
        if (candidate === APP_I18N_FILE || path.join(candidate, "index.ts") === APP_I18N_FILE) {
          return { path: APP_I18N_SPEC, namespace: "sdkwork-shared" };
        }
        return undefined;
      });
      build.onLoad({ filter: /.*/, namespace: "sdkwork-shared" }, (args) => ({
        contents: `module.exports = __sdkworkSharedModule(${JSON.stringify(args.path)});`,
        loader: "js",
      }));
    },
  };
}

const commonBuildOptions = {
  bundle: true,
  format: "cjs",
  platform: "neutral",
  target: ["es2020"],
  logLevel: "warning",
  sourcemap: false,
  minify: true,
  treeShaking: true,
  tsconfig: path.join(appRoot, "tsconfig.json"),
};

// The output is fully generated by this script; `dist` is git-ignored.
rmSync(outRoot, { recursive: true, force: true });
mkdirSync(sharedRoot, { recursive: true });

const sharedSpecifiers = collectSharedSpecifiers();

if (WATCH) {
  console.log(`[mall-mp] watching ${entryPoints.length} entries (shared runtime is built once) build ${BUILD_ID}`);
} else {
  console.log(`[mall-mp] shared runtime: ${sharedSpecifiers.length} @sdkwork modules`);
}

/** 1. Build the shared runtime: one copy of every SDK module the app consumes. */
const registrySource = [
  "module.exports = {",
  ...sharedSpecifiers.map(([spec, resolved]) => `  ${JSON.stringify(spec)}: require(${JSON.stringify(resolved)}),`),
  `${JSON.stringify(APP_I18N_SPEC)}: require(${JSON.stringify(APP_I18N_FILE)}),`,
  "};",
].join("\n");

const runtimeResult = await esbuild.build({
  ...commonBuildOptions,
  stdin: { contents: registrySource, resolveDir: appRoot, loader: "js" },
  outfile: sharedRuntimeFile,
  plugins: [nodeBuiltinStub()],
  banner: { js: GLOBAL_SHIMS },
});
if (runtimeResult.errors.length > 0) {
  console.error("[mall-mp] shared runtime build failed");
  process.exit(1);
}

/** 2. Build the entries; `@sdkwork/*` imports become lookups in the runtime. */
const buildOptions = {
  ...commonBuildOptions,
  entryPoints,
  outbase: srcRoot,
  outdir: outRoot,
  loader: { ".png": "dataurl", ".jpg": "dataurl" },
  plugins: [nodeBuiltinStub(), sharedSdkPlugin(sharedSpecifiers.map(([spec]) => spec))],
  banner: { js: GLOBAL_SHIMS + SHARED_ACCESS_SHIM },
  define: { __SDKWORK_MALL_MP_BUILD_ID__: JSON.stringify(BUILD_ID) },
};

if (WATCH) {
  const context = await esbuild.context(buildOptions);
  await context.watch();
} else {
  const result = await esbuild.build(buildOptions);
  if (result.errors.length > 0) {
    console.error("[mall-mp] bundle failed");
    process.exit(1);
  }
}

/**
 * Copies the template/config assets that are not JavaScript modules.
 */
const COPIED_EXTENSIONS = new Set([".json", ".wxml", ".wxss", ".wxs", ".png", ".jpg", ".jpeg", ".svg", ".gif", ".ttf"]);

function copyAssets(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const source = path.join(directory, entry.name);
    const relative = path.relative(srcRoot, source);
    if (entry.isDirectory()) {
      copyAssets(source);
      continue;
    }
    if (entry.name.endsWith(".d.ts") || entry.name.endsWith(".ts") || entry.name === "runtime-env.json.js") {
      continue;
    }
    if (!COPIED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      continue;
    }
    const target = path.join(outRoot, relative);
    mkdirSync(path.dirname(target), { recursive: true });
    // Strip a UTF-8 BOM: the WXSS compiler rejects it ("unexpected '\uFEFF' at pos 1").
    const bytes = readFileSync(source);
    if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
      writeFileSync(target, bytes.subarray(3));
    } else {
      cpSync(source, target);
    }
  }
}

copyAssets(srcRoot);

// Copy the shared-state module (plain JS, not bundled: every bundle requires the
// same file so the mini-program module cache makes it one instance).
cpSync(path.join(srcRoot, "shared-state.js"), path.join(outRoot, "shared-state.js"));

/** Writes relative paths after the output tree is known (page depth varies). */
function relativeTo(outFile, target) {
  const relative = path.relative(path.dirname(outFile), target).replace(/\\/gu, "/");
  return relative.startsWith(".") ? relative : `./${relative}`;
}

function rewritePlaceholders(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      rewritePlaceholders(full);
      continue;
    }
    if (!entry.name.endsWith(".js")) {
      continue;
    }
    let source = readFileSync(full, "utf8");
    const original = source;
    if (source.includes(SHARED_STORE_PLACEHOLDER)) {
      source = source.replaceAll(SHARED_STORE_PLACEHOLDER, JSON.stringify(relativeTo(full, path.join(outRoot, "shared-state.js"))));
    }
    if (source.includes(SHARED_PATH_PLACEHOLDER)) {
      source = source.replaceAll(SHARED_PATH_PLACEHOLDER, JSON.stringify(relativeTo(full, sharedRuntimeFile)));
    }
    if (source !== original) {
      writeFileSync(full, source);
    }
  }
}

rewritePlaceholders(outRoot);

const appJsonTarget = path.join(outRoot, "app.json");
if (!statSync(appJsonTarget, { throwIfNoEntry: false })?.isFile()) {
  writeFileSync(appJsonTarget, `${JSON.stringify(appJson, null, 2)}\n`);
}

/**
 * Emits a self-contained dev-tool project inside `dist/`.
 *
 * The app-root `project.config.json` points `miniprogramRoot` at `dist/`, but a
 * project opened one level too high (the app folder, or the repository root) makes
 * the tool count sources and `node_modules` as package code and report a size far
 * over the limit. With this file the tool can be opened directly on `dist/`, so the
 * package it measures is exactly what ships.
 */
const distProjectConfig = {
  miniprogramRoot: "./",
  compileType: "miniprogram",
  appid: appJsonProjectConfig.appid,
  projectname: appJsonProjectConfig.projectname,
  setting: {
    es6: true,
    useCompilerPlugins: [],
    minified: true,
    urlCheck: false,
    postcss: false,
    minifyWXSS: true,
    minifyWXML: true,
    compileWorklet: false,
    uglifyFileName: false,
    uploadWithSourceMap: false,
    enhance: false,
    packNpmManually: false,
    packNpmRelationList: [],
  },
  packOptions: { ignore: [{ type: "file", value: ".DS_Store" }] },
  condition: {},
};
writeFileSync(path.join(outRoot, "project.config.json"), `${JSON.stringify(distProjectConfig, null, 2)}\n`);

const bundleBytes = (directory) => {
  let total = 0;
  if (!statSync(directory, { throwIfNoEntry: false })?.isDirectory()) {
    return 0;
  }
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    total += entry.isDirectory() ? bundleBytes(full) : statSync(full).size;
  }
  return total;
};

/**
 * Reports the WeChat package budget and fails the build when a limit is exceeded.
 *
 * Official limits: the main package and every subpackage are capped at 2 MB, and
 * the whole mini program at 20 MB. The shared runtime belongs to the main package,
 * which keeps every page bundle small.
 */
function checkPackageBudget() {
  const distJson = JSON.parse(readFileSync(path.join(outRoot, "app.json"), "utf8").replace(/^\uFEFF/u, ""));
  const pagesBytes = (pages) => {
    let total = 0;
    for (const page of pages) {
      const directory = path.join(outRoot, path.dirname(page));
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (entry.isFile()) {
          total += statSync(path.join(directory, entry.name)).size;
        }
      }
    }
    return total;
  };
  const MB = 1024 * 1024;
  const mainBytes =
    statSync(path.join(outRoot, "app.js")).size +
    statSync(path.join(outRoot, "app.wxss")).size +
    statSync(path.join(outRoot, "app.json")).size +
    pagesBytes(distJson.pages ?? []) +
    bundleBytes(path.join(outRoot, "assets")) +
    bundleBytes(sharedRoot);
  const subpackages = (distJson.subPackages ?? []).map((entry) => ({
    root: entry.root,
    bytes: bundleBytes(path.join(outRoot, entry.root)),
  }));
  const totalBytes = bundleBytes(outRoot);
  const problems = [];
  if (mainBytes > 2 * MB) problems.push(`main package ${(mainBytes / MB).toFixed(2)} MB > 2 MB`);
  for (const subpackage of subpackages) {
    if (subpackage.bytes > 2 * MB) {
      problems.push(`${subpackage.root} ${(subpackage.bytes / MB).toFixed(2)} MB > 2 MB`);
    }
  }
  if (totalBytes > 20 * MB) problems.push(`total ${(totalBytes / MB).toFixed(2)} MB > 20 MB`);
  const largest = subpackages.reduce((max, entry) => Math.max(max, entry.bytes), 0);
  const kb = (value) => (value / 1024).toFixed(1);
  console.log(
    `[mall-mp] package budget: main ${kb(mainBytes)} KB, ${subpackages.length} subpackages ` +
      `(largest ${kb(largest)} KB), total ${kb(totalBytes)} KB`,
  );
  if (problems.length > 0) {
    console.error(`[mall-mp] package budget exceeded: ${problems.join("; ")}`);
    process.exitCode = 1;
  }
}

checkPackageBudget();

if (!WATCH) {
  console.log(
    `[mall-mp] built ${entryPoints.length} entries into dist/ (${(bundleBytes(outRoot) / 1024).toFixed(1)} KB) build ${BUILD_ID}`,
  );
}
