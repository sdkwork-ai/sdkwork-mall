#!/usr/bin/env node
/**
 * Generate the cross-root i18n capability catalogue (i18n S1).
 *
 * `specs/mall-capability-parity.json` already owns the canonical screen name of
 * every capability and the copy that must stay byte-identical on all four roots.
 * This script projects that contract into one locale catalogue so the four roots
 * read the same vocabulary instead of re-typing it:
 *
 *   capability.<capability-id>.title   canonical screen name
 *   shared.<shared-copy-key>           cross-root shared statement
 *   common.<verb>                      shared action labels
 *
 * Keys are derived from capability ids, never from file paths, so a renamed
 * capability is one contract edit rather than four string edits.
 *
 * Usage:
 *   node scripts/generate-mall-i18n-catalogues.mjs            # write catalogues
 *   node scripts/generate-mall-i18n-catalogues.mjs --check    # fail when stale
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contractPath = path.join(workspaceRoot, "specs", "mall-capability-parity.json");
const outputDirectory = path.join(workspaceRoot, "specs", "app-i18n");
const outputPath = path.join(outputDirectory, "capabilities.zh-CN.json");

const COMMON_MESSAGES = {
  "common.cancel": "取消",
  "common.confirm": "确认",
  "common.loading": "加载中",
  "common.retry": "重试",
};

const contract = JSON.parse(readFileSync(contractPath, "utf8"));

function buildCatalogue() {
  const messages = { ...COMMON_MESSAGES };

  for (const capability of contract.capabilities) {
    const title = String(capability.title ?? "").trim();
    if (!title) {
      throw new Error(`capability ${capability.id} has no title to publish`);
    }
    messages[`capability.${capability.id}.title`] = title;
  }

  for (const entry of contract.sharedCopy ?? []) {
    const text = String(entry.text ?? "").trim();
    if (!text) {
      throw new Error(`shared copy ${entry.key} has no text to publish`);
    }
    messages[`shared.${entry.key}`] = text;
  }

  const sortedMessages = Object.fromEntries(
    Object.entries(messages).sort(([left], [right]) => (left < right ? -1 : 1)),
  );

  return {
    schemaVersion: 1,
    locale: "zh-CN",
    generatedFrom: "specs/mall-capability-parity.json",
    capabilityCount: contract.capabilities.length,
    messages: sortedMessages,
  };
}

const catalogue = buildCatalogue();
const serialized = `${JSON.stringify(catalogue, null, 2)}\n`;
const checkOnly = process.argv.slice(2).includes("--check");

if (checkOnly) {
  if (!existsSync(outputPath)) {
    process.stdout.write(
      `missing ${path.relative(workspaceRoot, outputPath)}: run pnpm i18n:catalogues\n`,
    );
    process.exit(1);
  }
  if (readFileSync(outputPath, "utf8") !== serialized) {
    process.stdout.write(
      `i18n catalogue is stale: ${path.relative(workspaceRoot, outputPath)} differs from the contract.\n` +
        "Run pnpm i18n:catalogues and review the diff.\n",
    );
    process.exit(1);
  }
  process.stdout.write("i18n capability catalogue matches the parity contract.\n");
} else {
  mkdirSync(outputDirectory, { recursive: true });
  writeFileSync(outputPath, serialized, "utf8");
  process.stdout.write(
    `wrote ${path.relative(workspaceRoot, outputPath)} (${Object.keys(catalogue.messages).length} messages for ${catalogue.capabilityCount} capabilities)\n`,
  );
}
