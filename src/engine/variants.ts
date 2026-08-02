/**
 * Formes équivalentes d'une même réponse.
 *
 * Le problème que ce fichier règle : refuser une réponse juste est le pire
 * défaut d'un correcteur automatique. « I am » et « I'm », « apologise » et
 * « apologize » disent la même chose — les énumérer à la main dans chaque
 * exercice serait interminable et on en oublierait.
 *
 * On ramène donc les deux côtés de la comparaison à un même jeu de formes
 * canoniques. Deux contractions restent ambiguës (`'s` = is ou has, `'d` =
 * would ou had) : on développe alors les deux lectures et une seule
 * correspondance suffit.
 */

const MAX_VARIANTS = 8;

/** Variantes orthographiques britanniques / américaines, ramenées à une forme unique. */
const SPELLING: Record<string, string> = {
  // -ise / -ize
  apologize: 'apologise',
  organize: 'organise',
  realize: 'realise',
  recognize: 'recognise',
  criticize: 'criticise',
  memorize: 'memorise',
  summarize: 'summarise',
  apologized: 'apologised',
  organized: 'organised',
  realized: 'realised',
  recognized: 'recognised',
  organizing: 'organising',
  // -our / -or
  color: 'colour',
  colors: 'colours',
  favorite: 'favourite',
  behavior: 'behaviour',
  neighbor: 'neighbour',
  neighbors: 'neighbours',
  labor: 'labour',
  humor: 'humour',
  // -re / -er
  center: 'centre',
  theater: 'theatre',
  meter: 'metre',
  meters: 'metres',
  liter: 'litre',
  liters: 'litres',
  // consonne doublée
  traveling: 'travelling',
  traveled: 'travelled',
  traveler: 'traveller',
  canceled: 'cancelled',
  modeling: 'modelling',
  // divers
  gray: 'grey',
  toward: 'towards',
  math: 'maths',
  practice: 'practise',
  license: 'licence',
  // prétérits doubles
  learned: 'learnt',
  dreamed: 'dreamt',
  spelled: 'spelt',
  burned: 'burnt',
  spoiled: 'spoilt',
  gotten: 'got',
  // vocabulaire
  apartment: 'flat',
  apartments: 'flats',
  bookstore: 'bookshop',
  underground: 'tube',
  movie: 'film',
  movies: 'films',
  vacation: 'holiday',
  soccer: 'football',
};

/** Contractions sans ambiguïté : une seule lecture possible. */
const UNAMBIGUOUS: Record<string, string[]> = {
  "won't": ['will', 'not'],
  "can't": ['can', 'not'],
  cannot: ['can', 'not'],
  "shan't": ['shall', 'not'],
  "let's": ['let', 'us'],
};

const MODALS = new Set([
  'can',
  'could',
  'may',
  'might',
  'must',
  'shall',
  'should',
  'will',
  'would',
]);

export { MODALS };

/** Découpe en mots comparables : minuscules, sans accents ni ponctuation. */
export function tokenize(input: string): string[] {
  return input
    .replace(/[‘’‛ʼ`´]/g, "'")
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[-–—]/g, ' ')
    .replace(/[^\p{L}\p{N}' ]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** Développe un mot en une ou plusieurs suites de mots équivalentes. */
function expandToken(token: string): string[][] {
  const known = UNAMBIGUOUS[token];
  if (known) return [known];

  if (token.endsWith("n't") && token.length > 3) {
    return [[token.slice(0, -3), 'not']];
  }
  for (const [suffix, word] of [
    ["'m", 'am'],
    ["'re", 'are'],
    ["'ve", 'have'],
    ["'ll", 'will'],
  ] as const) {
    if (token.endsWith(suffix) && token.length > suffix.length) {
      return [[token.slice(0, -suffix.length), word]];
    }
  }
  // Ambigus : les deux lectures sont produites.
  if (token.endsWith("'s") && token.length > 2) {
    const stem = token.slice(0, -2);
    return [
      [stem, 'is'],
      [stem, 'has'],
    ];
  }
  if (token.endsWith("'d") && token.length > 2) {
    const stem = token.slice(0, -2);
    return [
      [stem, 'would'],
      [stem, 'had'],
    ];
  }

  return [[SPELLING[token] ?? token]];
}

/**
 * Toutes les lectures canoniques d'une phrase, sous forme de chaînes.
 * Deux réponses sont équivalentes si leurs jeux se croisent.
 */
export function canonicalForms(input: string): Set<string> {
  let branches: string[][] = [[]];

  for (const token of tokenize(input)) {
    const options = expandToken(token);
    const next: string[][] = [];
    for (const branch of branches) {
      for (const option of options) {
        next.push([...branch, ...option.map((w) => SPELLING[w] ?? w)]);
        if (next.length >= MAX_VARIANTS) break;
      }
      if (next.length >= MAX_VARIANTS) break;
    }
    branches = next;
  }

  return new Set(branches.map((b) => b.join(' ')));
}

/** Les deux formulations disent-elles la même chose ? */
export function sameAnswer(a: string, b: string): boolean {
  const left = canonicalForms(a);
  if (left.size === 0) return false;
  for (const form of canonicalForms(b)) {
    if (left.has(form)) return true;
  }
  return false;
}
