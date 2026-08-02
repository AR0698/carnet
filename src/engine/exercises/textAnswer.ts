/**
 * Socle partagé par les types d'exercice à réponse libre
 * (`produce`, `fill_blank`, `transform`, `spot_error`).
 *
 * Trois façons de poser la même question : une zone de texte (phrase entière à
 * produire), un champ inséré dans la phrase (trou à combler), une phrase de
 * départ suivie d'une consigne. Chacune existe en deux versions — avec saisie,
 * et sans, pour le mode cahier. La correction, elle, est commune : comparaison
 * normalisée contre `answerSpec.accepted`.
 */

import { BLANK, type Exercise } from '../../packs/schema';
import { analyse, canonicalAnswer, isAccepted, otherAnswers } from '../grading';
import { el } from '../../ui/dom';
import type { ExerciseHandle, ExerciseRenderer, GradeResult } from './types';

export function gradeFreeText(exercise: Exercise, userInput: string): GradeResult {
  const spec = exercise.answerSpec;
  const correct = isAccepted(spec, userInput);

  if (correct) {
    return {
      correct: true,
      expected: canonicalAnswer(spec),
      // On montre les autres tournures possibles, pas celle qu'elle vient d'écrire.
      alternatives: otherAnswers(spec, userInput),
      feedback: 'C’est ça.',
    };
  }

  // La formulation visée n'est pas forcément la réponse canonique : on corrige
  // par rapport à celle dont l'apprenante s'est le plus approchée.
  const correction = analyse(exercise, userInput);
  return {
    correct: false,
    expected: correction.target,
    alternatives: otherAnswers(spec, correction.target),
    // Quand la comparaison mot à mot est affichée, elle porte déjà la réponse
    // attendue : la répéter dans l'en-tête alourdit la carte pour rien.
    feedback: correction.diff
      ? 'Pas tout à fait.'
      : `Pas tout à fait — on attendait « ${correction.target} ».`,
    correction,
  };
}

function handleFor(field: HTMLInputElement | HTMLTextAreaElement): ExerciseHandle {
  // Le premier caractère marque la fin de la récupération en mémoire : ce qui
  // suit n'est plus du rappel, c'est de la frappe.
  let firstInput: number | undefined;
  field.addEventListener('input', () => (firstInput = performance.now()), { once: true });

  return {
    getValue: () => field.value,
    focus: () => field.focus(),
    firstInputAt: () => firstInput,
    lock: () => {
      field.readOnly = true;
      field.setAttribute('aria-readonly', 'true');
    },
    onSubmit: (cb) => {
      (field as HTMLElement).addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          cb();
        }
      });
    },
  };
}

const INPUT_ATTRS = {
  autocomplete: 'off',
  autocapitalize: 'off',
  autocorrect: 'off',
  spellcheck: 'false',
  lang: 'en',
};

function answerField(): HTMLTextAreaElement {
  return el('textarea', {
    ...INPUT_ATTRS,
    class: 'ex-field',
    rows: 2,
    'aria-label': 'Ta réponse',
  });
}

function promptLine(exercise: Exercise): HTMLElement {
  return el('p', { class: 'ex-prompt' }, [exercise.prompt]);
}

/**
 * Les deux faces d'un même énoncé : avec saisie à l'écran, et sans — quand la
 * réponse s'écrit sur le cahier.
 */
export interface FreeTextView {
  render(exercise: Exercise, container: HTMLElement): ExerciseHandle;
  statement(exercise: Exercise, container: HTMLElement): void;
}

/** Phrase entière à produire : zone de texte sur plusieurs lignes. */
export const textareaView: FreeTextView = {
  render(exercise, container) {
    const field = answerField();
    container.append(promptLine(exercise), field);
    return handleFor(field);
  },
  statement(exercise, container) {
    container.append(promptLine(exercise));
  },
};

/**
 * Exercices bâtis sur une phrase de départ (`transform`, `spot_error`).
 * Cette phrase est montrée à part, dans un bloc à elle : elle n'est pas la
 * consigne, c'est la matière sur laquelle travailler.
 */
export function sourcedView(label: string, variant: string): FreeTextView {
  const source = (exercise: Exercise) =>
    el('div', { class: `ex-source ex-source--${variant}` }, [
      el('span', { class: 'ex-source__label' }, [label]),
      el('p', { lang: 'en' }, [exercise.source ?? '']),
    ]);

  return {
    render(exercise, container) {
      const field = answerField();
      container.append(source(exercise), promptLine(exercise), field);
      return handleFor(field);
    },
    statement(exercise, container) {
      container.append(source(exercise), promptLine(exercise));
    },
  };
}

/** Largeur du champ inline, en caractères : assez pour écrire, jamais un indice. */
const INLINE_MIN_CH = 9;
const INLINE_MAX_CH = 26;

/** Trou à combler : le champ prend la place de `___` dans la phrase. */
export const inlineView: FreeTextView = {
  render(exercise, container) {
    const field = el('input', {
      ...INPUT_ATTRS,
      type: 'text',
      size: INLINE_MIN_CH,
      class: 'ex-field ex-field--inline',
      'aria-label': 'Mot manquant',
    });

    // Le champ s'élargit avec la saisie au lieu de s'étaler sur toute la ligne :
    // la phrase doit rester lisible d'un seul tenant, y compris sur mobile.
    field.addEventListener('input', () => {
      field.size = Math.min(INLINE_MAX_CH, Math.max(INLINE_MIN_CH, field.value.length + 1));
    });

    const prompt = el('p', { class: 'ex-prompt ex-prompt--inline' });
    const [before = '', ...rest] = exercise.prompt.split(BLANK);
    if (rest.length === 0) {
      // Pas de marqueur `___` : on retombe sur prompt puis champ dessous.
      prompt.append(exercise.prompt);
      container.append(prompt, field);
    } else {
      prompt.append(before, field, rest.join(BLANK));
      container.append(prompt);
    }
    return handleFor(field);
  },

  // Sur le cahier, le trou reste un trou : un blanc souligné, à la même place.
  statement(exercise, container) {
    const prompt = el('p', { class: 'ex-prompt ex-prompt--inline' });
    const [before = '', ...rest] = exercise.prompt.split(BLANK);
    if (rest.length === 0) prompt.append(exercise.prompt);
    else prompt.append(before, el('span', { class: 'ex-blank' }), rest.join(BLANK));
    container.append(prompt);
  },
};

export function freeTextRenderer(view: FreeTextView): ExerciseRenderer {
  return { render: view.render, statement: view.statement, grade: gradeFreeText };
}
