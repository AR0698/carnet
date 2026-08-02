/**
 * `mcq` — choisir parmi plusieurs propositions.
 *
 * Jamais planifié pour lui-même : c'est le filet de secours servi à la place
 * d'un exercice de production raté deux fois de suite (§4). Reconnaître n'est
 * pas produire — une réussite ici débloque l'apprenante, mais ne compte pas
 * comme une vraie récupération en mémoire (voir `scheduler.ts`).
 */

import type { Exercise } from '../../packs/schema';
import { canonicalAnswer, isAccepted } from '../grading';
import { sameAnswer } from '../variants';
import { el } from '../../ui/dom';
import type { ExerciseHandle, ExerciseRenderer, GradeResult } from './types';

function shuffled<T>(list: T[]): T[] {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function optionsOf(exercise: Exercise): string[] {
  return shuffled([canonicalAnswer(exercise.answerSpec), ...(exercise.distractors ?? [])]);
}

function render(exercise: Exercise, container: HTMLElement): ExerciseHandle {
  const options = optionsOf(exercise);

  let selected: string | null = null;
  let submit: (() => void) | null = null;
  let locked = false;

  const buttons: HTMLButtonElement[] = [];
  const list = el('div', { class: 'mcq' });

  for (const option of options) {
    const button = el('button', { class: 'mcq__option', type: 'button', lang: 'en' }, [option]);
    button.addEventListener('click', () => {
      if (locked) return;
      selected = option;
      for (const b of buttons) b.setAttribute('aria-pressed', String(b === button));
    });
    button.setAttribute('aria-pressed', 'false');
    buttons.push(button);
    list.append(button);
  }

  // Double-clic sur une proposition = choisir et valider.
  for (const button of buttons) {
    button.addEventListener('dblclick', () => submit?.());
  }

  container.append(el('p', { class: 'ex-prompt' }, [exercise.prompt]), list);

  return {
    getValue: () => selected ?? '',
    focus: () => buttons[0]?.focus(),
    lock: () => {
      locked = true;
      for (const b of buttons) b.disabled = true;
    },
    onSubmit: (cb) => {
      submit = cb;
    },
  };
}

/**
 * Mode cahier : les propositions restent affichées, mais on recopie la bonne
 * à la main plutôt que de la désigner du doigt. Écrire la forme juste vaut
 * mieux que la reconnaître — c'est même tout l'intérêt du filet de secours.
 */
function statement(exercise: Exercise, container: HTMLElement): void {
  container.append(
    el('p', { class: 'ex-prompt' }, [exercise.prompt]),
    el(
      'ul',
      { class: 'choices' },
      optionsOf(exercise).map((option) => el('li', { lang: 'en' }, [option])),
    ),
  );
}

function grade(exercise: Exercise, userInput: string): GradeResult {
  const correct = isAccepted(exercise.answerSpec, userInput);
  const expected = canonicalAnswer(exercise.answerSpec);
  return {
    correct,
    expected,
    alternatives: [],
    feedback: correct ? 'C’est bien celle-là.' : `Pas tout à fait — c’était « ${expected} ».`,
    // Pas de comparaison mot à mot ici : le choix était donné, seule
    // l'explication de l'erreur a un intérêt.
    correction: correct ? undefined : { target: expected, explanation: pitfallFor(exercise, userInput) },
  };
}

function pitfallFor(exercise: Exercise, userInput: string) {
  const pitfall = exercise.pitfalls?.find((p) => p.answers.some((w) => sameAnswer(w, userInput)));
  return pitfall ? { text: pitfall.explain, source: 'pitfall' as const } : undefined;
}

export const mcq: ExerciseRenderer = { render, grade, statement };
