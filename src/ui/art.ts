/**
 * Les dessins de l'application — vectoriels, écrits à la main, sans un octet
 * d'image.
 *
 * Le parti pris est celui de l'aquarelle de couverture : des lavis qui bavent
 * un peu, un trait d'encre irrégulier par-dessus, et des couleurs qui viennent
 * toutes de `tokens.css`. Aucun `#hex` ici — les `fill` pointent vers les
 * variables, si bien qu'un changement de palette repeint les illustrations
 * sans qu'on y revienne.
 *
 * Pourquoi du SVG plutôt que des photos : ça pèse quelques kilo-octets, ça
 * reste net à toutes les tailles, ça se met en cache avec la coquille de
 * l'application — donc ça s'affiche en mode avion — et ça se colore au thème.
 * Une photo nette à côté d'une aquarelle, l'un des deux perd toujours.
 *
 * Le bavement des lavis vient d'un `feTurbulence` déplacé : c'est le seul
 * moyen honnête d'obtenir un bord d'aquarelle sans texture bitmap.
 */

import { el } from './dom';

/**
 * Les filtres, déclarés une fois pour toute la page.
 *
 * `wash` déforme les aplats pour leur donner un bord de pinceau ; `grain`
 * fabrique le papier. Ils vivent dans un SVG de taille nulle, planté en tête de
 * document : plusieurs illustrations peuvent s'y référer sans les redéfinir.
 */
const FILTERS = `
<svg class="gtb-defs" aria-hidden="true" focusable="false" width="0" height="0">
  <defs>
    <filter id="gtb-wash" x="-12%" y="-12%" width="124%" height="124%">
      <feTurbulence type="fractalNoise" baseFrequency="0.014 0.021" numOctaves="4" seed="11" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="9" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <filter id="gtb-wash-fine" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" seed="3" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="3.5" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
  </defs>
</svg>`;

let filtersPlanted = false;

/** Plante les filtres au premier dessin demandé, jamais deux fois. */
function plantFilters(): void {
  if (filtersPlanted || typeof document === 'undefined') return;
  const host = el('div');
  host.innerHTML = FILTERS;
  const svg = host.firstElementChild;
  if (svg) document.body.prepend(svg);
  filtersPlanted = true;
}

/**
 * Une montgolfière.
 *
 * L'enveloppe est une seule courbe fermée — deux Béziers symétriques — plutôt
 * qu'un cercle : un ballon gonflé n'est pas rond, il retombe en goutte vers la
 * nacelle. Les fuseaux sont la même forme, rétrécie horizontalement.
 */
function balloon(cx: number, cy: number, r: number, colour: string, index: number): string {
  const envelope = (w: number) =>
    `M ${cx},${cy - r} ` +
    `C ${cx + w},${cy - r} ${cx + w},${cy + r * 0.42} ${cx},${cy + r * 0.95} ` +
    `C ${cx - w},${cy + r * 0.42} ${cx - w},${cy - r} ${cx},${cy - r} Z`;

  const basketW = r * 0.42;
  const basketY = cy + r * 1.28;

  return `
  <g class="gtb-balloon gtb-balloon--${index}">
    <path d="${envelope(r * 1.06)}" fill="var(${colour})" opacity="0.86" filter="url(#gtb-wash-fine)"/>
    <path d="${envelope(r * 0.34)}" fill="var(--ink)" opacity="0.12"/>
    <path d="${envelope(r * 1.06)}" fill="none" stroke="var(--ink)" stroke-width="1.4" opacity="0.5"/>
    <path d="M ${cx - basketW * 0.8},${cy + r * 0.92} L ${cx - basketW},${basketY}
             M ${cx + basketW * 0.8},${cy + r * 0.92} L ${cx + basketW},${basketY}"
          stroke="var(--ink)" stroke-width="1.1" opacity="0.55" fill="none"/>
    <rect x="${cx - basketW}" y="${basketY}" width="${basketW * 2}" height="${r * 0.3}"
          rx="${r * 0.07}" fill="var(--terracotta)" opacity="0.75"/>
  </g>`;
}

/**
 * Le pont suspendu de Clifton, vu de la rive.
 *
 * Le câble principal est une quadratique dont la flèche a été calculée pour
 * passer au-dessus du tablier : les suspentes sont posées sur des points
 * réellement pris sur la courbe, sinon elles flottent et l'œil le voit.
 */
function suspensionBridge(): string {
  const deck = 132;
  const towerTop = 58;
  const cable = `M 150,62 Q 313,132 462,62`;
  // Points de la quadratique, t = 1/8 … 7/8.
  const hangers = [
    [192, 77],
    [233, 88],
    [274, 95],
    [313, 97],
    [352, 95],
    [389, 88],
    [426, 77],
  ]
    .map(([x, y]) => `M ${x},${y} L ${x},${deck}`)
    .join(' ');

  const tower = (x: number) => `
    <rect x="${x}" y="${towerTop}" width="28" height="${deck + 8 - towerTop}"
          fill="var(--stone)" filter="url(#gtb-wash-fine)"/>
    <rect x="${x}" y="${towerTop}" width="28" height="${deck + 8 - towerTop}"
          fill="none" stroke="var(--ink)" stroke-width="1.3" opacity="0.45"/>
    <path d="M ${x + 5},${towerTop + 14} h 18 M ${x + 5},${towerTop + 30} h 18"
          stroke="var(--ink)" stroke-width="1" opacity="0.28"/>`;

  return `
  <g class="gtb-bridge">
    ${tower(150)}
    ${tower(462)}
    <path d="${cable}" fill="none" stroke="var(--ink)" stroke-width="2.4" opacity="0.7"
          stroke-linecap="round" class="gtb-draw"/>
    <path d="M 150,62 Q 104,102 62,131 M 462,62 Q 508,102 550,131"
          fill="none" stroke="var(--ink)" stroke-width="2" opacity="0.6" stroke-linecap="round"/>
    <path d="${hangers}" stroke="var(--ink)" stroke-width="0.9" opacity="0.42"/>
    <path d="M 40,${deck} L 600,${deck}" stroke="var(--ink)" stroke-width="2.6"
          opacity="0.72" stroke-linecap="round"/>
  </g>`;
}

