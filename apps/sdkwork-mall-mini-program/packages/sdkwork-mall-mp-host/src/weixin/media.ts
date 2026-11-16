/**
 * Media picker adapter (`wx.chooseMedia` + `FileSystemManager.readFile`).
 *
 * Authority: `MINI_PROGRAM_APP_ARCHITECTURE_SPEC.md` section 8 (`mediaPicker`).
 * The host only selects and reads bytes; the Drive uploader facade owns the
 * upload itself, so this adapter never learns an endpoint.
 */
import {
  createMpHostError,
  normalizeMpHostError,
  type MpChosenImage,
  type MpMediaPicker,
} from "../index";

export interface WxMediaApi {
  chooseMedia(options: {
    count: number;
    fail?(result: { errMsg?: string }): void;
    mediaType: Array<"image" | "video">;
    sizeType?: Array<"original" | "compressed">;
    sourceType?: Array<"album" | "camera">;
    success?(result: { tempFiles: Array<{ fileType?: string; size?: number; tempFilePath?: string }> }): void;
  }): void;
  getFileSystemManager(): {
    readFile(options: {
      encoding?: "ascii" | "binary" | "base64" | "utf8";
      fail?(result: { errMsg?: string }): void;
      filePath: string;
      success?(result: { data: unknown }): void;
    }): void;
  };
}

function contentTypeFromPath(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) {
    return "image/png";
  }
  if (lower.endsWith(".webp")) {
    return "image/webp";
  }
  if (lower.endsWith(".gif")) {
    return "image/gif";
  }
  return "image/jpeg";
}

export function createWeixinMediaPicker(api: WxMediaApi): MpMediaPicker {
  return {
    chooseImages({ maxCount, maxSizeBytes }) {
      return new Promise<MpChosenImage[]>((resolve, reject) => {
        api.chooseMedia({
          count: Math.max(1, maxCount),
          mediaType: ["image"],
          sourceType: ["album", "camera"],
          success(result) {
            const files = Array.isArray(result.tempFiles) ? result.tempFiles : [];
            const chosen: MpChosenImage[] = [];
            for (const file of files) {
              const path = typeof file.tempFilePath === "string" ? file.tempFilePath : "";
              if (!path) {
                continue;
              }
              const sizeBytes = typeof file.size === "number" ? file.size : 0;
              if (sizeBytes > maxSizeBytes) {
                reject(createMpHostError("invalid-state", `单张图片不能超过 ${Math.round(maxSizeBytes / 1024 / 1024)}MB`));
                return;
              }
              chosen.push({ path, sizeBytes, contentType: contentTypeFromPath(path) });
            }
            resolve(chosen);
          },
          fail: (failure) => reject(normalizeMpHostError(failure)),
        });
      });
    },

    readBytes(path) {
      return new Promise<ArrayBuffer>((resolve, reject) => {
        api.getFileSystemManager().readFile({
          filePath: path,
          success(result) {
            if (result.data instanceof ArrayBuffer) {
              resolve(result.data);
              return;
            }
            reject(createMpHostError("invalid-state", "读取图片失败"));
          },
          fail: (failure) => reject(normalizeMpHostError(failure)),
        });
      });
    },
  };
}
