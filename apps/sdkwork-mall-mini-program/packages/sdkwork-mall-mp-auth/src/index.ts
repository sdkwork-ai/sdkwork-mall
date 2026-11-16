/**
 * `@sdkwork/mall-mp-auth` public surface.
 *
 * One capability owns sign-in, sign-out and cold-launch session recovery. The
 * login page consumes this service; it never talks to the IAM SDK or platform
 * login API directly.
 */
export * from "./services/auth-service";
