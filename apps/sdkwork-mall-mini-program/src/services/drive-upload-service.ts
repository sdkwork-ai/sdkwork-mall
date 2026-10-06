/**
 * Drive uploader dev-contract flow for the mini-program.
 *
 * Mirrors the composed H5/PC uploader over the MP transport seam:
 * prepare → presigned part → raw storage PUT (ETag) → part registration →
 * session completion. The wire shapes follow the drive app-api
 * (`DRIVE_SPEC.md` §9); the resulting `drive://spaces/{spaceId}/nodes/{nodeId}`
 * reference is what business payloads persist (`DRIVE_SPEC.md` §10).
 *
 * The pure helpers (`buildUploaderPrepareBody`, `formatDriveImageUri`) are
 * exported separately so the wire contract stays unit-testable without
 * transport. Requires an upload declaration value from
 * `upload.declaration.json` (kebab-case dotted `appResourceType`).
 */
import { request, rawRequest } from "./transport";
import { sha256Hex } from "../utils/sha256";

export interface MpUploadDeclaration {
  appResourceIdKind: "application" | "entity" | "draft";
  appResourceType: string;
  purpose: string;
  retention: "long_term" | "temporary";
  scene: string;
  source: string;
  uploadProfileCode: string;
}

export interface MpUploadSourceFile {
  fileName: string;
  contentType: string;
  bytes: ArrayBuffer;
}

export interface MpPrepareUploaderBody {
  appResourceId: string;
  appResourceType: string;
  checksumSha256Hex: string;
  chunkSizeBytes: string;
  contentType: string;
  contentLength: string;
  fileFingerprint: string;
  id: string;
  originalFileName: string;
  retention: { mode: "long_term" | "temporary" };
  scene: string;
  source: string;
  taskId: string;
  uploadProfileCode: string;
}

const MP_UPLOAD_CHUNK_SIZE_BYTES = 5 * 1024 * 1024;

/** Pure: builds the `POST /drive/uploader/uploads` body for one file. */
export function buildUploaderPrepareBody(input: {
  declaration: MpUploadDeclaration;
  appResourceId: string;
  file: MpUploadSourceFile;
}): MpPrepareUploaderBody {
  const { declaration, appResourceId, file } = input;
  const fingerprint = `${declaration.source}:${file.fileName}:${file.contentType}:${file.bytes.byteLength}`;
  const taskId = `uploader-${fingerprint}`;
  return {
    appResourceId,
    appResourceType: declaration.appResourceType,
    checksumSha256Hex: sha256Hex(new Uint8Array(file.bytes)),
    chunkSizeBytes: String(MP_UPLOAD_CHUNK_SIZE_BYTES),
    contentType: file.contentType,
    contentLength: String(file.bytes.byteLength),
    fileFingerprint: fingerprint,
    id: `upload-item-${taskId}`,
    originalFileName: file.fileName,
    retention: { mode: declaration.retention },
    scene: declaration.scene,
    source: declaration.source,
    taskId,
    uploadProfileCode: declaration.uploadProfileCode,
  };
}

/** Pure: the persist-safe `drive://` reference (`DRIVE_SPEC.md` §10). */
export function formatDriveImageUri(spaceId: string, nodeId: string): string {
  return `drive://spaces/${spaceId}/nodes/${nodeId}`;
}

function readHeader(header: Record<string, string>, name: string): string {
  const value = header[name.toLowerCase()];
  if (typeof value === "string" && value !== "") {
    return value;
  }
  throw new Error("存储上传响应缺少 ETag");
}

/**
 * Uploads one image through the drive uploader flow and returns the
 * backend-addressable `drive://` reference.
 */
export async function uploadDriveImage(input: {
  declaration: MpUploadDeclaration;
  appResourceId: string;
  file: MpUploadSourceFile;
}): Promise<string> {
  const prepareBody = buildUploaderPrepareBody(input);
  const prepared = await request({
    path: "/drive/uploader/uploads",
    method: "POST",
    body: prepareBody as unknown as Record<string, unknown>,
  });
  const uploadItem = (prepared.uploadItem ?? {}) as Record<string, unknown>;
  const uploadSession = (prepared.uploadSession ?? {}) as Record<string, unknown>;
  const uploadSessionId = String(uploadItem.uploadSessionId ?? uploadSession.id ?? "");
  const spaceId = String(uploadItem.spaceId ?? uploadSession.spaceId ?? "");
  const nodeId = String(uploadItem.nodeId ?? uploadSession.nodeId ?? "");
  if (!uploadSessionId || !spaceId || !nodeId) {
    throw new Error("存储会话创建失败：响应缺少会话标识");
  }

  const presigned = await request({
    path: `/drive/upload_sessions/${uploadSessionId}/parts/1`,
    method: "PUT",
    body: { requestedTtlSeconds: 600 },
  });
  const uploadUrl = String(presigned.uploadUrl ?? "");
  if (!uploadUrl) {
    throw new Error("存储预签名失败：响应缺少 uploadUrl");
  }
  const stored = await rawRequest({
    url: uploadUrl,
    method: "PUT",
    body: input.file.bytes,
    contentType: input.file.contentType,
  });
  const etag = readHeader(stored.header, "etag");

  await request({
    path: `/drive/uploader/uploads/${String(uploadItem.id)}/parts/1`,
    method: "POST",
    body: {
      uploadSessionId,
      offsetBytes: "0",
      sizeBytes: String(input.file.bytes.byteLength),
      etag,
    },
  });

  await request({
    path: `/drive/upload_sessions/${uploadSessionId}/complete`,
    method: "POST",
    body: {
      uploadId: String(uploadSession.storageUploadId ?? ""),
      contentType: input.file.contentType,
      contentLength: String(input.file.bytes.byteLength),
      checksumSha256Hex: prepareBody.checksumSha256Hex,
      parts: [{ partNo: 1, etag }],
    },
  });

  return formatDriveImageUri(spaceId, nodeId);
}
