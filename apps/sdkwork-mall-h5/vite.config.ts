import { resolveViteEnvironment, resolveLucideReactEntry } from '../../../sdkwork-specs/tools/vite-runtime-profile.mjs';
import { resolveBrowserDistOutDir } from '../../../sdkwork-specs/tools/browser-dist-layout.mjs';
import { WORKSPACE_SOURCE_RESOLVE_EXTENSIONS } from '../../scripts/lib/workspace-source-resolution.mjs';

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from 'vite';
import type { PluginOption } from 'vite';
import {
  createSdkworkCredentialEntryBootstrapVitePlugin,
  createSdkworkPublicApplicationAccessTokenVitePlugin,
} from '@sdkwork/iam-credential-entry/vite';

const appRoot = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(appRoot, "../..");
const DEFAULT_PLATFORM_GATEWAY_TARGET = "http://127.0.0.1:3900";
const workspaceNodeModules = path.join(workspaceRoot, "node_modules");
const workspacePnpmStore = path.join(workspaceNodeModules, ".pnpm");
const appbaseRoot = path.resolve(workspaceRoot, "../sdkwork-appbase");
const uiRoot = path.resolve(workspaceRoot, "../sdkwork-ui");
const sdkCommonsRoot = path.resolve(workspaceRoot, "../sdkwork-sdk-commons");

const sharedRuntimePackages = [
  "@radix-ui/react-avatar",
  "@radix-ui/react-checkbox",
  "@radix-ui/react-context-menu",
  "@radix-ui/react-dialog",
  "@radix-ui/react-dropdown-menu",
  "@radix-ui/react-hover-card",
  "@radix-ui/react-label",
  "@radix-ui/react-menubar",
  "@radix-ui/react-popover",
  "@radix-ui/react-radio-group",
  "@radix-ui/react-scroll-area",
  "@radix-ui/react-select",
  "@radix-ui/react-separator",
  "@radix-ui/react-slider",
  "@radix-ui/react-slot",
  "@radix-ui/react-switch",
  "@radix-ui/react-tabs",
  "@radix-ui/react-tooltip",
  "@tanstack/react-table",
  "class-variance-authority",
  "clsx",
  "cmdk",
  "i18next",
  "lucide-react",
  "react-day-picker",
  "react-hook-form",
  "react-i18next",
  "react-resizable-panels",
  "sonner",
  "tailwind-merge",
];

function packageStorePrefix(packageName: string): string {
  const [scope, name] = packageName.startsWith("@")
    ? packageName.split("/")
    : ["", packageName];
  return scope ? `${scope}+${name}@` : `${name}@`;
}

function resolveWorkspacePackage(packageName: string): string {
  const directPath = path.join(workspaceNodeModules, packageName);
  if (existsSync(directPath)) {
    return directPath;
  }

  if (!existsSync(workspacePnpmStore)) {
    return packageName;
  }

  const pnpmEntry = readdirSync(workspacePnpmStore)
    .filter((entry) => {
      const packagePath = path.join(workspacePnpmStore, entry, "node_modules", packageName);
      return entry.startsWith(packageStorePrefix(packageName)) || existsSync(packagePath);
    })
    .sort()
    .at(-1);

  if (!pnpmEntry) {
    return packageName;
  }

  return path.join(workspacePnpmStore, pnpmEntry, "node_modules", packageName);
}

