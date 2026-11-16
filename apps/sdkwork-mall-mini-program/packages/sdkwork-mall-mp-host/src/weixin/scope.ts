/**
 * WeChat profile scope helper (re-exported from the host root).
 *
 * Kept as its own module so the profile adapters import a sibling path without a
 * cycle through `../index`.
 */
export {
  resolveGlobalObject,
  resolvePlatformScope,
  resolveSharedScope,
  type MpPlatformScope,
} from "../scope";
