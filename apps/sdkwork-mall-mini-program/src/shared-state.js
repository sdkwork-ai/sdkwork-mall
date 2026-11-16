/**
 * Cross-bundle shared state.
 *
 * The mini-program caches modules per appservice context, so this file is one
 * instance shared by the app bundle and every page bundle. The bundler injects a
 * `require` of this file (with the correct relative path) into each bundle, and
 * `@sdkwork/mall-mp-host`'s scope resolver uses it for the runtime, host profile
 * and IM services: the platform globals are not reliably writable (`wx` may be a
 * read-only proxy, `getApp().globalData` may not exist during the first bundle
 * evaluation, and `globalThis` is not guaranteed).
 */
module.exports = {};
