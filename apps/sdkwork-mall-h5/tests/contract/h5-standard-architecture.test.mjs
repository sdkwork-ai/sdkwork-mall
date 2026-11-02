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
