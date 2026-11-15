#!/usr/bin/env node
/**
 * Audit the access tier of the app-api surface the SDKWork mall consumes.
 *
 * Answers one question per operation: "must this be reachable without a login,
 * or must it require one?" by joining three sources of truth:
 *
 *   1. The consumed app-api OpenAPI contracts
 *      - the mall's own SDK specs (`sdks/**\/source-openapi.json`)
 *      - the app-api authorities of every sibling repo listed in
 *        `pnpm-workspace.yaml` (`apis/**\/app-api/**\/*.openapi.json`,
 *        `sdks/**\/*app-api*.openapi.json`)
 *   2. The published route tier
 *      - checked-in route manifests: `crates/**\/http_route_manifest.rs`,
 *        `crates/**\/manifest*.rs`, `crates/**\/routes.rs`
 *        (`HttpRoute::public|dual_token|dual_token_or_anonymous`,
 *        `HttpRoute::new(..., RouteAuth::X)`, and `RouteDefinition { .. }` tables)
 *      - for repos whose manifest is generated at build time from the OpenAPI
 *        authority (`build.rs` -> `generate_http_route_manifest`), the authority
 *        declaration (`x-sdkwork-auth-mode` then `security`) is used instead,
 *        exactly as the framework generator derives it
 *   3. Whether the mall actually calls the operation (path/operationId evidence
 *      in `apps/` and `packages/` sources)
 *
 * Outputs (both deterministic in ordering):
 *   docs/architecture/api/app-api-access-matrix.md
 *   docs/architecture/api/app-api-access-matrix.json
 *
 * Dependency-free Node ESM. Run from the mall repo root:
 *   node scripts/audit-mall-app-api-access.mjs
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const MALL_ROOT = path.resolve(SCRIPT_DIR, '..');
const WORKSPACE_ROOT = path.resolve(MALL_ROOT, '..');
const MALL_REPO_NAME = path.basename(MALL_ROOT);

const OUTPUT_MD = path.join(MALL_ROOT, 'docs/architecture/api/app-api-access-matrix.md');
const OUTPUT_JSON = path.join(MALL_ROOT, 'docs/architecture/api/app-api-access-matrix.json');

const APP_API_PREFIX = '/app/v3/api';

/** Directories that are never traversed (they explode or are symlinked trees). */
const SKIP_DIR_NAMES = new Set([
  'node_modules',
  'target',
  'dist',
  'build',
  'coverage',
  '.git',
  '.pnpm',
  '.workbuddy',
  '.tmp',
  '.tmp-build',
  '.sdkwork',
  'vendor',
]);

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);

/**
 * Canonical tier vocabulary (`API_SPEC.md` / `RouteAuth`).
 * Keys are normalized Rust/OpenAPI identifiers: lowercase, no `_` or `-`.
 */
const TIER_BY_NORMALIZED_NAME = new Map([
  ['public', 'anonymous'],
  ['anonymous', 'anonymous'],
  ['dualtokenoranonymous', 'dual-token-or-anonymous'],
  ['dualtoken', 'dual-token'],
  ['bootstrapbody', 'bootstrap-body'],
  ['credentialentrybootstrap', 'credential-entry-bootstrap'],
  ['refreshtoken', 'refresh-token'],
  ['apikey', 'api-key'],
  ['ingresstoken', 'ingress-token'],
  ['oauth', 'oauth'],
  ['openapiflexible', 'open-api-flexible'],
  ['openapibearerflexible', 'open-api-bearer-flexible'],
  ['apikeyordualtoken', 'api-key-or-dual-token'],
  ['agenttoken', 'agent-token'],
  ['compatibility', 'compatibility'],
]);

/** `x-sdkwork-auth-mode` -> tier (mirrors the framework generator mapping). */
const TIER_BY_AUTH_MODE = new Map([
  ['anonymous', 'anonymous'],
  ['public', 'anonymous'],
  ['dual-token', 'dual-token'],
  ['dual-token-or-anonymous', 'dual-token-or-anonymous'],
  ['bootstrap-body', 'bootstrap-body'],
  ['credential-entry-bootstrap', 'credential-entry-bootstrap'],
  ['refresh-token', 'refresh-token'],
  ['api-key', 'api-key'],
  ['ingress-token', 'ingress-token'],
  ['oauth', 'oauth'],
  ['open-api-flexible', 'open-api-flexible'],
  ['open-api-bearer-flexible', 'open-api-bearer-flexible'],
  ['api-key-or-dual-token', 'api-key-or-dual-token'],
  ['agent-token', 'agent-token'],
]);

const ADDITIVE_TIERS = new Set(['anonymous', 'dual-token', 'dual-token-or-anonymous']);

const VERDICT_OK = 'OK';
const VERDICT_TIER_CHANGE = 'NEEDS-TIER-CHANGE';
const VERDICT_MISSING = 'MISSING-ROUTE';
const VERDICT_UNUSED = 'UNUSED';

const MISSING_TIER = 'MISSING';

// ---------------------------------------------------------------------------
// Filesystem helpers (readdir-based: recursive Get-ChildItem is unusable here)
// ---------------------------------------------------------------------------

/**
 * Depth-first file listing with directory pruning and symlink skipping.
 *
 * @param {string} root absolute directory to walk
 * @param {(filePath: string, name: string) => boolean} [accept] file filter
 * @param {number} [maxDepth]
 * @returns {string[]} absolute file paths
 */
function listFiles(root, accept = () => true, maxDepth = 24) {
  const out = [];
  /** @type {{ dir: string, depth: number }[]} */
  const stack = [{ dir: root, depth: 0 }];
  while (stack.length > 0) {
    const { dir, depth } = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (depth + 1 > maxDepth) continue;
        if (SKIP_DIR_NAMES.has(entry.name)) continue;
        stack.push({ dir: entryPath, depth: depth + 1 });
        continue;
      }
      if (!entry.isFile()) continue;
      if (accept(entryPath, entry.name)) out.push(entryPath);
    }
  }
  return out.sort();
}

/** POSIX-style path relative to the workspace root (stable across platforms). */
function workspaceRelative(absolutePath) {
  return path.relative(WORKSPACE_ROOT, absolutePath).split(path.sep).join('/');
}

/** POSIX-style path relative to the mall root. */
function mallRelative(absolutePath) {
  return path.relative(MALL_ROOT, absolutePath).split(path.sep).join('/');
}

function readTextFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function readJsonFile(filePath) {
  const text = readTextFile(filePath);
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizePathTemplate(routePath) {
  return routePath.replace(/\{[^}/]*\}/g, '{}');
}

function operationKey(method, routePath) {
  return `${method.toUpperCase()} ${normalizePathTemplate(routePath)}`;
}

function methodFromRust(token) {
  const match = /HttpMethod::(\w+)/.exec(token);
  if (match) return match[1].toUpperCase();
  const quoted = /^"([A-Za-z]+)"$/.exec(token.trim());
  return quoted ? quoted[1].toUpperCase() : null;
}

function tierFromName(name) {
  if (!name) return null;
  const normalized = String(name).replace(/[_\-\s]/g, '').toLowerCase();
  return TIER_BY_NORMALIZED_NAME.get(normalized) ?? null;
}

// ---------------------------------------------------------------------------
// Workspace discovery
// ---------------------------------------------------------------------------

/**
 * Sibling SDKWork repos declared in the mall's `pnpm-workspace.yaml`
 * (entries like `../sdkwork-order/...`). These are the only sibling repos whose
 * app-api contracts the mall declares as consumed dependencies.
 *
 * @returns {{ name: string, dir: string }[]}
 */
