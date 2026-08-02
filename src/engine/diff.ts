/**
 * Comparaison mot à mot entre la réponse donnée et la réponse attendue.
 *
 * Montrer « la bonne réponse est … » laisse l'apprenante chercher elle-même
 * ce qui clochait. Ici on désigne les mots en cause, des deux côtés : c'est
 * souvent tout ce qui manquait pour comprendre.
 */

import { tokenize } from './variants';

export type DiffKind = 'same' | 'wrong' | 'missing';

export interface DiffToken {
  /** Mot tel qu'il a été écrit, casse et ponctuation comprises. */
  text: string;
  kind: DiffKind;
}

/** Un groupe de mots remplacé par un autre — la matière des règles d'explication. */
export interface Replacement {
  written: string[];
  expected: string[];
  /**
   * Mot commun qui précède immédiatement la divergence, dans les deux phrases.
   * Indispensable aux règles : sans lui, impossible de distinguer un -s de
   * troisième personne d'un simple pluriel de nom.
   */
  before?: string;
}

export interface AnswerDiff {
  given: DiffToken[];
  expected: DiffToken[];
  replacements: Replacement[];
  /** Nombre de mots qui diffèrent, des deux côtés. */
  distance: number;
}

interface Word {
  surface: string;
  key: string;
}

/** Découpe en gardant la forme écrite pour l'affichage et une clé pour comparer. */
function words(input: string): Word[] {
  return input
    .split(/\s+/)
    .map((surface) => ({ surface, key: tokenize(surface).join(' ') }))
    .filter((w) => w.key.length > 0);
}

export function wordDiff(given: string, expected: string): AnswerDiff {
  const a = words(given);
  const b = words(expected);

  // Plus longue sous-suite commune.
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i]![j] =
        a[i]!.key === b[j]!.key
          ? lcs[i + 1]![j + 1]! + 1
          : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }

  const givenTokens: DiffToken[] = [];
  const expectedTokens: DiffToken[] = [];
  const replacements: Replacement[] = [];
  let pendingWritten: string[] = [];
  let pendingExpected: string[] = [];
  let lastCommon: string | undefined;

  const flush = () => {
    if (pendingWritten.length > 0 || pendingExpected.length > 0) {
      replacements.push({ written: pendingWritten, expected: pendingExpected, before: lastCommon });
      pendingWritten = [];
      pendingExpected = [];
    }
  };

  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i]!.key === b[j]!.key) {
      flush();
      givenTokens.push({ text: a[i]!.surface, kind: 'same' });
      expectedTokens.push({ text: b[j]!.surface, kind: 'same' });
      lastCommon = a[i]!.key;
      i++;
      j++;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      givenTokens.push({ text: a[i]!.surface, kind: 'wrong' });
      pendingWritten.push(a[i]!.key);
      i++;
    } else {
      expectedTokens.push({ text: b[j]!.surface, kind: 'missing' });
      pendingExpected.push(b[j]!.key);
      j++;
    }
  }
  for (; i < a.length; i++) {
    givenTokens.push({ text: a[i]!.surface, kind: 'wrong' });
    pendingWritten.push(a[i]!.key);
  }
  for (; j < b.length; j++) {
    expectedTokens.push({ text: b[j]!.surface, kind: 'missing' });
    pendingExpected.push(b[j]!.key);
  }
  flush();

  const distance =
    givenTokens.filter((t) => t.kind !== 'same').length +
    expectedTokens.filter((t) => t.kind !== 'same').length;

  return { given: givenTokens, expected: expectedTokens, replacements, distance };
}

/**
 * Réponse acceptée la plus proche de ce qui a été écrit.
 * Comparer à la réponse canonique n'aurait pas de sens si l'apprenante visait
 * une autre formulation, également juste.
 */
export function closestAnswer(accepted: string[], given: string): { answer: string; diff: AnswerDiff } {
  let best: { answer: string; diff: AnswerDiff } | null = null;
  for (const answer of accepted) {
    const diff = wordDiff(given, answer);
    if (!best || diff.distance < best.diff.distance) best = { answer, diff };
  }
  // `accepted` est garanti non vide par la validation du pack.
  return best ?? { answer: '', diff: wordDiff(given, '') };
}

/**
 * Au-delà, les deux phrases n'ont plus grand-chose en commun : un diff
 * mot à mot ne serait que du bruit, mieux vaut montrer la réponse attendue.
 */
export function diffIsUseful(diff: AnswerDiff): boolean {
  const total = diff.given.length + diff.expected.length;
  return total > 0 && diff.distance / total <= 0.6;
}
