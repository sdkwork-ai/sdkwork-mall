import type { SdkworkAuthRuntimeConfig } from "@sdkwork/auth-pc-react";

export type SdkworkMallH5AuthRuntimeConfig = SdkworkAuthRuntimeConfig;

/**
 * Commerce verification policy: buyer accounts are created from a verified
 * email or phone, so registration always carries a verification challenge.
 * Both channels are enabled so either identifier can complete the flow.
 */
const COMMERCE_VERIFICATION_POLICY = {
  emailCodeLoginEnabled: true,
  emailRegistrationVerificationRequired: false,
  phoneCodeLoginEnabled: true,
  phoneRegistrationVerificationRequired: false,
};

/**
 * IAM auth runtime configuration for the H5 storefront.
 *
 * QR login is a desktop affordance (a phone cannot scan its own screen), so the
 * surface runs without the QR rail and renders only the account flows. The rail
 * mode stays explicit so the shared surface never falls back to its `qr-only`
 * default when this config is absent from an embedding host.
 */
export function resolveSdkworkMallH5AuthRuntimeConfig(): SdkworkMallH5AuthRuntimeConfig {
  return {
    leftRailMode: "highlights-only",
    loginMethods: ["password", "emailCode", "phoneCode"],
    oauthLoginEnabled: false,
    oauthProviders: [],
    qrLoginEnabled: false,
    recoveryMethods: ["email", "phone"],
    registerMethods: ["email", "phone"],
    verificationPolicy: COMMERCE_VERIFICATION_POLICY,
  };
}

export function resolveSdkworkMallH5AuthLocale(defaultLocale: string): string {
  return defaultLocale;
}
