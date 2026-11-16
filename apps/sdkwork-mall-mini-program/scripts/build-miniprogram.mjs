#!/usr/bin/env node
/**
 * Builds the runnable mini-program package.
 *
 * Why a build step: the WeChat dev-tool TypeScript plugin compiles only what it
 * can resolve inside the project, and this application composes SDKWork workspace
 * packages whose `exports` point at TypeScript sources (siblings outside the
 * project root). When the plugin cannot resolve those, the tool keeps the last
 * successful package — which is how a stale `app.ts` requiring a JSON module kept
 * running after the source was fixed.
 *
 * The script bundles every entry (app + one per page) into `dist/` as plain
 * CommonJS, copies WXML/WXSS/JSON/images, and `project.config.json` points
 * `miniprogramRoot` at `dist/`, so the dev tool never compiles TypeScript.
 */
import { createRequire } from "node:module";
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const esbuild = require("esbuild");

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = path.join(appRoot, "src");
const outRoot = path.join(appRoot, "dist");

const appJson = JSON.parse(readFileSync(path.join(srcRoot, "app.json"), "utf8"));

/** Entry modules: the app plus every page declared in app.json. */
const entryPoints = [
  path.join(srcRoot, "app.ts"),
  ...appJson.pages.map((page) => path.join(srcRoot, `${page}.ts`)),
];

for (const entry of entryPoints) {
  if (!statSync(entry, { throwIfNoEntry: false })?.isFile()) {
    console.error(`[mall-mp] missing entry: ${path.relative(appRoot, entry)}`);
    process.exit(1);
  }
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
var __sdkworkFetchImpl = function (input, init) {
  var impl = __sdkworkGlobal.__SDKWORK_MALL_MP_FETCH__ || (typeof globalThis !== "undefined" && globalThis.fetch);
  if (typeof impl !== "function") {
    throw new Error("SDK fetch is not installed; call installMpFetch from the app bootstrap");
  }
  return impl(input, init);
};
var fetch = __sdkworkFetchImpl;
var AbortSignal = __sdkworkGlobal.__SDKWORK_MALL_MP_ABORT_SIGNAL__ || (function () {
  function MpAbortSignal() {
    this.aborted = false;
    this.__listeners = [];
  }
  MpAbortSignal.prototype.addEventListener = function (type, handler) {
    if (type === "abort" && typeof handler === "function") this.__listeners.push(handler);
  };
  MpAbortSignal.prototype.removeEventListener = function (type, handler) {
    if (type !== "abort") return;
    var index = this.__listeners.indexOf(handler);
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
var AbortController = __sdkworkGlobal.__SDKWORK_MALL_MP_ABORT_CONTROLLER__ || (function () {
  function MpAbortController() {
    this.signal = new AbortSignal();
  }
  MpAbortController.prototype.abort = function () {
    this.signal.__dispatchAbort();
  };
  return MpAbortController;
})();
`;

/**
 * Stubs Node built-ins that SDK transport packages reference for their
 * server-side transports (`node:net`, `node:dgram`, ...).
 *
 * They are never taken on the mini-program platform (the client picks its
 * platform transport), and leaving `require("node:net")` in the bundle would
 * abort at load time because the module system has no such module.
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

const WATCH = process.argv.includes("--watch");
const buildOptions = {
  entryPoints,
  outbase: srcRoot,
  outdir: outRoot,
  bundle: true,
  format: "cjs",
  platform: "neutral",
  target: ["es2020"],
  external: [],
  logLevel: "warning",
  sourcemap: false,
  minify: true,
  treeShaking: true,
  tsconfig: path.join(appRoot, "tsconfig.json"),
  loader: { ".png": "dataurl", ".jpg": "dataurl" },
  plugins: [nodeBuiltinStub()],
  banner: { js: GLOBAL_SHIMS },
};

// The output is fully generated by this script; `dist` is git-ignored.
rmSync(outRoot, { recursive: true, force: true });
mkdirSync(outRoot, { recursive: true });

if (WATCH) {
  const context = await esbuild.context(buildOptions);
  await context.watch();
  console.log(`[mall-mp] watching ${entryPoints.length} entries (dist/)`);
} else {
  const result = await esbuild.build(buildOptions);
  if (result.errors.length > 0) {
    console.error("[mall-mp] bundle failed");
    process.exit(1);
  }
}

/**
 * Copies the template/config assets that are not JavaScript modules.
 *
 * `.ts` sources are bundled above and the loader shim (`runtime-env.json.js`) is a
 * build-time compatibility artifact, so neither is copied.
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
    if (entry.name.endsWith(".d.ts") || entry.name.endsWith(".ts")) {
      continue;
    }
    if (entry.name === "runtime-env.json.js") {
      continue;
    }
    if (!COPIED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      continue;
    }
    const target = path.join(outRoot, relative);
    mkdirSync(path.dirname(target), { recursive: true });
    cpSync(source, target);
  }
}

copyAssets(srcRoot);

const appJsonTarget = path.join(outRoot, "app.json");
if (!statSync(appJsonTarget, { throwIfNoEntry: false })?.isFile()) {
  writeFileSync(appJsonTarget, `${JSON.stringify(appJson, null, 2)}\n`);
}

const bundleBytes = (directory) => {
  let total = 0;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    total += entry.isDirectory() ? bundleBytes(full) : statSync(full).size;
  }
  return total;
};

if (!WATCH) {
  console.log(
    `[mall-mp] built ${entryPoints.length} entries into dist/ (${(bundleBytes(outRoot) / 1024).toFixed(1)} KB)`,
  );
}
