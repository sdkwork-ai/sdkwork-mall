/**
 * `PageInfo` reader for the mini-program's list services.
 *
 * The commerce app-api answers lists with `data.items` + `data.pageInfo`
 * (`API_SPEC.md` section 16, `PAGINATION_SPEC.md`). The authoritative fields are
 * `totalItems`, `page`, `pageSize`, `totalPages` and `hasMore`; there is no
 * `total` member. Reading a non-existent field left `total` at `0`, so every
 * "load more" guard fired immediately and only the first page was ever shown.
 *
 * Cursor lists carry `hasMore`/`nextCursor` and no `totalItems`; the reader
 * therefore prefers `hasMore`, then `totalPages`, then the item count.
 */
import type { MpPayload } from "./transport";

export interface MpPageInfo {
  /** True when the service reported more pages, or the count proves it. */
  hasMore: boolean;
  /** Best available total; falls back to the current page length in cursor mode. */
  totalItems: number;
}

function readNumber(source: Record<string, unknown>, key: string): number | null {
  const value = source[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

/**
 * Normalizes a list payload's pagination members.
 *
 * @param payload - The unwrapped `data` member of the response envelope.
 * @param itemCount - Length of the current page, used when the server omits a total.
 * @param requestedPage - Page number the caller asked for (offset mode only).
 */
export function readPageInfo(
  payload: MpPayload | undefined,
  itemCount: number,
  requestedPage = 1,
): MpPageInfo {
  const raw = (payload?.pageInfo ?? {}) as Record<string, unknown>;
  const totalItems = readNumber(raw, "totalItems") ?? itemCount;
  const page = readNumber(raw, "page") ?? requestedPage;
  const pageSize = readNumber(raw, "pageSize");
  const totalPages = readNumber(raw, "totalPages");

  let hasMore: boolean;
  if (typeof raw.hasMore === "boolean") {
    hasMore = raw.hasMore;
  } else if (totalPages !== null) {
    hasMore = page < totalPages;
  } else if (pageSize !== null) {
    hasMore = page * pageSize < totalItems;
  } else {
    // No pagination metadata at all: a full page implies more may follow.
    hasMore = itemCount > 0;
  }

  return { hasMore, totalItems };
}
