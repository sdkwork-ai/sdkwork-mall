import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

/**
 * Cross-client capability parity gate.
 *
 * The contract in `specs/mall-capability-parity.json` is the single source of
 * truth for "which commerce capability ships on which client root". This test
 * resolves every declared implementation against the platform's real route or
 * page registry, so a capability that is dropped, renamed, or added on one
 * platform without updating the contract fails the build instead of silently
 * drifting.
 *
 * Authority: APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC.md section 7 (route
 * identity) and section 11 (cross-architecture alignment verification).
 */

const workspaceRoot = path.resolve(import.meta.dirname, "..", "..");
const contractPath = path.join(workspaceRoot, "specs", "mall-capability-parity.json");
const contract = JSON.parse(readFileSync(contractPath, "utf8"));

const PLATFORMS = Object.keys(contract.platforms);
const ROUTE_PLATFORMS = ["pc", "h5"];

const FLUTTER_TAB_CLASSES = {
  home: "SdkworkHomePage",
  category: "SdkworkCategoryPage",
  cart: "SdkworkCartPage",
  buyer: "SdkworkBuyerPage",
};

function toAbsolute(relativePath) {
  return path.join(workspaceRoot, relativePath);
}

function readText(relativePath) {
  return readFileSync(toAbsolute(relativePath), "utf8");
}

function collectFiles(rootDirectory, predicate) {
  const collected = [];
  if (!existsSync(rootDirectory)) {
    return collected;
  }
  for (const entry of readdirSync(rootDirectory, { withFileTypes: true })) {
    const entryPath = path.join(rootDirectory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "build") {
        continue;
      }
      collected.push(...collectFiles(entryPath, predicate));
    } else if (predicate(entryPath)) {
      collected.push(entryPath);
    }
  }
  return collected;
}

/** Parse `{ ... id: "x", surface: "y", path: "z" ... }` route contribution literals. */
function readRouteContributions(platform) {
  const packagesRoot = path.join(toAbsolute(contract.platforms[platform].root), "packages");
  const contributions = new Map();
  for (const packageName of readdirSync(packagesRoot)) {
    const routesFile = path.join(packagesRoot, packageName, "src", "routes.ts");
    if (!existsSync(routesFile)) {
      continue;
    }
    const source = readFileSync(routesFile, "utf8");
    for (const match of source.matchAll(/\{[^{}]*?id:\s*"([^"]+)"[^{}]*?\}/gs)) {
      const block = match[0];
      const field = (name) => (block.match(new RegExp(`${name}:\\s*"([^"]*)"`)) ?? [])[1] ?? "";
      contributions.set(field("id"), {
        auth: field("auth"),
        capability: field("capability"),
        domain: field("domain"),
        id: field("id"),
        packageName,
        path: field("path"),
        platform,
        screen: field("screen"),
        surface: field("surface"),
        titleKey: field("titleKey"),
      });
    }
  }
  return contributions;
}

const registries = {
  pc: readRouteContributions("pc"),
  h5: readRouteContributions("h5"),
  miniProgram: new Set(JSON.parse(readText(contract.platforms.miniProgram.pageRegistry)).pages),
  flutter: readFlutterRoutes(),
};

function readFlutterRoutes() {
  const shellSource = readText(contract.platforms.flutter.routeRegistry);
  const routes = new Set();
  for (const match of shellSource.matchAll(/'(\/[a-z0-9-]+)':\s*\(context\)\s*=>/gu)) {
    routes.add(match[1]);
  }
  return routes;
}

function declaredImplementations() {
  const byPlatform = new Map(PLATFORMS.map((platform) => [platform, []]));
  for (const capability of contract.capabilities) {
    for (const [platform, implementation] of Object.entries(capability.implementations)) {
      byPlatform.get(platform)?.push({ capabilityId: capability.id, implementation });
    }
  }
  return byPlatform;
}

test("capability parity contract is well formed", () => {
  const seenIds = new Set();
  for (const capability of contract.capabilities) {
    assert.match(capability.id, /^[a-z][a-z0-9-]*(\.[a-z0-9-]+)+$/u, `bad capability id: ${capability.id}`);
    assert.ok(!seenIds.has(capability.id), `duplicate capability id: ${capability.id}`);
    seenIds.add(capability.id);

    assert.match(
      capability.canonicalRouteId,
      /^(storefront|buyer|account|merchant|admin)\.[a-z0-9-]+\.[a-z0-9-]+(\.[a-z0-9-]+)*$/u,
      `canonical route id must follow <surface>.<domain>.<capability>.<screen>: ${capability.canonicalRouteId}`,
    );
    assert.ok(capability.requiredOn.length > 0, `${capability.id} must be required on at least one platform`);

    for (const platform of capability.requiredOn) {
      assert.ok(PLATFORMS.includes(platform), `${capability.id} requires unknown platform ${platform}`);
      assert.ok(
        capability.implementations[platform],
        `${capability.id} requires ${platform} but declares no implementation`,
      );
    }
    for (const platform of Object.keys(capability.implementations)) {
      assert.ok(PLATFORMS.includes(platform), `${capability.id} implements unknown platform ${platform}`);
      assert.ok(
        capability.requiredOn.includes(platform),
        `${capability.id} implements ${platform} but does not require it`,
      );
    }
  }
});

