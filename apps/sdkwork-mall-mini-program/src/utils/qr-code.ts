/**
 * QR rendering without a canvas dependency.
 *
 * The mini program has no canvas context on this host profile and the buyers must
 * be able to show a scannable code on screen, so the matrix produced by the
 * `qrcode` core encoder is rasterised into a tiny 1-bit palette PNG (deflate
 * "stored" blocks, no compressor needed) and rendered through `image`.
 *
 * H5 uses the same matrix/PNG helpers, so both roots scan identically.
 */
import { create as createQrSymbol } from "qrcode/lib/core/qrcode.js";

export interface QrMatrix {
  size: number;
  /** `true` = dark module. */
  isDark: (x: number, y: number) => boolean;
}

export interface QrPngOptions {
  /** Pixels per module. 4–6 keeps the code under ~60 KB of base64. */
  scale?: number;
  /** Quiet zone in modules (spec minimum is 4). */
  quiet?: number;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (const byte of bytes) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    merged.set(part, offset);
    offset += part.length;
  }
  return merged;
}

function u32(value: number): Uint8Array {
  return new Uint8Array([(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]);
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const typed = new Uint8Array([...type].map((char) => char.charCodeAt(0)));
  return concat([u32(data.length), typed, data, u32(crc32(concat([typed, data])))]);
}

/** zlib stream built from deflate "stored" blocks (level 0), no compression. */
function zlibStored(raw: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [new Uint8Array([0x78, 0x01])];
  const MAX = 0xffff;
  for (let offset = 0; offset < raw.length; offset += MAX) {
    const length = Math.min(MAX, raw.length - offset);
    const final = offset + length >= raw.length ? 1 : 0;
    parts.push(
      new Uint8Array([
        final,
        length & 0xff,
        (length >>> 8) & 0xff,
        ~length & 0xff,
        (~length >>> 8) & 0xff,
      ]),
    );
    parts.push(raw.subarray(offset, offset + length));
  }
  parts.push(u32(adler32(raw)));
  return concat(parts);
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + CHUNK));
  }
  // The bundle banner installs `btoa` for every platform (the appservice lacks it).
  return btoa(binary);
}

/** Encodes `text` into a QR matrix (byte mode, error correction M). */
export function buildQrMatrix(text: string): QrMatrix {
  const symbol = createQrSymbol(text, { errorCorrectionLevel: "M" }) as {
    modules: { size: number; data: Uint8Array };
  };
  const { size, data } = symbol.modules;
  return {
    isDark: (x: number, y: number) => data[y * size + x] !== 0,
    size,
  };
}

/** Rasterises a matrix into a `data:image/png;base64,…` URI (2-colour palette). */
export function renderQrPng(matrix: QrMatrix, options: QrPngOptions = {}): string {
  const scale = options.scale ?? 5;
  const quiet = options.quiet ?? 4;
  const modules = matrix.size + quiet * 2;
  const pixels = modules * scale;

  const ihdr = concat([
    u32(pixels),
    u32(pixels),
    new Uint8Array([1, 3, 0, 0, 0]), // 1-bit palette
  ]);
  const plte = new Uint8Array([0, 0, 0, 255, 255, 255]);
  const rows: Uint8Array[] = [];
  const bytesPerRow = Math.ceil(pixels / 8);
  for (let py = 0; py < pixels; py += 1) {
    const row = new Uint8Array(bytesPerRow + 1);
    const moduleY = Math.floor(py / scale) - quiet;
    for (let px = 0; px < pixels; px += 1) {
      const moduleX = Math.floor(px / scale) - quiet;
      const dark = moduleY >= 0 && moduleX >= 0 && moduleY < matrix.size && moduleX < matrix.size && matrix.isDark(moduleX, moduleY);
      if (dark) {
        row[1 + (px >> 3)] |= 0x80 >> (px & 7);
      }
    }
    rows.push(row);
  }
  const zlib = zlibStored(concat(rows));
  const png = concat([
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("PLTE", plte),
    chunk("IDAT", zlib),
    chunk("IEND", new Uint8Array()),
  ]);
  return `data:image/png;base64,${toBase64(png)}`;
}

/** Convenience: text → data URI. */
export function buildQrDataUri(text: string, options: QrPngOptions = {}): string {
  return renderQrPng(buildQrMatrix(text), options);
}
