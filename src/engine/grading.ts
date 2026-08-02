/**
 * Correction : accepter largement, expliquer précisément.
 *
 * Deux exigences opposées. D'un côté, refuser une réponse juste est le défaut
 * le plus décourageant d'un correcteur automatique : on accepte donc toutes
 * les formes équivalentes (contractions, orthographes britannique et
 * américaine) sans avoir à les énumérer dans le contenu. De l'autre, en
 * grammaire, un « s » manquant *est* l'erreur : aucune tolérance approximative,
 * jamais de correspondance floue.
 */

import type { AnswerSpec, Exercise } from '../packs/schema';
import { closestAnswer, diffIsUseful, type AnswerDiff } from './diff';
import { explainFromDiff } from './patterns';
import { canonicalForms, sameAnswer } from './variants';

export function isAccepted(spec: AnswerSpec, userInput: string): boolean {
  if (canonicalForms(userInput).size === 0) return false;
  if (spec.caseSensitive) {
    // Rare, mais alors la casse fait partie de la réponse : comparaison brute.
    const given = userInput.trim().replace(/[.!?;,\s]+$/, '');
    return spec.accepted.some((a) => a.trim().replace(/[.!?;,\s]+$/, '') === given);
  }
  return spec.accepted.some((accepted) => sameAnswer(accepted, userInput));
}

/** Réponse canonique affichée en correction. */
export function canonicalAnswer(spec: AnswerSpec): string {
  // `accepted` est garanti non vide par la validation du pack.
  return spec.accepted[0] ?? '';
}

/**
 * Variantes également justes, privées de `exclude` : on ne réaffiche pas à
 * l'apprenante la phrase qu'elle vient d'écrire, ni la correction déjà donnée.
 * Les simples variantes de forme (I'm / I am) sont tues : elles n'apprennent rien.
 */
export function otherAnswers(spec: AnswerSpec, exclude: string): string[] {
  return spec.accepted.filter((a) => !sameAnswer(a, exclude));
}

export interface Explanation {
  /** Pourquoi la réponse donnée ne marche pas. */
  text: string;
  /** Écrite pour cet exercice, ou déduite d'une règle générale. */
  source: 'pitfall' | 'pattern';
}

export interface Correction {
  /** Réponse acceptée la plus proche de ce qui a été écrit. */
  target: string;
  /** Comparaison mot à mot, si elle éclaire quelque chose. */
  diff?: AnswerDiff;
  explanation?: Explanation;
}

/**
 * Analyse une réponse fausse : sur quelle formulation l'apprenante visait,
 * quels mots diffèrent, et pourquoi c'est faux si on le sait.
 */
export function analyse(exercise: Exercise, userInput: string): Correction {
  const { answer, diff } = closestAnswer(exercise.answerSpec.accepted, userInput);

  const pitfall = exercise.pitfalls?.find((p) =>
    p.answers.some((wrong) => sameAnswer(wrong, userInput)),
  );

  const explanation: Explanation | undefined = pitfall
    ? { text: pitfall.explain, source: 'pitfall' }
    : (() => {
        const text = explainFromDiff(diff);
        return text ? { text, source: 'pattern' as const } : undefined;
      })();

  return {
    target: answer,
    diff: diffIsUseful(diff) ? diff : undefined,
    explanation,
  };
}
