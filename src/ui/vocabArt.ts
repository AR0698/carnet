/**
 * Les dessins du vocabulaire — un mot, une chose qui se voit.
 *
 * Pourquoi dessiner plutôt que traduire. Un mot appris par sa traduction
 * s'atteint en deux temps : la chose, le mot français, puis le mot anglais. Le
 * maillon du milieu tient très bien à l'écrit et lâche exactement au moment où
 * l'on parle. Appris sur un dessin, le mot s'accroche directement à la chose,
 * et c'est ce chemin-là qu'on emprunte dans une cuisine ou devant un guichet.
 *
 * Ce que ces dessins ne sont pas : jolis. Ils sont **reconnaissables**, ce qui
 * n'est pas la même chose et se paie parfois. Une bouilloire, c'est un corps, un
 * bec et une anse — trois traits, et le mot arrive ; ajouter le cordon, le
 * bouton et le reflet donnerait une plus belle bouilloire et un moins bon
 * exercice. La règle a une conséquence désagréable et assumée : quelques dessins
 * sont ambigus (une casserole et une poêle se ressemblent), et c'est pour ça
 * qu'aucun mot ne repose sur son seul dessin — tous ont aussi leur carte de
 * production depuis le français.
 *
 * Techniquement, c'est le registre de `art.ts` : lavis qui bavent sous
 * `feTurbulence`, trait d'encre par-dessus, et pas un `#hex` — toutes les
 * couleurs viennent de `tokens.css`, si bien qu'un changement de palette les
 * repeint sans qu'on y revienne. Chacun pèse quelques centaines d'octets, reste
 * net à toutes les tailles et s'affiche en mode avion.
 */

import { plantFilters } from './art';
import { el } from './dom';

// --- primitives ---
//
// Cinq fonctions, et chaque dessin tient en une ou deux lignes. C'est ce qui
// permet d'en avoir quatre-vingts sans que le fichier devienne illisible.

/** Un aplat de lavis, tracé au pinceau. */
const w = (d: string, colour: string, opacity = 0.85): string =>
  `<path d="${d}" fill="var(${colour})" opacity="${opacity}" filter="url(#gtb-wash-fine)"/>`;

/** Le trait d'encre par-dessus le lavis — jamais un contour fermé exact. */
const k = (d: string, opacity = 0.5, width = 1.8): string =>
  `<path d="${d}" fill="none" stroke="var(--ink)" stroke-width="${width}" opacity="${opacity}" stroke-linecap="round" stroke-linejoin="round"/>`;

const disc = (cx: number, cy: number, r: number, colour: string, opacity = 0.85): string =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="var(${colour})" opacity="${opacity}" filter="url(#gtb-wash-fine)"/>`;

const blob = (
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  colour: string,
  opacity = 0.85,
): string =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="var(${colour})" opacity="${opacity}" filter="url(#gtb-wash-fine)"/>`;

const box = (
  x: number,
  y: number,
  width: number,
  height: number,
  colour: string,
  radius = 3,
  opacity = 0.85,
): string =>
  `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="var(${colour})" opacity="${opacity}" filter="url(#gtb-wash-fine)"/>`;

/**
 * Une silhouette debout, avec un point rouge sur l'articulation visée.
 *
 * Les parties du corps sont les seuls mots que le dessin isolé sert mal : une
 * épaule dessinée seule est une forme abstraite, un genou aussi. Montrées sur un
 * corps entier avec un repère, elles se lisent immédiatement — et c'est le même
 * corps d'un mot à l'autre, si bien que le repère est la seule chose à regarder.
 */
const bodyAt = (x: number, y: number): string =>
  disc(50, 20, 9, '--stone') +
  k('M 50,29 L 50,60 M 50,36 L 33,48 M 50,36 L 67,48 M 50,60 L 39,86 M 50,60 L 61,86', 0.5, 2.6) +
  `<circle cx="${x}" cy="${y}" r="7" fill="var(--brick)" opacity="0.28"/>` +
  `<circle cx="${x}" cy="${y}" r="3.4" fill="var(--brick)"/>`;

/**
 * Le registre des dessins.
 *
 * Les clés sont **toutes entre guillemets**, y compris celles qui n'en auraient
 * pas besoin : `scripts/build-pack.mjs` les relève d'ici par expression
 * régulière pour refuser un `art` qui ne mène à aucun dessin, et une syntaxe
 * uniforme lui évite d'avoir à comprendre du TypeScript.
 */
