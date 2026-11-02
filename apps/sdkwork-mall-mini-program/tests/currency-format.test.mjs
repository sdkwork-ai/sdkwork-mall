import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { strict as assert } from "node:assert";
import { test } from "node:test";

/**
 * Currency rendering guard for the mini program.
 *
 * `utils/format.ts#formatCny` already prepends `¥`. Page templates must either
 * bind that formatted string bare (`{{item.amountText}}`) or prefix a raw number
 * (`¥{{item.amountCny}}`) — never both, which renders `¥¥1,234.00`. The same
 * regression had shipped in the wallet, invoices, favourites and reviews
 * templates, so it is pinned here instead of relying on review.
 */

const pagesRoot = fileURLToPath(new URL("../src/pages/", import.meta.url));
const formatSource = readFileSync(
  fileURLToPath(new URL("../src/utils/format.ts", import.meta.url)),
  "utf8",
);

function listTemplates(directory) {
  const templates = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      templates.push(...listTemplates(entryPath));
    } else if (entry.name.endsWith(".wxml")) {
      templates.push(entryPath);
    }
  }
  return templates;
}

test("formatCny owns the currency symbol", () => {
  assert.match(formatSource, /return `¥\$\{value\.toFixed\(2\)\}`/u);
});

test("page templates never prefix an already formatted currency string", () => {
  const violations = [];
  for (const template of listTemplates(pagesRoot)) {
    const source = readFileSync(template, "utf8");
    for (const match of source.matchAll(/¥\{\{\s*([^}]+?)\s*\}\}/gu)) {
      const expression = match[1];
      // `...Text` / `...priceText` fields are produced by formatCny and already
      // carry the symbol.
      if (/Text$/u.test(expression)) {
        violations.push(
          `${template.replace(pagesRoot, "").replace(/\\/gu, "/")} → ¥{{${expression}}}`,
        );
      }
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Double currency symbol: bind the formatted field bare instead of prefixing it:\n${violations.join("\n")}`,
  );
});
