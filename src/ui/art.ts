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
 *
 * Ce que le dessin doit à l'aquarelle de couverture, et qu'un aplat unique
 * perdrait : les **fuseaux** des montgolfières, et une rangée de maisons dont
 * aucune n'a la couleur de sa voisine. Quatre maisons de la même teinte, ce
 * n'est plus Cliftonwood, c'est un lotissement.
 */

import { el } from './dom';

/**
 * Les filtres, déclarés une fois pour toute la page.
 *
 * `wash` déforme les aplats pour leur donner un bord de pinceau ; `wash-fine`
 * fait la même chose en plus serré, pour les petites formes. Ils vivent dans un
 * SVG de taille nulle, planté en tête de document : plusieurs illustrations
 * peuvent s'y référer sans les redéfinir.
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
export function plantFilters(): void {
  if (filtersPlanted || typeof document === 'undefined') return;
  const host = el('div');
  host.innerHTML = FILTERS;
  const svg = host.firstElementChild;
  if (svg) document.body.prepend(svg);
  filtersPlanted = true;
}

/**
 * Une montgolfière et ses fuseaux.
 *
 * L'enveloppe est une seule courbe fermée — deux Béziers symétriques — plutôt
 * qu'un cercle : un ballon gonflé n'est pas rond, il retombe en goutte vers la
 * nacelle.
 *
 * Les fuseaux sont de vraies bandes verticales **détourées par l'enveloppe**,
 * et non des enveloppes rétrécies empilées : rétrécie, la même forme donne une
 * lentille centrale, jamais les quartiers d'un ballon. Le `clipPath` porte
 * l'index en identifiant, sans quoi trois ballons partageraient le premier
 * détourage et deux d'entre eux se retrouveraient à la mauvaise place.
 */
function balloon(
  cx: number,
  cy: number,
  r: number,
  base: string,
  gore: string,
  index: number,
): string {
  const envelope = (w: number) =>
    `M ${cx},${cy - r} ` +
    `C ${cx + w},${cy - r} ${cx + w},${cy + r * 0.42} ${cx},${cy + r * 0.95} ` +
    `C ${cx - w},${cy + r * 0.42} ${cx - w},${cy - r} ${cx},${cy - r} Z`;

  const shape = envelope(r * 1.06);
  const clip = `gtb-gore-${index}`;
  const basketW = r * 0.4;
  const basketY = cy + r * 1.3;

  // Trois bandes suffisent : avec la couleur de fond, l'œil en compte six.
  const stripes = [-0.86, -0.16, 0.54]
    .map((k) => `<rect x="${cx + k * r}" y="${cy - r * 1.2}" width="${r * 0.32}" height="${r * 2.4}"/>`)
    .join('');

  return `
  <g class="gtb-balloon gtb-balloon--${index}">
    <clipPath id="${clip}"><path d="${shape}"/></clipPath>
    <path d="${shape}" fill="var(${base})" opacity="0.9" filter="url(#gtb-wash-fine)"/>
    <g clip-path="url(#${clip})" fill="var(${gore})" opacity="0.85">${stripes}</g>
    <path d="${shape}" fill="none" stroke="var(--ink)" stroke-width="1.3" opacity="0.45"/>
    <path d="M ${cx - basketW * 0.8},${cy + r * 0.92} L ${cx - basketW},${basketY}
             M ${cx + basketW * 0.8},${cy + r * 0.92} L ${cx + basketW},${basketY}"
          stroke="var(--ink)" stroke-width="1.1" opacity="0.5" fill="none"/>
    <rect x="${cx - basketW}" y="${basketY}" width="${basketW * 2}" height="${r * 0.3}"
          rx="${r * 0.07}" fill="var(--terracotta)" opacity="0.85"/>
  </g>`;
}

/**
 * Le pont suspendu de Clifton, vu de la rive.
 *
 * Les pylônes sont ocre et les câbles ambrés, comme sur l'aquarelle — la pierre
 * grise du relevé photographique aplatissait toute la bannière. Le câble
 * principal est une quadratique dont la flèche passe au-dessus du tablier : les
 * suspentes sont posées sur des points réellement pris sur la courbe, sinon
 * elles flottent et l'œil le voit.
 */
