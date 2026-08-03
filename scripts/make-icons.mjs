/**
 * Génère les icônes de l'application.
 *
 *   node scripts/make-icons.mjs
 *
 * Le motif est une montgolfière — la silhouette de Bristol qui reste lisible à
 * 48 pixels, là où le pont suspendu se réduirait à trois traits gris.
 *
 * Le rendu est fait à la main, sans dépendance : on décrit des formes
 * (rectangles, ellipses, polygones), on teste chaque pixel, et on encode le PNG
 * directement. Les courbes sont échantillonnées en 4 × 4 puis moyennées — sans
 * ce suréchantillonnage, le bord d'une ellipse est un escalier.
 *
 * Les couleurs sont celles de `src/ui/tokens.css` : les recopier ici si la
 * palette change.
 */

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

const PAPER = [0xe7, 0xe3, 0xda];
const INK = [0x14, 0x12, 0x10];
const MISPRINT = [0xd9, 0x3b, 0x2b];

/** Motif de référence, exprimé dans un carré de 512. */
const DESIGN = 512;

/** Suréchantillonnage : 4 × 4 suffit à effacer l'escalier des courbes. */
const SS = 4;

/** Décalage de la seconde encre, dans le carré de référence. */
const OFFSET = 17;

/**
 * L'enveloppe est une ellipse prolongée par un triangle : gonflée en haut, elle
 * retombe en goutte vers la nacelle.
 *
 * Un seul niveau, aucun fuseau clair : c'est un pochoir, et un pochoir ne
 * connaît que le plein et le vide.
 */
const stencil = (color, d = 0) => [
  // Pas d'horizon : le motif maskable est réduit vers le centre, et une bande
  // de sol s'y retrouverait à flotter au milieu du vide.

  // enveloppe
  { kind: 'ellipse', cx: 256 + d, cy: 206 + d, rx: 116, ry: 128, color },
  // Le triangle part de la largeur exacte de l'ellipse à cette hauteur (± 109),
  // sans quoi un ressaut apparaît à la jonction des deux formes.
  {
    kind: 'polygon',
    points: [
      [147 + d, 250 + d],
      [365 + d, 250 + d],
      [256 + d, 362 + d],
    ],
    color,
  },

  // suspentes et nacelle
  { kind: 'rect', x: 216 + d, y: 352 + d, w: 7, h: 36, color },
  { kind: 'rect', x: 289 + d, y: 352 + d, w: 7, h: 36, color },
  { kind: 'rect', x: 210 + d, y: 386 + d, w: 92, h: 46, color },
];

/**
 * Deux passes, comme sur l'affiche : la seconde encre d'abord, mal calée, puis
 * l'encre par-dessus. Les formes tardives recouvrent les premières — c'est ce
 * qui laisse dépasser un liseré rouge en bas à droite, et rien ailleurs.
 */
const SHAPES = [...stencil(MISPRINT, OFFSET), ...stencil(INK)];

function insideRect(s, x, y) {
  return x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h;
}

function insideEllipse(s, x, y) {
  const dx = (x - s.cx) / s.rx;
  const dy = (y - s.cy) / s.ry;
  return dx * dx + dy * dy <= 1;
}

/** Rayon horizontal, règle pair-impair : vaut pour n'importe quel polygone. */
function insidePolygon(points, x, y) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function colourAt(x, y) {
  // Du dernier au premier : la forme posée en dernier recouvre les précédentes.
  for (let i = SHAPES.length - 1; i >= 0; i--) {
    const s = SHAPES[i];
    const hit =
      s.kind === 'rect'
        ? insideRect(s, x, y)
        : s.kind === 'ellipse'
          ? insideEllipse(s, x, y)
          : insidePolygon(s.points, x, y);
    if (hit) return s.color;
  }
  return PAPER;
}

/** Rend l'icône à `size`, motif mis à l'échelle par `contentScale`. */
function render(size, contentScale) {
  const px = new Uint8Array(size * size * 3);
  const s = (size / DESIGN) * contentScale;
  const centre = size / 2;
  // Inverse de la mise à l'échelle : d'un pixel de sortie vers le carré de 512.
  const toDesign = (v) => (v - centre) / s + DESIGN / 2;
  const samples = SS * SS;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const c = colourAt(toDesign(x + (sx + 0.5) / SS), toDesign(y + (sy + 0.5) / SS));
          r += c[0];
          g += c[1];
          b += c[2];
        }
      }
      const i = (y * size + x) * 3;
      px[i] = Math.round(r / samples);
      px[i + 1] = Math.round(g / samples);
      px[i + 2] = Math.round(b / samples);
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
