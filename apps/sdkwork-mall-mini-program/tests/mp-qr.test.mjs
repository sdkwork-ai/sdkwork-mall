/**
 * QR guard: the partner share code must be a real, scannable-by-construction code.
 *
 * The matrix comes from the `qrcode` core encoder and is rasterised by our own
 * 1-bit PNG writer (no canvas, no compressor). This test checks the properties a
 * scanner relies on — finder patterns, timing pattern, palette PNG with the right
 * dimensions — so a regression in either half fails the gate.
 */
import { strict as assert } from "node:assert";
import { test } from "node:test";

import { buildQrDataUri, buildQrMatrix } from "../src/utils/qr-code.ts";

function decodeDataUri(uri) {
  const [prefix, base64] = uri.split(",");
  assert.equal(prefix, "data:image/png;base64");
  return Buffer.from(base64, "base64");
}

test("the QR matrix keeps the three finder patterns and the timing row", () => {
  const matrix = buildQrMatrix("https://shop.sdkwork.com/product/1001?invite=ABC123");
  assert.ok(matrix.size >= 21 && matrix.size <= 45, `unexpected QR size ${matrix.size}`);

  // Finder pattern: dark 7x7 ring with a light 3x3 core, at each corner.
  const checkFinder = (originX, originY) => {
    for (let y = 0; y < 7; y += 1) {
      for (let x = 0; x < 7; x += 1) {
        const onBorder = x === 0 || y === 0 || x === 6 || y === 6;
        const inCore = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        assert.equal(matrix.isDark(originX + x, originY + y), onBorder || inCore, `finder at ${originX},${originY}`);
      }
    }
  };
  checkFinder(0, 0);
  checkFinder(matrix.size - 7, 0);
  checkFinder(0, matrix.size - 7);

  // Timing pattern alternates between the top-left and top-right finders.
  for (let x = 8; x < matrix.size - 8; x += 1) {
    assert.equal(matrix.isDark(x, 6), x % 2 === 0, `timing module at x=${x}`);
  }
});

test("the QR PNG is a palette image sized to the matrix", () => {
  const scale = 5;
  const quiet = 4;
  const matrix = buildQrMatrix("https://shop.sdkwork.com/product/42?invite=TEAM01");
  const png = decodeDataUri(buildQrDataUri("https://shop.sdkwork.com/product/42?invite=TEAM01", { scale, quiet }));
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  const expected = (matrix.size + quiet * 2) * scale;
  assert.equal(width, expected);
  assert.equal(height, expected);
  assert.equal(png[24], 1, "bit depth");
  assert.equal(png[25], 3, "palette colour type");
  assert.ok(png.includes(Buffer.from("PLTE", "ascii")));
  assert.ok(png.includes(Buffer.from("IEND", "ascii")));
});

test("a longer payload still fits the byte-mode encoder", () => {
  const link = "https://shop.sdkwork.com/product/1001?invite=" + "A".repeat(96);
  const matrix = buildQrMatrix(link);
  assert.ok(matrix.size > 33, "payload growth must grow the symbol");
});
