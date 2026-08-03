/**
 * `picture` — un dessin, et le mot qui va avec.
 *
 * Le seul exercice de l'application qui ne passe pas par le français. C'est
 * exactement là qu'est son intérêt : `a kettle` appris comme « une bouilloire »
 * s'atteint en deux temps — image, mot français, mot anglais — et le maillon du
 * milieu finit par manquer au moment de parler. Appris sur le dessin, le mot
 * s'accroche directement à la chose.
 *
 * Il ne remplace pas la production depuis le français, il la double : les mots
 * dessinables portent les deux, et ce sont deux cartes distinctes, avec chacune
 * son état FSRS. Deux chemins vers le même mot valent mieux qu'un.
 *
 * Le dessin est vectoriel et vient du même registre que le reste
 * (`ui/vocabArt.ts`) : quelques centaines d'octets, net à toutes les tailles,
 * disponible en mode avion, et repeint avec la palette.
 */

import type { Exercise } from '../../packs/schema';
import { el } from '../../ui/dom';
import { vocabArt } from '../../ui/vocabArt';
import { gradeFreeText, textareaView } from './textAnswer';
import type { ExerciseHandle, ExerciseRenderer } from './types';

/**
 * Le cadre du dessin.
 *
 * Sans texte de remplacement décrivant l'objet : le dire, c'est donner la
 * réponse. Le lecteur d'écran annonce donc la consigne et un cadre vide, ce qui
 * est la traduction honnête de « il y a un dessin ici, et il est la question ».
 * L'exercice reste faisable autrement — le même mot a toujours sa carte de
 * production depuis le français.
 */
function artBlock(exercise: Exercise): HTMLElement {
  const drawing = vocabArt(exercise.art ?? '');
  return el('div', { class: 'ex-art', role: 'img', 'aria-label': 'Dessin à nommer' }, [
    drawing ?? el('p', { class: 'ex-art__missing' }, ['(dessin manquant)']),
  ]);
}

function render(exercise: Exercise, container: HTMLElement): ExerciseHandle {
  container.append(artBlock(exercise));
  return textareaView.render(exercise, container);
}

function statement(exercise: Exercise, container: HTMLElement): void {
  container.append(artBlock(exercise));
  textareaView.statement(exercise, container);
}

export const picture: ExerciseRenderer = { render, statement, grade: gradeFreeText };