function readWorkspaceSiblingRepos() {
  const manifestPath = path.join(MALL_ROOT, 'pnpm-workspace.yaml');
  const text = readTextFile(manifestPath);
  if (text === null) return [];
  const repos = new Map();
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*-\s*["']?(\.\.\/sdkwork-[^/"']+)/.exec(line);
    if (!match) continue;
    const repoDir = path.resolve(MALL_ROOT, match[1]);
    if (!fs.existsSync(repoDir)) continue;
    repos.set(path.basename(repoDir), repoDir);
  }
  return [...repos.entries()]
    .map(([name, dir]) => ({ name, dir }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function readWorkspaceRootGitRef(repoDir) {
  try {
    const head = execFileSync('git', ['-C', repoDir, 'rev-parse', '--short', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 15000,
    }).trim();
    const status = execFileSync('git', ['-C', repoDir, 'status', '--porcelain'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 15000,
    });
    const dirtyCount = status.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
    return { head, dirty: dirtyCount > 0, dirtyFiles: dirtyCount };
  } catch {
    return { head: null, dirty: null, dirtyFiles: null };
  }
}

// ---------------------------------------------------------------------------
// OpenAPI authorities
// ---------------------------------------------------------------------------

function isAppApiSpec(specFilePath, document) {
  const relative = workspaceRelative(specFilePath);
  const info = document?.info ?? {};
  const authority = String(info['x-sdkwork-api-authority'] ?? '');
  const sdkFamily = String(info['x-sdkwork-sdk-family'] ?? '');
  if (/(^|\/)(backend-api|open-api|internal-api)\//.test(relative)) return false;
  if (/(?:-backend-sdk|-open-sdk)/.test(relative)) return false;
  if (authority.endsWith('-app-api')) return true;
  if (sdkFamily.endsWith('-app-sdk')) return true;
  if (/\/apis\/app-api\//.test(relative)) return true;
  if (/-app-sdk\//.test(relative) && /(^|\/)(source-openapi|.*app-api.*)\.openapi\.json$/.test(relative)) {
    return true;
  }
  return false;
}

/** Higher-priority sources first: authored authority, then SDK snapshots, then generated aggregates. */
function specPriority(relative) {
  if (relative.includes('/apis/app-api/')) return 0;
  if (relative.includes('/sdks/') && relative.includes('/openapi/')) return 1;
  return 2;
}

/**
 * Collects the app-api OpenAPI authorities that make up the consumed surface.
 *
 * The mall's own specs come first, so a spec copy shipped by a sibling SDK does
 * not replace the contract the mall actually consumes. Identical copies (the
 * same operations with the same declared tiers, e.g. one per generated language)
 * are collapsed and only counted once.
 *
 * @param {{ name: string, dir: string }[]} siblingRepos
 * @returns {{ specs: object[], duplicates: { path: string, duplicateOf: string }[] }}
 */
function collectConsumedSpecFiles(siblingRepos) {
  const candidates = [];

  // 1. Specs shipped inside the mall repo itself (the primary consumed contract).
  for (const filePath of listFiles(
    path.join(MALL_ROOT, 'sdks'),
    (_p, name) => name === 'source-openapi.json' || name.endsWith('.openapi.json'),
  )) {
    candidates.push({ filePath, repo: MALL_REPO_NAME, owner: 'mall' });
  }
  for (const filePath of listFiles(
    path.join(MALL_ROOT, 'apis'),
    (_p, name) => name.endsWith('.openapi.json'),
  )) {
    candidates.push({ filePath, repo: MALL_REPO_NAME, owner: 'mall' });
  }

  // 2. Specs of the sibling repos that the mall's pnpm workspace declares.
  for (const repo of siblingRepos) {
    const apisDir = path.join(repo.dir, 'apis');
    if (fs.existsSync(apisDir)) {
      for (const filePath of listFiles(apisDir, (_p, name) => name.endsWith('.openapi.json'))) {
        candidates.push({ filePath, repo: repo.name, owner: 'sibling' });
      }
    }
    const sdksDir = path.join(repo.dir, 'sdks');
    if (fs.existsSync(sdksDir)) {
      for (const filePath of listFiles(
        sdksDir,
        (_p, name) => name === 'source-openapi.json' || name.endsWith('.openapi.json'),
      )) {
        candidates.push({ filePath, repo: repo.name, owner: 'sibling' });
      }
    }
  }

  const ordered = candidates
    .map((candidate) => ({ ...candidate, relative: workspaceRelative(candidate.filePath) }))
    .sort((left, right) => {
      const leftOwnerRank = left.owner === 'mall' ? 0 : 1;
      const rightOwnerRank = right.owner === 'mall' ? 0 : 1;
      if (leftOwnerRank !== rightOwnerRank) return leftOwnerRank - rightOwnerRank;
      const leftPriority = specPriority(left.relative);
      const rightPriority = specPriority(right.relative);
      if (leftPriority !== rightPriority) return leftPriority - rightPriority;
      return left.relative.localeCompare(right.relative);
    });

  /** @type {object[]} */
  const specs = [];
  /** @type {{ path: string, duplicateOf: string }[]} */
  const duplicates = [];
  /** @type {Map<string, string>} */
  const signatureToSpec = new Map();
  const seenPaths = new Set();

  for (const candidate of ordered) {
    if (seenPaths.has(candidate.relative)) continue;
    seenPaths.add(candidate.relative);
    const document = readJsonFile(candidate.filePath);
    if (!document || typeof document.paths !== 'object') continue;
    if (!isAppApiSpec(candidate.filePath, document)) continue;

    const spec = {
      ...candidate,
      document,
      isPrimary: /sdkwork-commerce-app-sdk/.test(candidate.relative),
    };
    const signature = parseSpecOperations(spec)
      .map((operation) => `${operation.method} ${operation.path} ${operation.operationId} ${operation.authority?.tier ?? ''}`)
      .sort()
      .join('\n');
    const existing = signatureToSpec.get(signature);
    if (existing) {
      duplicates.push({ path: spec.relative, duplicateOf: existing });
      continue;
    }
    signatureToSpec.set(signature, spec.relative);
    specs.push(spec);
  }

  return { specs, duplicates };
}

/**
 * Derives the tier an OpenAPI operation declares, mirroring
 * `sdkwork-web-build`/`sdkwork-web-contract`: `x-sdkwork-auth-mode` first, then
 * the operation (or document) `security` requirements.
 */
function deriveAuthorityTier(operation, rootSecurity) {
  const authMode = operation['x-sdkwork-auth-mode'];
  if (typeof authMode === 'string' && authMode.trim().length > 0) {
    const tier = TIER_BY_AUTH_MODE.get(authMode.trim().toLowerCase());
    if (tier) return { tier, declaredBy: `x-sdkwork-auth-mode=${authMode.trim()}` };
  }
  const security = operation.security ?? rootSecurity;
  if (security === undefined || security === null) return null;
  if (!Array.isArray(security)) return null;
  if (security.length === 0) return { tier: 'anonymous', declaredBy: 'security=[]' };

  const requirements = security.filter((entry) => entry && typeof entry === 'object');
  const allowsAnonymous = requirements.some((entry) => Object.keys(entry).length === 0);
  const schemeNames = requirements
    .flatMap((entry) => Object.keys(entry))
    .map((name) => name.toLowerCase());
  const hasAuth = schemeNames.some((name) => name.includes('auth'));
  const hasAccess = schemeNames.some((name) => name.includes('access'));
  const hasApiKey = schemeNames.some((name) => name.includes('apikey') || name.includes('api_key'));
  const hasOauth = schemeNames.some((name) => name.includes('oauth') || name.includes('bearer'));

  if (hasAuth && hasAccess) {
    return {
      tier: allowsAnonymous ? 'dual-token-or-anonymous' : 'dual-token',
      declaredBy: allowsAnonymous ? 'security=[{}, AuthToken+AccessToken]' : 'security=AuthToken+AccessToken',
    };
  }
  if (hasApiKey) return { tier: 'api-key', declaredBy: 'security=ApiKey' };
  if (hasOauth) return { tier: 'oauth', declaredBy: 'security=OAuth' };
  return null;
}

function parseSpecOperations(spec) {
  const operations = [];
  const rootSecurity = spec.document.security;
  for (const [routePath, pathItem] of Object.entries(spec.document.paths ?? {})) {
    if (!pathItem || typeof pathItem !== 'object') continue;
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method.toLowerCase())) continue;
      if (!operation || typeof operation !== 'object') continue;
      operations.push({
        method: method.toUpperCase(),
        path: routePath,
        operationId: typeof operation.operationId === 'string' ? operation.operationId : '',
        tags: Array.isArray(operation.tags) ? operation.tags.map(String) : [],
        authority: deriveAuthorityTier(operation, rootSecurity),
        specRelative: spec.relative,
        specRepo: spec.repo,
        specOwner: spec.owner,
        specPrimary: spec.isPrimary === true,
        specPriority: specPriority(spec.relative),
      });
    }
  }
  return operations;
}

// ---------------------------------------------------------------------------
// Published route manifests
// ---------------------------------------------------------------------------

/** Rust `const NAME: &str = "value";` table used to resolve `paths::NAME` args. */
const constCache = new Map();

function resolveRustConst(crateDir, expression) {
  const match = /^(?:crate::)?(?:[\w]+::)*([A-Z0-9_]+)$/.exec(expression.trim());
  if (!match) return null;
  const sourceDir = path.join(crateDir, 'src');
  if (!constCache.has(sourceDir)) {
    /** @type {Map<string, string>} */
    const constants = new Map();
    for (const filePath of listFiles(sourceDir, (_p, name) => name.endsWith('.rs'), 8)) {
      const text = readTextFile(filePath);
      if (text === null) continue;
      const pattern =
        /(?:pub(?:\([^)]*\))?\s+)?const\s+([A-Z0-9_]+)\s*:\s*&(?:\s*'static)?\s*str\s*=\s*"((?:[^"\\]|\\.)*)"\s*;/g;
      let hit;
      while ((hit = pattern.exec(text)) !== null) {
        if (!constants.has(hit[1])) constants.set(hit[1], hit[2].replace(/\\"/g, '"'));
      }
    }
    constCache.set(sourceDir, constants);
  }
  return constCache.get(sourceDir).get(match[1]) ?? null;
}

/** Splits a Rust call argument list on top-level commas. */
function splitRustArguments(source, startIndex) {
  const args = [];
  let depth = 0;
  let current = '';
  let index = startIndex;
  while (index < source.length) {
    const char = source[index];
    if (char === '"' || char === "'") {
      // Raw strings are not used by these manifests; handle cooked strings only.
      let cursor = index + 1;
      current += char;
      while (cursor < source.length) {
        current += source[cursor];
        if (source[cursor] === '\\') {
          cursor += 1;
          if (cursor < source.length) current += source[cursor];
          cursor += 1;
          continue;
        }
        if (source[cursor] === char) break;
        cursor += 1;
      }
      index = cursor + 1;
      continue;
    }
    if (char === '(' || char === '[' || char === '{') {
      depth += 1;
      current += char;
      index += 1;
      continue;
    }
    if (char === ')' || char === ']' || char === '}') {
      if (depth === 0 && char === ')') return { args, endIndex: index };
      depth -= 1;
      current += char;
      index += 1;
      continue;
    }
    if (char === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
      index += 1;
      continue;
    }
    current += char;
    index += 1;
  }
  if (current.trim().length > 0) args.push(current.trim());
  return { args, endIndex: source.length };
}

function stringLiteralValue(argument) {
  const match = /^"((?:[^"\\]|\\.)*)"$/.exec(argument.trim());
  return match ? match[1].replace(/\\"/g, '"') : null;
}

const ROUTE_CONSTRUCTOR_REGEX = /HttpRoute::(\w+)\s*\(/g;
const BARE_ROUTE_CONSTRUCTOR_REGEX =
  /^[ \t]*(public|dual_token|dual_token_or_anonymous|anonymous|api_key_or_dual_token)\s*\(/gm;
const ROUTE_DEFINITION_REGEX = /RouteDefinition\s*\{([^{}]*)\}/g;

/**
 * Extracts every route declaration from one Rust file.
 *
 * @returns {{ method: string, path: string, operationId: string, tier: string, form: string }[]}
 */
function parseRouteDeclarations(filePath) {
  const raw = readTextFile(filePath);
  if (raw === null) return [];
  if (!raw.includes('HttpRoute::') && !raw.includes('RouteDefinition')) return [];

  // Unit tests in the same file declare fixture routes; the production manifest
  // is the part before the first `#[cfg(test)]` module.
  const testModuleIndex = raw.indexOf('#[cfg(test)]');
  const text = testModuleIndex >= 0 ? raw.slice(0, testModuleIndex) : raw;
  if (!text.includes('HttpRoute::') && !text.includes('RouteDefinition')) return [];

  const crateDir = (() => {
    let current = path.dirname(filePath);
    for (let depth = 0; depth < 8; depth += 1) {
      if (fs.existsSync(path.join(current, 'Cargo.toml'))) return current;
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
    return path.dirname(filePath);
  })();

  const declarations = [];

  const resolvers = [
    { regex: ROUTE_CONSTRUCTOR_REGEX, form: 'HttpRoute::<tier>' },
    { regex: BARE_ROUTE_CONSTRUCTOR_REGEX, form: '<tier>' },
  ];
  for (const { regex, form } of resolvers) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const variant = match[1];
      const { args, endIndex } = splitRustArguments(text, match.index + match[0].length);
      if (args.length < 3) {
        regex.lastIndex = endIndex;
        continue;
      }
      let method = methodFromRust(args[0]);
      if (!method) {
        regex.lastIndex = endIndex;
        continue;
      }
      // `HttpRoute::new(method, path, module, operationId, RouteAuth::X)`
      if (form === 'HttpRoute::<tier>' && variant === 'new') {
        const pathValue = stringLiteralValue(args[1]) ?? resolveRustConst(crateDir, args[1]);
        const tierToken = args[args.length - 1] ?? '';
        const tierMatch = /RouteAuth::(\w+)/.exec(tierToken);
        const tier = tierMatch ? tierFromName(tierMatch[1]) : null;
        const operationId = stringLiteralValue(args[3] ?? '') ?? '';
        if (pathValue && tier) {
          declarations.push({ method, path: pathValue, operationId, tier, form: 'HttpRoute::new' });
        }
        regex.lastIndex = endIndex;
        continue;
      }
      const tier = tierFromName(variant);
      if (!tier) {
        regex.lastIndex = endIndex;
        continue;
      }
      const pathValue = stringLiteralValue(args[1]) ?? resolveRustConst(crateDir, args[1]);
      if (!pathValue) {
        regex.lastIndex = endIndex;
        continue;
      }
      // The operation id is the last string literal argument; the optional
      // module/group label sits between the path and it.
      let operationId = '';
      for (let index = args.length - 1; index >= 2; index -= 1) {
        const value = stringLiteralValue(args[index]);
        if (value !== null) {
          operationId = value;
          break;
        }
      }
      declarations.push({ method, path: pathValue, operationId, tier, form });
      regex.lastIndex = endIndex;
    }
  }

  ROUTE_DEFINITION_REGEX.lastIndex = 0;
  let definition;
  while ((definition = ROUTE_DEFINITION_REGEX.exec(text)) !== null) {
    const body = definition[1];
    const methodMatch = /method\s*:\s*(?:"([A-Za-z]+)"|HttpMethod::(\w+))/.exec(body);
    const pathMatch = /path\s*:\s*(?:"((?:[^"\\]|\\.)*)"|([A-Za-z0-9_:]+))/.exec(body);
    if (!methodMatch || !pathMatch) continue;
    const method = (methodMatch[1] ?? methodMatch[2] ?? '').toUpperCase();
    const pathValue = pathMatch[1]
      ? pathMatch[1].replace(/\\"/g, '"')
      : resolveRustConst(crateDir, pathMatch[2] ?? '');
    if (!pathValue) continue;
    const authMatch = /auth\s*:\s*RouteAuth::(\w+)/.exec(body);
    const tier = authMatch ? tierFromName(authMatch[1]) : null;
    if (!tier) continue;
    const operationIdMatch = /operation_id\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(body);
    declarations.push({
      method,
      path: pathValue,
      operationId: operationIdMatch ? operationIdMatch[1] : '',
      tier,
      form: 'RouteDefinition',
    });
  }

  return declarations;
}

/**
 * Every sibling SDKWork repo in the workspace root that owns Rust route crates.
 * The published tier is declared wherever the domain lives, which is not always
 * a repo the mall lists in `pnpm-workspace.yaml` (for example `sdkwork-catalog`
 * publishes the catalog app-api routes the commerce contract consumes).
 *
 * @returns {{ name: string, dir: string }[]}
 */
function collectRouteRepoDirs() {
  const repos = [];
  let entries;
  try {
    entries = fs.readdirSync(WORKSPACE_ROOT, { withFileTypes: true });
  } catch {
    return repos;
  }
  for (const entry of entries) {
    if (entry.isSymbolicLink() || !entry.isDirectory()) continue;
    if (!entry.name.startsWith('sdkwork-')) continue;
    const dir = path.join(WORKSPACE_ROOT, entry.name);
    if (!fs.existsSync(path.join(dir, 'crates'))) continue;
    repos.push({ name: entry.name, dir });
  }
  return repos.sort((left, right) => left.name.localeCompare(right.name));
}

function isRouteDeclarationFile(filePath, name) {
  if (/[\\/](tests|benches|examples)[\\/]/.test(filePath)) return false;
  if (/(?:^|_)tests?\.rs$/.test(name)) return false;
  return (
    name === 'http_route_manifest.rs' ||
    /^manifest.*\.rs$/.test(name) ||
    name === 'routes.rs' ||
    /route_manifest\.rs$/.test(name)
  );
}

/**
 * Builds the published-tier index from checked-in route declarations.
 *
 * @returns {{
 *   index: Map<string, object[]>,
 *   files: string[],
 *   reposWithGeneratedManifest: Set<string>,
 *   generatedManifestSpecs: Map<string, Set<string>>,
 * }}
 */
function buildRouteIndex(routeRepoDirs) {
  /** @type {Map<string, object[]>} */
  const index = new Map();
  const files = [];
  const reposWithGeneratedManifest = new Set();
  /** @type {Map<string, Set<string>>} repo -> absolute OpenAPI authorities it generates its manifest from */
  const generatedManifestSpecs = new Map();

  for (const repo of routeRepoDirs) {
    const cratesDir = path.join(repo.dir, 'crates');
    for (const buildScript of listFiles(cratesDir, (_p, name) => name === 'build.rs', 8)) {
      const text = readTextFile(buildScript);
      if (!text || !text.includes('generate_http_route_manifest')) continue;
      reposWithGeneratedManifest.add(repo.name);
      let crateDir = path.dirname(buildScript);
      for (let depth = 0; depth < 8; depth += 1) {
        if (fs.existsSync(path.join(crateDir, 'Cargo.toml'))) break;
        const parent = path.dirname(crateDir);
        if (parent === crateDir) break;
        crateDir = parent;
      }
      if (!generatedManifestSpecs.has(repo.name)) generatedManifestSpecs.set(repo.name, new Set());
      const specPattern = /"([^"]*\.openapi\.json)"/g;
      let match;
      while ((match = specPattern.exec(text)) !== null) {
        generatedManifestSpecs.get(repo.name).add(path.resolve(crateDir, match[1]));
      }
    }

    for (const filePath of listFiles(cratesDir, isRouteDeclarationFile, 8)) {
      const declarations = parseRouteDeclarations(filePath);
      if (declarations.length === 0) continue;
      files.push(workspaceRelative(filePath));
      for (const declaration of declarations) {
        if (!declaration.path.startsWith('/app/')) continue;
        const key = operationKey(declaration.method, declaration.path);
        if (!index.has(key)) index.set(key, []);
        index.get(key).push({
          ...declaration,
          repo: repo.name,
          file: workspaceRelative(filePath),
        });
      }
    }
  }

  files.sort();
  return { index, files, reposWithGeneratedManifest, generatedManifestSpecs };
}

