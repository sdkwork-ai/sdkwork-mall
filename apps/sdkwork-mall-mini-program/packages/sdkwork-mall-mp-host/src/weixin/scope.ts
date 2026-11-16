/**
 * Global scope resolution for the WeChat profile.
 *
 * The adapters take their platform scope as a parameter so tests can inject a
 * fake. On a device the scope is the global object — but `globalThis` is not
 * guaranteed to exist across base libraries (and some bundle transforms shadow it),
 * and reading `scope.wx` off `undefined` produced the launch failure
 * "Cannot read property 'wx' of undefined".
 *
 * `typeof globalThis` is safe even when the binding is missing, and the indirect
 * `Function("return this")()` fallback reaches the real global object on every
 * base library that supports `wx` at all.
 */
export interface MpPlatformScope {
  wx?: Record<string, unknown>;
}

export function resolvePlatformScope(): MpPlatformScope {
  if (typeof globalThis !== "undefined" && globalThis) {
    return globalThis as unknown as MpPlatformScope;
  }
  try {
    // Indirect global access: works when `globalThis` is unavailable.
    const escaper = Function("return this") as () => unknown;
    const scope = escaper();
    if (scope && typeof scope === "object") {
      return scope as MpPlatformScope;
    }
  } catch {
    // Fall through to an empty scope; the adapter then reports `unsupported`.
  }
  return {};
}

/** Mirrors `resolvePlatformScope`, but typed for a concrete `wx` surface. */
export function resolveWx<T>(): Partial<T> | undefined {
  const scope = resolvePlatformScope() as { wx?: Partial<T> };
  return scope.wx;
}