function suspensionBridge(): string {
  const deck = 138;
  const towerTop = 52;
  const cable = `M 156,58 Q 320,134 484,58`;
  // Points de la quadratique, t = 1/8 … 7/8.
  const hangers = [
    [199, 74],
    [242, 87],
    [283, 95],
    [320, 97],
    [357, 95],
    [398, 87],
    [441, 74],
  ]
    .map(([x, y]) => `M ${x},${y} L ${x},${deck}`)
    .join(' ');

  const tower = (x: number) => `
    <rect x="${x}" y="${towerTop}" width="26" height="${deck + 10 - towerTop}"
          fill="var(--terracotta)" opacity="0.95" filter="url(#gtb-wash-fine)"/>
    <rect x="${x}" y="${towerTop}" width="26" height="${deck + 10 - towerTop}"
          fill="none" stroke="var(--ink)" stroke-width="1.2" opacity="0.42"/>
    <rect x="${x + 6}" y="${towerTop + 16}" width="14" height="18" rx="7"
          fill="var(--paper)" opacity="0.55"/>`;

  return `
  <g class="gtb-bridge">
    ${tower(156)}
    ${tower(484)}
    <path d="${hangers}" stroke="var(--amber)" stroke-width="2" opacity="0.75"/>
    <path d="${cable}" fill="none" stroke="var(--amber)" stroke-width="3.4" opacity="0.95"
          stroke-linecap="round" class="gtb-draw"/>
    <path d="M 156,58 Q 106,98 46,132 M 484,58 Q 534,98 594,132"
          fill="none" stroke="var(--amber)" stroke-width="3" opacity="0.9" stroke-linecap="round"/>
    <rect x="0" y="${deck - 3}" width="640" height="7" rx="2" fill="var(--terracotta)"
          opacity="0.92" filter="url(#gtb-wash-fine)"/>
    <path d="M 0,${deck + 4} L 640,${deck + 4}" stroke="var(--ink)" stroke-width="1"
          opacity="0.32" stroke-linecap="round"/>
  </g>`;
}

/**
 * Une rangée de maisons colorées, comme à Cliftonwood — l'autre carte postale.
 *
 * Chacune a son toit, sa cheminée et sa couleur. Elles commencent à x = 28 et
 * s'arrêtent avant le premier pylône : sur un écran étroit, le
 * `preserveAspectRatio="slice"` de la bannière rogne une trentaine d'unités de
 * chaque côté, et une maison coupée en deux ressemble à un bug d'affichage.
 */
function terrace(): string {
  const houses: Array<[number, number, string]> = [
    [58, 52, '--terracotta'],
    [110, 66, '--teal'],
    [162, 46, '--rose'],
    [214, 58, '--amber'],
  ];
  const base = 188;
  const w = 46;

  return `
  <g class="gtb-terrace">
    ${houses
      .map(([x, h, colour]) => {
        const top = base - h;
        return `
      <rect x="${x + 8}" y="${top - 12}" width="7" height="12" fill="var(--brick)" opacity="0.7"/>
      <path d="M ${x - 3},${top} L ${x + w / 2},${top - 15} L ${x + w + 3},${top} Z"
            fill="var(--brick)" opacity="0.85" filter="url(#gtb-wash-fine)"/>
      <rect x="${x}" y="${top}" width="${w}" height="${h}" fill="var(${colour})"
            opacity="0.9" filter="url(#gtb-wash-fine)"/>
      <rect x="${x}" y="${top}" width="${w}" height="${h}" fill="none"
            stroke="var(--ink)" stroke-width="1.1" opacity="0.38"/>
      <rect x="${x + 6}" y="${top + 9}" width="11" height="12" fill="var(--paper)" opacity="0.85"/>
      <rect x="${x + 23}" y="${top + 9}" width="11" height="12" fill="var(--paper)" opacity="0.85"/>
      <rect x="${x + 14}" y="${base - 18}" width="12" height="18" rx="1"
            fill="var(--paper)" opacity="0.7"/>`;
      })
      .join('')}
  </g>`;
}

/** Les bosquets du parc : trois lavis verts posés au pied du dessin. */
function shrubs(): string {
  const blobs: Array<[number, number, number, string]> = [
    [236, 182, 22, '--leaf'],
    [268, 186, 16, '--gorge'],
    [548, 180, 26, '--leaf'],
    [590, 186, 18, '--gorge'],
    [508, 186, 15, '--park'],
  ];
  return `
  <g class="gtb-shrubs" filter="url(#gtb-wash-fine)">
    ${blobs
      .map(([cx, cy, r, c]) => `<ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r * 0.72}" fill="var(${c})" opacity="0.78"/>`)
      .join('')}
  </g>`;
}

/**
 * La bannière d'accueil : le gorge, le pont, les ballons, la lumière.
 *
 * `preserveAspectRatio="xMidYMax slice"` garde le pont centré et laisse le ciel
 * se faire rogner sur les écrans étroits — c'est le haut qui est vide, pas le bas.
 *
 * Les ballons volent une quinzaine d'unités plus bas que le haut du cadre pour
 * cette raison précise : une enveloppe coupée net par le bord ressemble à un
 * défaut de rendu, pas à un ballon qui sort du champ.
 */
export function bristolBanner(): HTMLElement {
  plantFilters();

  const svg = `