// ---------------------------------------------------------------------------
// Consumer evidence
// ---------------------------------------------------------------------------

/**
 * Mall source files that can contain consumer evidence: `apps/**` and any
 * top-level `packages/**` (feature packages live under the apps, so both are
 * scanned).
 */
function collectMallSourceFiles() {
  const roots = [path.join(MALL_ROOT, 'apps')].filter((dir) => fs.existsSync(dir));
  const packagesDir = path.join(MALL_ROOT, 'packages');
  if (fs.existsSync(packagesDir)) roots.push(packagesDir);
  const files = [];
  for (const root of roots) {
    for (const filePath of listFiles(root, (absolutePath, name) => {
      const extension = path.extname(name).toLowerCase();
      if (!SOURCE_EXTENSIONS.has(extension)) return false;
      try {
        return fs.statSync(absolutePath).size <= 1024 * 1024;
      } catch {
        return false;
      }
    })) {
      files.push(filePath);
    }
  }
  return files.sort();
}

/** Normalizes a route-like string literal to the `{param}` template shape. */
function normalizeLiteralRoute(literal) {
  const withoutQuery = literal.split(/[?#]/)[0];
  const collapsed = withoutQuery
    .replace(/\$\{[^}]*\}/g, '{}')
    .replace(/:[A-Za-z_$][\w$]*/g, '{}')
    .replace(/\{[^}/]*\}/g, '{}');
  if (collapsed.length > 1 && collapsed.endsWith('/')) return collapsed.slice(0, -1);
  return collapsed;
}

