/**
 * Les dessins de l'application — vectoriels, écrits à la main, sans un octet
 * d'image.
 *
 * Le parti pris est celui de la sérigraphie et du pochoir : des aplats pleins,
 * des bords coupés au cutter, deux encres et rien de plus. Aucun `#hex` ici —
 * les `fill` pointent vers les variables de `tokens.css`, si bien qu'un
 * changement de palette repeint les illustrations sans qu'on y revienne, et
 * que le tirage de nuit s'obtient tout seul.
 *
 * Pourquoi du SVG plutôt que des photos : ça pèse quelques kilo-octets, ça
 * reste net à toutes les tailles, ça se met en cache avec la coquille de
 * l'application — donc ça s'affiche en mode avion — et ça se colore au thème.
 *
 * Trois procédés, tous empruntés à l'impression :
 *
 * — **le décalage.** Chaque silhouette est tirée deux fois : une passe de
 *   `--misprint` mal calée de quelques unités, puis la passe d'encre. C'est le
 *   défaut d'une affiche tirée à la main, et c'est ce qui la distingue d'un
 *   aplat d'écran.
 * — **le crachotis.** `feTurbulence` seuillé en alpha donne le grain d'une
 *   bombe qui postillonne autour du pochoir. Aucune texture bitmap.
 * — **la trame.** Une grille de points pour les demi-tons du ciel : c'est ce
 *   qu'on voit en approchant l'œil d'un journal.
 */

import { el } from './dom';

/**
 * Filtres et trames, déclarés une fois pour toute la page.
 *
 * Ils vivent dans un SVG de taille nulle, planté en tête de document :
 * plusieurs illustrations peuvent s'y référer sans les redéfinir.
 */
const DEFS = `
<svg class="gtb-defs" aria-hidden="true" focusable="false" width="0" height="0">
  <defs>
    <!-- Bord de pochoir : haute fréquence, faible amplitude. Une découpe au
         cutter tremble par petits crans, elle n'ondule pas. -->
    <filter id="gtb-rough" x="-4%" y="-4%" width="108%" height="108%">
      <feTurbulence type="fractalNoise" baseFrequency="0.32" numOctaves="2" seed="9" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" xChannelSelector="R" yChannelSelector="G"/>
    </filter>

    <!-- Crachotis de bombe : le bruit est seuillé en alpha, puis sert de
         gabarit à la forme source. Ce qui reste est une poussière de points. -->
    <filter id="gtb-spray" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.72" numOctaves="1" seed="5" result="n"/>
      <feColorMatrix in="n" type="matrix"
        values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.7 0.92" result="mask"/>
      <feComposite in="SourceGraphic" in2="mask" operator="in"/>
    </filter>

    <!-- Trame de demi-ton, pour les ciels et les aplats clairs. -->
    <pattern id="gtb-dots" width="5" height="5" patternUnits="userSpaceOnUse">
      <circle cx="1.7" cy="1.7" r="1.15" fill="var(--ink)"/>
    </pattern>
  </defs>
</svg>`;

let defsPlanted = false;

/** Plante les filtres au premier dessin demandé, jamais deux fois. */
function plantDefs(): void {
  if (defsPlanted || typeof document === 'undefined') return;
  const host = el('div');
  host.innerHTML = DEFS;
  const svg = host.firstElementChild;
  if (svg) document.body.prepend(svg);
  defsPlanted = true;
}

/**
 * Le tirage : la même forme deux fois, la seconde encre d'abord.
 *
 * C'est le geste central de toute cette feuille. Il est écrit une fois ici
 * plutôt que recopié dans chaque dessin, faute de quoi le décalage finirait
 * par différer d'une illustration à l'autre — et un défaut d'impression qui
 * change de valeur n'est plus un défaut, c'est une négligence.
 */
function printed(shapes: string, offset = 4, className = ''): string {
  return `
  <g class="${className}">
    <g transform="translate(${offset},${offset})" fill="var(--misprint)">${shapes}</g>
    <g fill="var(--ink)">${shapes}</g>
  </g>`;
}