test("PC storefront and buyer capabilities are all registered in the parity contract", () => {
  const declared = new Set(
    contract.capabilities
      .map((capability) => capability.implementations.pc?.routeId)
      .filter((routeId) => typeof routeId === "string"),
  );
  const pcOnlyPrefixes = contract.pcOnlyRoutePrefixes;
  const unregistered = [...registries.pc.values()]
    .filter((route) => route.surface === "storefront" || route.surface === "buyer")
    .filter((route) => !pcOnlyPrefixes.some((prefix) => route.id.startsWith(prefix)))
    .filter((route) => !declared.has(route.id))
    .map((route) => `${route.id} (${route.packageName})`);

  assert.deepEqual(
    unregistered,
    [],
    `PC routes missing from specs/mall-capability-parity.json: ${unregistered.join(", ")}`,
  );
});

test("route ids declared by the contract resolve on their platform registry", () => {
  for (const [platform, implementations] of declaredImplementations()) {
    if (!ROUTE_PLATFORMS.includes(platform)) {
      continue;
    }
    for (const { capabilityId, implementation } of implementations) {
      assert.ok(
        registries[platform].has(implementation.routeId),
        `${capabilityId}: ${platform} route id ${implementation.routeId} is not registered`,
      );
    }
  }
});

test("route identity aligns across PC and H5 for every shared capability", () => {
  for (const capability of contract.capabilities) {
    const pcRouteId = capability.implementations.pc?.routeId;
    const h5RouteId = capability.implementations.h5?.routeId;
    if (!pcRouteId || !h5RouteId) {
      continue;
    }
    if (capability.implementations.h5?.fusedInto) {
      continue;
    }
    assert.equal(
      h5RouteId,
      pcRouteId,
      `${capability.id}: H5 route id must match the canonical PC route id`,
    );
  }
});

test("H5 route registry covers every required capability and nothing undocumented", () => {
  const declared = new Set(
    contract.capabilities
      .map((capability) => capability.implementations.h5?.routeId)
      .filter((routeId) => typeof routeId === "string"),
  );
  const extras = new Set((contract.platformExtras.h5 ?? []).map((extra) => extra.routeId));
  const undocumented = [...registries.h5.keys()].filter(
    (routeId) => !declared.has(routeId) && !extras.has(routeId),
  );

  assert.deepEqual(
    undocumented,
    [],
    `H5 routes missing from the parity contract: ${undocumented.join(", ")}`,
  );

  for (const capability of contract.capabilities) {
    if (!capability.requiredOn.includes("h5")) {
      continue;
    }
    assert.ok(capability.implementations.h5, `${capability.id} is required on H5 but not implemented`);
    assert.ok(
      registries.h5.has(capability.implementations.h5.routeId),
      `${capability.id}: H5 route ${capability.implementations.h5.routeId} is not registered`,
    );
  }
});

test("mini-program page registry and page files cover every required capability", () => {
  const declaredPages = new Set(
    contract.capabilities
      .map((capability) => capability.implementations.miniProgram?.page)
      .filter((page) => typeof page === "string"),
  );
  const extras = new Set((contract.platformExtras.miniProgram ?? []).map((extra) => extra.page));
  const undocumented = [...registries.miniProgram].filter(
    (page) => !declaredPages.has(page) && !extras.has(page),
  );

  assert.deepEqual(
    undocumented,
    [],
    `mini-program pages missing from the parity contract: ${undocumented.join(", ")}`,
  );

  for (const capability of contract.capabilities) {
    if (!capability.requiredOn.includes("miniProgram")) {
      continue;
    }
    const page = capability.implementations.miniProgram?.page;
    assert.ok(page, `${capability.id} is required on the mini program but declares no page`);
    assert.ok(
      registries.miniProgram.has(page),
      `${capability.id}: mini-program page ${page} is not declared in app.json`,
    );
    for (const extension of ["ts", "json", "wxml", "wxss"]) {
      const pageFile = path.join(toAbsolute(contract.platforms.miniProgram.pageRoot), `${page}.${extension}`);
      assert.ok(existsSync(pageFile), `${capability.id}: missing mini-program page file ${page}.${extension}`);
    }
  }
});

