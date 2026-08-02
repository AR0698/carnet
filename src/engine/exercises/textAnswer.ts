/**
 * Socle partagé par les types d'exercice à réponse libre
 * (`produce`, `fill_blank`, `transform`, `spot_error`).
 *
 * Deux variantes de rendu : une zone de texte (phrase entière à produire) ou
 * un champ inséré dans la phrase (trou à combler). La correction, elle, est
 * commune : comparaison normalisée contre `answerSpec.accepted`.
 */

import type { Exercise } from '../../packs/schema';
import { analyse, canonicalAnswer, isAccepted, otherAnswers } from '../grading';
import { el } from '../../ui/dom';
import type { ExerciseHandle, ExerciseRenderer, GradeResult } from './types';

const BLANK = '___';

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
  return {
    getValue: () => field.value,
    focus: () => field.focus(),
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

/** Phrase entière à produire : zone de texte sur plusieurs lignes. */
export function renderTextarea(exercise: Exercise, container: HTMLElement): ExerciseHandle {
  const field = answerField();
  container.append(el('p', { class: 'ex-prompt' }, [exercise.prompt]), field);
  return handleFor(field);
}

/**
 * Exercices bâtis sur une phrase de départ (`transform`, `spot_error`).
 * Cette phrase est montrée à part, dans un bloc à elle : elle n'est pas la
 * consigne, c'est la matière sur laquelle travailler.
 */
export function renderSourced(
  label: string,
  variant: string,
): (exercise: Exercise, container: HTMLElement) => ExerciseHandle {
  return (exercise, container) => {
    const field = answerField();
    container.append(
      el('div', { class: `ex-source ex-source--${variant}` }, [
        el('span', { class: 'ex-source__label' }, [label]),
        el('p', { lang: 'en' }, [exercise.source ?? '']),
      ]),
      el('p', { class: 'ex-prompt' }, [exercise.prompt]),
      field,
    );
    return handleFor(field);
  };
}

/** Largeur du champ inline, en caractères : assez pour écrire, jamais un indice. */
const INLINE_MIN_CH = 9;
const INLINE_MAX_CH = 26;

/** Trou à combler : le champ prend la place de `___` dans la phrase. */
export function renderInline(exercise: Exercise, container: HTMLElement): ExerciseHandle {
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
}

export function freeTextRenderer(
  render: (ex: Exercise, c: HTMLElement) => ExerciseHandle,
): ExerciseRenderer {
  return { render, grade: gradeFreeText };
}