/**
 * Une montgolfière, découpée au pochoir.
 *
 * L'enveloppe est une seule courbe fermée — deux Béziers symétriques — plutôt
 * qu'un cercle : un ballon gonflé n'est pas rond, il retombe en goutte vers la
 * nacelle. Pas de fuseaux, pas d'ombre : un pochoir n'a qu'un seul niveau.
 */
function balloon(cx: number, cy: number, r: number): string {
  const w = r * 1.06;
  const basketW = r * 0.36;
  const basketY = cy + r * 1.3;

  return (
    `M ${cx},${cy - r} ` +
    `C ${cx + w},${cy - r} ${cx + w},${cy + r * 0.42} ${cx},${cy + r * 0.95} ` +
    `C ${cx - w},${cy + r * 0.42} ${cx - w},${cy - r} ${cx},${cy - r} Z ` +
    // les suspentes, épaissies pour survivre au pochoir
    `M ${cx - basketW - 1},${cy + r * 0.9} h 2 l ${basketW * 0.4},${r * 0.4} h -2 Z ` +
    `M ${cx + basketW - 1},${cy + r * 0.9} h 2 l ${-basketW * 0.4},${r * 0.4} h -2 Z ` +
    `M ${cx - basketW},${basketY} h ${basketW * 2} v ${r * 0.28} h ${-basketW * 2} Z`
  );
}

/**
 * Le pont suspendu de Clifton, en silhouette.
 *
 * Tout est rempli, rien n'est tracé : un pochoir ne connaît pas l'épaisseur de
 * trait, seulement des surfaces découpées. Le câble est donc une bande fermée
 * — la courbe aller, la courbe retour décalée — et les suspentes de vrais
 * rectangles, posés sur des points réellement pris sur la quadratique.
 */
function suspensionBridge(): string {
  const deck = 134;
  const ground = 172;
  const towerTop = 40;

  // Points de la quadratique P0(150,58) P1(315,140) P2(470,58), t = 1/8 … 7/8.
  const hangers = [
    [191, 76],
    [232, 89],
    [272, 96],
    [313, 99],
    [352, 96],
    [392, 89],
    [431, 76],
  ]
    .map(([x, y]) => `M ${x! - 1.2},${y} h 2.4 V ${deck} h -2.4 Z`)
    .join(' ');

  const tower = (x: number) => `M ${x},${towerTop} h 18 V ${ground} h -18 Z `;

  return (
    // câble principal : bande fermée de 6 unités d'épaisseur
    `M 150,58 Q 315,140 470,58 L 470,64 Q 315,146 150,64 Z ` +
    // retours de câble vers les rives
    `M 150,58 Q 100,98 40,130 L 40,136 Q 100,104 150,64 Z ` +
    `M 470,58 Q 520,98 580,130 L 580,136 Q 520,104 470,64 Z ` +
    hangers +
    // tablier
    ` M 12,${deck} h 616 v 6 H 12 Z ` +
    tower(142) +
    tower(462) +
    // le sol : la bande noire qui tient toute la composition
    ` M 0,${ground} h 640 v 40 H 0 Z`
  );
}

/**
 * La bannière d'accueil : le pont, le ciel tramé, les ballons.
 *
 * `preserveAspectRatio="xMidYMax slice"` garde le pont centré et laisse le ciel
 * se faire rogner sur les écrans étroits — c'est le haut qui est vide, pas le bas.
 */