test("Flutter route and tab registries cover every required capability", () => {
  const declaredRoutes = new Set(
    contract.capabilities
      .map((capability) => capability.implementations.flutter?.route)
      .filter((route) => typeof route === "string"),
  );
  const declaredTabs = new Set(
    contract.capabilities
      .map((capability) => capability.implementations.flutter?.tab)
      .filter((tab) => typeof tab === "string"),
  );
  const extras = new Set((contract.platformExtras.flutter ?? []).map((extra) => extra.route));
  const undocumented = [...registries.flutter].filter(
    (route) => !declaredRoutes.has(route) && !extras.has(route),
  );

  assert.deepEqual(
    undocumented,
    [],
    `Flutter routes missing from the parity contract: ${undocumented.join(", ")}`,
  );

  const shellSource = readText(contract.platforms.flutter.routeRegistry);
  const dartSources = collectFiles(
    path.join(toAbsolute(contract.platforms.flutter.pageRoot)),
    (filePath) => filePath.endsWith(".dart"),
  ).map((filePath) => readFileSync(filePath, "utf8"));

  for (const capability of contract.capabilities) {
    if (!capability.requiredOn.includes("flutter")) {
      continue;
    }
    const implementation = capability.implementations.flutter;
    assert.ok(implementation, `${capability.id} is required on Flutter but declares no implementation`);

    if (implementation.route) {
      assert.ok(
        registries.flutter.has(implementation.route),
        `${capability.id}: Flutter route ${implementation.route} is not registered in buildSdkworkMallRoutes()`,
      );
      const builderClass = shellSource
        .split("\n")
        .find((line) => line.includes(`'${implementation.route}':`));
      const className = builderClass?.match(/=>\s*(?:const\s+)?([A-Za-z0-9_]+)\(/u)?.[1];
      assert.ok(className, `${capability.id}: Flutter route ${implementation.route} has no page builder`);
      assert.ok(
        dartSources.some((source) => source.includes(`class ${className}`)),
        `${capability.id}: Flutter page class ${className} is not defined`,
      );
    } else {
      const className = FLUTTER_TAB_CLASSES[implementation.tab];
      assert.ok(className, `${capability.id}: unknown Flutter tab ${implementation.tab}`);
      assert.ok(
        shellSource.includes(`${className}(`),
        `${capability.id}: Flutter tab page ${className} is not composed by the shell`,
      );
    }
  }
});

test("declared navigation evidence resolves so no capability page is orphaned", () => {
  for (const capability of contract.capabilities) {
    for (const evidence of capability.navigationEvidence ?? []) {
      const source = readText(evidence.file);
      assert.ok(
        source.includes(evidence.contains),
        `${capability.id}: ${evidence.platform} navigation entry "${evidence.contains}" is missing from ${evidence.file}`,
      );
    }
  }
});

test("every declared capability route is actually mounted by the web routers", () => {
  const pcRouter = readText(contract.platforms.pc.router);
  const h5Router = readText(contract.platforms.h5.router);

  // A route contribution that the app router never mounts is declared metadata
  // with no reachable screen: the registry check alone cannot see that.
  for (const capability of contract.capabilities) {
    const pcRouteId = capability.implementations.pc?.routeId;
    if (pcRouteId) {
      assert.ok(
        pcRouter.includes(`case "${pcRouteId}"`),
        `${capability.id}: PC router does not mount route id ${pcRouteId}`,
      );
    }
  }

  for (const capability of contract.capabilities) {
    const h5Implementation = capability.implementations.h5;
    if (!h5Implementation || h5Implementation.fusedInto) {
      continue;
    }
    const route = registries.h5.get(h5Implementation.routeId);
    assert.ok(route, `${capability.id}: H5 route ${h5Implementation.routeId} is not registered`);
    assert.ok(
      h5Router.includes(`path="${route.path}"`),
      `${capability.id}: H5 router does not mount path ${route.path}`,
    );
  }
});

test("shared capabilities keep the same auth posture across PC and H5", () => {
  for (const capability of contract.capabilities) {
    const pcRouteId = capability.implementations.pc?.routeId;
    const h5RouteId = capability.implementations.h5?.routeId;
    if (!pcRouteId || !h5RouteId) {
      continue;
    }
    const pcRoute = registries.pc.get(pcRouteId);
    const h5Route = registries.h5.get(h5RouteId);
    if (!pcRoute?.auth || !h5Route?.auth) {
      continue;
    }
    assert.equal(
      h5Route.auth,
      pcRoute.auth,
      `${capability.id}: auth posture differs (PC ${pcRoute.auth}, H5 ${h5Route.auth})`,
    );
  }
});

test("every stored route title key follows the package route-key convention", () => {
  for (const platform of ROUTE_PLATFORMS) {
    for (const route of registries[platform].values()) {
      if (!route.titleKey) {
        continue;
      }
      assert.match(
        route.titleKey,
        /^(?:[a-z][a-zA-Z0-9-]*\.)+routes\.[a-zA-Z0-9-]+\.title$/u,
        `${platform} ${route.id}: title key "${route.titleKey}" must look like <namespace>.routes.<screen>.title`,
      );
    }
  }
});

test("shared copy stays byte-identical across the roots that ship it", () => {
  for (const entry of contract.sharedCopy ?? []) {
    assert.ok(entry.key, "shared copy entry needs a key");
    assert.ok(entry.text, `${entry.key}: shared copy entry needs text`);
    assert.ok(Array.isArray(entry.files) && entry.files.length > 0, `${entry.key}: needs at least one file`);
    for (const file of entry.files) {
      const source = readText(file);
      assert.ok(
        source.includes(entry.text),
        `${entry.key}: "${entry.text}" is missing or reworded in ${file}`,
      );
    }
  }
});

test("mini-program and Flutter expose the canonical route identity of every capability", () => {
  // PC and H5 carry route ids in their route contributions; the mobile roots
  // used to carry only physical paths, which made "route identity is aligned
  // across clients" unverifiable for half the product. Both now publish a
  // capability registry keyed by the same canonical route id.
  const miniProgramRegistry = readCapabilityRegistry("miniProgram");
  const flutterRegistry = readCapabilityRegistry("flutter");

  for (const capability of contract.capabilities) {
    const mpImplementation = capability.implementations.miniProgram;
    if (mpImplementation && !mpImplementation.fusedInto) {
      const entry = miniProgramRegistry.get(capability.canonicalRouteId);
      assert.ok(
        entry,
        `${capability.id}: mini-program capability registry is missing ${capability.canonicalRouteId}`,
      );
      assert.equal(
        entry.target,
        mpImplementation.page,
        `${capability.id}: mini-program registry target must match the contract page`,
      );
    }

    const flutterImplementation = capability.implementations.flutter;
    if (flutterImplementation?.route && !flutterImplementation.fusedInto) {
      const entry = flutterRegistry.get(capability.canonicalRouteId);
      assert.ok(
        entry,
        `${capability.id}: Flutter capability registry is missing ${capability.canonicalRouteId}`,
      );
      assert.equal(
        entry.target,
        flutterImplementation.route,
        `${capability.id}: Flutter registry target must match the contract route`,
      );
    }
  }

  const documentedRouteIds = new Set(
    contract.capabilities.map((capability) => capability.canonicalRouteId),
  );
  for (const [routeId, entry] of [...miniProgramRegistry, ...flutterRegistry]) {
    assert.ok(
      documentedRouteIds.has(routeId),
      `${entry.platform} capability registry declares unknown route id ${routeId}`,
    );
  }
});

function readCapabilityRegistry(platform) {
  const registry =
    platform === "miniProgram"
      ? "apps/sdkwork-mall-mini-program/src/routes/capabilities.ts"
      : "apps/sdkwork-mall-flutter-mobile/lib/routes/capability_routes.dart";
  const source = readText(registry);
  const entries = new Map();
  const pattern =
    platform === "miniProgram"
      ? /\{ routeId: "([^"]+)", page: "([^"]+)" \}/gu
      : /SdkworkMallCapabilityRoute\(\s*routeId:\s*'([^']+)',\s*path:\s*'([^']+)',?\s*\)/gu;
  for (const match of source.matchAll(pattern)) {
    const routeId = match[1];
    assert.ok(!entries.has(routeId), `${platform} capability registry repeats route id ${routeId}`);
    entries.set(routeId, { platform, target: match[2] });
  }
  assert.ok(entries.size > 0, `${platform} capability registry must not be empty`);
  return entries;
}

test("platform roots referenced by the contract exist", () => {
  for (const [platform, configuration] of Object.entries(contract.platforms)) {
    const rootPath = toAbsolute(configuration.root);
    assert.ok(existsSync(rootPath), `${platform} root missing: ${configuration.root}`);
    assert.ok(statSync(rootPath).isDirectory(), `${platform} root is not a directory: ${configuration.root}`);
  }
});
