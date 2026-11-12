import assert from "node:assert/strict";
import { existsSync, readdirSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createServer, loadConfigFromFile } from "vite";

/**
 * Workspace source-resolution contract.
 *
 * Workspace packages are consumed as TypeScript *source*: their
 * `package.json#exports` points at `src/index.ts`, and their internal imports
 * are extensionless. Vite's default extension list tries `.js` before `.ts`, so
 * an extensionless import silently binds to a gitignored `tsc` artifact left
 * next to the authored source. When that artifact is older than the source it
 * shadows, the package entry (`.ts`) and its internal modules (`.js`) come from
 * different revisions.
 *
 * Deployed symptom (2026-11-12):
 *
 *   Uncaught (in promise) TypeError: Cannot read properties of undefined
 *     (reading 'demandClaims')
 *     at new SdkworkAppClient (index.ts:46:48)
 *     at createClient (index.ts:60:10)
 *
 * The composed facade `@sdkwork/order-app-sdk/src/index.ts` reads
 * `this.orderDemandClaims.demandClaims`, while its base class
 * `generated/server-openapi/src/sdk` resolved to a stale compiled `sdk.js`
 * generation that never declared `orderDemandClaims`.
 *
 * The contract: every web renderer Vite config must prefer authored TypeScript
 * so an extensionless workspace import binds to the `.ts`, never a stale `.js`
 * sibling.
 */

const workspaceRoot = path.resolve(fileURLToPath(new URL("../../../..", import.meta.url)));

const RENDERER_CONFIGS = [
  { appRoot: path.join(workspaceRoot, "apps/sdkwork-mall-pc"), label: "PC" },
  { appRoot: path.join(workspaceRoot, "apps/sdkwork-mall-h5"), label: "H5" },
];

async function loadRendererExtensions({ appRoot, label }) {
  const configPath = path.join(appRoot, "vite.config.ts");
  assert.ok(existsSync(configPath), `[${label}] missing ${configPath}`);

  const loaded = await loadConfigFromFile(
    { command: "build", mode: "standalone.production" },
    configPath,
    appRoot,
  );
  assert.ok(loaded, `[${label}] could not load ${configPath}`);

  const extensions = loaded.config.resolve?.extensions;
  assert.ok(
    Array.isArray(extensions) && extensions.length > 0,
    `[${label}] vite config must declare resolve.extensions`,
  );

  return extensions;
}

/**
 * Facade roots reachable from one renderer: every `@sdkwork/*` workspace link
 * that exposes both `src/index.ts` and a generated transport entry.
 */
function findSdkFacadeRoots(appRoot) {
  const scopedRoot = path.join(appRoot, "node_modules", "@sdkwork");
  if (!existsSync(scopedRoot)) {
    return [];
  }

  const facades = [];
  for (const entry of readdirSync(scopedRoot)) {
    let packageRoot;
    try {
      packageRoot = realpathSync(path.join(scopedRoot, entry));
    } catch {
      continue;
    }

    const facadeEntry = path.join(packageRoot, "src", "index.ts");
    const generatedEntry = path.join(
      packageRoot,
      "generated",
      "server-openapi",
      "src",
      "index.ts",
    );
    if (!existsSync(facadeEntry) || !existsSync(generatedEntry)) {
      continue;
    }

    facades.push({ packageRoot, facadeEntry, generatedEntry, label: `@sdkwork/${entry}` });
  }

  return facades.sort((left, right) => left.label.localeCompare(right.label));
}

function canonicalPath(target) {
  try {
    return realpathSync.native(target);
  } catch {
    return path.resolve(target);
  }
}

async function resolveWithRenderer(appRoot, extensions, source, importer) {
  const server = await createServer({
    configFile: false,
    root: appRoot,
    logLevel: "silent",
    resolve: { extensions: [...extensions] },
    server: { middlewareMode: true },
  });

  try {
    const container = server.pluginContainer;
    const resolved = await container.resolveId(source, importer);
    return resolved?.id ?? null;
  } finally {
    await server.close();
  }
}

test("web renderer Vite configs resolve workspace sources from TypeScript first", async () => {
  for (const renderer of RENDERER_CONFIGS) {
    const extensions = await loadRendererExtensions(renderer);
    const tsIndex = extensions.indexOf(".ts");
    const jsIndex = extensions.indexOf(".js");

    assert.ok(tsIndex >= 0, `[${renderer.label}] resolve.extensions must include .ts`);
    assert.ok(jsIndex >= 0, `[${renderer.label}] resolve.extensions must keep .js`);
    assert.ok(
      tsIndex < jsIndex,
      `[${renderer.label}] authored .ts must be tried before compiled .js ` +
        `(got ${JSON.stringify(extensions)})`,
    );
    assert.ok(
      extensions.indexOf(".tsx") >= 0 && extensions.indexOf(".tsx") < jsIndex,
      `[${renderer.label}] authored .tsx must be tried before compiled .js ` +
        `(got ${JSON.stringify(extensions)})`,
    );
  }
});

test("extensionless facade imports bind to the generated .ts transport", async () => {
  let checked = 0;

  for (const renderer of RENDERER_CONFIGS) {
    const extensions = await loadRendererExtensions(renderer);
    const facades = findSdkFacadeRoots(renderer.appRoot);
    assert.ok(
      facades.length > 0,
      `[${renderer.label}] expected at least one workspace SDK facade under ${renderer.appRoot}/node_modules/@sdkwork`,
    );

    for (const facade of facades) {
      const resolved = await resolveWithRenderer(
        renderer.appRoot,
        extensions,
        "../generated/server-openapi/src/index",
        facade.facadeEntry,
      );

      assert.ok(
        resolved,
        `[${renderer.label}] ${facade.label} failed to resolve its generated transport entry`,
      );
      assert.equal(
        canonicalPath(resolved),
        canonicalPath(facade.generatedEntry),
        `[${renderer.label}] ${facade.label} facade must bind to the authored ` +
          `generated .ts transport, never a stale compiled .js sibling`,
      );
      checked += 1;
    }
  }

  assert.ok(checked > 0, "expected at least one workspace SDK facade to verify");
});

test("the order facade resolves its demand-claims client from source", async () => {
  const renderer = RENDERER_CONFIGS[0];
  const packageRoot = path.join(
    renderer.appRoot,
    "node_modules",
    "@sdkwork",
    "order-app-sdk",
  );

  if (!existsSync(packageRoot)) {
    return;
  }

  const facadeEntry = path.join(packageRoot, "src", "index.ts");
  const extensions = await loadRendererExtensions(renderer);
  const resolvedSdk = await resolveWithRenderer(
    renderer.appRoot,
    extensions,
    "../generated/server-openapi/src/sdk",
    facadeEntry,
  );

  assert.ok(resolvedSdk, "order facade failed to resolve its generated sdk entry");
  assert.equal(
    canonicalPath(resolvedSdk),
    canonicalPath(path.join(packageRoot, "generated", "server-openapi", "src", "sdk.ts")),
    "the order facade base class must come from the authored sdk.ts generation that " +
      "declares orderDemandClaims",
  );
});