function escapeRegExp(pattern: string): string {
  return pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type TsconfigAliasEntry = {
  find: string | RegExp;
  replacement: string;
};

function loadTsconfigAliases(): TsconfigAliasEntry[] {
  const tsconfigBasePath = path.join(workspaceRoot, "tsconfig.base.json");
  const tsconfigBase = JSON.parse(readFileSync(tsconfigBasePath, "utf8"));
  const pathMappings = tsconfigBase?.compilerOptions?.paths ?? {};
  const runtimeAliases = new Set([
    "react",
    "react-dom",
    "react/jsx-runtime",
    "react/jsx-dev-runtime",
  ]);

  const entries: TsconfigAliasEntry[] = [];
  for (const [find, replacements] of Object.entries(pathMappings)) {
    if (runtimeAliases.has(find)) {
      continue;
    }

    const replacement = Array.isArray(replacements) ? replacements[0] : undefined;
    if (typeof replacement !== "string") {
      continue;
    }

    const resolvedReplacement = path.resolve(
      workspaceRoot,
      replacement.endsWith("/*") ? replacement.slice(0, -2) : replacement,
    );

    // 精确映射（如 "@sdkwork/mall-h5-order"）只匹配包名本身，
    // 不匹配子路径导入（如 "@sdkwork/mall-h5-order/order-page"），
    // 让 vite 通过 node 解析和 package.json exports 字段解析子路径。
    // 通配符映射（如 "@sdkwork/*"）保持前缀匹配。
    if (find.endsWith("/*")) {
      entries.push({
        find: find.slice(0, -2),
        replacement: resolvedReplacement,
      });
    } else {
      entries.push({
        find: new RegExp(`^${escapeRegExp(find)}$`),
        replacement: resolvedReplacement,
      });
    }
  }

  return entries.sort((left, right) => {
    const leftLen = typeof left.find === "string" ? left.find.length : left.find.source.length;
    const rightLen = typeof right.find === "string" ? right.find.length : right.find.source.length;
    return rightLen - leftLen;
  });
}

function resolveDevProxyTarget(
  value: string | undefined,
  fallback: string,
): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    return fallback;
  }

  if (/^https?:\/\//iu.test(trimmed)) {
    try {
      return new URL(trimmed).origin;
    } catch {
      return fallback;
    }
  }

  return fallback;
}

function resolveMallH5DevProxyTarget({
  configuredApiBaseUrl,
  configuredSdkBaseUrl,
  env,
  explicitTarget,
}: {
  configuredApiBaseUrl?: string;
  configuredSdkBaseUrl?: string;
  env: Record<string, string>;
  explicitTarget?: string;
}): string {
  const platformGatewayUrl =
    env.VITE_SDKWORK_CLOUDROUTER_PLATFORM_API_GATEWAY_HTTP_URL
    ?? env.SDKWORK_CLOUDROUTER_PLATFORM_API_GATEWAY_HTTP_URL
    ?? env.VITE_SDKWORK_CLOUDROUTER_APPLICATION_PUBLIC_HTTP_URL
    ?? env.SDKWORK_CLOUDROUTER_APPLICATION_PUBLIC_HTTP_URL;

  return resolveDevProxyTarget(
    explicitTarget
      ?? configuredApiBaseUrl
      ?? configuredSdkBaseUrl
      ?? platformGatewayUrl,
    resolveDevProxyTarget(platformGatewayUrl, DEFAULT_PLATFORM_GATEWAY_TARGET),
  );
}

// Vite 8 runs Rolldown; `output.advancedChunks` is its native splitting
// primitive. React/router and the icon/UI primitives are stable across releases,
// so isolating them lets a repeat visitor reuse them from cache while only the
// app chunk is re-downloaded after a deploy.
const STABLE_VENDOR_CHUNK_GROUPS = [
  {
    name: "vendor-react",
    test: (id: string) =>
      ["/node_modules/react/", "/node_modules/react-dom/", "/node_modules/scheduler/", "/node_modules/react-router"].some(
        (fragment) => id.includes(fragment),
      ),
    priority: 30,
    maxSize: 512 * 1024,
  },
  {
    name: "vendor-ui",
    test: (id: string) =>
      ["/node_modules/@radix-ui/", "/node_modules/lucide-react/", "/node_modules/sonner/", "/node_modules/cmdk/"].some(
        (fragment) => id.includes(fragment),
      ),
    priority: 25,
    maxSize: 512 * 1024,
  },
];

/**
 * Read the committed public application access token of one deployment profile.
 *
 * `.env.<mode>` is the selected profile document whenever Vite runs with the
 * profile id as its mode (`standalone.development`, `cloud.production`, …),
 * which is what every canonical dev/build path does. The file is read directly
 * instead of through `loadEnv` because a launching process can export a private
 * fixture under the same `SDKWORK_ACCESS_TOKEN` key, and a private credential
 * must never be embedded in a renderer (`IAM_CREDENTIAL_ENTRY_SPEC.md` §4).
 */
function readProfilePublicApplicationAccessToken(mode: string): string | undefined {
  const profilePath = path.join(appRoot, `.env.${mode}`);
  if (existsSync(profilePath)) {
    for (const line of readFileSync(profilePath, "utf8").split(/\r?\n/u)) {
      const separator = line.indexOf("=");
      if (separator <= 0 || line.startsWith("#")) {
        continue;
      }
      if (line.slice(0, separator).trim() !== "SDKWORK_ACCESS_TOKEN") {
        continue;
      }
      const value = line.slice(separator + 1).trim();
      if (value) {
        return value;
      }
    }
  }
  return process.env.SDKWORK_ACCESS_TOKEN?.trim() || undefined;
}

