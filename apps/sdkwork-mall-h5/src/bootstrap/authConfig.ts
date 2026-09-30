import type { CSSProperties } from "react";
import type { SdkworkAuthRuntimeConfig } from "@sdkwork/auth-pc-react";

export interface SdkworkMallH5AuthAppearanceConfig {
  asidePanelClassName?: string;
  asidePanelStyle?: CSSProperties;
  bodyClassName?: string;
  contentContainerClassName?: string;
  pageClassName?: string;
  qrFrameClassName?: string;
  shellClassName?: string;
  slotProps?: {
    asidePanel?: { className?: string; style?: CSSProperties };
    background?: { className?: string };
    page?: { className?: string };
    shell?: { className?: string };
  };
  theme?: Record<string, string>;
}

export type SdkworkMallH5AuthRuntimeConfig = SdkworkAuthRuntimeConfig;
const COMMERCE_VERIFICATION_POLICY = {
  emailCodeLoginEnabled: true,
  emailRegistrationVerificationRequired: false,
  phoneCodeLoginEnabled: true,
  phoneRegistrationVerificationRequired: false,
};

export function resolveSdkworkMallH5AuthRuntimeConfig(): SdkworkMallH5AuthRuntimeConfig {
  return {
    leftRailMode: "qr-only",
    loginMethods: ["password", "emailCode", "phoneCode"],
    oauthLoginEnabled: false,
    oauthProviders: [],
    qrLoginEnabled: true,
    recoveryMethods: ["email", "phone"],
    registerMethods: ["email", "phone"],
    verificationPolicy: COMMERCE_VERIFICATION_POLICY,
  };
}

export function resolveSdkworkMallH5AuthAppearance(): SdkworkMallH5AuthAppearanceConfig {
  return {
    asidePanelClassName: "sdkwork-mall-h5-auth-aside-panel",
    asidePanelStyle: {
      backgroundColor: "#f8fafc",
      backgroundImage: "linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)",
      color: "#0f172a",
    },
    bodyClassName: "sdkwork-mall-h5-auth-body",
    contentContainerClassName: "sdkwork-mall-h5-auth-content",
    pageClassName: "sdkwork-mall-h5-auth-page",
    qrFrameClassName: "sdkwork-mall-h5-auth-qr-frame",
    shellClassName: "sdkwork-mall-h5-auth-card-shell",
    slotProps: {
      asidePanel: {
        style: {
          backgroundColor: "#f8fafc",
          backgroundImage: "linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)",
          color: "#0f172a",
        },
      },
      background: {
        className: "sdkwork-mall-h5-auth-background",
      },
      page: {
        className: "sdkwork-mall-h5-auth-page",
      },
      shell: {
        className: "sdkwork-mall-h5-auth-card-shell",
      },
    },
  };
}

export function resolveSdkworkMallH5AuthLocale(defaultLocale: string): string {
  return defaultLocale;
}