/**
 * Walks mall sources once and indexes (a) route-looking string literals and
 * (b) dotted call chains, then resolves them to operations.
 *
 * @param {string[]} sourceFiles
 * @param {object[]} operations
 */
function collectConsumerEvidence(sourceFiles, operations) {
  const byTemplate = new Map();
  const byOperationId = new Map();
  for (const operation of operations) {
    const template = normalizePathTemplate(operation.path);
    if (!byTemplate.has(template)) byTemplate.set(template, []);
    byTemplate.get(template).push(operation);
    for (const operationId of operation.operationIds) {
      if (operationId.split('.').length < 2 || operationId.length < 6) continue;
      if (!byOperationId.has(operationId)) byOperationId.set(operationId, []);
      byOperationId.get(operationId).push(operation);
    }
  }

  const literalPattern = /["'`](\/[A-Za-z0-9_{}$:./-]*)["'`]/g;
  const chainPattern = /[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+/g;

  for (const filePath of sourceFiles) {
    const text = readTextFile(filePath);
    if (text === null) continue;
    const relative = mallRelative(filePath);

    const seenTemplates = new Set();
    literalPattern.lastIndex = 0;
    let literal;
    while ((literal = literalPattern.exec(text)) !== null) {
      const normalized = normalizeLiteralRoute(literal[1]);
      if (normalized.length < 2) continue;
      if (seenTemplates.has(normalized)) continue;
      seenTemplates.add(normalized);
      const candidates = byTemplate.get(normalized);
      if (candidates) {
        for (const operation of candidates) {
          operation.consumerFiles.add(relative);
          operation.consumerKinds.add('path');
        }
      }
    }

    const seenChains = new Set();
    chainPattern.lastIndex = 0;
    let chain;
    while ((chain = chainPattern.exec(text)) !== null) {
      const value = chain[0];
      if (seenChains.has(value)) continue;
      seenChains.add(value);
      const candidates = byOperationId.get(value);
      if (candidates) {
        for (const operation of candidates) {
          operation.consumerFiles.add(relative);
          operation.consumerKinds.add('operation-id');
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Target tier policy
// ---------------------------------------------------------------------------

/**
 * Storefront browse reads that must be reachable without a login.
 * Deliberately explicit: every entry is a product decision, not a heuristic.
 */
const STOREFRONT_BROWSE_READS = [
  { pattern: /^\/app\/v3\/api\/catalog\/attributes$/, note: 'catalog attribute dictionary' },
  { pattern: /^\/app\/v3\/api\/catalog\/categories$/, note: 'category tree' },
  { pattern: /^\/app\/v3\/api\/catalog\/categories\/\{[^}]+\}$/, note: 'category detail' },
  { pattern: /^\/app\/v3\/api\/catalog\/products$/, note: 'product (spu projection) list' },
  { pattern: /^\/app\/v3\/api\/catalog\/products\/\{[^}]+\}$/, note: 'product detail' },
  { pattern: /^\/app\/v3\/api\/catalog\/products\/\{[^}]+\}\/skus$/, note: 'product sku list' },
  { pattern: /^\/app\/v3\/api\/catalog\/skus\/\{[^}]+\}$/, note: 'sku detail' },
  { pattern: /^\/app\/v3\/api\/catalog\/spus$/, note: 'spu list (storefront grid)' },
  { pattern: /^\/app\/v3\/api\/catalog\/spus\/\{[^}]+\}$/, note: 'spu detail (product page)' },
  { pattern: /^\/app\/v3\/api\/shops$/, note: 'shop list' },
  { pattern: /^\/app\/v3\/api\/shops\/\{[^}]+\}$/, note: 'shop detail' },
  { pattern: /^\/app\/v3\/api\/promotions\/offers$/, note: 'promotion offer list' },
  { pattern: /^\/app\/v3\/api\/promotions\/offers\/\{[^}]+\}$/, note: 'promotion offer detail' },
  { pattern: /^\/app\/v3\/api\/memberships\/plans$/, note: 'membership plan catalogue' },
  { pattern: /^\/app\/v3\/api\/memberships\/package_groups$/, note: 'membership package group list' },
  {
    pattern: /^\/app\/v3\/api\/memberships\/package_groups\/\{[^}]+\}$/,
    note: 'membership package group detail',
  },
  {
    pattern: /^\/app\/v3\/api\/memberships\/package_groups\/\{[^}]+\}\/packages$/,
    note: 'membership packages of a group',
  },
  { pattern: /^\/app\/v3\/api\/memberships\/packages$/, note: 'membership package list' },
  { pattern: /^\/app\/v3\/api\/memberships\/packages\/\{[^}]+\}$/, note: 'membership package detail' },
];

