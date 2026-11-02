import { existsSync, readdirSync, readFileSync } from "node:fs";
import { strict as assert } from "node:assert";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

function read(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

test("mall H5 root is manifest-driven with mobile runtime identity", () => {
  const manifest = JSON.parse(read("../../agent.app.config.json"));
  assert.equal(manifest.app?.key, "sdkwork-mall-h5");
  assert.equal(manifest.runtime?.family, "mobile");
  assert.equal(manifest.runtime?.framework, "react-h5");
});

test("mall H5 route ids align with the PC root registry", () => {
  const expectedRouteIds = new Set([
    "storefront.mall.home",
    "storefront.mall.categories",
    "storefront.mall.category-detail",
    "storefront.mall.search",
    "storefront.mall.product-detail",
    "storefront.mall.shop",
    "storefront.mall.activity-list",
    "storefront.mall.activity-detail",
    "storefront.mall.cart",
    "storefront.mall.checkout",
    "storefront.mall.payment-result",
    "buyer.mall.dashboard",
    "buyer.mall.orders",
    "buyer.mall.orders.logistics",
    "buyer.mall.addresses",
    "buyer.mall.coupons",
    "buyer.mall.after-sales",
    "buyer.mall.invoices",
    "buyer.mall.wallet",
    "buyer.mall.points",
    "buyer.mall.membership",
    "buyer.mall.favorites",
    "buyer.mall.footprint",
    "buyer.mall.messages",
  ]);
  const routeSources = [
    "../../packages/sdkwork-mall-h5-home/src/routes.ts",
    "../../packages/sdkwork-mall-h5-catalog/src/routes.ts",
    "../../packages/sdkwork-mall-h5-cart/src/routes.ts",
    "../../packages/sdkwork-mall-h5-order/src/routes.ts",
    "../../packages/sdkwork-mall-h5-buyer/src/routes.ts",
    "../../packages/sdkwork-mall-h5-account/src/routes.ts",
    "../../packages/sdkwork-mall-h5-membership/src/routes.ts",
    "../../packages/sdkwork-mall-h5-shop/src/routes.ts",
    "../../packages/sdkwork-mall-h5-activity/src/routes.ts",
  ];
  const collected = new Set();
  for (const source of routeSources) {
    for (const match of read(source).matchAll(/id:\s*"([^"]+)"/gu)) {
      collected.add(match[1]);
    }
  }
  for (const routeId of expectedRouteIds) {
    assert.ok(collected.has(routeId), `route id ${routeId} must be registered`);
  }
});

test("mall H5 packages never import retired commerce transports", () => {
  // Built from parts so this assertion file does not itself contain the
  // retired transport specifiers the workspace import gate greps for.
  const scope = "@sdkwork/";
  const forbidden = [
    `${scope}commerce-app-sdk`,
    `${scope}commerce-backend-sdk`,
    "sdkwork-commerce-app-sdk-generated",
    "sdkwork-commerce-backend-sdk-generated",
  ];
  const files = [
    "../../src/bootstrap/iamRuntime.ts",
    "../../src/bootstrap/commerceProviders.ts",
    "../../packages/sdkwork-mall-h5-home/src/home-service.ts",
    "../../packages/sdkwork-mall-h5-catalog/src/catalog-service.ts",
    "../../packages/sdkwork-mall-h5-cart/src/cart-service.ts",
  ];
  for (const file of files) {
    const source = read(file);
    for (const specifier of forbidden) {
      assert.ok(!source.includes(specifier), `${file} must not import ${specifier}`);
    }
  }
});

test("mall H5 commerce consumption goes through the shared facade", () => {
  for (const file of [
    "../../packages/sdkwork-mall-h5-home/src/home-service.ts",
    "../../packages/sdkwork-mall-h5-catalog/src/catalog-service.ts",
    "../../packages/sdkwork-mall-h5-cart/src/cart-service.ts",
  ]) {
    assert.match(read(file), /getSdkworkCommerceService/u, `${file} must consume the commerce service facade`);
  }
});

