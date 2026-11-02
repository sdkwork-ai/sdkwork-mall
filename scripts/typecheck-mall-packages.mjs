#!/usr/bin/env node
/**
 * Per-package TypeScript gate for the mall client roots.
 *
 * Why this exists: the repository-level `tsc --noEmit` resolves every app
 * bootstrap, and the app bootstraps import the federated commerce facade
 * (`@sdkwork/cloudrouter-app-sdk/domains`). While that upstream subpath is
 * missing, a root typecheck error hides whether the capability packages
 * themselves are sound. Every capability package carries its own `tsconfig.json`
 * and does not import the app bootstrap, so it can be verified independently.
 *
 * Usage:
 *   node scripts/typecheck-mall-packages.mjs             # active packages
 *   node scripts/typecheck-mall-packages.mjs --root pc   # one client root
 *   node scripts/typecheck-mall-packages.mjs --include-inactive
 *   node scripts/typecheck-mall-packages.mjs --json      # machine output
 *
 * Only packages the application root actually depends on are gated: the
 * inactive legacy SaaS packages (billing/checkout/offer/pricing/subscription/…)
 * are excluded from the root tsconfig, have no workspace links, and are not
 * shipped — auditing them belongs to that backlog, not to this gate.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const asJson = args.includes("--json");
const includeInactive = args.includes("--include-inactive");
const rootFilter = args.includes("--root") ? args[args.indexOf("--root") + 1] : undefined;

const appRoots = readdirSync(path.join(workspaceRoot, "apps"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.startsWith("sdkwork-mall-"))
  .map((entry) => entry.name)
  .filter((name) => !rootFilter || name.endsWith(`-${rootFilter}`));

function readDeclaredDependencies(appRoot) {
  const manifestPath = path.join(workspaceRoot, "apps", appRoot, "package.json");
  if (!existsSync(manifestPath)) {
    return null;
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  return new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
  ]);
}

const candidates = [];
const skipped = [];
for (const appRoot of appRoots) {
  const packagesRoot = path.join(workspaceRoot, "apps", appRoot, "packages");
  if (!existsSync(packagesRoot)) {
    continue;
  }
  const declared = readDeclaredDependencies(appRoot);
  for (const entry of readdirSync(packagesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const packageRoot = path.join(packagesRoot, entry.name);
    const manifestPath = path.join(packageRoot, "package.json");
    if (!existsSync(path.join(packageRoot, "tsconfig.json")) || !existsSync(manifestPath)) {
      continue;
    }
    const packageName = JSON.parse(readFileSync(manifestPath, "utf8")).name;
    const isActive = !declared || declared.has(packageName);
    if (!isActive && !includeInactive) {
      skipped.push({ appRoot, name: entry.name });
      continue;
    }
    candidates.push({ appRoot, packageRoot, name: entry.name });
  }
}

const typescriptBin = path.join(workspaceRoot, "node_modules", "typescript", "bin", "tsc");
if (!existsSync(typescriptBin)) {
  process.stderr.write(`typescript is not installed at ${typescriptBin}\n`);
  process.exit(2);
}

const results = [];
for (const candidate of candidates) {
  const startedAt = Date.now();
  try {
    execFileSync(process.execPath, [typescriptBin, "--noEmit", "-p", candidate.packageRoot], {
      cwd: candidate.packageRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    results.push({ ...candidate, durationMs: Date.now() - startedAt, ok: true, output: "" });
  } catch (error) {
    const stdout = typeof error.stdout === "string" ? error.stdout : "";
    const stderr = typeof error.stderr === "string" ? error.stderr : "";
    results.push({
      ...candidate,
      durationMs: Date.now() - startedAt,
      ok: false,
      output: `${stdout}${stderr}`.trim(),
    });
  }
}

const failures = results.filter((result) => !result.ok);

if (asJson) {
  process.stdout.write(
    `${JSON.stringify({ failures: failures.length, results, skipped }, null, 2)}\n`,
  );
  process.exit(failures.length > 0 ? 1 : 0);
}

for (const result of results) {
  const status = result.ok ? "ok  " : "FAIL";
  const seconds = (result.durationMs / 1000).toFixed(1).padStart(4);
  process.stdout.write(`${status} ${seconds}s  ${result.name}\n`);
  if (!result.ok && result.output) {
    for (const line of result.output.split("\n").slice(0, 40)) {
      process.stdout.write(`         ${line}\n`);
    }
  }
}

process.stdout.write(
  `\n${results.length} packages typechecked, ${failures.length} failed.\n`,
);
if (skipped.length > 0) {
  process.stdout.write(
    `${skipped.length} inactive package(s) skipped (not declared by the app root): ${skipped
      .map((entry) => entry.name)
      .join(", ")}\n`,
  );
}
if (failures.length > 0) {
  process.stdout.write(
    `\nFix these packages before shipping: ${failures.map((result) => result.name).join(", ")}\n`,
  );
  process.exit(1);
}
process.stdout.write("Every active capability package typechecks on its own.\n");
