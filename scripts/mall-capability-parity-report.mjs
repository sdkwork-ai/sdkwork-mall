#!/usr/bin/env node
/**
 * Mall capability parity report.
 *
 * Prints the cross-client capability matrix from `specs/mall-capability-parity.json`
 * and marks each required implementation as covered or missing. The machine gate
 * is `tests/contract/verify-mall-capability-parity.test.mjs`; this script is the
 * human-readable companion used during regression rounds and release review.
 *
 * Usage:
 *   node scripts/mall-capability-parity-report.mjs            # full matrix
 *   node scripts/mall-capability-parity-report.mjs --gaps     # only missing cells
 *   node scripts/mall-capability-parity-report.mjs --json     # machine output
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contractPath = path.join(workspaceRoot, "specs", "mall-capability-parity.json");
const contract = JSON.parse(readFileSync(contractPath, "utf8"));
const platforms = Object.keys(contract.platforms);

const args = new Set(process.argv.slice(2));
const gapsOnly = args.has("--gaps");
const asJson = args.has("--json");

const routeRegistries = {
  pc: new Set(readRouteIds("pc")),
  h5: new Set(readRouteIds("h5")),
};
const miniProgramPages = new Set(
  JSON.parse(readText(contract.platforms.miniProgram.pageRegistry)).pages,
);
const flutterRoutes = new Set(readFlutterRoutes());

function readText(relativePath) {
  return readFileSync(path.join(workspaceRoot, relativePath), "utf8");
}

function collectDirectories(relativePath) {
  const absolutePath = path.join(workspaceRoot, relativePath);
  return existsSync(absolutePath)
    ? readdirSync(absolutePath, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
    : [];
}

function readRouteIds(platform) {
  const packagesRoot = path.join(
    workspaceRoot,
    contract.platforms[platform].root,
    "packages",
  );
  const routeIds = [];
  if (!existsSync(packagesRoot)) {
    return routeIds;
  }
  for (const packageName of collectDirectories(
    path.relative(workspaceRoot, packagesRoot),
  )) {
    const routesFile = path.join(packagesRoot, packageName, "src", "routes.ts");
    if (!existsSync(routesFile)) {
      continue;
    }
    for (const match of readFileSync(routesFile, "utf8").matchAll(/id:\s*"([^"]+)"/gu)) {
      routeIds.push(match[1]);
    }
  }
  return routeIds;
}

function readFlutterRoutes() {
  const shell = readText(contract.platforms.flutter.routeRegistry);
  return [...shell.matchAll(/'(\/[a-z0-9-]+)':\s*\(context\)\s*=>/gu)].map(
    (match) => match[1],
  );
}

/** Resolves one implementation cell to { covered, target, detail }. */
function resolveCell(capability, platform) {
  const implementation = capability.implementations[platform];
  if (!implementation) {
    return { covered: false, detail: "not declared", target: "—" };
  }
  if (platform === "pc" || platform === "h5") {
    const covered = routeRegistries[platform].has(implementation.routeId);
    return {
      covered,
      detail: covered ? "route" : "route not registered",
      target: implementation.routeId,
    };
  }
  if (platform === "miniProgram") {
    const page = implementation.page;
    const declared = miniProgramPages.has(page);
    const filesPresent = ["ts", "json", "wxml", "wxss"].every((extension) =>
      existsSync(
        path.join(
          workspaceRoot,
          contract.platforms.miniProgram.pageRoot,
          `${page}.${extension}`,
        ),
      ),
    );
    return {
      covered: declared && filesPresent,
      detail: declared ? (filesPresent ? "page" : "page files missing") : "page not declared",
      target: page,
    };
  }
  if (platform === "flutter") {
    if (implementation.route) {
      const covered = flutterRoutes.has(implementation.route);
      return {
        covered,
        detail: covered ? "route" : "route not registered",
        target: implementation.route,
      };
    }
    return { covered: true, detail: "tab", target: `tab:${implementation.tab}` };
  }
  return { covered: false, detail: "unknown platform", target: "—" };
}

const rows = contract.capabilities.map((capability) => {
  const cells = Object.fromEntries(
    platforms.map((platform) => [platform, resolveCell(capability, platform)]),
  );
  const requiredGaps = capability.requiredOn.filter(
    (platform) => !cells[platform].covered,
  );
  return { capability, cells, requiredGaps };
});

const missing = rows.filter((row) => row.requiredGaps.length > 0);

if (asJson) {
  process.stdout.write(
    `${JSON.stringify(
      {
        capabilityCount: rows.length,
        gaps: missing.map((row) => ({
          id: row.capability.id,
          missingOn: row.requiredGaps,
        })),
        platforms,
        rows: rows.map((row) => ({
          id: row.capability.id,
          requiredOn: row.capability.requiredOn,
          surface: row.capability.surface,
          title: row.capability.title,
          cells: row.cells,
        })),
      },
      null,
      2,
    )}\n`,
  );
  process.exit(missing.length > 0 ? 1 : 0);
}

const displayWidth = (value) => [...value].reduce((width, character) => (
  width + (/[\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFF60]/u.test(character) ? 2 : 1)
), 0);
const pad = (value, width) => value + " ".repeat(Math.max(0, width - displayWidth(value)));

const header = ["capability", "surface", ...platforms];
const table = rows.map((row) => [
  row.capability.id,
  row.capability.surface,
  ...platforms.map((platform) => {
    const cell = row.cells[platform];
    const required = row.capability.requiredOn.includes(platform);
    if (!required && !cell.covered) {
      return "·";
    }
    if (!cell.covered) {
      return "MISSING";
    }
    return cell.detail === "tab" ? "ok(tab)" : "ok";
  }),
]);

const included = gapsOnly ? [header, ...table.filter((_, index) => rows[index].requiredGaps.length > 0)] : [header, ...table];
const widths = included[0].map((_, columnIndex) => (
  Math.max(...included.map((line) => displayWidth(line[columnIndex])))
));

for (const [index, line] of included.entries()) {
  process.stdout.write(`${line.map((cell, columnIndex) => pad(cell, widths[columnIndex])).join("  ")}\n`);
  if (index === 0) {
    process.stdout.write(`${widths.map((width) => "-".repeat(width)).join("  ")}\n`);
  }
}

process.stdout.write(
  `\n${rows.length} capabilities, ${platforms.length} client roots, ${missing.length} required gaps.\n`,
);
for (const row of missing) {
  process.stdout.write(`  gap: ${row.capability.id} missing on ${row.requiredGaps.join(", ")}\n`);
}
if (missing.length > 0) {
  process.stdout.write("\nUpdate the client root or the contract before shipping.\n");
  process.exit(1);
}
process.stdout.write(
  "Every required capability resolves on every listed client root.\n",
);