/**
 * Deploy application anchor: the identity the public application access token
 * must carry.
 *
 * IAM makes the deploy application the identity of every access token, so the
 * expected `app_id` is `SDKWORK_DEPLOY_APPLICATION_ID`, never the manifest
 * `backend.appId` runtime id (APP_ACCESS_TOKEN_SPEC.md section 3.1.1). A source
 * checkout has no anchor: the committed profile then carries the
 * `__SDKWORK_DEPLOY_APPLICATION_ID__` placeholder, and `undefined` here skips the
 * plugin's app_id comparison instead of comparing against a retired identity.
 */
function readDeployApplicationId(): string | undefined {
  return process.env.SDKWORK_DEPLOY_APPLICATION_ID?.trim() || undefined;
}

/**
 * Credential-entry handoff for one Vite mode.
 *
 * The Vite dev server (`serve`) keeps the private development bootstrap token
 * handoff: it is a local, CSP-free surface. Every other combination —
 * non-development serve and every build (development … production,
 * standalone/cloud) — receives the committed public application access token as
 * a same-origin external script, because `IAM_CREDENTIAL_ENTRY_SPEC.md` §4
 * requires test/demo/staging/production renderers to carry it and the
 * production CSP (`script-src 'self'`) refuses an inline script. The canonical
 * plugin validates the token and fails closed when the selected profile has no
 * public application token, so a renderer can never reach the runtime error
 * `access-token-only request requires Access-Token before request dispatch`
 * (APP_ACCESS_TOKEN_SPEC.md §4).
 */
