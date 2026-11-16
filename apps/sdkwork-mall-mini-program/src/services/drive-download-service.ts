/**
 * Drive download grants for the mini-program.
 *
 * Authority: `DRIVE_SPEC.md` section 9 (downloads) and section 10 (persisted
 * `drive://` references). A stored node is not readable directly: the app
 * exchanges the node id for a short-lived signed URL, exactly the way uploads
 * exchange a session for a presigned part.
 *
 * This is the read counterpart of `drive-upload-service.ts`, and it is injected
 * into the messaging capability so chat rendering owns no storage flow.
 */
import { request } from "./transport";

/**
 * Exchanges one Drive node for a short-lived signed download URL.
 *
 * @param nodeId - Drive node the media message references.
 * @returns The signed URL to render.
 */
export async function createDriveDownloadGrant(nodeId: string): Promise<string> {
  const payload = await request({
    path: `/drive/nodes/${encodeURIComponent(nodeId)}/download_grants`,
    method: "POST",
    body: {},
  });
  const url = String(payload.downloadUrl ?? payload.signedSourceUrl ?? "");
  if (!url) {
    throw new Error("存储下载地址获取失败");
  }
  return url;
}
