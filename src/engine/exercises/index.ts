/**
 * Registre des types d'exercice.
 *
 * Le moteur ne connaît que `ExerciseRenderer`. Brancher un nouveau type =
 * écrire un fichier ici + une ligne dans `RENDERERS`. Rien d'autre ne bouge :
 * ni la session, ni la planification, ni l'interface.
 */

import type { Exercise, ExerciseType } from '../../packs/schema';
import { el } from '../../ui/dom';
import { fillBlank } from './fillBlank';
import { match } from './match';
import { mcq } from './mcq';
import { oddOneOut } from './oddOneOut';
import { picture } from './picture';
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
  picture,
  match,
  odd_one_out: oddOneOut,
};

export function rendererFor(type: ExerciseType): ExerciseRenderer {
  const renderer = RENDERERS[type];
  if (!renderer) throw new Error(`Type d'exercice non pris en charge : ${type}`);
  return renderer;
}

/**
 * Affiche un énoncé sans champ de saisie — mode cahier. Un type qui ne définit
 * pas de `statement` retombe sur sa consigne nue : jamais d'écran vide.
 */
export function renderStatement(exercise: Exercise, container: HTMLElement): void {
  const renderer = rendererFor(exercise.type);
  if (renderer.statement) renderer.statement(exercise, container);
  else container.append(el('p', { class: 'ex-prompt' }, [exercise.prompt]));
}

export function supportedTypes(): ExerciseType[] {
  return Object.keys(RENDERERS) as ExerciseType[];
}

export type { ExerciseHandle, ExerciseRenderer, GradeResult } from './types';
