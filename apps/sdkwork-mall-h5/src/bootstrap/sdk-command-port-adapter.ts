import { createSdkworkIdempotencyParams } from "@sdkwork/order-service";

type ArgumentRule = (args: readonly unknown[]) => unknown[];
type MethodOverride = (...args: unknown[]) => unknown;

export interface SdkCommandPortAdapterOptions {
  argumentRules?: Readonly<Record<string, ArgumentRule>>;
  commandPaths?: readonly string[];
  methodOverrides?: Readonly<Record<string, MethodOverride>>;
}

export function createSdkCommandPortAdapter<TPort extends object>(
  source: object,
  options: SdkCommandPortAdapterOptions = {},
): TPort {
  const commandPaths = new Set(options.commandPaths ?? []);
  const proxyCache = new WeakMap<object, object>();

  const adaptNode = (node: object, path: readonly string[]): object => {
    const cached = proxyCache.get(node);
    if (cached) {
      return cached;
    }

    const proxy = new Proxy(node, {
      get(target, property, receiver) {
        const value = Reflect.get(target, property, receiver) as unknown;
        const propertyName = String(property);
        const methodPath = [...path, propertyName].join(".");
        const methodOverride = options.methodOverrides?.[methodPath];
        if (methodOverride) {
          return (...rawArgs: unknown[]) => methodOverride(
            ...rawArgs.map(normalizeSdkArgument),
          );
        }
        if (typeof value === "function") {
          return (...rawArgs: unknown[]) => {
            const rule = options.argumentRules?.[methodPath];
            let args = rule
              ? rule(rawArgs)
              : rawArgs.map(normalizeSdkArgument);

            if (commandPaths.has(methodPath) && args.length < value.length) {
              while (args.length < value.length - 1) {
                args.push({});
              }
              const body = findCommandBody(args);
              args.push(createSdkworkIdempotencyParams());
            }

            if (args.length > value.length) {
              args = args.slice(0, value.length);
            }
            return Reflect.apply(value, target, args);
          };
        }
        if (value && typeof value === "object") {
          return adaptNode(value, [...path, propertyName]);
        }
        return value;
      },
    });
    proxyCache.set(node, proxy);
    return proxy;
  };

  return adaptNode(source, []) as TPort;
}

export function normalizeSdkArgument(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeSdkArgument);
  }
  if (!isRecord(value)) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key.replace(/_([a-z])/gu, (_, letter: string) => letter.toUpperCase()),
      normalizeSdkArgument(entry),
    ]),
  );
}

export function splitSdkQueryId(
  value: unknown,
  idKey: string,
): [string, Record<string, unknown>] {
  const query = normalizeSdkArgument(value);
  if (!isRecord(query)) {
    throw new Error(`SDK command port query must provide ${idKey}.`);
  }
  const id = String(query[idKey] ?? "").trim();
  if (!id) {
    throw new Error(`SDK command port query must provide ${idKey}.`);
  }
  const params = { ...query };
  delete params[idKey];
  return [id, params];
}

function findCommandBody(args: readonly unknown[]): Record<string, unknown> {
  for (let index = args.length - 1; index >= 0; index -= 1) {
    const candidate = args[index];
    if (isRecord(candidate)) {
      return candidate;
    }
  }
  return {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