export function bristolBanner(): HTMLElement {
  plantDefs();

  const svg = `
<svg class="gtb-banner__svg" viewBox="0 0 640 200" preserveAspectRatio="xMidYMax slice"
     role="img" aria-label="Le pont suspendu de Clifton et des montgolfières, découpés au pochoir">
  <!-- le ciel, en demi-ton : la trame se voit, c'est le sujet -->
  <rect width="640" height="172" fill="url(#gtb-dots)" opacity="var(--halftone-opacity)"/>

  <!-- le disque : soleil du matin, ou pleine lune du tirage de nuit -->
  <circle cx="556" cy="44" r="30" fill="var(--amber)" filter="url(#gtb-rough)"/>

  ${printed(`<path d="${suspensionBridge()}"/>`, 5, 'gtb-skyline')}

  ${printed(`<path d="${balloon(78, 52, 24)}"/>`, 3, 'gtb-balloon gtb-balloon--1')}
  ${printed(`<path d="${balloon(250, 36, 15)}"/>`, 3, 'gtb-balloon gtb-balloon--2')}
  ${printed(`<path d="${balloon(392, 46, 19)}"/>`, 3, 'gtb-balloon gtb-balloon--3')}

  <!-- le crachotis autour du pochoir, là où la bombe déborde du bord -->
  <rect x="0" y="150" width="640" height="30" fill="var(--ink)" filter="url(#gtb-spray)"/>
</svg>`;

  const host = el('div', { class: 'gtb-banner' });
  host.innerHTML = svg;
  return host;
}

/**
 * Petit fanion de carnet — la vignette qui distingue les carnets dans le hub.
 * Quatre motifs, un par carnet, dans le même registre que la bannière : une
 * silhouette pleine, tirée deux fois.
 */
export function carnetGlyph(
  kind: 'grammar' | 'themes' | 'vocab' | 'culture',
): HTMLElement {
  plantDefs();

  // Les formes creuses (le disque, l'entaille de la plume) portent leur propre
  // `fill-rule` : leurs sous-tracés sont strictement emboîtés, donc `evenodd`
  // y perce un trou. Partout ailleurs les formes se chevauchent — pylônes,
  // câble, tablier — et la règle par défaut les additionne, ce qu'on veut.
  const body = {
    // une plume taillée : la mécanique de la langue
    grammar:
      '<path fill-rule="evenodd" d="M 29,3 L 36,10 L 13,33 L 4,37 L 8,28 Z ' +
      'M 18,22 L 23,27 L 11,32 Z"/>' +
      '<path d="M 3,38 h 34 v 4 H 3 Z"/>',
    // un 45 tours : la scène, les sound systems, le carnet de vocabulaire
    themes:
      '<path fill-rule="evenodd" d="' +
      'M 3,20 a 17,17 0 1 0 34,0 a 17,17 0 1 0 -34,0 Z ' +
      'M 8,20 a 12,12 0 1 0 24,0 a 12,12 0 1 0 -24,0 Z ' +
      'M 9,20 a 11,11 0 1 0 22,0 a 11,11 0 1 0 -22,0 Z ' +
      'M 16,20 a 4,4 0 1 0 8,0 a 4,4 0 1 0 -8,0 Z"/>',
    // une bombe de peinture : les mots qu'on attrape et qu'on note soi-même
    vocab:
      '<path d="M 12,14 h 16 v 25 h -16 Z M 15,10 h 10 v 4 h -10 Z M 16,4 h 8 v 6 h -8 Z"/>' +
      '<path d="M 29,3 h 3 v 3 h -3 Z M 34,6 h 3 v 3 h -3 Z M 31,10 h 2 v 2 h -2 Z ' +
      'M 36,1 h 2 v 2 h -2 Z"/>',
    // les deux pylônes et leur câble : la ville elle-même
    culture:
      '<path d="M 5,7 h 6 v 31 H 5 Z M 29,7 h 6 v 31 h -6 Z ' +
      'M 8,10 Q 20,29 32,10 L 32,15 Q 20,34 8,15 Z ' +
      'M 1,25 h 38 v 4 H 1 Z"/>',
  }[kind];

  const host = el('div', { class: 'gtb-glyph' });
  host.innerHTML =
    `<svg viewBox="0 0 42 46" aria-hidden="true" focusable="false">` +
    printed(body, 2) +
    `</svg>`;
  return host;
}
