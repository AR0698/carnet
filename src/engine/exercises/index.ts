/**
 * Registre des types d'exercice.
 *
 * Le moteur ne connaît que `ExerciseRenderer`. Brancher un nouveau type =
 * écrire un fichier ici + une ligne dans `RENDERERS`. Rien d'autre ne bouge.
 *
 * Étape 1 : `produce` et `fill_blank`.
 * Étape 3 : `transform`, `spot_error`, `mcq` viendront s'ajouter à cette table.
 */

import type { ExerciseType } from '../../packs/schema';
import { fillBlank } from './fillBlank';
import { produce } from './produce';
import type { ExerciseRenderer } from './types';

const RENDERERS: Partial<Record<ExerciseType, ExerciseRenderer>> = {
  produce,
  fill_blank: fillBlank,
};

export function rendererFor(type: ExerciseType): ExerciseRenderer {
  const r = RENDERERS[type];
  if (!r) throw new Error(`Type d'exercice non pris en charge : ${type}`);
  return r;
}

export function supportedTypes(): ExerciseType[] {
  return Object.keys(RENDERERS) as ExerciseType[];
}

export type { ExerciseHandle, ExerciseRenderer, GradeResult } from './types';