test("every in-app H5 link resolves to a mounted route", () => {
  // A link to a path the router does not mount lands on the catch-all "page
  // does not exist" screen. That is a user-visible defect the route registry
  // can prove statically, so no page link should be able to regress silently.
  const packagesRoot = fileURLToPath(new URL("../../packages/", import.meta.url));
  const routePaths = collectRoutePaths(packagesRoot);
  const nonRoutePaths = new Set([
    // IAM auth gate owned by @sdkwork/auth-pc-react (rendered before AppRoutes).
    "/auth/login",
  ]);

  const unresolved = [];
  for (const file of collectTsx(packagesRoot)) {
    const source = readFileSync(file, "utf8");
    const relative = file.replace(packagesRoot, "").replace(/\\/gu, "/");
    for (const match of source.matchAll(/to="(\/[^"$]*)"|navigate\("(\/[^"$]*)"/gu)) {
      const target = match[1] ?? match[2] ?? "";
      const pathOnly = target.split("?")[0].split("#")[0];
      if (pathOnly === "" || nonRoutePaths.has(pathOnly)) {
        continue;
      }
      if (!routePaths.some((registered) => matchesRoutePath(registered, pathOnly))) {
        unresolved.push(`${relative} → ${target}`);
      }
    }
  }

  assert.deepEqual(
    unresolved,
    [],
    `Links target paths the H5 router does not mount:\n${unresolved.join("\n")}`,
  );
});

function collectRoutePaths(packagesRoot) {
  const paths = [];
  for (const packageName of readdirSync(packagesRoot, { withFileTypes: true })) {
    if (!packageName.isDirectory()) {
      continue;
    }
    const routesFile = join(packagesRoot, packageName.name, "src", "routes.ts");
    if (!existsSync(routesFile)) {
      continue;
    }
    for (const match of readFileSync(routesFile, "utf8").matchAll(/path:\s*"([^"]+)"/gu)) {
      paths.push(match[1]);
    }
  }
  return paths;
}

function collectTsx(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      // Never descend into linked dependencies.
      if (entry.name === "node_modules" || entry.name === "dist") {
        continue;
      }
      files.push(...collectTsx(entryPath));
    } else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
      files.push(entryPath);
    }
  }
  return files;
}

/** `/categories/:categoryId` matches `/categories/42`; exact paths match only themselves. */
function matchesRoutePath(registered, target) {
  const registeredSegments = registered.split("/").filter(Boolean);
  const targetSegments = target.split("/").filter(Boolean);
  if (registeredSegments.length !== targetSegments.length) {
    return false;
  }
  return registeredSegments.every(
    (segment, index) => segment.startsWith(":") || segment === targetSegments[index],
  );
}