const DRAW: Record<string, string> = {
  // --- le temps qu'il fait ---
  'sun': disc(50, 50, 20, '--amber', 0.95) + k('M 50,18 V 8 M 50,82 V 92 M 18,50 H 8 M 82,50 H 92 M 27,27 L 20,20 M 73,73 L 80,80 M 73,27 L 80,20 M 27,73 L 20,80', 0.55, 2.4),
  'cloud': blob(44, 54, 22, 14, '--harbour', 0.45) + blob(64, 58, 16, 11, '--harbour', 0.45) + blob(56, 44, 15, 11, '--harbour', 0.4) + k('M 24,62 Q 40,34 62,42 Q 82,44 78,62', 0.35),
  'rain': blob(48, 40, 24, 13, '--harbour', 0.4) + k('M 32,58 L 27,74 M 48,58 L 43,78 M 64,58 L 59,74', 0.6, 3),
  'drizzle': blob(48, 38, 24, 12, '--harbour', 0.3) + k('M 30,55 l -2,6 M 42,58 l -2,6 M 54,55 l -2,6 M 66,58 l -2,6 M 36,70 l -2,6 M 60,70 l -2,6', 0.45, 2.4),
  'snow': blob(48, 38, 24, 12, '--harbour', 0.3) + k('M 34,64 v 10 M 29,69 h 10 M 32,65 l 4,8 M 36,65 l -4,8 M 62,64 v 10 M 57,69 h 10 M 60,65 l 4,8 M 64,65 l -4,8', 0.5, 2),
  'fog': blob(50, 44, 26, 14, '--harbour', 0.28) + k('M 20,58 H 76 M 28,68 H 84 M 22,78 H 70', 0.35, 3.4),
  'wind': k('M 14,38 H 58 a 9,9 0 1,0 -9,-9 M 14,54 H 72 a 10,10 0 1,1 -10,10 M 14,70 H 50', 0.5, 3),
  'lightning': w('M 56,10 L 34,52 H 48 L 40,90 L 68,44 H 53 Z', '--amber', 0.95) + k('M 56,10 L 34,52 H 48 L 40,90 L 68,44 H 53 Z', 0.45),
  'rainbow': k('M 16,80 A 34,34 0 0 1 84,80', 0.9, 7) + `<path d="M 26,80 A 24,24 0 0 1 74,80" fill="none" stroke="var(--amber)" stroke-width="7" opacity="0.9"/><path d="M 36,80 A 14,14 0 0 1 64,80" fill="none" stroke="var(--leaf)" stroke-width="7" opacity="0.9"/>`,
  'puddle': blob(50, 66, 32, 11, '--harbour', 0.45) + k('M 22,66 Q 34,56 50,57 Q 70,58 78,68', 0.4) + k('M 40,40 l -3,9 M 58,34 l -3,9', 0.45, 2.4),

  // --- le monde autour ---
  'mountain': w('M 8,84 L 36,30 L 54,60 L 66,42 L 92,84 Z', '--gorge') + w('M 28,48 L 36,30 L 45,46 Z', '--paper', 0.9) + k('M 8,84 L 36,30 L 54,60 L 66,42 L 92,84', 0.45),
  'hill': w('M 6,84 Q 32,40 58,84 Z', '--leaf', 0.75) + w('M 44,84 Q 68,52 94,84 Z', '--gorge', 0.7) + k('M 6,84 Q 32,40 58,84 M 44,84 Q 68,52 94,84', 0.35),
  'river': w('M 30,10 Q 18,38 42,54 Q 66,70 50,92 L 72,92 Q 88,66 62,50 Q 38,34 52,10 Z', '--harbour', 0.6) + k('M 30,10 Q 18,38 42,54 Q 66,70 50,92 M 52,10 Q 38,34 62,50 Q 88,66 72,92', 0.35),
  'forest': w('M 26,74 L 38,34 L 50,74 Z', '--leaf', 0.8) + w('M 52,78 L 66,28 L 80,78 Z', '--gorge', 0.8) + k('M 38,74 V 86 M 66,78 V 88', 0.5, 3),
  'island': blob(50, 70, 34, 13, '--stone', 0.9) + k('M 50,66 V 40 M 50,42 q -12,-6 -16,4 q 10,4 16,-4 M 50,42 q 12,-6 16,4 q -10,4 -16,-4', 0.5, 2.4) + blob(50, 84, 42, 7, '--harbour', 0.45),
  'waterfall': w('M 20,14 H 44 V 62 Q 44,80 60,86 H 20 Z', '--gorge', 0.75) + w('M 44,14 H 62 V 78 H 44 Z', '--harbour', 0.6) + k('M 48,20 V 72 M 54,24 V 76 M 58,18 V 70', 0.35, 2),
  'cliff': w('M 10,86 H 52 V 22 L 62,22 V 86 H 90 Z', '--stone', 0.9) + w('M 10,74 H 90 V 92 H 10 Z', '--harbour', 0.5) + k('M 52,22 V 74 M 62,22 V 74', 0.4),
  'valley': w('M 4,20 L 40,84 L 4,84 Z', '--gorge', 0.8) + w('M 96,20 L 60,84 L 96,84 Z', '--leaf', 0.75) + k('M 40,84 Q 50,74 60,84', 0.45, 2.4),
  'field': w('M 8,50 H 92 L 82,86 H 18 Z', '--gorge', 0.7) + k('M 20,86 L 30,50 M 40,86 L 45,50 M 60,86 L 58,50 M 80,86 L 72,50', 0.35, 2),
  'beach': blob(50, 30, 46, 18, '--harbour', 0.5) + w('M 6,48 H 94 V 88 H 6 Z', '--stone', 0.85) + k('M 8,50 q 12,6 24,0 q 12,-6 24,0 q 12,6 24,0', 0.35, 2.2),

  // --- bêtes et bestioles ---
  'fox': blob(48, 58, 20, 15, '--terracotta') + w('M 32,48 L 28,28 L 44,40 Z', '--terracotta') + w('M 64,48 L 68,28 L 52,40 Z', '--terracotta') + w('M 66,66 Q 90,60 88,80 Q 78,78 72,72 Z', '--terracotta', 0.75) + k('M 40,56 h.1 M 56,56 h.1', 0.8, 4) + k('M 48,64 l 0,4', 0.6, 2.4),
  'seagull': w('M 10,54 Q 34,26 50,52 Q 66,26 90,54 Q 66,44 50,60 Q 34,44 10,54 Z', '--paper', 0.95) + k('M 10,54 Q 34,26 50,52 Q 66,26 90,54', 0.55, 2.4) + k('M 50,52 Q 66,44 50,60 Q 34,44 50,52', 0.4),
  'sheep': blob(46, 56, 24, 17, '--paper', 0.95) + blob(70, 46, 11, 9, '--ink', 0.6) + k('M 22,56 a 8,8 0 1,1 8,-8 M 40,40 a 9,9 0 1,1 10,-6 M 60,42 a 8,8 0 1,1 6,-8', 0.4, 2) + k('M 34,72 v 12 M 56,72 v 12', 0.5, 2.6),
  'cow': blob(46, 56, 25, 17, '--paper', 0.95) + blob(36, 50, 8, 6, '--ink', 0.55) + blob(56, 62, 7, 5, '--ink', 0.55) + blob(74, 46, 12, 10, '--paper', 0.95) + k('M 66,38 l -4,-8 M 82,38 l 4,-8', 0.5, 2.4) + k('M 34,72 v 12 M 56,72 v 12', 0.5, 2.6),
  'bee': blob(50, 54, 20, 13, '--amber', 0.95) + k('M 44,42 V 66 M 54,42 V 66', 0.65, 4) + blob(40, 38, 12, 7, '--sky', 0.5) + blob(60, 38, 12, 7, '--sky', 0.5) + k('M 70,48 l 6,-8 M 70,52 l 8,-2', 0.5, 2),
  'spider': disc(50, 56, 13, '--ink', 0.7) + disc(50, 40, 8, '--ink', 0.6) + k('M 38,50 L 18,38 M 38,56 L 16,54 M 38,62 L 18,72 M 40,68 L 28,84 M 62,50 L 82,38 M 62,56 L 84,54 M 62,62 L 82,72 M 60,68 L 72,84', 0.55, 2.2),
  'butterfly': w('M 48,50 Q 20,20 16,44 Q 14,64 46,58 Z', '--plum', 0.8) + w('M 52,50 Q 80,20 84,44 Q 86,64 54,58 Z', '--rose', 0.8) + k('M 50,34 V 76', 0.6, 3) + k('M 50,34 l -8,-12 M 50,34 l 8,-12', 0.5, 2),
  'squirrel': blob(44, 60, 15, 17, '--terracotta') + disc(44, 38, 11, '--terracotta') + w('M 62,74 Q 86,66 78,38 Q 66,46 64,66 Z', '--terracotta', 0.75) + k('M 38,30 l -3,-8 M 50,30 l 3,-8', 0.5, 2.2) + k('M 40,38 h.1', 0.8, 3.6),
  'hedgehog': blob(52, 62, 24, 15, '--stone', 0.95) + k('M 32,54 l -6,-8 M 42,48 l -3,-10 M 54,46 l 1,-11 M 66,48 l 5,-10 M 76,56 l 8,-7', 0.5, 2.2) + w('M 24,64 Q 12,62 14,72 Q 22,74 28,70 Z', '--stone') + k('M 16,68 h.1', 0.8, 3.4),
  'duck': blob(50, 62, 21, 14, '--paper', 0.95) + disc(66, 44, 10, '--paper', 0.95) + w('M 74,44 L 90,48 L 74,52 Z', '--amber', 0.95) + k('M 64,42 h.1', 0.8, 3.4) + k('M 30,74 q 8,8 16,2', 0.4, 2.2),
  'fish': w('M 20,54 Q 46,30 72,54 Q 46,78 20,54 Z', '--teal', 0.85) + w('M 72,54 L 88,40 L 88,68 Z', '--teal', 0.8) + k('M 20,54 Q 46,30 72,54 Q 46,78 20,54', 0.4) + k('M 34,48 h.1', 0.8, 3.4),
  'snail': blob(38, 68, 22, 9, '--stone', 0.9) + k('M 58,60 a 14,14 0 1,1 -8,-12 a 9,9 0 1,0 5,8 a 5,5 0 1,1 -3,-5', 0.6, 3) + k('M 20,64 l -5,-12 M 26,63 l 0,-13', 0.5, 2) + `<circle cx="15" cy="50" r="2.2" fill="var(--ink)" opacity="0.7"/><circle cx="26" cy="48" r="2.2" fill="var(--ink)" opacity="0.7"/>`,
  'horse': blob(44, 58, 23, 14, '--terracotta', 0.9) + w('M 62,54 L 72,28 L 84,30 L 80,52 Z', '--terracotta', 0.9) + k('M 74,28 l -2,-8 M 82,30 l 3,-7', 0.5, 2.2) + k('M 30,70 v 16 M 44,70 v 16 M 58,68 v 18', 0.5, 2.6) + k('M 22,56 q -8,6 -4,14', 0.4, 2.4),

  // --- le corps, montré sur un corps ---
  'shoulder': bodyAt(37, 39),
  'elbow': bodyAt(30, 45),
  'wrist': bodyAt(33, 48),
  'knee': bodyAt(44, 73),
  'ankle': bodyAt(39, 86),
  'hip': bodyAt(50, 58),
  'hand': w('M 34,88 V 52 q 0,-8 6,-8 t 6,8 V 30 q 0,-8 6,-8 t 6,8 v 20 q 0,-10 6,-10 t 6,10 v 8 q 0,-8 5,-8 t 5,8 v 18 q 0,16 -14,20 H 46 Q 34,92 34,88 Z', '--stone', 0.95) + k('M 40,52 V 44 M 52,50 V 30 M 64,58 V 50 M 74,64 V 58', 0.4, 2),
  'foot': w('M 26,72 q -6,-14 6,-22 q 12,-8 26,-2 q 14,6 20,2 q 8,-4 10,4 q 3,10 -8,16 q -14,8 -34,8 q -16,0 -20,-6 Z', '--stone', 0.95) + k('M 74,52 q 4,-6 8,-2 M 62,48 q 4,-6 8,-2 M 50,46 q 4,-6 8,-2', 0.4, 2),
  'eye': w('M 12,50 Q 50,18 88,50 Q 50,82 12,50 Z', '--paper', 0.95) + disc(50, 50, 15, '--harbour', 0.85) + disc(50, 50, 6, '--ink', 0.85) + k('M 12,50 Q 50,18 88,50 Q 50,82 12,50', 0.5),
  'ear': w('M 60,14 q -30,-2 -30,32 q 0,26 8,40 q 10,-2 8,-14 q -2,-14 8,-14 q 14,0 16,-18 q 2,-24 -10,-26 Z', '--stone', 0.95) + k('M 54,30 q -12,2 -12,16 q 0,10 6,12', 0.45),
  'nose': w('M 50,16 q -6,26 -16,42 q -6,10 4,14 q 12,4 24,0 q 10,-4 4,-14 Q 56,42 50,16 Z', '--stone', 0.95) + k('M 38,66 q 6,6 12,0 q 6,6 12,0', 0.45),
  'tooth': w('M 26,26 q 24,-10 48,0 q 6,26 -6,52 q -8,14 -12,-6 q -4,-16 -12,0 q -4,20 -12,6 Q 20,52 26,26 Z', '--paper', 0.98) + k('M 26,26 q 24,-10 48,0', 0.4),
  'hair': disc(50, 54, 24, '--stone', 0.9) + w('M 22,52 q 4,-34 28,-34 q 26,0 28,34 q -10,-16 -28,-16 q -20,0 -28,16 Z', '--ink', 0.7) + k('M 40,58 h.1 M 60,58 h.1', 0.8, 4),

  // --- la maison ---
  'kettle': w('M 28,44 h 40 q 6,0 6,8 v 24 q 0,8 -8,8 H 30 q -8,0 -8,-8 V 52 q 0,-8 6,-8 Z', '--harbour', 0.85) + k('M 68,52 q 16,4 16,16', 0.55, 3) + k('M 34,44 q 0,-10 14,-10 q 14,0 14,10', 0.55, 3) + k('M 42,32 h 14', 0.5, 4),
  'tap': k('M 40,84 V 46 q 0,-14 14,-14 h 16', 0.6, 6) + box(30, 82, 24, 8, '--harbour', 2) + k('M 40,40 h -14 M 40,40 v -8 M 34,32 h 12', 0.55, 4) + k('M 70,40 v 10', 0.4, 2.4) + `<circle cx="70" cy="58" r="3" fill="var(--harbour)" opacity="0.8"/>`,
  'sink': w('M 16,40 H 84 L 76,80 H 24 Z', '--stone', 0.9) + k('M 16,40 H 84 L 76,80 H 24 Z', 0.45) + `<ellipse cx="50" cy="72" rx="7" ry="3" fill="var(--ink)" opacity="0.5"/>` + k('M 50,40 V 20 q 0,-8 -10,-8', 0.5, 4),
  'oven': box(20, 22, 60, 62, '--stone', 4) + box(28, 42, 44, 34, '--harbour', 3, 0.6) + k('M 20,36 H 80', 0.4, 2) + `<circle cx="30" cy="30" r="3.4" fill="var(--ink)" opacity="0.6"/><circle cx="42" cy="30" r="3.4" fill="var(--ink)" opacity="0.6"/>` + k('M 34,50 H 66', 0.4, 3),
  'fridge': box(28, 12, 44, 76, '--paper', 4) + k('M 28,12 h 44 v 76 h -44 Z', 0.45) + k('M 28,40 H 72', 0.45, 2.4) + k('M 64,28 v 8 M 64,46 v 8', 0.55, 3.4),
  'cupboard': box(20, 18, 60, 66, '--terracotta', 3, 0.7) + k('M 50,18 V 84', 0.45, 2.2) + k('M 20,18 h 60 v 66 h -60 Z', 0.45) + `<circle cx="45" cy="52" r="2.6" fill="var(--ink)" opacity="0.7"/><circle cx="55" cy="52" r="2.6" fill="var(--ink)" opacity="0.7"/>`,
  'bin': w('M 28,32 H 72 L 66,86 H 34 Z', '--harbour', 0.75) + box(24, 22, 52, 8, '--harbour', 2) + k('M 42,20 h 16', 0.55, 4) + k('M 42,42 V 76 M 50,42 V 76 M 58,42 V 76', 0.35, 2),
  'cushion': w('M 22,26 q 28,-6 56,0 q 6,26 0,50 q -28,6 -56,0 q -6,-24 0,-50 Z', '--plum', 0.75) + k('M 22,26 q 28,-6 56,0 q 6,26 0,50 q -28,6 -56,0 q -6,-24 0,-50 Z', 0.4) + k('M 30,34 q 20,10 40,0', 0.25, 2),
  'duvet': w('M 12,40 q 38,-10 76,0 v 40 q -38,8 -76,0 Z', '--paper', 0.95) + k('M 12,40 q 38,-10 76,0 v 40 q -38,8 -76,0 Z', 0.4) + k('M 12,54 q 38,8 76,0 M 38,44 V 82 M 62,44 V 82', 0.25, 2),
  'lamp': w('M 30,44 L 42,18 H 58 L 70,44 Z', '--amber', 0.8) + k('M 50,44 V 76', 0.5, 3) + w('M 34,76 h 32 v 8 h -32 Z', '--ink', 0.6) + k('M 30,44 L 42,18 H 58 L 70,44 Z', 0.4),
  'mirror': `<ellipse cx="50" cy="46" rx="26" ry="34" fill="var(--sky)" opacity="0.5" filter="url(#gtb-wash-fine)"/>` + k('M 50,12 a 26,34 0 1,0 0.1,0 Z', 0.5, 3) + k('M 38,32 L 30,50 M 48,28 L 36,58', 0.3, 3) + k('M 44,80 v 8 h 12 v -8', 0.45),
  'shelf': box(16, 30, 68, 5, '--terracotta', 1) + box(16, 62, 68, 5, '--terracotta', 1) + box(26, 12, 8, 18, '--harbour', 1) + box(38, 16, 7, 14, '--brick', 1) + box(50, 14, 9, 16, '--leaf', 1) + box(28, 46, 8, 16, '--plum', 1) + box(40, 44, 10, 18, '--amber', 1),
  'mug': w('M 26,34 H 66 V 74 q 0,8 -8,8 H 34 q -8,0 -8,-8 Z', '--paper', 0.98) + k('M 66,44 q 14,0 14,12 q 0,12 -14,12', 0.55, 3.5) + k('M 26,34 H 66 V 74 q 0,8 -8,8 H 34 q -8,0 -8,-8 Z', 0.45) + k('M 34,26 q 4,-8 0,-14 M 46,26 q 4,-8 0,-14', 0.3, 2),
  'hoover': box(18, 56, 46, 26, '--brick', 5, 0.8) + k('M 64,62 q 18,-4 14,-24 q -2,-14 -14,-14', 0.55, 4) + `<circle cx="30" cy="82" r="7" fill="var(--ink)" opacity="0.7"/><circle cx="56" cy="82" r="7" fill="var(--ink)" opacity="0.7"/>` + k('M 58,20 h 12', 0.5, 4),
  'stairs': w('M 14,86 V 68 h 18 V 50 h 18 V 32 h 18 V 14 h 18 v 72 Z', '--stone', 0.9) + k('M 14,86 V 68 h 18 V 50 h 18 V 32 h 18 V 14 h 18', 0.45),

  // --- ce qu'on porte ---
  'jumper': w('M 34,26 H 66 L 84,40 L 76,54 L 68,48 V 84 H 32 V 48 L 24,54 L 16,40 Z', '--plum', 0.8) + k('M 34,26 H 66 L 84,40 L 76,54 L 68,48 V 84 H 32 V 48 L 24,54 L 16,40 Z', 0.45) + k('M 40,26 q 10,10 20,0', 0.4),
  'coat': w('M 34,22 H 66 L 82,38 L 74,52 L 70,46 V 86 H 30 V 46 L 26,52 L 18,38 Z', '--harbour', 0.75) + k('M 50,26 V 86', 0.45, 2.2) + `<circle cx="45" cy="48" r="2.4" fill="var(--ink)" opacity="0.7"/><circle cx="45" cy="64" r="2.4" fill="var(--ink)" opacity="0.7"/>`,
  'scarf': w('M 26,16 q 24,10 48,0 l 6,14 q -30,12 -60,0 Z', '--brick', 0.8) + w('M 36,30 q 8,26 2,54 h 14 q 6,-30 -2,-54 Z', '--brick', 0.7) + k('M 36,30 q 8,26 2,54 M 50,30 q 6,26 2,54', 0.35, 2),
  'boots': w('M 24,18 h 16 v 44 q 0,8 10,8 h 8 v 14 H 24 Z', '--ink', 0.7) + w('M 58,18 h 16 v 44 q 0,8 10,8 h 4 v 14 H 58 Z', '--ink', 0.55) + k('M 24,50 h 16 M 58,50 h 16', 0.3, 2),
  'trousers': w('M 30,18 H 70 L 66,86 H 54 L 50,46 L 46,86 H 34 Z', '--indigo', 0.75) + k('M 30,18 H 70 L 66,86 H 54 L 50,46 L 46,86 H 34 Z', 0.45) + k('M 30,28 H 70', 0.35, 2),
  'socks': w('M 30,16 h 14 v 34 q 0,8 -10,10 q -12,4 -14,-6 q -2,-8 8,-12 q 2,-2 2,-8 Z', '--paper', 0.95) + w('M 54,16 h 14 v 34 q 0,8 -10,10 q -12,4 -14,-6 q -2,-8 8,-12 q 2,-2 2,-8 Z', '--rose', 0.6) + k('M 30,24 h 14 M 54,24 h 14', 0.35, 2),
  'hat': blob(50, 62, 34, 9, '--gorge', 0.85) + w('M 30,62 q 2,-34 20,-34 q 18,0 20,34 Z', '--gorge', 0.8) + k('M 30,58 q 20,8 40,0', 0.45, 3),
  'gloves': w('M 26,84 V 48 q 0,-8 6,-8 v -10 q 0,-6 5,-6 t 5,6 v 8 q 0,-8 5,-8 t 5,8 v 8 q 0,-6 5,-6 t 5,6 v 32 Z', '--brick', 0.7) + k('M 26,66 h 36', 0.35, 2),
  'shirt': w('M 32,22 H 68 L 82,36 L 74,48 L 70,44 V 84 H 30 V 44 L 26,48 L 18,36 Z', '--paper', 0.95) + k('M 42,22 L 50,36 L 58,22', 0.5) + k('M 50,36 V 84', 0.35, 2) + k('M 32,22 H 68 L 82,36 L 74,48 L 70,44 V 84 H 30 V 44 L 26,48 L 18,36 Z', 0.45),
  'dress': w('M 36,18 H 64 L 60,40 L 80,84 H 20 L 40,40 Z', '--rose', 0.75) + k('M 36,18 H 64 L 60,40 L 80,84 H 20 L 40,40 Z', 0.45) + k('M 40,40 h 20', 0.35, 2),
  'belt': box(14, 42, 72, 16, '--terracotta', 3, 0.85) + box(56, 36, 22, 28, '--amber', 3, 0.95) + k('M 64,36 v 28', 0.5, 3) + k('M 14,42 h 72 v 16 h -72 Z', 0.4),
  'trainers': w('M 16,66 q 2,-16 16,-18 q 8,-2 14,6 q 10,10 26,12 q 12,2 12,10 H 18 Z', '--paper', 0.95) + k('M 18,76 H 84', 0.5, 3) + k('M 34,56 l 8,6 M 42,52 l 8,8 M 50,50 l 8,10', 0.4, 2),

  // --- ce qu'on mange ---
  'bread': w('M 16,52 q 4,-24 34,-24 q 30,0 34,24 q 2,26 -34,26 q -36,0 -34,-26 Z', '--amber', 0.7) + k('M 30,38 q 6,-8 10,0 M 46,34 q 6,-8 10,0 M 62,38 q 6,-8 10,0', 0.4) + k('M 16,52 q 4,-24 34,-24 q 30,0 34,24 q 2,26 -34,26 q -36,0 -34,-26 Z', 0.4),
  'cheese': w('M 16,68 L 40,30 H 86 L 62,68 Z', '--amber', 0.85) + w('M 16,68 V 80 L 62,80 V 68 Z', '--amber', 0.7) + `<circle cx="40" cy="56" r="5" fill="var(--paper)" opacity="0.9"/><circle cx="56" cy="46" r="3.6" fill="var(--paper)" opacity="0.9"/><circle cx="30" cy="62" r="3" fill="var(--paper)" opacity="0.9"/>` + k('M 16,68 L 40,30 H 86 L 62,68 Z', 0.4),
  'apple': w('M 50,30 q 22,-6 26,20 q 4,26 -14,36 q -12,6 -12,-2 q 0,8 -12,2 q -18,-10 -14,-36 q 4,-26 26,-20 Z', '--brick', 0.85) + k('M 50,30 q 0,-12 -10,-16', 0.5, 3) + w('M 52,20 q 12,-8 16,2 q -12,6 -16,-2 Z', '--leaf', 0.85),
  'egg': `<ellipse cx="50" cy="56" rx="24" ry="32" fill="var(--paper)" opacity="0.98" filter="url(#gtb-wash-fine)"/>` + k('M 50,24 a 24,32 0 1,0 0.1,0 Z', 0.45) + `<ellipse cx="42" cy="46" rx="8" ry="10" fill="var(--paper)" opacity="0.5"/>`,
  'carrot': w('M 50,32 L 66,84 L 34,84 Z', '--terracotta', 0.9) + k('M 50,32 q -8,-14 -16,-16 M 50,32 q 0,-16 2,-20 M 50,32 q 8,-12 16,-14', 0.55, 3.4) + k('M 42,52 h 16 M 40,66 h 20', 0.3, 2),
  'mushroom': w('M 16,50 q 6,-30 34,-30 q 28,0 34,30 q -34,10 -68,0 Z', '--terracotta', 0.85) + w('M 42,50 h 16 v 30 q -8,6 -16,0 Z', '--paper', 0.95) + k('M 16,50 q 34,10 68,0', 0.4),
  'strawberry': w('M 50,32 q 24,0 22,22 q -2,26 -22,34 q -20,-8 -22,-34 q -2,-22 22,-22 Z', '--rose', 0.9) + w('M 34,30 q 16,-8 32,0 q -16,10 -32,0 Z', '--leaf', 0.85) + `<circle cx="42" cy="50" r="1.8" fill="var(--paper)"/><circle cx="56" cy="48" r="1.8" fill="var(--paper)"/><circle cx="50" cy="62" r="1.8" fill="var(--paper)"/><circle cx="38" cy="66" r="1.8" fill="var(--paper)"/><circle cx="60" cy="66" r="1.8" fill="var(--paper)"/>`,
  'grapes': [[50, 30], [40, 44], [60, 44], [32, 58], [50, 58], [68, 58], [40, 72], [60, 72], [50, 84]].map(([x, y]) => disc(x!, y!, 9, '--plum', 0.8)).join('') + k('M 50,30 q 4,-14 14,-18', 0.5, 3),
  'onion': w('M 50,28 q 24,10 22,32 q -2,26 -22,26 q -20,0 -22,-26 q -2,-22 22,-32 Z', '--paper', 0.9) + k('M 50,30 V 86 M 36,36 q -4,26 4,48 M 64,36 q 4,26 -4,48', 0.35, 2) + k('M 50,28 q -4,-14 -8,-16 M 50,28 q 4,-14 8,-16', 0.5, 2.4),
  'chicken': w('M 22,60 q 0,-22 24,-22 q 26,0 30,18 q 4,18 -12,22 q -6,2 -10,-2 q -6,6 -14,2 q -18,-4 -18,-18 Z', '--stone', 0.9) + k('M 70,80 v 10 M 46,80 v 10', 0.5, 3.4) + k('M 22,60 q 0,-22 24,-22 q 26,0 30,18', 0.4),
  'cake': box(22, 44, 56, 34, '--terracotta', 3, 0.8) + w('M 22,44 q 28,-10 56,0 v 8 q -28,10 -56,0 Z', '--paper', 0.95) + k('M 40,44 V 24 M 60,44 V 24', 0.5, 2.4) + w('M 36,24 q 4,-8 8,0 q -4,6 -8,0 Z', '--amber', 0.95) + w('M 56,24 q 4,-8 8,0 q -4,6 -8,0 Z', '--amber', 0.95),
  'pear': w('M 50,26 q 14,0 12,18 q -2,10 6,20 q 8,14 -4,22 q -14,10 -28,0 q -12,-8 -4,-22 q 8,-10 6,-20 q -2,-18 12,-18 Z', '--leaf', 0.7) + k('M 50,26 q 0,-10 6,-14', 0.5, 3),
  'lemon': `<ellipse cx="50" cy="54" rx="30" ry="21" fill="var(--amber)" opacity="0.9" filter="url(#gtb-wash-fine)"/>` + k('M 80,54 q 8,0 8,-2 M 20,54 q -8,0 -8,-2', 0.5, 3) + k('M 50,33 a 30,21 0 1,0 0.1,0 Z', 0.35),
  'soup': w('M 16,44 h 68 q -4,32 -34,32 q -30,0 -34,-32 Z', '--paper', 0.95) + w('M 20,46 h 60 q -4,22 -30,22 q -26,0 -30,-22 Z', '--terracotta', 0.6) + k('M 44,34 q -6,-10 0,-18 M 56,34 q -6,-10 0,-18', 0.35, 2.4) + k('M 12,44 h 76', 0.45, 3),

  // --- la cuisine ---
  'pan': `<ellipse cx="44" cy="56" rx="30" ry="10" fill="var(--ink)" opacity="0.28"/>` + w('M 14,52 h 60 v 12 q 0,10 -30,10 q -30,0 -30,-10 Z', '--ink', 0.55) + k('M 74,54 h 20', 0.6, 6),
  'saucepan': box(22, 44, 48, 34, '--harbour', 3, 0.8) + `<ellipse cx="46" cy="44" rx="24" ry="7" fill="var(--stone)" opacity="0.85"/>` + k('M 70,50 h 20', 0.6, 5) + k('M 22,44 v 34 h 48 V 44', 0.4),
  'chopping-board': w('M 18,28 h 50 q 8,0 8,10 v 40 q 0,10 -8,10 H 18 Z', '--amber', 0.55) + k('M 18,28 h 50 q 8,0 8,10 v 40 q 0,10 -8,10 H 18 Z', 0.45) + `<circle cx="24" cy="38" r="3" fill="var(--ink)" opacity="0.4"/>` + k('M 30,50 h 34 M 30,62 h 34', 0.2, 2),
  'whisk': k('M 50,86 V 56', 0.6, 6) + k('M 50,56 q -18,-6 -14,-26 q 4,-18 14,-18 q 10,0 14,18 q 4,20 -14,26 M 50,56 q -8,-8 -6,-28 M 50,56 q 8,-8 6,-28', 0.55, 2.4),
  'kitchen-knife': w('M 14,54 q 30,-22 46,-14 q 6,4 0,10 q -14,12 -46,4 Z', '--stone', 0.95) + box(60, 46, 28, 9, '--ink', 3, 0.65) + k('M 14,54 q 30,-22 46,-14', 0.45),

  // --- se déplacer ---
  'bus': box(12, 26, 76, 44, '--brick', 5, 0.85) + box(18, 32, 26, 18, '--sky', 2, 0.7) + box(50, 32, 26, 18, '--sky', 2, 0.7) + `<circle cx="30" cy="74" r="8" fill="var(--ink)" opacity="0.75"/><circle cx="70" cy="74" r="8" fill="var(--ink)" opacity="0.75"/>` + k('M 12,26 h 76 v 44 h -76 Z', 0.4),
  'bicycle': k('M 26,66 a 16,16 0 1,0 0.1,0 Z M 74,66 a 16,16 0 1,0 0.1,0 Z', 0.6, 2.6) + k('M 26,66 L 44,40 H 62 L 74,66 M 44,40 L 56,66 M 40,32 h 12 M 46,32 L 44,40 M 62,40 l 4,-8 h 6', 0.6, 2.6),
  'train': w('M 18,30 h 44 q 12,0 16,14 l 4,20 H 18 Z', '--indigo', 0.8) + box(24, 36, 18, 16, '--sky', 2, 0.7) + box(50, 40, 16, 12, '--sky', 2, 0.7) + `<circle cx="32" cy="72" r="7" fill="var(--ink)" opacity="0.75"/><circle cx="52" cy="72" r="7" fill="var(--ink)" opacity="0.75"/><circle cx="72" cy="72" r="7" fill="var(--ink)" opacity="0.75"/>` + k('M 18,64 h 64', 0.4, 2),
  'van': w('M 10,34 h 44 v 12 h 14 l 14,16 v 12 H 10 Z', '--paper', 0.95) + box(56, 48, 14, 12, '--sky', 2, 0.7) + `<circle cx="28" cy="76" r="8" fill="var(--ink)" opacity="0.75"/><circle cx="66" cy="76" r="8" fill="var(--ink)" opacity="0.75"/>` + k('M 10,34 h 44 v 12 h 14 l 14,16 v 12 H 10 Z', 0.45),
  'ferry': w('M 12,64 h 76 l -10,18 H 22 Z', '--paper', 0.95) + box(28, 38, 40, 26, '--paper', 2, 0.95) + box(34, 44, 10, 10, '--sky', 1, 0.7) + box(52, 44, 10, 10, '--sky', 1, 0.7) + k('M 48,38 V 22 h 10 v 16', 0.5) + k('M 6,86 q 12,6 24,0 q 12,-6 24,0 q 12,6 24,0', 0.35, 2.4),
  'tram': box(20, 22, 60, 48, '--leaf', 4, 0.75) + box(26, 30, 20, 18, '--sky', 2, 0.7) + box(54, 30, 20, 18, '--sky', 2, 0.7) + k('M 50,22 V 8 M 36,8 h 30', 0.5, 2.4) + `<circle cx="34" cy="74" r="6" fill="var(--ink)" opacity="0.75"/><circle cx="66" cy="74" r="6" fill="var(--ink)" opacity="0.75"/>`,
  'lorry': box(10, 32, 44, 34, '--stone', 3, 0.9) + w('M 56,44 h 18 l 12,14 v 8 H 56 Z', '--brick', 0.85) + box(62, 48, 12, 9, '--sky', 1, 0.7) + `<circle cx="26" cy="72" r="8" fill="var(--ink)" opacity="0.75"/><circle cx="72" cy="72" r="8" fill="var(--ink)" opacity="0.75"/>`,
  'plane': w('M 8,54 L 74,44 q 14,-2 14,4 q 0,6 -14,6 L 8,60 Z', '--paper', 0.95) + w('M 40,50 L 26,20 h 10 l 26,28 Z', '--paper', 0.9) + w('M 40,58 L 26,84 h 10 l 26,-24 Z', '--paper', 0.9) + k('M 8,54 L 74,44 q 14,-2 14,4 q 0,6 -14,6 L 8,60 Z', 0.45),
  'taxi': w('M 14,50 l 12,-16 h 48 l 12,16 v 18 H 14 Z', '--amber', 0.9) + box(30, 38, 16, 12, '--sky', 2, 0.7) + box(54, 38, 16, 12, '--sky', 2, 0.7) + box(40, 22, 20, 10, '--ink', 2, 0.7) + `<circle cx="30" cy="72" r="7" fill="var(--ink)" opacity="0.75"/><circle cx="70" cy="72" r="7" fill="var(--ink)" opacity="0.75"/>`,

  // --- formes ---
  'circle': disc(50, 50, 30, '--harbour', 0.75) + k('M 50,20 a 30,30 0 1,0 0.1,0 Z', 0.45),
  'square': box(22, 22, 56, 56, '--terracotta', 2, 0.75) + k('M 22,22 h 56 v 56 h -56 Z', 0.45),
  'triangle': w('M 50,18 L 84,80 H 16 Z', '--amber', 0.85) + k('M 50,18 L 84,80 H 16 Z', 0.45),
  'rectangle': box(12, 32, 76, 36, '--leaf', 2, 0.7) + k('M 12,32 h 76 v 36 h -76 Z', 0.45),
  'oval': blob(50, 50, 34, 22, '--plum', 0.7) + k('M 16,50 a 34,22 0 1,0 0.1,0 Z', 0.45),
  'star': w('M 50,12 L 61,40 L 90,42 L 68,60 L 76,88 L 50,72 L 24,88 L 32,60 L 10,42 L 39,40 Z', '--amber', 0.95) + k('M 50,12 L 61,40 L 90,42 L 68,60 L 76,88 L 50,72 L 24,88 L 32,60 L 10,42 L 39,40 Z', 0.4),
  'diamond': w('M 50,14 L 86,50 L 50,86 L 14,50 Z', '--rose', 0.8) + k('M 50,14 L 86,50 L 50,86 L 14,50 Z', 0.45),
  'cube': w('M 26,36 L 50,22 L 74,36 L 50,50 Z', '--harbour', 0.75) + w('M 26,36 L 50,50 V 78 L 26,64 Z', '--harbour', 0.6) + w('M 74,36 L 50,50 V 78 L 74,64 Z', '--harbour', 0.45) + k('M 26,36 L 50,22 L 74,36 V 64 L 50,78 L 26,64 Z M 26,36 L 50,50 L 74,36 M 50,50 V 78', 0.45),
  'cylinder': `<ellipse cx="50" cy="28" rx="24" ry="9" fill="var(--teal)" opacity="0.8" filter="url(#gtb-wash-fine)"/>` + box(26, 28, 48, 44, '--teal', 0, 0.65) + `<ellipse cx="50" cy="72" rx="24" ry="9" fill="var(--teal)" opacity="0.8"/>` + k('M 26,28 V 72 M 74,28 V 72', 0.4),

  // --- ce qu'on achète, et dans quoi ---
  'jar': box(28, 34, 44, 50, '--sky', 4, 0.55) + box(26, 24, 48, 12, '--brick', 2, 0.85) + box(34, 46, 32, 14, '--paper', 1, 0.9) + k('M 28,34 h 44 v 50 h -44 Z', 0.4),
  'tin': `<ellipse cx="50" cy="28" rx="22" ry="7" fill="var(--stone)" opacity="0.9" filter="url(#gtb-wash-fine)"/>` + box(28, 28, 44, 46, '--stone', 0, 0.85) + `<ellipse cx="50" cy="74" rx="22" ry="7" fill="var(--stone)" opacity="0.85"/>` + box(28, 40, 44, 20, '--brick', 0, 0.7) + k('M 28,28 V 74 M 72,28 V 74', 0.4),
  'bottle': w('M 40,30 h 20 v 14 q 12,10 12,26 v 18 q 0,6 -6,6 H 34 q -6,0 -6,-6 V 70 q 0,-16 12,-26 Z', '--teal', 0.6) + box(42, 16, 16, 14, '--teal', 1, 0.7) + box(34, 66, 32, 14, '--paper', 1, 0.9) + k('M 40,30 h 20 v 14 q 12,10 12,26 v 18 q 0,6 -6,6 H 34 q -6,0 -6,-6 V 70 q 0,-16 12,-26 Z', 0.4),
  'packet': w('M 26,28 q 24,-8 48,0 v 52 q -24,8 -48,0 Z', '--amber', 0.6) + k('M 26,28 q 24,-8 48,0 v 52 q -24,8 -48,0 Z', 0.45) + k('M 26,28 l 12,-10 h 24 l 12,10', 0.45) + k('M 36,50 h 28 M 36,62 h 20', 0.3, 2),
  'tube': w('M 34,26 h 32 v 40 q 0,16 -16,16 q -16,0 -16,-16 Z', '--paper', 0.95) + box(42, 14, 16, 12, '--brick', 2, 0.85) + k('M 34,26 h 32 M 34,26 v 40 q 0,16 16,16 q 16,0 16,-16 V 26', 0.45) + k('M 40,72 h 20', 0.3, 2),
  'box': w('M 18,38 L 50,26 L 82,38 V 76 L 50,88 L 18,76 Z', '--amber', 0.55) + k('M 18,38 L 50,50 L 82,38 M 50,50 V 88', 0.45) + k('M 18,38 L 50,26 L 82,38 V 76 L 50,88 L 18,76 Z', 0.45),
  'carton': w('M 30,36 h 40 v 48 H 30 Z', '--paper', 0.95) + w('M 30,36 L 42,18 h 16 l 12,18 Z', '--paper', 0.9) + k('M 30,36 h 40 v 48 H 30 Z M 30,36 L 42,18 h 16 l 12,18 M 50,18 V 36', 0.45) + box(36, 52, 28, 16, '--harbour', 1, 0.5),
  'bowl': w('M 14,44 h 72 q -6,34 -36,34 q -30,0 -36,-34 Z', '--paper', 0.95) + k('M 14,44 h 72 q -6,34 -36,34 q -30,0 -36,-34 Z', 0.45) + `<ellipse cx="50" cy="44" rx="36" ry="7" fill="var(--ink)" opacity="0.12"/>`,
  'jug': w('M 30,30 h 34 v 44 q 0,8 -8,8 H 38 q -8,0 -8,-8 Z', '--sky', 0.55) + k('M 64,42 q 14,4 14,14 q 0,12 -14,14', 0.55, 3.4) + w('M 30,30 l 8,-8 h 8 l -6,8 Z', '--sky', 0.5) + k('M 30,30 h 34 v 44 q 0,8 -8,8 H 38 q -8,0 -8,-8 Z', 0.4),
  'basket': w('M 20,42 h 60 l -8,38 H 28 Z', '--amber', 0.6) + k('M 34,42 L 30,80 M 50,42 V 80 M 66,42 L 70,80 M 24,58 h 52', 0.35, 2) + k('M 34,42 q 4,-20 16,-20 q 12,0 16,20', 0.5, 2.6),

  // --- la ville, les objets ---
  'postbox': w('M 30,34 q 20,-14 40,0 v 48 H 30 Z', '--brick', 0.9) + box(38, 46, 24, 6, '--ink', 1, 0.65) + k('M 30,60 h 40', 0.35, 2) + k('M 30,34 q 20,-14 40,0 v 48 H 30 Z', 0.4),
  'bench': box(16, 44, 68, 8, '--terracotta', 2, 0.85) + box(16, 30, 68, 7, '--terracotta', 2, 0.8) + k('M 24,52 V 78 M 76,52 V 78 M 24,30 V 52 M 76,30 V 52', 0.5, 3),
  'lamppost': k('M 50,88 V 30 q 0,-8 8,-8 h 8', 0.55, 5) + w('M 60,22 h 14 l -4,14 H 64 Z', '--amber', 0.9) + box(40, 84, 20, 6, '--ink', 1, 0.6),
  'traffic-lights': box(36, 12, 28, 62, '--ink', 4, 0.7) + `<circle cx="50" cy="26" r="8" fill="var(--brick)" opacity="0.95"/><circle cx="50" cy="44" r="8" fill="var(--amber)" opacity="0.95"/><circle cx="50" cy="62" r="8" fill="var(--leaf)" opacity="0.95"/>` + k('M 50,74 V 90', 0.5, 4),
  'zebra-crossing': [20, 34, 48, 62, 76].map((y) => box(12, y!, 76, 8, '--paper', 1, 0.95)).join('') + `<rect x="8" y="12" width="84" height="76" fill="var(--ink)" opacity="0.12"/>`,
  'umbrella': w('M 8,52 q 6,-38 42,-38 q 36,0 42,38 q -20,-10 -42,0 q -22,-10 -42,0 Z', '--harbour', 0.8) + k('M 50,52 V 78 q 0,10 -10,10 q -8,0 -8,-8', 0.55, 3.4) + k('M 8,52 q 6,-38 42,-38 q 36,0 42,38', 0.4),
  'suitcase': box(16, 32, 68, 48, '--terracotta', 5, 0.8) + k('M 38,32 v -8 q 0,-6 6,-6 h 12 q 6,0 6,6 v 8', 0.55, 3) + k('M 16,54 h 68', 0.35, 2) + `<rect x="44" y="50" width="12" height="8" rx="1" fill="var(--ink)" opacity="0.6"/>`,
  'key': disc(30, 50, 16, '--amber', 0.9) + disc(30, 50, 6, '--paper', 0.98) + k('M 46,50 H 86 M 76,50 V 62 M 66,50 V 60', 0.6, 5),
  'book': w('M 14,26 q 18,-8 36,0 v 52 q -18,-8 -36,0 Z', '--harbour', 0.7) + w('M 86,26 q -18,-8 -36,0 v 52 q 18,-8 36,0 Z', '--brick', 0.7) + k('M 50,26 V 78', 0.5, 2.4) + k('M 14,26 q 18,-8 36,0 q 18,-8 36,0 v 52 q -18,-8 -36,0 q -18,-8 -36,0 Z', 0.45),
  'phone': box(32, 12, 36, 76, '--ink', 6, 0.75) + box(36, 20, 28, 56, '--sky', 2, 0.7) + `<circle cx="50" cy="82" r="3.4" fill="var(--paper)" opacity="0.7"/>`,
  'clock': disc(50, 50, 34, '--paper', 0.98) + k('M 50,16 a 34,34 0 1,0 0.1,0 Z', 0.55, 2.6) + k('M 50,50 V 28 M 50,50 L 66,60', 0.7, 3) + k('M 50,20 v 5 M 80,50 h -5 M 50,80 v -5 M 20,50 h 5', 0.45, 2.4),
  'candle': box(40, 34, 20, 50, '--paper', 2, 0.95) + k('M 50,34 V 26', 0.5, 2) + w('M 50,10 q 10,10 0,16 q -10,-6 0,-16 Z', '--amber', 0.95) + k('M 40,34 h 20 v 50 h -20 Z', 0.4),
  'ladder': k('M 30,88 L 38,14 M 70,88 L 62,14', 0.6, 4) + k('M 33,72 h 34 M 35,56 h 30 M 36,40 h 27 M 38,24 h 23', 0.5, 3),
  'wheelbarrow': w('M 22,42 h 52 l -10,22 H 30 Z', '--brick', 0.8) + `<circle cx="34" cy="74" r="9" fill="var(--ink)" opacity="0.7"/>` + k('M 64,64 L 86,78 M 74,42 L 90,50', 0.55, 3.4) + k('M 22,42 h 52 l -10,22 H 30 Z', 0.4),
  'spade': w('M 40,58 h 20 v 22 q -10,8 -20,0 Z', '--stone', 0.9) + k('M 50,58 V 22', 0.6, 5) + k('M 40,22 h 20', 0.6, 5),
  'flowerpot': w('M 28,52 h 44 l -6,32 H 34 Z', '--terracotta', 0.85) + box(24, 44, 52, 9, '--terracotta', 2, 0.9) + k('M 50,44 V 26', 0.5, 3) + disc(50, 20, 8, '--rose', 0.85) + w('M 50,32 q -14,-4 -16,-12 q 12,0 16,12 Z', '--leaf', 0.85),
};

/** Le dessin d'une clé, ou `null` si elle ne mène nulle part. */
export function vocabArt(key: string): HTMLElement | null {
  const body = DRAW[key];
  if (!body) return null;
  plantFilters();
  const host = el('div', { class: 'vocab-art' });
  host.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">${body}</svg>`;
  return host;
}

/** Les clés disponibles — pour les tests, et pour savoir ce qui est dessiné. */
export function artKeys(): string[] {
  return Object.keys(DRAW);
}
