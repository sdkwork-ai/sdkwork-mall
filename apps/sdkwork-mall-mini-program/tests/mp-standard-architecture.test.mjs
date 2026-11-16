import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { allPagePaths } from "../scripts/app-pages.mjs";

function read(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

/** Every `.ts` file under a package `src/` tree (compile-time sources only). */
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

function collectPageFiles() {
  const pagesDir = fileURLToPath(new URL("../src/pages/", import.meta.url));
  const files = [];
  for (const entry of readdirSync(pagesDir)) {
    const entryPath = join(pagesDir, entry);
    try {
      const inner = readdirSync(entryPath);
      for (const name of inner) {
        if (name.endsWith(".ts")) {
          files.push(`../src/pages/${entry}/${name}`);
        }
      }
    } catch {
      // not a directory
    }
  }
  return files;
}

test("mall mini-program root is manifest-driven", () => {
  const manifest = JSON.parse(read("../agent.app.config.json"));
  assert.equal(manifest.app?.key, "sdkwork-mall-mini-program");
  assert.equal(manifest.runtime?.family, "mini-program");
  assert.equal(manifest.runtime?.framework, "weixin-mini-program");
});

test("mall mini-program tab bar covers the JD core surfaces", () => {
  const appJson = JSON.parse(read("../src/app.json"));
  const pages = appJson.tabBar.list.map((entry) => entry.pagePath);
  // Five tabs, matching the H5 shell (`SHELL_TABS`): 首页 / 分类 / 消息 / 购物车 / 我的.
  assert.deepEqual(pages, [
    "pages/home/index",
    "pages/category/index",
    "pages/chats/index",
    "pages/cart/index",
    "pages/buyer/index",
  ]);
  // The cart tab is the one that carries a badge; every tab needs both states.
  for (const entry of appJson.tabBar.list) {
    assert.ok(entry.text, `${entry.pagePath} needs a label`);
    assert.ok(entry.iconPath && entry.selectedIconPath, `${entry.pagePath} needs both icon states`);
  }
});

test("mall mini-program registers the full commerce route catalog", () => {
  const appJson = JSON.parse(read("../src/app.json"));
  const pages = new Set(allPagePaths(appJson));
  const requiredSurfaces = [
    "pages/home/index",
    "pages/category/index",
    "pages/search/index",
    "pages/product/index",
    "pages/cart/index",
    "pages/checkout/index",
    "pages/cashier/index",
    "pages/payment-result/index",
    "pages/orders/index",
    "pages/order-detail/index",
    "pages/address/index",
    "pages/coupons/index",
    "pages/buyer/index",
    "pages/login/index",
  ];
  for (const surface of requiredSurfaces) {
    assert.equal(pages.has(surface), true, `mini-program must register ${surface}`);
  }
});

test("platform request hop lives only in the mp-host adapter", () => {
  // Authority: MINI_PROGRAM_APP_ARCHITECTURE_SPEC section 8. The single transport
  // seam moved: `wx.request` is now reached through the WeChat host profile
  // (`packages/sdkwork-mall-mp-host/src/weixin/http.ts`), the commerce envelope
  // lives in `@sdkwork/mall-mp-core`, and `src/services/transport.ts` only
  // delegates so legacy imports keep working.
  const hostHttp = read("../packages/sdkwork-mall-mp-host/src/weixin/http.ts");
  assert.match(hostHttp, /request\(options\)/u, "the host http adapter must implement the platform hop");

  const hostFiles = readdirSync(fileURLToPath(new URL("../packages/sdkwork-mall-mp-host/src/weixin/", import.meta.url)));
  assert.ok(hostFiles.includes("http.ts"), "the weixin host profile must own http.ts");

  for (const file of collectPageFiles()) {
    assert.ok(!read(file).includes("wx.request("), `${file} must not call wx.request directly`);
  }
  for (const file of [
    "../src/app.ts",
    "../src/services/catalog-service.ts",
    "../src/services/cart-service.ts",
    "../src/services/order-service.ts",
    "../src/services/address-service.ts",
    "../src/services/promotion-service.ts",
    "../src/services/im-service.ts",
    "../src/services/transport.ts",
  ]) {
    assert.ok(!read(file).includes("wx.request("), `${file} must go through the transport seam`);
  }

  const transport = read("../src/services/transport.ts");
  assert.match(transport, /getMallMpRuntime\(\)\.request/u, "transport must delegate to the core request client");

  const coreRequest = read("../packages/sdkwork-mall-mp-core/src/request/index.ts");
  assert.ok(!coreRequest.includes("wx."), "mp-core must not touch platform globals; it uses MpHttpClient");
  assert.match(coreRequest, /http\.request/u, "mp-core must go through the injected host http client");
});

test("mini program packages follow the mp taxonomy and stay platform-free", () => {
  // Authority: MINI_PROGRAM_APP_ARCHITECTURE_SPEC sections 2-3 and 6.
  const packagesRoot = fileURLToPath(new URL("../packages/", import.meta.url));
  const entries = readdirSync(packagesRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  assert.ok(entries.length >= 5, "the root must compose core, commons, shell, capability and host packages");

  const requiredTypes = new Set(["core", "commons", "host", "feature"]);
  const seenTypes = new Set();
  for (const entry of entries) {
    const manifest = JSON.parse(readFileSync(join(packagesRoot, entry.name, "package.json"), "utf8"));
    assert.equal(
      manifest.name,
      `@sdkwork/${entry.name.replace(/^sdkwork-/, "")}`,
      `${entry.name} package name must match its directory`,
    );
    assert.match(manifest.name, /^@sdkwork\/mall-mp-[a-z-]+$/u, "package names use the mp segment");
    assert.equal(manifest.sdkwork?.architecture, "mini-program", `${entry.name} must declare its architecture`);
    seenTypes.add(manifest.sdkwork?.packageType);
  }
  for (const type of requiredTypes) {
    assert.equal(seenTypes.has(type), true, `missing a ${type} package`);
  }

  // Feature and core packages never reach for the platform global: capabilities
  // receive host adapters and injected ports from the bootstrap. Comments are
  // stripped first because the documentation legitimately names `wx.login()`.
  for (const entry of entries) {
    if (entry.name === "sdkwork-mall-mp-host") {
      continue;
    }
    for (const file of collectTypeScriptFiles(join(packagesRoot, entry.name, "src"))) {
      const source = stripProse(readFileSync(file, "utf8"));
      assert.ok(
        !/\bwx\.[a-zA-Z]/u.test(source),
        `${entry.name}/${file.split(/[\\/]/u).slice(-2).join("/")} must not call platform globals`,
      );
    }
  }
});

/**
 * Removes comments and string literals so documentation and error copy that
 * legitimately name `wx.login()` are not mistaken for a platform call.
 */
function stripProse(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .replace(/^[ \t]*\/\/.*$/gmu, "")
    .replace(/`(?:[^`\\]|\\.)*`/gu, "``")
    .replace(/'(?:[^'\\\n]|\\.)*'/gu, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/gu, '""');
}

test("the app entry composes the runtime, IAM auth and IM services", () => {
  // Authority: MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md section 1 (thin bootstrap)
  // and section 6 (capability services call injected clients/services).
  const appEntry = read("../src/app.ts");
  assert.match(appEntry, /initializeMallMpRuntime/u, "app entry must install the runtime");
  assert.match(appEntry, /createWeixinHost/u, "app entry must install a host profile");
  assert.match(appEntry, /createMpImServices/u, "app entry must compose the IM services");
  assert.match(appEntry, /configureMpImServices/u, "app entry must install the IM services");
  assert.match(appEntry, /createMpAuthService/u, "app entry must reuse the IAM-backed account service");
});

test("domain ownership stays split: IAM owns auth, IM owns messaging", () => {
  // Authority: `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` section 6. A capability
  // package must not re-implement the other domain's transport.
  const session = read("../packages/sdkwork-mall-mp-core/src/session/index.ts");
  assert.match(
    session,
    /@sdkwork\/iam-mp-core\/session-wechat/u,
    "session must come from the IAM mini-program module",
  );

  const imService = read("../packages/sdkwork-mall-mp-im/src/services/im-service.ts");
  assert.match(imService, /@sdkwork\/im-mp-chat/u, "messaging must come from the IM mini-program services");
  assert.doesNotMatch(imService, /\/im\/chat\//u, "mall must not re-implement the IM chat transport");
  assert.doesNotMatch(imService, /\/notifications/u, "mall must not re-implement the notice transport");

  // The generated SDKs stay construction concerns of core.
  const sdk = read("../packages/sdkwork-mall-mp-core/src/sdk/index.ts");
  assert.match(sdk, /@sdkwork\/iam-app-sdk/u);
  assert.match(sdk, /@sdkwork\/im-app-sdk/u);
  assert.match(sdk, /@sdkwork\/im-sdk/u);
});


test("mall mini-program commerce facade composes the domain services", () => {
  const facade = read("../src/bootstrap/sdkClients.ts");
  for (const serviceType of [
    "MallMpCatalogService",
    "MallMpCartService",
    "MallMpOrderService",
    "MallMpAddressService",
    "MallMpPromotionService",
  ]) {
    assert.match(facade, new RegExp(serviceType, "u"), `facade must type ${serviceType}`);
  }
  for (const service of [
    "../src/services/catalog-service.ts",
    "../src/services/cart-service.ts",
    "../src/services/order-service.ts",
    "../src/services/address-service.ts",
    "../src/services/promotion-service.ts",
  ]) {
    assert.ok(read(service).includes("export "), `${service} must export its domain surface`);
  }
});