<svg class="gtb-banner__svg" viewBox="0 0 640 200" preserveAspectRatio="xMidYMax slice"
     role="img" aria-label="Le pont suspendu de Clifton, des montgolfières à fuseaux et les maisons colorées de Bristol">
  <!-- Le papier reste nu. Un grand lavis de ciel et deux aplats de sol
       rendaient toute la bannière terne : sur l'aquarelle de couverture, le
       blanc du papier est ce qui fait chanter les couleurs, et le seul lavis
       du bas est celui de l'herbe, juste sous les maisons. -->
  <ellipse cx="330" cy="190" rx="330" ry="26" fill="var(--gorge)" opacity="0.34"
           filter="url(#gtb-wash)"/>

  <g class="gtb-sun">
    <circle cx="588" cy="34" r="16" fill="var(--amber)" opacity="0.92" filter="url(#gtb-wash-fine)"/>
    <path d="M 588,8 v -7 M 588,67 v 7 M 562,34 h -7 M 614,34 h 7
             M 570,16 l -5,-5 M 606,52 l 5,5 M 606,16 l 5,-5 M 570,52 l -5,5"
          stroke="var(--amber)" stroke-width="2.2" stroke-linecap="round" opacity="0.8"/>
  </g>

  <g class="gtb-cloud" filter="url(#gtb-wash-fine)" opacity="0.45">
    <ellipse cx="470" cy="30" rx="26" ry="12" fill="var(--harbour)"/>
    <ellipse cx="448" cy="35" rx="17" ry="9" fill="var(--harbour)"/>
    <ellipse cx="492" cy="36" rx="15" ry="8" fill="var(--harbour)"/>
  </g>

  <!-- L'ordre fait la profondeur : le pont d'abord, la rangée de maisons
       par-dessus. Dessinée avant, la plus haute se faisait trancher le toit par
       le tablier — deux plans à la même distance, et le dessin s'aplatit. -->
  ${shrubs()}
  ${suspensionBridge()}
  ${terrace()}

  ${balloon(80, 62, 26, '--indigo', '--leaf', 1)}
  ${balloon(252, 48, 17, '--plum', '--amber', 2)}
  ${balloon(378, 56, 21, '--harbour', '--paper', 3)}
</svg>`;

  const host = el('div', { class: 'gtb-banner' });
  host.innerHTML = svg;
  return host;
}

/**
 * Petit fanion de carnet — la vignette qui distingue les carnets dans le hub.
 * Quatre motifs, un par carnet, dans le même registre que la bannière.
 */
export function carnetGlyph(
  kind: 'grammar' | 'themes' | 'vocab' | 'culture',
): HTMLElement {
  plantFilters();

  const body = {
    // une plume et sa ligne : la mécanique de la langue
    grammar: `
      <path d="M 9,30 C 16,14 27,8 33,7 C 33,17 27,28 12,32 Z" fill="var(--harbour)"
            opacity="0.75" filter="url(#gtb-wash-fine)"/>
      <path d="M 6,34 L 34,6" stroke="var(--ink)" stroke-width="1.6" opacity="0.5" stroke-linecap="round"/>`,
    // un disque : le tourne-disque de l'aquarelle, et la scène du carnet
    themes: `
      <circle cx="20" cy="20" r="14" fill="var(--plum)" opacity="0.78" filter="url(#gtb-wash-fine)"/>
      <circle cx="20" cy="20" r="14" fill="none" stroke="var(--ink)" stroke-width="1.2" opacity="0.45"/>
      <circle cx="20" cy="20" r="8" fill="none" stroke="var(--paper)" stroke-width="1" opacity="0.6"/>
      <circle cx="20" cy="20" r="3.2" fill="var(--amber)"/>`,
    // une montgolfière : ce qu'on attrape en l'air
    vocab: `
      <path d="M 20,7 C 31,7 31,21 20,29 C 9,21 9,7 20,7 Z" fill="var(--terracotta)"
            opacity="0.8" filter="url(#gtb-wash-fine)"/>
      <path d="M 20,7 C 23,7 23,22 20,29 C 17,22 17,7 20,7 Z" fill="var(--amber)" opacity="0.85"/>
      <path d="M 16,28 L 15,33 M 24,28 L 25,33" stroke="var(--ink)" stroke-width="1.2" opacity="0.5"/>
      <rect x="15" y="33" width="10" height="5" rx="1" fill="var(--brick)" opacity="0.85"/>`,
    // les deux pylônes et leur câble : la ville elle-même
    culture: `
      <rect x="8" y="10" width="5" height="24" fill="var(--terracotta)" opacity="0.85" filter="url(#gtb-wash-fine)"/>
      <rect x="27" y="10" width="5" height="24" fill="var(--terracotta)" opacity="0.85" filter="url(#gtb-wash-fine)"/>
      <path d="M 10,12 Q 20,30 29,12" fill="none" stroke="var(--amber)" stroke-width="2.4"
            opacity="0.95" stroke-linecap="round"/>
      <path d="M 3,33 h 34" stroke="var(--terracotta)" stroke-width="2.4" opacity="0.9" stroke-linecap="round"/>`,
  }[kind];

  const host = el('div', { class: 'gtb-glyph' });
  host.innerHTML = `<svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">${body}</svg>`;
  return host;
}