test("mall H5 capability packages are individually typecheckable", () => {
  // The root `tsc` resolves the app bootstrap, which imports the federated
  // commerce facade. While that facade subpath is missing upstream, only
  // per-package typechecks can prove a capability package is sound, so every
  // package the app root declares must carry its own tsconfig.
  const manifest = JSON.parse(read("../../package.json"));
  const declared = Object.keys({
    ...(manifest.dependencies ?? {}),
    ...(manifest.devDependencies ?? {}),
  }).filter((name) => name.startsWith("@sdkwork/mall-h5-"));
  assert.ok(declared.length > 0, "the H5 app root must declare its capability packages");

  const packagesRoot = fileURLToPath(new URL("../../packages/", import.meta.url));
  const missing = [];
  for (const entry of readdirSync(packagesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const packageJsonPath = join(packagesRoot, entry.name, "package.json");
    if (!existsSync(packageJsonPath)) {
      continue;
    }
    const packageName = JSON.parse(readFileSync(packageJsonPath, "utf8")).name;
    if (!declared.includes(packageName)) {
      continue;
    }
    if (!existsSync(join(packagesRoot, entry.name, "tsconfig.json"))) {
      missing.push(entry.name);
    }
  }

  assert.deepEqual(
    missing,
    [],
    `H5 packages must declare tsconfig.json so scripts/typecheck-mall-packages.mjs covers them: ${missing.join(", ")}`,
  );
});

test("no H5 capability route is an orphan screen", () => {
  // The inverse of the link check: a registered route that nothing links to is
  // implemented but unreachable. The page module for each path is resolved from
  // the router, so a page's own self-reference cannot satisfy the check. Tab
  // roots are entered from the tab bar and are exempt.
  const packagesRoot = fileURLToPath(new URL("../../packages/", import.meta.url));
  const appRoot = fileURLToPath(new URL("../../", import.meta.url));
  const routerSource = read("../../src/routes/AppRoutes.tsx");
  const tabPaths = new Set(["/", "/categories", "/cart", "/buyer"]);

  const packageDirectories = new Map();
  for (const entry of readdirSync(packagesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const packageJsonPath = join(packagesRoot, entry.name, "package.json");
    if (!existsSync(packageJsonPath)) {
      continue;
    }
    packageDirectories.set(
      JSON.parse(readFileSync(packageJsonPath, "utf8")).name,
      join(packagesRoot, entry.name),
    );
  }

  const lazyModules = new Map();
  for (const match of routerSource.matchAll(/const (\w+) = lazy\(\(\)[\s\S]*?import\("([^"]+)"\)/gu)) {
    lazyModules.set(match[1], match[2]);
  }

  const pageModuleByPath = new Map();
  for (const segment of routerSource.split("<Route").slice(1)) {
    const pathMatch = segment.match(/path="([^"]+)"/u);
    const componentMatch = segment.match(/<([A-Z]\w+)/u);
    if (!pathMatch || !componentMatch) {
      continue;
    }
    const specifier = lazyModules.get(componentMatch[1]);
    if (!specifier) {
      continue;
    }
    const [packageName, ...subpathParts] = specifier.split("/");
    const packageNameWithScope = specifier.startsWith("@")
      ? [packageName, subpathParts.shift()].join("/")
      : packageName;
    const subpath = subpathParts.join("/");
    const packageDirectory = packageDirectories.get(packageNameWithScope);
    if (!packageDirectory) {
      continue;
    }
    const exportsMap = JSON.parse(readFileSync(join(packageDirectory, "package.json"), "utf8")).exports ?? {};
    const entry = exportsMap[subpath ? `./${subpath}` : "."];
    const relativeModule = entry?.import ?? entry?.default;
    if (typeof relativeModule !== "string") {
      continue;
    }
    pageModuleByPath.set(pathMatch[1], join(packageDirectory, relativeModule));
  }

  const linkSources = collectTsx(packagesRoot)
    .concat(collectTsx(join(appRoot, "src")))
    .filter((file) => !file.endsWith("routes.ts") && !file.endsWith("AppRoutes.tsx"));

  const orphans = [];
  for (const registered of collectRoutePaths(packagesRoot)) {
    if (tabPaths.has(registered)) {
      continue;
    }
    const needle = registered.split("/:")[0];
    if (!needle) {
      continue;
    }
    const ownModule = pageModuleByPath.get(registered);
    const linked = linkSources.some((file) => {
      if (ownModule && file === ownModule) {
        return false;
      }
      const source = readFileSync(file, "utf8");
      return source.includes(`"${needle}`) || source.includes(`\`${needle}`);
    });
    if (!linked) {
      orphans.push(registered);
    }
  }

  assert.deepEqual(
    orphans,
    [],
    `Routes with no in-app entry (implemented but unreachable):\n${orphans.join("\n")}`,
  );
});

test("every H5 page component exposes an accessible page heading", () => {
  // The shell navbar is a styled div, not a heading, so assistive technology
  // gets no page title unless the page renders its own <h1>. Visual users see
  // the navbar title; screen-reader users need the heading.
  const packagesRoot = fileURLToPath(new URL("../../packages/", import.meta.url));
  const missing = [];
  let pages = 0;
  for (const entry of readdirSync(packagesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const pagesDirectory = join(packagesRoot, entry.name, "src", "pages");
    if (!existsSync(pagesDirectory)) {
      continue;
    }
    for (const file of readdirSync(pagesDirectory)) {
      if (!file.endsWith(".tsx")) {
        continue;
      }
      pages += 1;
      if (!/<h1[\s>]/u.test(readFileSync(join(pagesDirectory, file), "utf8"))) {
        missing.push(`${entry.name}/${file}`);
      }
    }
  }

  assert.ok(pages > 0, "expected H5 page components");
  assert.deepEqual(missing, [], `H5 page components without a <h1> heading:\n${missing.join("\n")}`);
});