/**
 * Une rangée de maisons colorées, comme à Cliftonwood — l'autre carte postale.
 *
 * Elles commencent à x = 74 et non au bord : sur un écran étroit, le
 * `preserveAspectRatio="slice"` de la bannière rogne une trentaine d'unités de
 * chaque côté, et une maison coupée en deux ressemble à un bug d'affichage.
 */
function terrace(): string {
  const houses: Array<[number, number, string]> = [
    [74, 38, '--terracotta'],
    [114, 48, '--amber'],
    [154, 33, '--brick'],
    [194, 43, '--gorge'],
  ];
  const base = 178;

  return `
  <g class="gtb-terrace">
    ${houses
      .map(
        ([x, h, colour]) => `
      <rect x="${x}" y="${base - h}" width="34" height="${h}" fill="var(${colour})"
            opacity="0.62" filter="url(#gtb-wash-fine)"/>
      <rect x="${x}" y="${base - h}" width="34" height="${h}" fill="none"
            stroke="var(--ink)" stroke-width="1.1" opacity="0.4"/>
      <rect x="${x + 11}" y="${base - h + 10}" width="12" height="11" fill="var(--paper)" opacity="0.8"/>`,
      )
      .join('')}
  </g>`;
}

/**
 * La bannière d'accueil : le gorge, le pont, les ballons, la lumière.
 *
 * `preserveAspectRatio="xMidYMax slice"` garde le pont centré et laisse le ciel
 * se faire rogner sur les écrans étroits — c'est le haut qui est vide, pas le bas.
 */
export function bristolBanner(): HTMLElement {
  plantFilters();

  const svg = `
<svg class="gtb-banner__svg" viewBox="0 0 640 200" preserveAspectRatio="xMidYMax slice"
     role="img" aria-label="Le pont suspendu de Clifton, des montgolfières et les maisons colorées de Bristol">
  <g filter="url(#gtb-wash)">
    <ellipse cx="320" cy="70" rx="330" ry="86" fill="var(--sky)" opacity="0.5"/>
    <ellipse cx="150" cy="150" rx="240" ry="52" fill="var(--gorge)" opacity="0.42"/>
    <ellipse cx="500" cy="158" rx="220" ry="46" fill="var(--park)" opacity="0.3"/>
  </g>

  <g class="gtb-sun">
    <circle cx="586" cy="34" r="14" fill="var(--amber)" opacity="0.85" filter="url(#gtb-wash-fine)"/>
    <path d="M 586,10 v -7 M 586,65 v 7 M 562,34 h -7 M 610,34 h 7
             M 569,17 l -5,-5 M 603,51 l 5,5 M 603,17 l 5,-5 M 569,51 l -5,5"
          stroke="var(--amber)" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
  </g>

  ${terrace()}
  ${suspensionBridge()}

  ${balloon(78, 56, 26, '--terracotta', 1)}
  ${balloon(252, 40, 17, '--indigo', 2)}
  ${balloon(534, 68, 21, '--amber', 3)}
</svg>`;

  const host = el('div', { class: 'gtb-banner' });
  host.innerHTML = svg;
  return host;
}

/**
 * Petit fanion de carnet — la vignette qui distingue les trois carnets dans le
 * hub. Trois motifs, un par carnet, dans le même registre que la bannière.
 */
export function carnetGlyph(kind: 'grammar' | 'vocab' | 'culture'): HTMLElement {
  plantFilters();

  const body = {
    // une plume et sa ligne : la mécanique de la langue
    grammar: `
      <path d="M 9,30 C 16,14 27,8 33,7 C 33,17 27,28 12,32 Z" fill="var(--harbour)"
            opacity="0.72" filter="url(#gtb-wash-fine)"/>
      <path d="M 6,34 L 34,6" stroke="var(--ink)" stroke-width="1.6" opacity="0.5" stroke-linecap="round"/>`,
    // une montgolfière : ce qu'on attrape en l'air
    vocab: `
      <path d="M 20,7 C 31,7 31,21 20,29 C 9,21 9,7 20,7 Z" fill="var(--terracotta)"
            opacity="0.75" filter="url(#gtb-wash-fine)"/>
      <path d="M 16,28 L 15,33 M 24,28 L 25,33" stroke="var(--ink)" stroke-width="1.2" opacity="0.5"/>
      <rect x="15" y="33" width="10" height="5" rx="1" fill="var(--amber)" opacity="0.85"/>`,
    // les deux pylônes et leur câble : la ville elle-même
    culture: `
      <rect x="8" y="10" width="5" height="24" fill="var(--stone)" filter="url(#gtb-wash-fine)"/>
      <rect x="27" y="10" width="5" height="24" fill="var(--stone)" filter="url(#gtb-wash-fine)"/>
      <path d="M 10,12 Q 20,30 29,12" fill="none" stroke="var(--ink)" stroke-width="1.8"
            opacity="0.6" stroke-linecap="round"/>
      <path d="M 3,33 h 34" stroke="var(--ink)" stroke-width="1.8" opacity="0.6" stroke-linecap="round"/>`,
  }[kind];

  const host = el('div', { class: 'gtb-glyph' });
  host.innerHTML = `<svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">${body}</svg>`;
  return host;
}
