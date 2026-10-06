/**
 * Host-injectable media runtime port for the H5 after-sales evidence surface.
 *
 * Evidence images are uploaded by the host through the platform drive
 * uploader (the standard community/company port pattern:
 * `uploader.uploadImage` → `drive://` URL); each evidence snapshot item then
 * carries the backend-addressable reference alongside its declared file
 * metadata (`evidenceSnapshot` is a free-form array, so the reference rides
 * without a backend change). Hosts without a drive client leave the port
 * unconfigured; the evidence picker refuses with a hint instead of
 * persisting a local blob:/data URL — that would be a fake upload
 * (`DRIVE_SPEC.md` §18).
 */

export interface MallH5AfterSalesMediaRuntimePort {
  /** Uploads images and returns their backend-addressable references. */
  uploadImages(files: File[]): Promise<string[]>;
  /**
   * Transient display URL for a stored reference (drive:// URIs need a
   * bounded host-side read; blob/object URLs resolve to themselves).
   * Optional: hosts that never store drive-backed evidence may omit it.
   */
  resolveDisplayUrl?(reference: string): Promise<string | null>;
}

let mediaRuntimePort: MallH5AfterSalesMediaRuntimePort | null = null;

export function configureMallH5AfterSalesMediaRuntimePort(
  port: MallH5AfterSalesMediaRuntimePort,
): void {
  mediaRuntimePort = port;
}

export function resetMallH5AfterSalesMediaRuntimePort(): void {
  mediaRuntimePort = null;
}

export function isMallH5AfterSalesMediaRuntimeConfigured(): boolean {
  return mediaRuntimePort !== null;
}

export function getMallH5AfterSalesMediaRuntime(): MallH5AfterSalesMediaRuntimePort {
  if (!mediaRuntimePort) {
    throw new Error(
      "mall h5 after-sales media runtime port is not configured: the host must inject a drive-backed " +
        "image uploader via configureMallH5AfterSalesMediaRuntimePort before uploading evidence",
    );
  }
  return mediaRuntimePort;
}
