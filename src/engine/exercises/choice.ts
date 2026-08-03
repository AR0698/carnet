/**
 * Socle partagé par les exercices à propositions (`mcq`, `odd_one_out`).
 *
 * Même geste dans les deux cas — on désigne une forme parmi plusieurs — et
 * pourtant deux usages opposés. Le `mcq` sert de filet quand produire a échoué
 * deux fois ; l'intrus, lui, est un vrai exercice, qui demande de tenir la
 * frontière d'une famille de mots. Seule la formulation du verdict les
 * distingue, d'où ce socle commun et deux fichiers de trois lignes.
 *
 * Une remarque sur ce que ces exercices mesurent : reconnaître n'est pas
 * produire. Les formes sont sous les yeux, la réussite y est donc moins chère
 * qu'ailleurs — c'est pourquoi rien ici ne propose « En fait, je l'avais »
 * (`isChoice`), et pourquoi le `mcq` ne porte aucune carte.
 */

import type { Exercise } from '../../packs/schema';
import { canonicalAnswer, isAccepted } from '../grading';
import { sameAnswer } from '../variants';
import { el } from '../../ui/dom';
import type { ExerciseHandle, ExerciseRenderer, GradeResult } from './types';

export function shuffled<T>(list: T[]): T[] {
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

/** L'explication écrite d'avance pour la faute commise, s'il y en a une. */
export function pitfallFor(exercise: Exercise, userInput: string) {
  const pitfall = exercise.pitfalls?.find((p) => p.answers.some((w) => sameAnswer(w, userInput)));
  return pitfall ? { text: pitfall.explain, source: 'pitfall' as const } : undefined;
}

/** Ce que le verdict dit — la seule chose qui change d'un type à l'autre. */
export interface ChoiceCopy {
  right: string;
  wrong(expected: string): string;
}

function render(exercise: Exercise, container: HTMLElement): ExerciseHandle {
  const options = optionsOf(exercise);

  let selected: string | null = null;
  let submit: (() => void) | null = null;
  let locked = false;
  // Ici rien ne se tape : le premier choix *est* la fin de la délibération.
  let firstChoice: number | undefined;

  const buttons: HTMLButtonElement[] = [];
  const list = el('div', { class: 'mcq' });

  for (const option of options) {
    const button = el('button', { class: 'mcq__option', type: 'button', lang: 'en' }, [option]);
    button.addEventListener('click', () => {
      if (locked) return;
      firstChoice ??= performance.now();
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
    firstInputAt: () => firstChoice,
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

export function choiceRenderer(copy: ChoiceCopy): ExerciseRenderer {
  const grade = (exercise: Exercise, userInput: string): GradeResult => {
    const correct = isAccepted(exercise.answerSpec, userInput);
    const expected = canonicalAnswer(exercise.answerSpec);
    return {
      correct,
      expected,
      alternatives: [],
      feedback: correct ? copy.right : copy.wrong(expected),
      // Pas de comparaison mot à mot ici : le choix était donné, seule
      // l'explication de l'erreur a un intérêt.
      correction: correct
        ? undefined
        : { target: expected, explanation: pitfallFor(exercise, userInput) },
    };
  };

  return { render, grade, statement };
}
