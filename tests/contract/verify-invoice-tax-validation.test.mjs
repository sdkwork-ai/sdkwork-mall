import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";

/**
 * Invoice tax-number validation contract.
 *
 * A company invoice is keyed by the 15–20 character unified social credit code.
 * Checkout has always rejected malformed codes, but the standalone invoice
 * centres accepted any text, so the merchant received invoices the tax system
 * later rejected. Every invoice surface must validate the code and surface the
 * same message.
 */
const workspaceRoot = path.resolve(import.meta.dirname, "..", "..");

const ROOTS = [
  {
    name: "pc",
    page: "apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-invoice/src/components/invoice-editor-dialog.tsx",
    pagePatterns: ["/^[A-Z0-9]{15,20}$/", "copy.editor.taxNumberInvalid"],
    catalogue: "apps/sdkwork-mall-pc/packages/sdkwork-mall-pc-invoice/src/invoice-copy.ts",
    readMessage: (source) => {
      // The copy module ships English first and zh-CN second (unicode escapes);
      // the canonical message is the decoded Chinese entry.
      const matches = [...source.matchAll(/taxNumberInvalid:\s*"((?:[^"\\]|\\.)*)"/gu)];
      const decoded = matches.map((match) => JSON.parse(`"${match[1]}"`));
      const chinese = decoded.find((message) => /[\u4e00-\u9fff]/u.test(message));
      assert.ok(chinese, "PC invoice copy must declare a zh-CN taxNumberInvalid");
      return chinese;
    },
  },
  {
    name: "h5",
    page: "apps/sdkwork-mall-h5/packages/sdkwork-mall-h5-buyer/src/pages/InvoicesPage.tsx",
    pagePatterns: ["/^[A-Z0-9]{15,20}$/u", 't("invoices.taxInvalid")'],
    catalogue: "apps/sdkwork-mall-h5/src/i18n/zh-CN/account/invoices/messages.json",
    readMessage: (source) => JSON.parse(source).invoices.taxInvalid,
  },
  {
    name: "miniProgram",
    page: "apps/sdkwork-mall-mini-program/src/pages/invoices/index.ts",
    pagePatterns: ["/^[A-Z0-9]{15,20}$/", 't("invoices.taxInvalid")'],
    catalogue: "apps/sdkwork-mall-mini-program/src/i18n/zh-CN/account/invoices/messages.js",
    readMessage: (source) => {
      const match = source.match(/taxInvalid:\s*"([^"]+)"/u);
      assert.ok(match, "mini-program invoices fragment must declare taxInvalid");
      return match[1];
    },
  },
  {
    name: "flutter",
    page: "apps/sdkwork-mall-flutter-mobile/lib/pages/settings_and_invoices.dart",
    pagePatterns: ["RegExp(r'^[A-Z0-9]{15,20}$')", "'invoices.taxInvalid'"],
    catalogue:
      "apps/sdkwork-mall-flutter-mobile/lib/src/i18n/zh-CN/account/settings-invoices/messages.json",
    readMessage: (source) => JSON.parse(source).invoices.taxInvalid,
  },
];

function read(relativePath) {
  const absolutePath = path.join(workspaceRoot, relativePath);
  assert.ok(existsSync(absolutePath), `missing ${relativePath}`);
  return readFileSync(absolutePath, "utf8");
}

test("every invoice centre rejects a malformed tax number", () => {
  for (const root of ROOTS) {
    const page = read(root.page);
    for (const pattern of root.pagePatterns) {
      assert.ok(
        page.includes(pattern),
        `${root.name} invoice page must contain ${JSON.stringify(pattern)}`,
      );
    }
  }
});

test("the tax-number message is identical across the roots", () => {
  const messages = ROOTS.map((root) => root.readMessage(read(root.catalogue)));
  for (const message of messages) {
    assert.equal(
      message,
      "税号格式不正确（15-20 位字母或数字）",
      "invoice tax message must match the canonical copy",
    );
  }
  assert.equal(new Set(messages).size, 1);
});
