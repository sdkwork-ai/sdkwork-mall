/**
 * Share-card builders for the mini-program.
 *
 * Every shareable page produces its card through this module so the restored
 * path always goes through `routes/capabilities.ts` (a renamed page is a
 * one-line registry change, never a broken share link) and so the fallback copy
 * stays consistent.
 *
 * WeChat restores a shared card by re-opening the `path` (friend/group share)
 * or by re-launching the timeline entry with `query` appended to the page path.
 */
import { t } from "../i18n";
import { mpCapabilityUrl } from "../routes/capabilities";

export interface MpShareCard {
  imageUrl?: string;
  /** Absolute page path with query, e.g. `/pages/product/index?id=42`. */
  path: string;
  title: string;
}

export interface MpTimelineCard {
  imageUrl?: string;
  /** Query string only — the timeline entry already points at the page. */
  query: string;
  title: string;
}

export interface MpShareInput {
  /** Localized page-specific title; the fallback is used when empty. */
  title?: string;
  /** Absolute https image URL; omitted when the page has no artwork. */
  imageUrl?: string;
  /** Query parameters restored with the card. */
  query?: Record<string, string | number | undefined>;
  /** Capability route id the card returns to. */
  routeId: string;
}

function queryString(query?: Record<string, string | number | undefined>): string {
  const pairs: string[] = [];
  for (const key of Object.keys(query ?? {})) {
    const value = (query ?? {})[key];
    if (value === undefined || value === null || value === "") {
      continue;
    }
    pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return pairs.join("&");
}

/** Default card title; brand-level copy shared by every surface. */
export function mpShareFallbackTitle(): string {
  return t("share.mallTitle");
}

/**
 * Builds the friend/group share card for a capability route.
 *
 * @param input - Card copy plus the capability route to restore.
 * @returns `{ title, path, imageUrl }` ready for `onShareAppMessage`.
 */
export function buildMpShareCard(input: MpShareInput): MpShareCard {
  const card: MpShareCard = {
    path: mpCapabilityUrl(input.routeId, input.query),
    title: input.title || mpShareFallbackTitle(),
  };
  if (input.imageUrl) {
    card.imageUrl = input.imageUrl;
  }
  return card;
}

/**
 * Builds the timeline (朋友圈) card for a capability route.
 *
 * @param input - Card copy plus the capability route to restore.
 * @returns `{ title, query, imageUrl }` ready for `onShareTimeline`.
 */
export function buildMpTimelineCard(input: MpShareInput): MpTimelineCard {
  const card: MpTimelineCard = {
    query: queryString(input.query),
    title: input.title || mpShareFallbackTitle(),
  };
  if (input.imageUrl) {
    card.imageUrl = input.imageUrl;
  }
  return card;
}
