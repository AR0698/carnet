/**
 * Génère les icônes de l'application.
 *
 *   node scripts/make-icons.mjs
 *
 * Le motif est fait de rectangles alignés sur les pixels : une page de cahier
 * (lignes pâles + trait de marge rouge) sur laquelle une phrase est écrite à
 * l'encre iris, débordant sur la marge. Aucune courbe, aucun texte — donc
 * aucun rasterizer ni police à installer, et un rendu net à toutes les tailles.
 *
 * Les couleurs sont celles de `src/ui/tokens.css` : les recopier ici si la
 * palette change.
 */

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

const PAPER = [0xf7, 0xf8, 0xf5];
const GRID = [0xe3, 0xee, 0xe1];
const MARGIN = [0xe8, 0x57, 0x4a];
const IRIS = [0x5b, 0x4f, 0xe8];
const IRIS_SOFT = [0xa1, 0x9b, 0xee]; // iris mélangé au papier

/** Motif de référence, exprimé dans un carré de 512. */
const DESIGN = 512;
const SHAPES = [
  // lignes du cahier — épaisses pour rester lisibles une fois réduites
  ...[132, 228, 324, 420].map((y) => ({ x: 0, y, w: 512, h: 7, color: GRID })),
  // trait de marge
  { x: 136, y: 0, w: 9, h: 512, color: MARGIN },
  // l'écriture, posée sur les lignes : un trait plein qui déborde sur la marge,
  // un plus court dessous. L'ensemble est centré sur le carré.
  { x: 80, y: 186, w: 372, h: 42, color: IRIS },
  { x: 172, y: 282, w: 208, h: 42, color: IRIS_SOFT },
];

function render(size, contentScale) {
  const px = new Uint8Array(size * size * 3);
  for (let i = 0; i < size * size; i++) {
    px[i * 3] = PAPER[0];
    px[i * 3 + 1] = PAPER[1];
    px[i * 3 + 2] = PAPER[2];
  }

  const s = (size / DESIGN) * contentScale;
  const centre = size / 2;
  const map = (v) => Math.round(centre + (v - DESIGN / 2) * s);

  for (const shape of SHAPES) {
    const x0 = Math.max(0, map(shape.x));
    const y0 = Math.max(0, map(shape.y));
    const x1 = Math.min(size, map(shape.x + shape.w));
    const y1 = Math.min(size, map(shape.y + shape.h));
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * size + x) * 3;
        px[i] = shape.color[0];
        px[i + 1] = shape.color[1];
        px[i + 2] = shape.color[2];
      }
    }
  }
  return px;
}

// --- encodage PNG (truecolor 8 bits, filtre 0) ---

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function toPng(px, size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // profondeur
  ihdr[9] = 2; // truecolor RGB
  // 10..12 : compression, filtre, entrelacement — tous à 0

  const stride = size * 3;
  const raw = Buffer.alloc(size * (stride + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filtre « none »
    Buffer.from(px.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const ICONS = [
  // motif pleine page
  { file: 'icon-192.png', size: 192, scale: 1 },
  { file: 'icon-512.png', size: 512, scale: 1 },
  // maskable : le motif doit tenir dans la zone sûre (cercle central de 80 %)
  { file: 'icon-512-maskable.png', size: 512, scale: 0.72 },
  // iOS arrondit les angles lui-même : une marge suffit
  { file: 'apple-touch-icon.png', size: 180, scale: 0.86 },
];

mkdirSync(OUT_DIR, { recursive: true });
for (const { file, size, scale } of ICONS) {
  const png = toPng(render(size, scale), size);
  writeFileSync(join(OUT_DIR, file), png);
  console.log(`${file.padEnd(24)} ${size}×${size}  ${(png.length / 1024).toFixed(1)} ko`);
}
