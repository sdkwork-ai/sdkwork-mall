/**
 * Application upload declaration constants (`DRIVE_SPEC.md` section 18).
 *
 * Authority: `apps/sdkwork-mall-pc/specs/upload.declaration.json`; this module carries the
 * declared values into code so upload call sites reference a constant instead of repeating
 * literals.
 */

export interface SdkworkMallPcUploadDeclarationEntry {
  readonly appResourceIdKind: 'application' | 'entity' | 'draft';
  readonly appResourceType: string;
  readonly purpose: string;
  readonly retention: 'long_term' | 'temporary';
  readonly scene: string;
  readonly source: string;
  readonly uploadProfileCode: string;
}

/** The single call-origin label for every upload from this application. */
export const SDKWORK_MALL_PC_UPLOAD_SOURCE = 'sdkwork-mall-pc' as const;

/**
 * After-sales evidence images uploaded from the buyer after-sales form.
 *
 * `application`-kind scope label: the after-sales request does not exist at
 * upload time (the form uploads before `afterSales.requests.create`), so the
 * id is the stable surface label rather than an entity id. Each evidence
 * snapshot item carries the returned `drive://` reference next to its declared
 * file metadata.
 */
export const SDKWORK_MALL_PC_AFTER_SALES_EVIDENCE_UPLOAD = {
  appResourceIdKind: 'application',
  appResourceType: 'mall.after_sales_evidence',
  purpose: 'After-sales evidence images uploaded to Drive and referenced by the after-sales request snapshot.',
  retention: 'long_term',
  scene: 'after-sales-evidence',
  source: SDKWORK_MALL_PC_UPLOAD_SOURCE,
  uploadProfileCode: 'image',
} as const satisfies SdkworkMallPcUploadDeclarationEntry;

/** Every declared upload purpose for this application. */
export const SDKWORK_MALL_PC_UPLOAD_DECLARATIONS: readonly SdkworkMallPcUploadDeclarationEntry[] = [
  SDKWORK_MALL_PC_AFTER_SALES_EVIDENCE_UPLOAD,
];