/** Recharge catalogue reads that are public today and must stay public. */
const RECHARGE_CATALOGUE_READS = [
  /^\/app\/v3\/api\/recharges\/packages$/,
  /^\/app\/v3\/api\/recharges\/plans$/,
  /^\/app\/v3\/api\/recharges\/settings$/,
];

const RULES = [
  {
    id: 'R1',
    target: 'dual-token-or-anonymous',
    label: 'storefront browse read',
    description:
      'Anonymous visitors must be able to browse the storefront; a signed-in caller is still resolved so per-user scope keeps working.',
  },
  {
    id: 'R2',
    target: 'anonymous',
    label: 'recharge catalogue read',
    description: 'Recharge packages/plans/settings are public today and need no credential.',
  },
  {
    id: 'R3',
    target: 'anonymous',
    label: 'preserve already-anonymous surface',
    description:
      'A non-browse operation that is already published anonymous (webhooks, cashier links, display config) is not proposed for a login gate by this audit.',
  },
  {
    id: 'R4',
    target: 'dual-token',
    label: 'default: login required',
    description: 'Every other operation is user-scoped or state-changing and requires a login.',
  },
];

const RULE_BY_ID = new Map(RULES.map((rule) => [rule.id, rule]));

/**
 * Classifies one operation into its target tier.
 *
 * @returns {{ id: string, target: string, note: string }}
 */
function classifyTargetTier(operation) {
  const method = operation.method;
  const routePath = operation.path;

  if (method === 'GET') {
    for (const entry of STOREFRONT_BROWSE_READS) {
      if (entry.pattern.test(routePath)) {
        return { id: 'R1', target: 'dual-token-or-anonymous', note: entry.note };
      }
    }
    for (const pattern of RECHARGE_CATALOGUE_READS) {
      if (pattern.test(routePath)) {
        return { id: 'R2', target: 'anonymous', note: 'recharge catalogue read' };
      }
    }
  }

  if (operation.published.tier === 'anonymous') {
    return { id: 'R3', target: 'anonymous', note: 'already published anonymous' };
  }

  return { id: 'R4', target: 'dual-token', note: 'user-scoped or state-changing' };
}

// ---------------------------------------------------------------------------
// Audit assembly
// ---------------------------------------------------------------------------

