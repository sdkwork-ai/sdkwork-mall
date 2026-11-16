/**
 * `@sdkwork/mall-mp-core` public surface.
 *
 * Runtime composition, session/token context, generated SDK client factories and
 * the commerce request seam. Business capabilities depend on this package; this
 * package depends only on `@sdkwork/mall-mp-host` and generated app SDKs.
 */
export * from "./composition/index";
export * from "./host/index";
export * from "./modules/index";
export * from "./platform/index";
export * from "./request/index";
export * from "./runtime/index";
export * from "./sdk/index";
export * from "./session/index";
