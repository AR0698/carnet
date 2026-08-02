/**
 * Registre des types d'exercice.
 *
 * Le moteur ne connaît que `ExerciseRenderer`. Brancher un nouveau type =
 * écrire un fichier ici + une ligne dans `RENDERERS`. Rien d'autre ne bouge :
 * ni la session, ni la planification, ni l'interface.
 */

import type { ExerciseType } from '../../packs/schema';
import { fillBlank } from './fillBlank';
import { mcq } from './mcq';
import { produce } from './produce';
import { spotError } from './spotError';
import { transform } from './transform';
import type { ExerciseRenderer } from './types';

const RENDERERS: Record<ExerciseType, ExerciseRenderer> = {
  produce,
  fill_blank: fillBlank,
  transform,
  spot_error: spotError,
  mcq,
};

export function rendererFor(type: ExerciseType): ExerciseRenderer {
  const renderer = RENDERERS[type];
  if (!renderer) throw new Error(`Type d'exercice non pris en charge : ${type}`);
  return renderer;
}

export function supportedTypes(): ExerciseType[] {
  return Object.keys(RENDERERS) as ExerciseType[];
}

export type { ExerciseHandle, ExerciseRenderer, GradeResult } from './types';