function uniqueSorted(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function buildAudit() {
  const siblingRepos = readWorkspaceSiblingRepos();
  const { specs, duplicates: duplicateSpecs } = collectConsumedSpecFiles(siblingRepos);
  const routeRepoDirs = collectRouteRepoDirs();
  const routeIndex = buildRouteIndex(routeRepoDirs);

  // --- consumed operations (deduped by method + path template) -------------
  /** @type {Map<string, object>} */
  const operations = new Map();
  for (const spec of specs) {
    for (const parsed of parseSpecOperations(spec)) {
      const key = operationKey(parsed.method, parsed.path);
      let record = operations.get(key);
      if (!record) {
        record = {
          key,
          method: parsed.method,
          path: parsed.path,
          operationIds: new Set(),
          tags: new Set(),
          specRefs: new Set(),
          primary: false,
          authorities: [],
          consumerFiles: new Set(),
          consumerKinds: new Set(),
        };
        operations.set(key, record);
      }
      if (parsed.operationId) record.operationIds.add(parsed.operationId);
      for (const tag of parsed.tags) record.tags.add(tag);
      record.specRefs.add(parsed.specRelative);
      if (parsed.specPrimary) record.primary = true;
      if (parsed.authority) {
        record.authorities.push({
          tier: parsed.authority.tier,
          declaredBy: parsed.authority.declaredBy,
          spec: parsed.specRelative,
          repo: parsed.specRepo,
          priority: parsed.specPriority,
        });
      }
    }
  }

  const operationList = [...operations.values()].sort((left, right) => {
    if (left.path !== right.path) return left.path.localeCompare(right.path);
    return left.method.localeCompare(right.method);
  });

  // --- published tier resolution ------------------------------------------
  const mallRepoName = MALL_REPO_NAME;
  for (const operation of operationList) {
    operation.operationIds = uniqueSorted([...operation.operationIds]);
    operation.tags = uniqueSorted([...operation.tags]);
    operation.specRefs = uniqueSorted([...operation.specRefs]);

    const declarations = routeIndex.index.get(operation.key) ?? [];
    operation.manifestDeclarations = declarations.map((declaration) => ({
      tier: declaration.tier,
      repo: declaration.repo,
      file: declaration.file,
      form: declaration.form,
      operationId: declaration.operationId,
    }));

    const authorityTiers = uniqueSorted(operation.authorities.map((entry) => entry.tier));
    operation.authorityTiers = authorityTiers;
    operation.authorities = operation.authorities
      .slice()
      .sort((left, right) =>
        left.priority !== right.priority
          ? left.priority - right.priority
          : (left.repo + left.spec + left.tier).localeCompare(right.repo + right.spec + right.tier),
      );
    operation.authorityPrimary = operation.authorities[0] ?? null;

    if (declarations.length > 0) {
      const tiers = uniqueSorted(declarations.map((declaration) => declaration.tier));
      const repos = uniqueSorted(declarations.map((declaration) => declaration.repo));
      operation.published = {
        tier: tiers.length === 1 ? tiers[0] : 'conflict',
        tiers,
        source: `route-manifest:${repos.join(',')}`,
        sourceKind: 'route-manifest',
        repo: repos.join(','),
      };
    } else {
      // No checked-in manifest entry: the tier can only be published when the
      // owning repo materializes its manifest at build time from an OpenAPI
      // authority it names in `build.rs`.
      const generatedCandidates = operation.authorities
        .filter((authority) => authority.repo !== mallRepoName)
        .filter((authority) => routeIndex.reposWithGeneratedManifest.has(authority.repo))
        .filter((authority) => {
          const specs = routeIndex.generatedManifestSpecs.get(authority.repo);
          if (!specs || specs.size === 0) return true;
          return specs.has(path.resolve(WORKSPACE_ROOT, authority.spec));
        })
        .sort((left, right) =>
          left.priority !== right.priority
            ? left.priority - right.priority
            : left.repo.localeCompare(right.repo),
        );
      if (generatedCandidates.length > 0) {
        const tiers = uniqueSorted(generatedCandidates.map((candidate) => candidate.tier));
        operation.published = {
          tier: tiers.length === 1 ? tiers[0] : 'conflict',
          tiers,
          source: `openapi-authority:${generatedCandidates[0].repo} (manifest generated at build time)`,
          sourceKind: 'openapi-authority',
          repo: generatedCandidates[0].repo,
          spec: generatedCandidates[0].spec,
        };
      } else {
        operation.published = {
          tier: MISSING_TIER,
          tiers: [],
          source: 'none',
          sourceKind: 'none',
          repo: '',
        };
      }
    }
  }

  // --- consumer evidence --------------------------------------------------
  const sourceFiles = collectMallSourceFiles();
  collectConsumerEvidence(sourceFiles, operationList);
  for (const operation of operationList) {
    operation.consumerFiles = [...operation.consumerFiles].sort();
    operation.consumerKinds = [...operation.consumerKinds].sort();
    operation.consumed = operation.consumerFiles.length > 0;
  }

  // --- target tier + verdict ---------------------------------------------
  for (const operation of operationList) {
    const target = classifyTargetTier(operation);
    operation.target = {
      tier: target.target,
      rule: target.id,
      note: target.note,
    };
    const publishedTier = operation.published.tier;
    if (publishedTier === MISSING_TIER) {
      operation.verdict = VERDICT_MISSING;
    } else if (publishedTier === 'conflict') {
      operation.verdict = VERDICT_TIER_CHANGE;
    } else if (publishedTier !== operation.target.tier) {
      operation.verdict = VERDICT_TIER_CHANGE;
    } else if (!operation.consumed) {
      operation.verdict = VERDICT_UNUSED;
    } else {
      operation.verdict = VERDICT_OK;
    }
  }

  // --- drift between the runtime manifest and the OpenAPI authority -------
  const authorityDrift = [];
  for (const operation of operationList) {
    if (operation.published.sourceKind !== 'route-manifest') continue;
    const disagreeing = operation.authorities.filter(
      (authority) => authority.tier !== operation.published.tier,
    );
    if (disagreeing.length === 0) continue;
    authorityDrift.push({
      method: operation.method,
      path: operation.path,
      operationId: operation.operationIds[0] ?? '',
      routeManifestTier: operation.published.tier,
      routeManifestFiles: uniqueSorted(operation.manifestDeclarations.map((entry) => entry.file)),
      authorityTiers: operation.authorityTiers,
      disagreeingAuthorities: disagreeing.map((authority) => ({
        tier: authority.tier,
        spec: authority.spec,
        repo: authority.repo,
        declaredBy: authority.declaredBy,
      })),
    });
  }

  // --- summary ------------------------------------------------------------
  const summary = summarize(
    operationList,
    sourceFiles,
    specs,
    routeIndex,
    authorityDrift,
    duplicateSpecs,
  );

  return {
    siblingRepos,
    specs,
    duplicateSpecs,
    routeIndex,
    operations: operationList,
    sourceFiles,
    summary,
    authorityDrift,
  };
}

function countBy(items, selector) {
  /** @type {Record<string, number>} */
  const counts = {};
  for (const item of items) {
    const key = selector(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(counts).sort((left, right) => left[0].localeCompare(right[0])),
  );
}

function summarize(operations, sourceFiles, specs, routeIndex, authorityDrift, duplicateSpecs) {
  const publicTierBuckets = { anonymous: 0, 'dual-token-or-anonymous': 0, 'dual-token': 0, other: 0, missing: 0 };
  for (const operation of operations) {
    const tier = operation.published.tier;
    if (tier === MISSING_TIER) publicTierBuckets.missing += 1;
    else if (ADDITIVE_TIERS.has(tier)) publicTierBuckets[tier] += 1;
    else publicTierBuckets.other += 1;
  }

  const targetBuckets = { anonymous: 0, 'dual-token-or-anonymous': 0, 'dual-token': 0 };
  for (const operation of operations) {
    targetBuckets[operation.target.tier] = (targetBuckets[operation.target.tier] ?? 0) + 1;
  }

  const verdicts = countBy(operations, (operation) => operation.verdict);
  const publishedTiers = countBy(operations, (operation) => operation.published.tier);
  const consumed = operations.filter((operation) => operation.consumed).length;
  const unused = operations.length - consumed;

  const primarySpec = specs.find((spec) => /sdkwork-commerce-app-sdk/.test(spec.relative));
  const primaryOperations = operations.filter((operation) => operation.primary);

  const summary = {
    generatedAt: new Date().toISOString(),
    totalOperations: operations.length,
    primaryContract: {
      spec: primarySpec?.relative ?? null,
      operations: primaryOperations.length,
      anonymous: primaryOperations.filter((operation) => operation.published.tier === 'anonymous').length,
      dualTokenOrAnonymous: primaryOperations.filter(
        (operation) => operation.published.tier === 'dual-token-or-anonymous',
      ).length,
      dualToken: primaryOperations.filter((operation) => operation.published.tier === 'dual-token').length,
      otherPublished: primaryOperations.filter(
        (operation) =>
          !ADDITIVE_TIERS.has(operation.published.tier) && operation.published.tier !== MISSING_TIER,
      ).length,
      missing: primaryOperations.filter((operation) => operation.published.tier === MISSING_TIER).length,
      unused: primaryOperations.filter((operation) => !operation.consumed).length,
      verdicts: countBy(primaryOperations, (operation) => operation.verdict),
    },
    consumedSpecs: specs.length,
    duplicateSpecCopies: duplicateSpecs.length,
    routeManifestFiles: routeIndex.files.length,
    sourceFilesScanned: sourceFiles.length,
    publishedTiers,
    publishedTierBuckets: publicTierBuckets,
    targetTiers: targetBuckets,
    verdicts,
    consumed,
    unused,
    authorityDriftCount: authorityDrift.length,
    consistency: {
      totalEqualsPublishedTiers:
        Object.values(publishedTiers).reduce((sum, value) => sum + value, 0) === operations.length,
      totalEqualsVerdicts:
        Object.values(verdicts).reduce((sum, value) => sum + value, 0) === operations.length,
      totalEqualsConsumedPlusUnused: consumed + unused === operations.length,
      totalEqualsTargetTiers:
        Object.values(targetBuckets).reduce((sum, value) => sum + value, 0) === operations.length,
    },
  };
  return summary;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function mdCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function describeConsumed(operation, { compact = true } = {}) {
  if (operation.consumerFiles.length === 0) return '—';
  if (compact) return `${operation.consumerFiles.length} file${operation.consumerFiles.length === 1 ? '' : 's'}`;
  return operation.consumerFiles.join('<br>');
}

function describePublished(operation) {
  const { tier, tiers, sourceKind } = operation.published;
  if (tier === MISSING_TIER) return 'none';
  if (tier === 'conflict') return `conflict (${tiers.join(' / ')})`;
  return tier;
}

function describePublishedSource(operation) {
  const { sourceKind, source, repo } = operation.published;
  if (sourceKind === 'route-manifest') return `manifest: ${repo}`;
  if (sourceKind === 'openapi-authority') return `authority: ${repo} (build-generated manifest)`;
  return '—';
}

function renderMarkdown(audit) {
  const { operations, summary, authorityDrift, specs } = audit;
  const lines = [];
  const push = (line = '') => lines.push(line);

  push('# Mall app-api access-tier matrix');
  push();
  push(
    'Generated artifact — do not hand-edit. Regenerate with `pnpm audit:app-api-access` (or `node scripts/audit-mall-app-api-access.mjs`) from the mall repository root.',
  );
  push();
  push(
    'This matrix answers one question per consumed app-api operation: **should it be reachable without a login (`anonymous` / `dual-token-or-anonymous`), or must it require one (`dual-token`)?**',
  );
  push();
  push('## How this document is produced');
  push();
  push('Three source families are joined, with no hand-written rows:');
  push();
  push(
    '1. **Consumed contract** — the mall SDK specs (`sdks/**/source-openapi.json`) plus the `app-api` authorities of every sibling repo declared in `pnpm-workspace.yaml` (`apis/**/app-api/**/*.openapi.json`, `sdks/**/*app-api*.openapi.json`). Duplicate `method + path` pairs across specs are merged into one row.',
  );
  push(
    '2. **Published tier** — checked-in Rust route declarations (`crates/**/http_route_manifest.rs`, `crates/**/manifest*.rs`, `crates/**/routes.rs`): `HttpRoute::public|dual_token|dual_token_or_anonymous`, `HttpRoute::new(.., RouteAuth::X)` and `RouteDefinition { .. }` tables. When a repo materializes its manifest at build time from the OpenAPI authority (`build.rs` → `generate_http_route_manifest`) and has no checked-in routes, the authority declaration (`x-sdkwork-auth-mode`, then `security`) is used, exactly as the framework generator derives it.',
  );
  push(
    '3. **Consumer evidence** — a scan of `apps/**` and `packages/**` sources for the operation path template (module-local, so `/catalog/spus` counts but `/catalog/spus/{id}` does not) and for the dotted `operationId` call chain (for example `commerce().catalog.spus.list(..)`).',
  );
  push();
  push('Path templates are compared with parameter names erased (`{spuId}` ≈ `{productId}` ≈ `` `${id}` ``), so a consumer call site matches regardless of the local variable name.');
  push();

  push('## Snapshot');
  push();
  push(`- Generated at: \`${summary.generatedAt}\``);
  push(`- Consumed app-api specs: ${summary.consumedSpecs}`);
  push(`- Route declaration files parsed: ${summary.routeManifestFiles}`);
  push(`- Mall source files scanned for consumer evidence: ${summary.sourceFilesScanned}`);
  push();
  push('| Repository | HEAD | Working tree |');
  push('| --- | --- | --- |');
  for (const repo of audit.repoSnapshot) {
    const dirty = repo.dirty === null ? 'unknown' : repo.dirty ? `dirty (${repo.dirtyFiles} paths)` : 'clean';
    push(`| ${mdCell(repo.name)} | ${mdCell(repo.head ?? 'unknown')} | ${mdCell(dirty)} |`);
  }
  push();
  push(`Consumed specs (${specs.length}):`);
  push();
  for (const spec of specs) {
    push(`- \`${spec.relative}\` — ${spec.operationCount} operations`);
  }
  push();

  push('## Summary');
  push();
  push('| Metric | Count |');
  push('| --- | --- |');
  push(`| Total consumed app-api operations | ${summary.totalOperations} |`);
  push(`| Published \`anonymous\` | ${summary.publishedTierBuckets.anonymous} |`);
  push(`| Published \`dual-token-or-anonymous\` | ${summary.publishedTierBuckets['dual-token-or-anonymous']} |`);
  push(`| Published \`dual-token\` | ${summary.publishedTierBuckets['dual-token']} |`);
  push(`| Published other tier (\`bootstrap-body\`, \`api-key\`, …) | ${summary.publishedTierBuckets.other} |`);
  push(`| Published none (\`MISSING-ROUTE\`) | ${summary.publishedTierBuckets.missing} |`);
  push(`| Consumed by mall code (path or operationId evidence) | ${summary.consumed} |`);
  push(`| Not consumed (unused) | ${summary.unused} |`);
  push();
  push('| Verdict | Count |');
  push('| --- | --- |');
  for (const verdict of [
    VERDICT_OK,
    VERDICT_TIER_CHANGE,
    VERDICT_MISSING,
    VERDICT_UNUSED,
  ]) {
    push(`| ${verdict} | ${summary.verdicts[verdict] ?? 0} |`);
  }
  push();
  push(
    `Primary consumed contract (\`${summary.primaryContract.spec ?? 'n/a'}\`, ${summary.primaryContract.operations} operations): ` +
      `${summary.primaryContract.anonymous} anonymous, ` +
      `${summary.primaryContract.dualTokenOrAnonymous} dual-token-or-anonymous, ` +
      `${summary.primaryContract.dualToken} dual-token, ` +
      `${summary.primaryContract.missing} missing, ` +
      `${summary.primaryContract.unused} unused, ` +
      `${summary.primaryContract.otherPublished} other.`,
  );
  push();
  push('Consistency checks:');
  push();
  push(`- total == Σ published tiers: \`${summary.consistency.totalEqualsPublishedTiers}\``);
  push(`- total == Σ verdicts: \`${summary.consistency.totalEqualsVerdicts}\``);
  push(`- total == consumed + unused: \`${summary.consistency.totalEqualsConsumedPlusUnused}\``);
  push(`- total == Σ target tiers: \`${summary.consistency.totalEqualsTargetTiers}\``);
  push();

  push('## Tier policy');
  push();
  push('### Access tiers');
  push();
  push('| Tier | Meaning |');
  push('| --- | --- |');
  push('| `anonymous` | No credential at all. Machine surfaces and public configuration. |');
  push(
    '| `dual-token-or-anonymous` | Optional credential: an anonymous visitor is admitted, a signed-in caller is still resolved for per-user scope. Storefront browse traffic uses this. |',
  );
  push('| `dual-token` | Login required (`AuthToken` + `AccessToken`). |');
  push();
  push('### Target-tier rules (applied in order)');
  push();
  push('| Rule | Applies to | Target tier |');
  push('| --- | --- | --- |');
  for (const rule of RULES) {
    push(`| ${rule.id} | ${mdCell(rule.label)} | \`${rule.target}\` |`);
  }
  push();
  for (const rule of RULES) {
    push(`- **${rule.id} — ${rule.label}**: ${rule.description}`);
  }
  push();
  push('R1 storefront browse reads (the explicit list evaluated by the script):');
  push();
  for (const entry of STOREFRONT_BROWSE_READS) {
    push(`- \`GET ${entry.pattern.source.replace(/^\^|\$$/g, '').replace(/\\\//g, '/')}\` — ${entry.note}`);
  }
  push();
  push('R2 recharge catalogue reads:');
  push();
  for (const pattern of RECHARGE_CATALOGUE_READS) {
    push(`- \`GET ${pattern.source.replace(/^\^|\$$/g, '').replace(/\\\//g, '/')}\``);
  }
  push();

  push('### Verdicts');
  push();
  push('| Verdict | Meaning |');
  push('| --- | --- |');
  push(
    '| `OK` | Published tier already equals the target tier and the mall actually calls the operation. |',
  );
  push('| `NEEDS-TIER-CHANGE` | Published tier differs from the target tier (also used for `conflict`). |');
  push(
    '| `MISSING-ROUTE` | No published route declaration exists for a consumed operation, so the runtime answers `404 route-not-in-manifest`. The operation is declared in an OpenAPI authority but the owning surface never registered it. |',
  );
  push('| `UNUSED` | Tier is correct, but no mall source references the operation. |');
  push();

  // --- findings -----------------------------------------------------------
  const tierChanges = operations.filter((operation) => operation.verdict === VERDICT_TIER_CHANGE);
  const missing = operations.filter((operation) => operation.verdict === VERDICT_MISSING);
  const unused = operations.filter((operation) => operation.verdict === VERDICT_UNUSED);

  push('## Findings');
  push();
  push(`### Needs a tier change (${tierChanges.length})`);
  push();
  if (tierChanges.length === 0) {
    push('None.');
  } else {
    push('| Method | Path | Published | Target | Rule | Consumed |');
    push('| --- | --- | --- | --- | --- | --- |');
    for (const operation of tierChanges) {
      push(
        `| ${operation.method} | \`${mdCell(operation.path)}\` | ${describePublished(operation)} | \`${operation.target.tier}\` | ${operation.target.rule} | ${describeConsumed(operation)} |`,
      );
    }
  }
  push();
  push(`### Missing published route — join gaps (${missing.length})`);
  push();
  if (missing.length === 0) {
    push('None.');
  } else {
    push(
      'These operations are declared in a consumed OpenAPI authority, but no checked-in (or build-generated) route manifest declares them, so a caller gets `404 route-not-in-manifest`.',
    );
    push();
    push('| Method | Path | operationId | Authority spec | Consumed |');
    push('| --- | --- | --- | --- | --- |');
    for (const operation of missing) {
      push(
        `| ${operation.method} | \`${mdCell(operation.path)}\` | ${mdCell(operation.operationIds[0] ?? '')} | ${mdCell(uniqueSorted(operation.specRefs).join('<br>'))} | ${describeConsumed(operation)} |`,
      );
    }
  }
  push();
  push(`### Unused by mall code (${unused.length})`);
  push();
  if (unused.length === 0) {
    push('None.');
  } else {
    push(
      'Published tier matches the target tier, but no mall source path or operationId references the operation. They are listed for scope review, not as defects.',
    );
    push();
    push('| Method | Path | Published |');
    push('| --- | --- | --- |');
    for (const operation of unused) {
      push(`| ${operation.method} | \`${mdCell(operation.path)}\` | ${operation.published.tier} |`);
    }
  }
  push();
  push(`### Route-manifest / OpenAPI-authority drift (${authorityDrift.length})`);
  push();
  if (authorityDrift.length === 0) {
    push('None — every checked-in manifest entry agrees with its OpenAPI authority.');
  } else {
    push(
      'The checked-in route manifest (runtime truth) and an OpenAPI authority disagree. Either the authority is stale or the manifest was not regenerated; the runtime follows the manifest. Aggregate contracts (the mall commerce spec) are the usual stale side: they keep declaring `dual-token` after a domain authority moved a read to optional credential.',
    );
    push();
    push('| Method | Path | Manifest tier | Authority tier(s) | Disagreeing authority spec(s) |');
    push('| --- | --- | --- | --- | --- |');
    for (const drift of authorityDrift) {
      const specs = drift.disagreeingAuthorities
        .map((authority) => `${authority.spec} (${authority.tier})`)
        .join('<br>');
      push(
        `| ${drift.method} | \`${mdCell(drift.path)}\` | ${drift.routeManifestTier} | ${mdCell(drift.authorityTiers.join(', '))} | ${mdCell(specs)} |`,
      );
    }
  }
  push();

  // --- consumer evidence --------------------------------------------------
  const consumedOperations = operations.filter((operation) => operation.consumed);
  push(`## Consumer evidence (${consumedOperations.length} operations)`);
  push();
  if (consumedOperations.length === 0) {
    push('No mall source file references a consumed app-api operation.');
  } else {
    push('| Method | Path | Evidence | Files |');
    push('| --- | --- | --- | --- |');
    for (const operation of consumedOperations) {
      push(
        `| ${operation.method} | \`${mdCell(operation.path)}\` | ${mdCell(operation.consumerKinds.join(', '))} | ${mdCell(operation.consumerFiles.join('<br>'))} |`,
      );
    }
  }
  push();

  // --- full matrix --------------------------------------------------------
  push('## Full matrix');
  push();
  push(
    `${operations.length} operations, one row each, ordered by path then method. The first path segment after \`${APP_API_PREFIX}\` forms the family grouping.`,
  );
  push();

  /** @type {Map<string, object[]>} */
  const families = new Map();
  for (const operation of operations) {
    const suffix = operation.path.slice(APP_API_PREFIX.length).replace(/^\//, '');
    const family = suffix.split('/')[0] || '(root)';
    if (!families.has(family)) families.set(family, []);
    families.get(family).push(operation);
  }
  for (const family of [...families.keys()].sort((left, right) => left.localeCompare(right))) {
    const rows = families.get(family);
    push(`### \`${family}\` (${rows.length})`);
    push();
    push('| Method | Path | operationId | Consumed by | Published | Published source | Target | Rule | Verdict |');
    push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const operation of rows) {
      push(
        `| ${operation.method} | \`${mdCell(operation.path)}\` | ${mdCell(operation.operationIds[0] ?? '')} | ${describeConsumed(operation)} | ${describePublished(operation)} | ${describePublishedSource(operation)} | \`${operation.target.tier}\` | ${operation.target.rule} | ${operation.verdict} |`,
      );
    }
    push();
  }

  push('## Notes and limitations');
  push();
  push(
    '- Consumer evidence is textual: a call made through a generated SDK method whose name differs from the operationId, with no literal path anywhere, is invisible to this scan.',
  );
  push(
    '- An operation that appears in several specs is one row; `operationId` shows the lexicographically first identifier and all variants live in the JSON artifact.',
  );
  push(
    '- `UNUSED` means "no textual reference in `apps/` or `packages/`", not "dead contract". Shared SDK families ship whole surfaces, so unused rows stay in their published tier.',
  );
  push(
    '- R3 never proposes a login gate for an already-anonymous operation. Machine surfaces (payment webhooks, cashier capability links) and display configuration are therefore preserved as `anonymous` instead of being forced to `dual-token` by the catch-all rule.',
  );
  push(
    '- Sibling repositories can be modified concurrently by other work; the snapshot table records the HEAD and working-tree state used for this run.',
  );
  push();

  return `${lines.join('\n')}\n`;
}

function serializeAudit(audit) {
  const { operations, summary, authorityDrift, specs, routeIndex, sourceFiles } = audit;
  return {
    schemaVersion: 1,
    generatedBy: 'scripts/audit-mall-app-api-access.mjs',
    generatedAt: summary.generatedAt,
    generatedFromCommand: 'node scripts/audit-mall-app-api-access.mjs',
    appApiPrefix: APP_API_PREFIX,
    snapshot: audit.repoSnapshot,
    summary,
    tierVocabulary: {
      additive: [...ADDITIVE_TIERS],
      labels: Object.fromEntries(
        [...TIER_BY_NORMALIZED_NAME.entries()].sort((left, right) => left[0].localeCompare(right[0])),
      ),
    },
    targetPolicy: {
      rules: RULES,
      storefrontBrowseReads: STOREFRONT_BROWSE_READS.map((entry) => ({
        pathPattern: entry.pattern.source,
        note: entry.note,
      })),
      rechargeCatalogueReads: RECHARGE_CATALOGUE_READS.map((pattern) => pattern.source),
    },
    sources: {
      consumedSpecs: specs.map((spec) => ({ path: spec.relative, repo: spec.repo, operations: spec.operationCount })),
      duplicateSpecCopies: audit.duplicateSpecs,
      routeManifestFiles: routeIndex.files,
      reposWithBuildGeneratedManifest: [...routeIndex.reposWithGeneratedManifest].sort(),
      sourceFilesScanned: sourceFiles.length,
    },
    joinGaps: {
      consumedWithoutPublishedRoute: operations
        .filter((operation) => operation.verdict === VERDICT_MISSING)
        .map((operation) => ({
          method: operation.method,
          path: operation.path,
          operationIds: operation.operationIds,
          authoritySpecs: operation.specRefs,
          consumedBy: operation.consumerFiles,
        })),
    },
    authorityDrift,
    operations: operations.map((operation) => ({
      key: operation.key,
      method: operation.method,
      path: operation.path,
      operationIds: operation.operationIds,
      tags: operation.tags,
      primaryContract: operation.primary,
      consumed: {
        isConsumed: operation.consumed,
        evidenceKinds: operation.consumerKinds,
        fileCount: operation.consumerFiles.length,
        files: operation.consumerFiles,
      },
      published: {
        tier: operation.published.tier,
        tiers: operation.published.tiers,
        sourceKind: operation.published.sourceKind,
        source: operation.published.source,
        repo: operation.published.repo,
        declarations: operation.manifestDeclarations,
      },
      authority: {
        tiers: operation.authorityTiers,
        declarations: operation.authorities,
      },
      target: operation.target,
      verdict: operation.verdict,
    })),
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const audit = buildAudit();

  // Record the snapshot of every repo contributing data, so a re-run can be
  // compared to the state this document describes.
  const snapshotRepos = new Map();
  snapshotRepos.set(MALL_REPO_NAME, MALL_ROOT);
  for (const repo of audit.siblingRepos) {
    const contributes =
      audit.specs.some((spec) => spec.repo === repo.name) ||
      audit.routeIndex.files.some((file) => file.startsWith(`${repo.name}/`));
    if (contributes) snapshotRepos.set(repo.name, repo.dir);
  }
  audit.repoSnapshot = [...snapshotRepos.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([name, dir]) => ({ name, ...readWorkspaceRootGitRef(dir) }));

  // Spec operation counts for the document header.
  for (const spec of audit.specs) {
    spec.operationCount = parseSpecOperations(spec).length;
  }

  fs.mkdirSync(path.dirname(OUTPUT_MD), { recursive: true });

  const json = serializeAudit(audit);
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
  fs.writeFileSync(OUTPUT_MD, renderMarkdown(audit), 'utf8');

  const summary = audit.summary;
  const report = [
    `Wrote ${mallRelative(OUTPUT_MD)}`,
    `Wrote ${mallRelative(OUTPUT_JSON)}`,
    '',
    `Consumed app-api operations: ${summary.totalOperations}`,
    `  anonymous               : ${summary.publishedTierBuckets.anonymous}`,
    `  dual-token-or-anonymous : ${summary.publishedTierBuckets['dual-token-or-anonymous']}`,
    `  dual-token              : ${summary.publishedTierBuckets['dual-token']}`,
    `  other published tier    : ${summary.publishedTierBuckets.other}`,
    `  missing published route : ${summary.publishedTierBuckets.missing}`,
    `  consumed by mall code   : ${summary.consumed}`,
    `  unused                  : ${summary.unused}`,
    '',
    `Verdicts: ${JSON.stringify(summary.verdicts)}`,
    `Consistency: ${JSON.stringify(summary.consistency)}`,
  ];
  console.log(report.join('\n'));

  const consistencyOk = Object.values(summary.consistency).every(Boolean);
  if (!consistencyOk) {
    console.error('Summary counts are inconsistent — see the consistency block above.');
    process.exitCode = 1;
  }
}

main();
