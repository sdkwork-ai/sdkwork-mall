import type {
  SdkworkAuthAppearanceConfig,
  SdkworkAuthHeaderSlotProps,
} from "@sdkwork/auth-pc-react";
import { ShoppingBag } from "lucide-react";

/**
 * Header rendered above every IAM auth screen (login, register, recovery).
 *
 * The shared IAM auth surface is desktop-first: its default header is a large
 * marketing title and nothing identifies the product. On the H5 storefront the
 * login screen is the first screen of the app, so it carries the storefront
 * brand mark above the flow title — the same order a native mall app uses.
 */
function SdkworkMallAuthHeader({
  badge,
  className,
  description,
  style,
  title,
}: SdkworkAuthHeaderSlotProps) {
  return (
    <div className={className} style={style}>
      <div className="sdk-mall-auth-brand">
        <span aria-hidden="true" className="sdk-mall-auth-brand-mark">
          <ShoppingBag size={20} strokeWidth={2} />
        </span>
        <span className="sdk-mall-auth-brand-name">SDKWork 商城</span>
      </div>
      {badge}
      {title}
      {description}
    </div>
  );
}

/**
 * Appearance of the IAM auth surface on the H5 storefront.
 *
 * Layout is owned by the `.sdk-mall-auth-*` rules in `src/index.css` (mobile
 * viewport: single column, full-bleed, safe-area aware); this configuration
 * only binds those class names and supplies the commerce design tokens so the
 * shared surface does not fall back to its red/desktop defaults.
 */
export function createSdkworkMallH5AuthAppearance(): SdkworkAuthAppearanceConfig {
  return {
    bodyClassName: "sdk-mall-auth-body",
    contentContainerClassName: "sdk-mall-auth-content",
    descriptionClassName: "sdk-mall-auth-description",
    headerClassName: "sdk-mall-auth-header",
    pageClassName: "sdk-mall-auth-page",
    shellClassName: "sdk-mall-auth-shell",
    slotProps: {
      // A phone cannot scan its own screen, and the desktop aside column
      // (QR rail / marketing highlights) would push the form below the fold.
      asideContainer: {
        className: "sdk-mall-auth-aside",
        style: { display: "none" },
      },
      background: { className: "sdk-mall-auth-background" },
    },
    slots: { Header: SdkworkMallAuthHeader },
    theme: {
      contentTextColor: "#111827",
      descriptionColor: "#6b7280",
      dividerColor: "rgba(17, 24, 39, 0.08)",
      fieldBackgroundColor: "#f3f4f6",
      fieldBorderColor: "transparent",
      fieldPlaceholderColor: "#9ca3af",
      fieldTextColor: "#111827",
      formMutedTextColor: "#6b7280",
      iconMutedColor: "#9ca3af",
      labelColor: "#374151",
      pageBackgroundColor: "#f5f6f8",
      shellBackgroundColor: "#ffffff",
      shellBorderColor: "transparent",
      tabActiveBackgroundColor: "transparent",
      tabActiveTextColor: "#2563eb",
      tabBackgroundColor: "transparent",
      tabInactiveTextColor: "#6b7280",
      titleColor: "#111827",
      validationMessageColor: "#b91c1c",
    },
    titleClassName: "sdk-mall-auth-title",
  };
}
