/**
 * Reads one resolved commerce payload.
 *
 * The generated app SDK already unwraps the `{ code, data, traceId }` success
 * envelope before it resolves (`@sdkwork/sdk-common` `processResponse`), so a
 * list call resolves to `{ items, pageInfo }` and a detail call to the record
 * itself. A few block-owned groups (the federated `shops` surface) still hand
 * back the envelope verbatim, so both shapes are accepted here — in one place,
 * instead of in every capability.
 *
 * Reading `.data` unconditionally turned every unwrapped payload into `{}`:
 * the request resolved, the page cleared its loading flag, and the storefront
 * rendered as an unexplained empty page with no error and no retry. That is the
 * regression this module exists to prevent.
 */
import { asRecord, asRecordList, asString, type MpRecord } from "../types/common";

const SUCCESS_CODES: ReadonlyArray<string | number | null | undefined> = [
  0,
  "0",
  200,
  "200",
  2000,
  "2000",
  "success",
];

function isSuccessCode(code: unknown): boolean {
  if (code === null || code === undefined || code === "") {
    return true;
  }
  return SUCCESS_CODES.some((entry) => entry === code || String(entry) === String(code).toLowerCase());
}

/**
 * Normalizes the value a commerce call resolved to.
 *
 * - a list payload stays a record (`items` / `pageInfo`);
 * - a bare array becomes `{ items }` so list readers keep working;
 * - a verbatim success envelope is unwrapped;
 * - a verbatim failure envelope raises its message instead of looking empty.
 */
export function normalizeCommercePayload(value: unknown): MpRecord {
  if (Array.isArray(value)) {
    return { items: asRecordList(value) };
  }
  const record = asRecord(value);
  // A list/detail payload owns business fields; a wrapper owns `data` (and
  // usually `code`). Checking the business fields first keeps a DTO that happens
  // to carry a `data`/`code` member from being mistaken for an envelope.
  const ownsPayloadFields =
    "items" in record || "content" in record || "id" in record || "pageInfo" in record;
  if (!("data" in record) || ownsPayloadFields) {
    return record;
  }
  if ("code" in record && !isSuccessCode(record.code)) {
    throw new Error(asString(record, ["message", "msg", "detail", "title"], "请求失败"));
  }
  const data = record.data;
  return Array.isArray(data) ? { items: asRecordList(data) } : asRecord(data);
}

/** Awaits one commerce call and returns its normalized payload. */
export async function readCommercePayload(call: Promise<unknown>): Promise<MpRecord> {
  return normalizeCommercePayload(await call);
}
