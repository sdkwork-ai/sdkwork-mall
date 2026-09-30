import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";
import { test } from "node:test";

function read(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

test("mall mini-program root is manifest-driven", () => {
  const manifest = JSON.parse(read("../sdkwork.app.config.json"));
  assert.equal(manifest.app?.key, "sdkwork-mall-mini-program");
  assert.equal(manifest.runtime?.family, "mini-program");
  assert.equal(manifest.runtime?.framework, "weixin-mini-program");
});

test("mall mini-program tab bar covers the JD core surfaces", () => {
  const appJson = JSON.parse(read("../src/app.json"));
  const pages = appJson.tabBar.list.map((entry) => entry.pagePath);
  assert.deepEqual(pages, [
    "pages/home/index",
    "pages/category/index",
    "pages/cart/index",
    "pages/buyer/index",
  ]);
});

test("mall mini-program never issues raw wx.request before the MP SDK family lands", () => {
  for (const file of ["../../src/bootstrap/sdkClients.ts", "../../src/app.js"]) {
    assert.ok(!read(file).includes("wx.request"), `${file} must not bypass the SDK seam`);
  }
  assert.match(
    read("../src/bootstrap/sdkClients.ts"),
    /pending the generated WeChat MP SDK family/u,
  );
});
