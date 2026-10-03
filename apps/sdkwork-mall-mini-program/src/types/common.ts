/**
 * Shared mini-program structural types.
 *
 * Kept as narrow structural shapes over the WeChat event payloads the pages
 * actually consume, so handlers stay strict-mode clean without coupling to
 * the full miniprogram-api-typings event taxonomy.
 */

export interface MpInputEvent {
  detail: { value: string };
}

export interface MpPickerChangeEvent {
  detail: { value: number | string };
}

export interface MpTapEvent {
  currentTarget: {
    dataset: Record<string, string | number | undefined>;
  };
}

export interface MpSwitchChangeEvent {
  detail: { value: boolean | string | number };
}

/** swiper bindchange event (image carousel page switches). */
export interface MpSwiperChangeEvent {
  detail: { current: number; source?: string };
}

/** Loose record accessor for service payloads. */
export type MpRecord = Record<string, unknown>;

export function asString(map: MpRecord, keys: readonly string[], fallback = ""): string {
  for (const key of keys) {
    const value = map[key];
    if (value !== null && value !== undefined && String(value) !== "") {
      return String(value);
    }
  }
  return fallback;
}

export function asNumber(map: MpRecord, keys: readonly string[]): number | null {
  for (const key of keys) {
    const value = map[key];
    if (typeof value === "number") {
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

export function asRecord(value: unknown): MpRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as MpRecord)
    : {};
}

export function asRecordList(value: unknown): MpRecord[] {
  return Array.isArray(value) ? value.filter((entry) => entry !== null && typeof entry === "object") : [];
}

/** Human-readable message from a thrown value of any shape. */
export function errorMessage(cause: unknown, fallback = "操作失败"): string {
  if (cause instanceof Error && cause.message) {
    return cause.message;
  }
  if (typeof cause === "object" && cause !== null && "message" in cause) {
    const message = (cause as { message?: unknown }).message;
    if (typeof message === "string" && message !== "") {
      return message;
    }
  }
  return fallback;
}
