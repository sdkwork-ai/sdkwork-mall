/**
 * Minimal type surface for the `qrcode` core encoder.
 *
 * The published package ships JavaScript only; the storefront imports the pure
 * core (`qrcode/lib/core/qrcode`) so no canvas, DOM or Node built-in is pulled into
 * the mini-program bundle.
 */
declare module "qrcode/lib/core/qrcode.js" {
  export function create(
    text: string,
    options?: { errorCorrectionLevel?: "L" | "M" | "Q" | "H"; version?: number },
  ): { modules: { size: number; data: Uint8Array } };
}
