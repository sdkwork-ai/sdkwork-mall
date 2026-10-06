import { describe, expect, it } from "vitest";

import { sha256Hex, sha256HexOfString } from "../src/utils/sha256";
import {
  buildUploaderPrepareBody,
  formatDriveImageUri,
  type MpUploadDeclaration,
} from "../src/services/drive-upload-service";

const DECLARATION: MpUploadDeclaration = {
  appResourceIdKind: "application",
  appResourceType: "mall.after-sales-evidence",
  purpose: "test",
  retention: "long_term",
  scene: "after-sales-evidence",
  source: "sdkwork-mall-mini-program",
  uploadProfileCode: "image",
};

describe("sha256Hex", () => {
  it("matches the FIPS 180-4 test vectors", () => {
    expect(sha256Hex(new Uint8Array(0))).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(sha256HexOfString("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(sha256HexOfString("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")).toBe(
      "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
    );
  });
});

describe("buildUploaderPrepareBody", () => {
  it("carries the declaration and file identity per the drive wire contract", () => {
    const bytes = new TextEncoder().encode("evidence-bytes");
    const body = buildUploaderPrepareBody({
      declaration: DECLARATION,
      appResourceId: "after-sales-evidence",
      file: { fileName: "evidence.jpg", contentType: "image/jpeg", bytes },
    });
    expect(body.appResourceType).toBe("mall.after-sales-evidence");
    expect(body.appResourceId).toBe("after-sales-evidence");
    expect(body.scene).toBe("after-sales-evidence");
    expect(body.source).toBe("sdkwork-mall-mini-program");
    expect(body.uploadProfileCode).toBe("image");
    expect(body.retention).toEqual({ mode: "long_term" });
    expect(body.originalFileName).toBe("evidence.jpg");
    expect(body.contentType).toBe("image/jpeg");
    expect(body.contentLength).toBe(String(bytes.byteLength));
    expect(body.fileFingerprint).toContain("evidence.jpg");
    // FIPS vector for "evidence-bytes"
    expect(body.checksumSha256Hex).toBe(sha256Hex(bytes));
  });
});

describe("formatDriveImageUri", () => {
  it("renders the persist-safe drive reference", () => {
    expect(formatDriveImageUri("space-upload", "node-1005")).toBe(
      "drive://spaces/space-upload/nodes/node-1005",
    );
  });
});
