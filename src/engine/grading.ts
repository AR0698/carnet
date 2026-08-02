/**
 * Correction par défaut : comparaison normalisée contre `answerSpec.accepted`.
 *
 * Tolérante sur la forme (casse, espaces, apostrophes typographiques,
 * ponctuation finale), stricte sur le sens : aucune correspondance
 * approximative. En grammaire, un « s » manquant *est* l'erreur — le tolérer
 * reviendrait à valider ce qu'on cherche à corriger.
 */

import type { AnswerSpec } from '../packs/schema';

const CURLY_QUOTES = /[‘’‛ʼ`´]/g;
const TRAILING_PUNCT = /[.!?;,\s]+$/;

export function normalize(input: string, spec: AnswerSpec): string {
  let out = input
    .replace(CURLY_QUOTES, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .replace(TRAILING_PUNCT, '');

  if (spec.ignoreAccents !== false) {
    out = out.normalize('NFD').replace(/\p{Diacritic}/gu, '');
  }
  if (!spec.caseSensitive) {
    out = out.toLocaleLowerCase();
  }
  return out;
}

export function isAccepted(spec: AnswerSpec, userInput: string): boolean {
  const given = normalize(userInput, spec);
  if (given.length === 0) return false;
  return spec.accepted.some((a) => normalize(a, spec) === given);
}

/** Réponse canonique affichée en correction. */
export function canonicalAnswer(spec: AnswerSpec): string {
  // `accepted` est garanti non vide par la validation du pack.
  return spec.accepted[0] ?? '';
}

/**
 * Variantes également justes, à montrer après coup — privées de `exclude`,
 * pour ne jamais réafficher à l'apprenante la phrase qu'elle vient d'écrire
 * ni répéter la correction déjà donnée.
 */
export function otherAnswers(spec: AnswerSpec, exclude: string): string[] {
  const hidden = normalize(exclude, spec);
  return spec.accepted.filter((a) => normalize(a, spec) !== hidden);
}
