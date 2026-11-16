/**
 * Generates the buyer-page line icons as plain PNGs.
 *
 * The mini program has no icon component library (H5 uses lucide), so the icons
 * are pre-rendered once and shipped as assets. Pure Node: a minimal PNG encoder
 * (zlib + CRC) and a handful of geometric glyphs keep the output deterministic and
 * reviewable, and `image` renders PNGs on every base library.
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SIZE = 64;
const COLOR = { r: 0xe9, g: 0x3b, b: 0x3d };
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/assets/icons");

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

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng(pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(SIZE, 0);
  header.writeUInt32BE(SIZE, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
  for (let y = 0; y < SIZE; y += 1) {
    raw[y * (SIZE * 4 + 1)] = 0;
    pixels.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function canvas() {
  const buffer = Buffer.alloc(SIZE * SIZE * 4);
  const set = (x, y) => {
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) {
      return;
    }
    const offset = (y * SIZE + x) * 4;
    buffer[offset] = COLOR.r;
    buffer[offset + 1] = COLOR.g;
    buffer[offset + 2] = COLOR.b;
    buffer[offset + 3] = 0xff;
  };
  const alphaZero = (offset) => { buffer[offset + 3] = 0; };
  return { buffer, set, alphaZero };
}

function rect(set, x, y, w, h) {
  for (let py = y; py < y + h; py += 1) {
    for (let px = x; px < x + w; px += 1) {
      set(px, py);
    }
  }
}

function ring(set, cx, cy, radius, thickness) {
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const distance = Math.hypot(x - cx, y - cy);
      if (distance <= radius && distance >= radius - thickness) {
        set(x, y);
      }
    }
  }
}

function disc(set, cx, cy, radius) {
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      if (Math.hypot(x - cx, y - cy) <= radius) {
        set(x, y);
      }
    }
  }
}

function line(set, x1, y1, x2, y2, thickness = 4) {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
  for (let step = 0; step <= steps; step += 1) {
    const t = steps === 0 ? 0 : step / steps;
    const cx = Math.round(x1 + (x2 - x1) * t);
    const cy = Math.round(y1 + (y2 - y1) * t);
    disc(set, cx, cy, thickness / 2);
  }
}

function strokeRect(set, x, y, w, h, t = 4) {
  line(set, x, y, x + w, y, t);
  line(set, x + w, y, x + w, y + h, t);
  line(set, x + w, y + h, x, y + h, t);
  line(set, x, y + h, x, y, t);
}

const ICONS = {
  wallet: (set) => {
    strokeRect(set, 10, 18, 44, 30);
    line(set, 10, 26, 54, 26, 3);
    strokeRect(set, 34, 32, 20, 10, 3);
    disc(set, 40, 37, 2.5);
  },
  star: (set) => {
    const points = [];
    for (let i = 0; i < 10; i += 1) {
      const radius = i % 2 === 0 ? 22 : 9;
      const angle = -Math.PI / 2 + (i * Math.PI) / 5;
      points.push([32 + radius * Math.cos(angle), 32 + radius * Math.sin(angle)]);
    }
    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
          const [xi, yi] = points[i];
          const [xj, yj] = points[j];
          if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
            inside = !inside;
          }
        }
        if (inside) set(x, y);
      }
    }
  },
  crown: (set) => {
    for (let x = 10; x <= 54; x += 1) {
      for (let y = 20; y <= 46; y += 1) {
        const top = 18 + Math.abs(((x - 10) % 15) - 7) * 1.8;
        if (y >= top) set(x, y);
      }
    }
    line(set, 10, 50, 54, 50, 4);
  },
  heart: (set) => {
    disc(set, 23, 26, 11);
    disc(set, 41, 26, 11);
    for (let y = 20; y < 54; y += 1) {
      const half = Math.max(0, 22 - (y - 26) * 1.1);
      for (let x = Math.round(32 - half); x <= Math.round(32 + half); x += 1) set(x, y);
    }
  },
  clock: (set) => {
    ring(set, 32, 32, 22, 4);
    line(set, 32, 32, 32, 20, 4);
    line(set, 32, 32, 42, 36, 4);
  },
  pin: (set) => {
    ring(set, 32, 25, 15, 4);
    line(set, 24, 36, 32, 54, 4);
    line(set, 40, 36, 32, 54, 4);
    disc(set, 32, 25, 4);
  },
  ticket: (set) => {
    strokeRect(set, 8, 16, 48, 32);
    line(set, 30, 22, 30, 42, 3);
  },
  file: (set) => {
    strokeRect(set, 16, 10, 32, 44);
    line(set, 24, 22, 40, 22, 3);
    line(set, 24, 30, 40, 30, 3);
    line(set, 24, 38, 34, 38, 3);
  },
  receipt: (set) => {
    strokeRect(set, 16, 8, 32, 40);
    line(set, 24, 20, 40, 20, 3);
    line(set, 24, 28, 40, 28, 3);
    line(set, 24, 36, 34, 36, 3);
    for (let x = 16; x < 48; x += 8) {
      line(set, x, 48, x + 4, 56, 3);
      line(set, x + 4, 56, x + 8, 48, 3);
    }
  },
  chat: (set) => {
    strokeRect(set, 10, 12, 44, 30, 4);
    line(set, 22, 42, 22, 54, 4);
    line(set, 22, 54, 38, 42, 4);
  },
  headset: (set) => {
    for (let y = 8; y < 32; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        const distance = Math.hypot(x - 32, y - 32);
        if (distance <= 22 && distance >= 18) set(x, y);
      }
    }
    strokeRect(set, 8, 30, 9, 18, 3);
    strokeRect(set, 47, 30, 9, 18, 3);
  },
  box: (set) => {
    line(set, 32, 10, 54, 24, 4);
    line(set, 32, 10, 10, 24, 4);
    line(set, 10, 24, 10, 44, 4);
    line(set, 54, 24, 54, 44, 4);
    line(set, 10, 44, 32, 56, 4);
    line(set, 54, 44, 32, 56, 4);
    line(set, 32, 32, 32, 56, 3);
  },
  truck: (set) => {
    strokeRect(set, 8, 24, 26, 18);
    strokeRect(set, 34, 30, 16, 12);
    ring(set, 20, 46, 6, 3);
    ring(set, 44, 46, 6, 3);
    line(set, 34, 24, 34, 30, 3);
  },
  check: (set) => {
    line(set, 16, 34, 28, 46, 7);
    line(set, 28, 46, 50, 18, 7);
  },
  package: (set) => {
    strokeRect(set, 12, 16, 40, 34);
    line(set, 12, 26, 52, 26, 3);
    line(set, 32, 16, 32, 50, 3);
    disc(set, 32, 26, 3);
  },
};

mkdirSync(OUT, { recursive: true });
for (const [name, draw] of Object.entries(ICONS)) {
  const { buffer, set, alphaZero } = canvas();
  void alphaZero;
  draw(set);
  writeFileSync(path.join(OUT, `${name}.png`), encodePng(buffer));
}
console.log(`[icons] wrote ${Object.keys(ICONS).length} icons into src/assets/icons`);
