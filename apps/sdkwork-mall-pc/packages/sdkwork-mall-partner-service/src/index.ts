/**
 * `@sdkwork/mall-partner-service` — the mall's headless distribution domain.
 *
 * Layer boundary: UI packages depend on this package's models, pure helpers and
 * service interface; only `createSdkworkPartnerJoinPort` touches the composed
 * partner app SDK. No React, no DOM, no raw HTTP.
 */
export * from "./partner-types.ts";
export * from "./partner-domain.ts";
export * from "./partner-sdk-port.ts";
export * from "./partner-service.ts";
export * from "./partner-controller.ts";
