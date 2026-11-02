#!/usr/bin/env node
/**
 * Mall i18n readiness audit.
 *
 * Counts hard-coded user-facing copy per client root so the migration can be
 * planned with numbers instead of guesses. Regional/spec data modules (province
 * and city lists, size charts) are excluded from the copy total — they are
 * locale data, not translatable strings.
 *
 * Usage:
 *   node scripts/audit-mall-i18n-readiness.mjs                  # human report
 *   node scripts/audit-mall-i18n-readiness.mjs --json           # machine output
 *   node scripts/audit-mall-i18n-readiness.mjs --write-baseline # refresh the ratchet baseline
 *   node scripts/audit-mall-i18n-readiness.mjs --check          # fail when a root adds copy
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const asJson = args.has("--json");
const writeBaseline = args.has("--write-baseline");
const checkBaseline = args.has("--check");
const baselinePath = path.join(workspaceRoot, "specs", "i18n-readiness.baseline.json");

const ROOTS = {
  pc: { dir: "apps/sdkwork-mall-pc", extensions: [".ts", ".tsx"] },
  h5: { dir: "apps/sdkwork-mall-h5", extensions: [".ts", ".tsx"] },
  miniProgram: { dir: "apps/sdkwork-mall-mini-program/src", extensions: [".ts", ".wxml"] },
  flutter: { dir: "apps/sdkwork-mall-flutter-mobile/lib", extensions: [".dart"] },
};

/** Locale data rather than copy: province/city lists and similar datasets. */
const LOCALE_DATA_FILES = [
  /regions\.ts$/u,
  /pages[\\/]address[\\/]index\.ts$/u,
  /address_page\.dart$/u,
];

const CJK = /[\u4e00-\u9fff]/u;
const CJK_LITERAL = /["'`][^"'`\n]*[\u4e00-\u9fff][^"'`\n]*["'`]/gu;

function walk(directory, extensions, collected = []) {
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return collected;
  }
  for (const entry of entries) {
    if (entry.isSymbolicLink()) {
      continue;
    }
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", "dist", "build", ".dart_tool"].includes(entry.name)) {
        continue;
      }
      walk(fullPath, extensions, collected);
      continue;
    }
    if (extensions.some((extension) => entry.name.endsWith(extension))) {
      collected.push(fullPath);
    }
  }
  return collected;
}

const report = {};
for (const [rootName, root] of Object.entries(ROOTS)) {
  const files = walk(path.join(workspaceRoot, root.dir), root.extensions);
  let copyLiterals = 0;
  let localeDataLiterals = 0;
  const perFile = [];

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    const matches = [...source.matchAll(CJK_LITERAL)];
    if (matches.length === 0) {
      continue;
    }
    const relative = path.relative(path.join(workspaceRoot, root.dir), file).replace(/\\/gu, "/");
    const isLocaleData = LOCALE_DATA_FILES.some((pattern) => pattern.test(relative));
    if (isLocaleData) {
      localeDataLiterals += matches.length;
      continue;
    }
    copyLiterals += matches.length;
    perFile.push({ file: relative, literals: matches.length });
  }

  perFile.sort((left, right) => right.literals - left.literals);
  report[rootName] = {
    filesScanned: files.length,
    filesWithCopy: perFile.length,
    copyLiterals,
    localeDataLiterals,
    hotspots: perFile.slice(0, 5),
  };
}

if (asJson) {
  process.stdout.write(`${JSON.stringify({ roots: report }, null, 2)}\n`);
} else if (!writeBaseline && !checkBaseline) {
  const header = ["root", "files", "files+wcopy", "copy strings", "locale data"];
  const table = Object.entries(report).map(([root, data]) => [
    root,
    String(data.filesScanned),
    String(data.filesWithCopy),
    String(data.copyLiterals),
    String(data.localeDataLiterals),
  ]);
  const widths = header.map((_, column) => Math.max(...[header, ...table].map((row) => row[column].length)));
  for (const [index, row] of [header, ...table].entries()) {
    process.stdout.write(`${row.map((cell, column) => cell.padEnd(widths[column])).join("  ")}\n`);
    if (index === 0) {
      process.stdout.write(`${widths.map((width) => "-".repeat(width)).join("  ")}\n`);
    }
  }
  const total = Object.values(report).reduce((sum, data) => sum + data.copyLiterals, 0);
  process.stdout.write(`\n${total} user-facing strings remain hard-coded across the four roots.\n`);
  for (const [root, data] of Object.entries(report)) {
    process.stdout.write(`\n${root} hotspots:\n`);
    for (const hotspot of data.hotspots) {
      process.stdout.write(`  ${String(hotspot.literals).padStart(4)}  ${hotspot.file}\n`);
    }
  }
  process.stdout.write(
    "\nPlan: specs/app-i18n catalogues per root, keyed by capability id (the parity contract already owns the canonical labels).\n",
  );
  process.stdout.write("See docs/architecture/tech/TECH-I18N-READINESS.md.\n");
}

/**
 * Readiness ratchet.
 *
 * The migration is staged (S1 catalogue landed, per-root runtime pending), so
 * the audit is not yet a zero-baseline gate. Instead the committed baseline is
 * a ceiling: a root may not add hard-coded copy without an explicit baseline
 * update in the same change, which makes the growth reviewable. Shrinking copy
 * is always allowed and is reported.
 */
const copyByRoot = Object.fromEntries(
  Object.entries(report).map(([rootName, data]) => [rootName, data.copyLiterals]),
);
const totalCopy = Object.values(copyByRoot).reduce((sum, count) => sum + count, 0);

if (writeBaseline) {
  writeFileSync(
    baselinePath,
    `${JSON.stringify({ schemaVersion: 1, roots: copyByRoot, total: totalCopy }, null, 2)}\n`,
    "utf8",
  );
  process.stdout.write(
    `wrote ${path.relative(workspaceRoot, baselinePath)} (total ${totalCopy})\n`,
  );
}

if (checkBaseline) {
  if (!existsSync(baselinePath)) {
    process.stdout.write(
      `missing ${path.relative(workspaceRoot, baselinePath)}: run pnpm i18n:baseline\n`,
    );
    process.exit(1);
  }
  const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
  const grown = [];
  const shrunk = [];
  for (const [rootName, count] of Object.entries(copyByRoot)) {
    const previous = baseline.roots?.[rootName];
    if (typeof previous !== "number") {
      grown.push(`${rootName}: no baseline entry (current ${count})`);
      continue;
    }
    if (count > previous) {
      grown.push(`${rootName}: ${previous} -> ${count}`);
    } else if (count < previous) {
      shrunk.push(`${rootName}: ${previous} -> ${count}`);
    }
  }

  if (grown.length > 0) {
    process.stdout.write(
      "i18n readiness regressed: a root added hard-coded user-facing copy.\n" +
        `${grown.join("\n")}\n` +
        "Move the copy into a catalogue, or run pnpm i18n:baseline and justify the growth in review.\n",
    );
    process.exit(1);
  }
  process.stdout.write(
    `i18n readiness ratchet holds (${Object.entries(copyByRoot)
      .map(([rootName, count]) => `${rootName} ${count}/${baseline.roots[rootName]}`)
      .join(", ")}).\n`,
  );
  if (shrunk.length > 0) {
    process.stdout.write(`improved: ${shrunk.join(", ")} — refresh the baseline with pnpm i18n:baseline\n`);
  }
}

void CJK;
