/**
 * Wire-record coercion for the mini program.
 *
 * Authority: `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` section 3 (`mp-commons`
 * owns domain-neutral helpers). Generated SDKs hand back typed DTOs, but the
 * legacy commerce endpoints and the federation chat plane still answer loose
 * records, so the coercion happens once here instead of in every capability.
 */
export type MpRecord = Record<string, unknown>;

export function asRecord(value: unknown): MpRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as MpRecord) : {};
}

export function asRecordList(value: unknown): MpRecord[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is MpRecord => entry !== null && typeof entry === "object" && !Array.isArray(entry))
    : [];
}

export function asString(record: MpRecord, keys: readonly string[], fallback = ""): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value !== "") {
      return value;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return fallback;
}

export function asNumber(record: MpRecord, keys: readonly string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

export function asBoolean(record: MpRecord, keys: readonly string[]): boolean {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") {
      return value;
    }
    if (value === "true" || value === 1) {
      return true;
    }
  }
  return false;
}

/** Absolute epoch milliseconds from an ISO string or a numeric field. */
export function asEpochMillis(record: MpRecord, keys: readonly string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      return value;
    }
    if (typeof value === "string" && value) {
      const parsed = Date.parse(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}