function resolveCredentialEntryPlugins({
  command,
  environment,
  mode,
  privateBootstrapAccessToken,
}: {
  command: "build" | "serve";
  environment: string;
  mode: string;
  privateBootstrapAccessToken?: string;
}): PluginOption[] {
  if (command === "serve" && environment === "development") {
    const developmentPlugin = createSdkworkCredentialEntryBootstrapVitePlugin({
      accessToken: privateBootstrapAccessToken,
      environment,
    });
    return developmentPlugin ? [developmentPlugin] : [];
  }

  return [
    createSdkworkPublicApplicationAccessTokenVitePlugin({
      accessToken: readProfilePublicApplicationAccessToken(mode),
      applicationId: readDeployApplicationId(),
      environment,
      profileId: mode,
    }),
  ];
}

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, appRoot, "");
  const bootstrapAccessToken = env.SDKWORK_ACCESS_TOKEN ?? process.env.SDKWORK_ACCESS_TOKEN;
  // A serve process must honour its explicit mode: an ambient
  // `SDKWORK_ENVIRONMENT=production` (exported by some build shells and agent
  // presets) would otherwise promote `pnpm dev` to production, skip the private
  // development handoff and refuse to boot. Builds keep the process-env fallback
  // because the canonical build runner injects the deployment identity there.
  const environment = resolveViteEnvironment(mode, command === "serve" ? {} : process.env);
  const appApiProxyTarget = resolveMallH5DevProxyTarget({
    configuredApiBaseUrl: env.VITE_SDKWORK_COMMERCE_H5_APP_API_BASE_URL,
    configuredSdkBaseUrl: env.VITE_SDKWORK_COMMERCE_H5_SDK_BASE_URL,
    env,
    explicitTarget: process.env.SDKWORK_MALL_H5_DEV_APP_API_PROXY_TARGET,
  });
  const backendApiProxyTarget = resolveMallH5DevProxyTarget({
    configuredApiBaseUrl: env.VITE_SDKWORK_COMMERCE_H5_BACKEND_API_BASE_URL,
    configuredSdkBaseUrl: env.VITE_SDKWORK_COMMERCE_H5_SDK_BASE_URL,
    env,
    explicitTarget: process.env.SDKWORK_MALL_H5_DEV_BACKEND_API_PROXY_TARGET,
  });

  return {
  root: appRoot,
  plugins: [
    // The bootstrap credential reaches the renderer only through the shared IAM
    // plugins (the injected global
    // `globalThis.__SDKWORK_CREDENTIAL_ENTRY_BOOTSTRAP_ACCESS_TOKEN__`).
    // `define['process.env.SDKWORK_ACCESS_TOKEN']` is NOT a valid handoff
    // (IAM_CREDENTIAL_ENTRY_SPEC.md section 4/5).
    ...resolveCredentialEntryPlugins({
      command,
      environment,
      mode,
      privateBootstrapAccessToken: bootstrapAccessToken,
    }),
    react(), tailwindcss(),
  ],
  optimizeDeps: {
    // Workspace-linked sources must not be frozen into the esbuild prebundle:
    // the sdk-common dist barrel dropped fresh exports once already.
    exclude: [
      "@sdkwork/cloudrouter-backend-sdk/domains",
      "@sdkwork/iam-runtime",
      "@sdkwork/membership-service",
      "@sdkwork/payment-app-sdk",
      "@sdkwork/promotion-service",
      "@sdkwork/cloudrouter-app-sdk/domains",
      "@sdkwork/payment-service",
      "@sdkwork/membership-app-sdk",
      "@sdkwork/mall-commerce-sdk-ports",
      "@sdkwork/iam-h5-auth",
      "@sdkwork/iam-h5-core",
      "@sdkwork/iam-service",
      "@sdkwork/i18n-pc-react",
      "@sdkwork/cloudrouter-backend-sdk",
      "@sdkwork/account-app-sdk",
      "@sdkwork/iam-app-sdk",
      "@sdkwork/promotion-app-sdk",
      "@sdkwork/account-service",
      "@sdkwork/iam-contracts",
      "@sdkwork/order-app-sdk",
      "@sdkwork/order-mobile-react-orders",
      "@sdkwork/ui-mobile-react",
      "motion",
      "@sdkwork/mall-commerce-service",
      "@sdkwork/order-service",
      "@sdkwork/utils",
      "@sdkwork/cloudrouter-app-sdk",
      "@sdkwork/sdk-common",
      "@sdkwork/appbase-pc-react",
      "@sdkwork/iam-credential-entry",
      "@sdkwork/mall-h5-account",
      "@sdkwork/mall-h5-activity",
      "@sdkwork/mall-h5-buyer",
      "@sdkwork/mall-h5-cart",
      "@sdkwork/mall-h5-catalog",
      "@sdkwork/mall-h5-commons",
      "@sdkwork/mall-h5-core",
      "@sdkwork/mall-h5-home",
      "@sdkwork/mall-h5-membership",
      "@sdkwork/mall-h5-order",
      "@sdkwork/mall-h5-shell",
      "@sdkwork/mall-h5-shop",
      "@sdkwork/runtime-bootstrap",
      "@sdkwork/ui-pc-react",
    ],
  },
  resolve: {
    // Authored TypeScript must win over gitignored `tsc` siblings inside the
    // source-linked workspace packages (see workspace-source-resolution.mjs):
    // a stale `.js` shadowing a fresh `.ts` produced the deployed runtime
    // "Cannot read properties of undefined (reading 'demandClaims')" crash.
    extensions: [...WORKSPACE_SOURCE_RESOLVE_EXTENSIONS],
    alias: [
      {
        find: "react",
        replacement: path.join(workspaceNodeModules, "react"),
      },
      {
        find: "react-dom",
        replacement: path.join(workspaceNodeModules, "react-dom"),
      },
      {
        find: "react-router-dom",
        replacement: path.join(workspaceNodeModules, "react-router-dom"),
      },
      ...sharedRuntimePackages.map((packageName) => ({
        find: packageName,
        replacement: resolveWorkspacePackage(packageName),
      })),
      ...loadTsconfigAliases(),
    ],
    dedupe: [
      "react",
      "react-dom",
      "react-router",
      "react-router-dom",
      ...sharedRuntimePackages,
    ],
  },
  build: {
    outDir: resolveBrowserDistOutDir(resolveViteEnvironment(mode, env)),
    rollupOptions: {
      output: {
        advancedChunks: {
          groups: STABLE_VENDOR_CHUNK_GROUPS,
        },
      },
    },
    sourcemap: mode !== "production",
  },
  server: {
    host: "127.0.0.1",
    port: 5176,
    proxy: {
      "/app/v3/api": {
        changeOrigin: true,
        target: appApiProxyTarget,
      },
      "/backend/v3/api": {
        changeOrigin: true,
        target: backendApiProxyTarget,
      },
      // Customer-service chat transport (mall seam) rides the same dev gateway.
      "/im/chat": {
        changeOrigin: true,
        target: appApiProxyTarget,
      },
    },
    fs: {
      allow: [
        appRoot,
        workspaceRoot,
        appbaseRoot,
        uiRoot,
        sdkCommonsRoot,
      ],
    },
  },
};
});
