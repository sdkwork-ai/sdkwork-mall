#!/usr/bin/env node
// Materialize the mini-program runtime bundle (runtime-env injection target).
// The MP dev toolchain consumes src/ directly; this script validates the
// runtime environment projection until the generated MP SDK family lands.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const deploymentProfile = process.argv.includes("--deployment-profile")
  ? process.argv[process.argv.indexOf("--deployment-profile") + 1]
  : "standalone";
const environment = process.argv.includes("--environment")
  ? process.argv[process.argv.indexOf("--environment") + 1]
  : "development";

const manifest = JSON.parse(readFileSync(path.join(appRoot, "sdkwork.app.config.json"), "utf8"));
const envConfig = manifest.environments?.[environment];
if (!envConfig) {
  console.error(`[mall-mp] unknown environment: ${environment}`);
  process.exit(1);
}

const runtimeEnv = {
  commerceAppApiBaseUrl: `${envConfig.accessUrl.replace(/\/apps\/.*$/u, "")}/app/v3/api`,
  environment,
  deploymentProfile,
};

mkdirSync(path.join(appRoot, "src"), { recursive: true });
writeFileSync(
  path.join(appRoot, "src", "runtime-env.json"),
  `${JSON.stringify(runtimeEnv, null, 2)}\n`,
);
console.log(`[mall-mp] materialized src/runtime-env.json (${deploymentProfile}.${environment})`);
