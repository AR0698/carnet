/**
 * La fiche de cours — l'endroit où on va comprendre.
 *
 * Une seule fonction de rendu, deux usages : l'écran de consultation, et la
 * fenêtre qui s'ouvre par-dessus une session quand une réponse vient d'être
 * ratée. Dans les deux cas c'est la même fiche, dans le même ordre, pour que
 * l'endroit où l'on cherche la règle soit toujours le même endroit.
 *
 * Sur la mise en page : l'ordre est fixe et n'est pas négociable — l'image, la
 * règle, le contraste, le piège, les exemples. On retient un cas concret bien
 * avant une formulation abstraite ; la formulation placée en tête se lit et ne
 * s'accroche à rien.
 *
 * Sur le dessin : il est en HTML et non en SVG, contrairement au reste des
 * illustrations. Un schéma porte du texte, et du texte dans un SVG ne suit ni
 * la taille de police du système ni les retours à la ligne. Une frise dont les
 * étiquettes débordent n'explique plus rien.
 */

import type { Lesson, LessonFigure, LessonRegister, Topic } from '../packs/schema';
import { el } from './dom';
import { listenButton } from './speech';

const REGISTER_LABEL: Record<LessonRegister, string> = {
  bristol: 'À Bristol',
  work: 'Au boulot',
};

/** Bornes de l'axe, en pourcentage — on garde une marge pour les bords ouverts. */
const clampPercent = (v: number): number => Math.min(100, Math.max(0, v));

/**
 * La frise : ce que la règle dit du temps, mis à plat.
 *
 * Chaque durée et chaque instant occupe sa propre ligne, étiquette au-dessus
 * de la barre. Deux étiquettes sur la même ligne finissent toujours par se
 * chevaucher sur un téléphone, et une frise illisible coûte plus qu'elle ne
 * rapporte. Le repère « maintenant » traverse toutes les lignes : c'est le
 * seul élément qui doit se lire d'un coup d'œil vertical.
 */
export function lessonFigure(figure: LessonFigure): HTMLElement {
  const rows: HTMLElement[] = [];

  for (const span of figure.spans ?? []) {
    const from = clampPercent(Math.min(span.from, span.to));
    const to = clampPercent(Math.max(span.from, span.to));
    const open = span.open;

    const bar = el('i', {
      class:
        `fig__bar fig__bar--${span.tone ?? 'strong'}` +
        (open ? ` fig__bar--open-${open}` : ''),
      style: `left:${from}%;width:${Math.max(to - from, 2)}%`,
    });

    rows.push(
      el('div', { class: 'fig__row' }, [
        el('span', { class: 'fig__label' }, [span.label]),
        el('div', { class: 'fig__track' }, [el('i', { class: 'fig__rule' }), bar]),
      ]),
    );
  }

  for (const mark of figure.marks ?? []) {
    const at = clampPercent(mark.at);
    rows.push(
      el('div', { class: 'fig__row' }, [
        el('span', { class: 'fig__label' }, [mark.label]),
        el('div', { class: 'fig__track' }, [
          el('i', { class: 'fig__rule' }),
          el('i', { class: 'fig__dot', style: `left:${at}%` }),
        ]),
      ]),
    );
  }

  if (rows.length === 0) return el('div', { class: 'fig fig--empty' });

  // Le repère traverse la pile entière : posé sur chaque ligne, il donnerait
  // autant de traits verticaux qu'il y a de lignes, et l'œil ne saurait plus
  // lequel est « maintenant ».
  //
  // Il est toujours au milieu de l'axe, jamais ailleurs : c'est une convention
  // de lecture, pas une valeur à régler. Le passé est à gauche, l'avenir à
  // droite, dans les 145 fiches — une frise dont le repère se déplace d'une
  // unité à l'autre oblige à relire l'axe avant de lire la règle. Les
  // coordonnées des durées sont donc écrites par rapport à ce milieu-là.
  const now =
    figure.now &&
    el('div', { class: 'fig__now' }, [el('i', {}), el('span', {}, [figure.now])]);

  return el('div', { class: 'fig' }, [el('div', { class: 'fig__stack' }, [...rows, now])]);
}

/** Une ligne d'exemple : la phrase anglaise, sa version française, et l'écoute. */
function exampleRow(example: Lesson['examples'][number], lang: string): HTMLElement {
  return el('div', { class: `lesson-eg lesson-eg--${example.register}` }, [
    el('span', { class: 'lesson-eg__tag' }, [REGISTER_LABEL[example.register]]),
    el('p', { class: 'lesson-eg__en', lang: 'en' }, [example.en]),
    el('p', { class: 'lesson-eg__fr' }, [example.fr]),
    listenButton(example.en, lang),
  ]);
}

export interface LessonCardOptions {
  /** Langue lue à voix haute — celle de la matière, pas celle des consignes. */
  lang: string;
  /** Ouvre une autre fiche. Sans lui, les renvois s'affichent sans être cliquables. */
  onNavigate?(topicId: string): void;
  /** Le titre des notions renvoyées, pour ne pas afficher des `u003` nus. */
  titleOf?(topicId: string): string | undefined;
}

/**
 * La fiche entière, dans son ordre de lecture.
 *
 * Rien n'est repliable : un accordéon obligerait à décider quoi ouvrir avant
 * de savoir ce qu'il y a dedans, alors que la fiche est déjà taillée pour
 * tenir d'un seul tenant. Ce qu'on vient chercher ici, c'est une réponse en
 * quelques secondes, pas une arborescence.
 */
export function lessonCard(topic: Topic, options: LessonCardOptions): HTMLElement {
  const lesson = topic.lesson;
  if (!lesson) return el('div');

  const { lang, onNavigate, titleOf } = options;

  const seeAlso = (lesson.seeAlso ?? []).map((id) => {
    const label = titleOf?.(id) ?? id;
    if (!onNavigate) return el('span', { class: 'lesson-link' }, [label]);
    const link = el('button', { class: 'btn btn--link lesson-link', type: 'button' }, [label]);
    link.addEventListener('click', () => onNavigate(id));
    return link;
  });

  return el('article', { class: 'lesson' }, [
    // L'image d'abord. C'est elle qui reste quand la formulation s'efface, et
    // c'est par elle qu'on retrouve la règle deux semaines plus tard.
    el('div', { class: 'lesson-image' }, [
      lesson.figure && lessonFigure(lesson.figure),
      el('p', { class: 'lesson-image__line' }, [lesson.image]),
    ]),

    el('div', { class: 'lesson-rule' }, [
      el('span', { class: 'lesson-tag' }, ['La règle']),
      el('p', {}, [lesson.rule]),
    ]),

    lesson.contrast &&
      el('div', { class: 'lesson-contrast' }, [
        el('div', { class: 'lesson-contrast__pair' }, [
          el('p', { lang: 'en' }, [lesson.contrast.left]),
          el('span', { class: 'lesson-contrast__vs' }, ['≠']),
          el('p', { lang: 'en' }, [lesson.contrast.right]),
        ]),
        el('p', { class: 'lesson-contrast__note' }, [lesson.contrast.note]),
      ]),

    // Le piège porte la mention explicite du français : c'est la seule partie
    // de la fiche qui explique une faute qu'on ne ferait pas dans une autre
    // langue de départ, et la nommer ainsi la rend reconnaissable.
    el('div', { class: 'lesson-trap' }, [
      el('span', { class: 'lesson-tag' }, ['Le piège français']),
      el('p', { class: 'lesson-trap__wrong', lang: 'en' }, [lesson.trap.wrong]),
      el('p', { class: 'lesson-trap__right', lang: 'en' }, [lesson.trap.right]),
      el('p', { class: 'lesson-trap__why' }, [lesson.trap.why]),
    ]),

    el('div', { class: 'lesson-egs' }, [
      el('span', { class: 'lesson-tag' }, ['En vrai']),
      ...lesson.examples.map((e) => exampleRow(e, lang)),
    ]),

    seeAlso.length > 0 &&
      el('div', { class: 'lesson-see' }, [
        el('span', { class: 'lesson-tag' }, ['À ne pas confondre avec']),
        el('div', { class: 'lesson-see__row' }, seeAlso),
      ]),
  ]);
}

/**
 * La fiche par-dessus la session, sans quitter la session.
 *
 * Naviguer vers un écran de cours au milieu d'une révision perdrait la file en
 * cours — elle ne vit que le temps de l'écran. Et surtout : sortir puis revenir
 * ferait de la consultation une interruption, quand elle doit être un coup
 * d'œil. D'où une `<dialog>` native, qui apporte le piège à focus et la touche
 * Échap sans qu'on les réécrive.
 */
export interface LessonDialogOptions {
  lang: string;
  /**
   * Retrouve une notion par son identifiant.
   *
   * Sert aux renvois : « à ne pas confondre avec » se suit **dans** la fenêtre,
   * sans la refermer. C'est souvent là que se trouve la réponse — on se trompe
   * rarement sur une règle isolée, presque toujours entre deux règles voisines.
   */
  resolve?(topicId: string): Topic | undefined;
}

export function openLessonDialog(topic: Topic, options: LessonDialogOptions): void {
  if (!topic.lesson) return;

  const dialog = el('dialog', { class: 'lesson-dialog' });
  const close = el('button', { class: 'btn btn--link lesson-dialog__close', type: 'button' }, [
    'Fermer',
  ]);
  close.addEventListener('click', () => dialog.close());

  const show = (shown: Topic): void => {
    dialog.replaceChildren(
      el('div', { class: 'lesson-dialog__head' }, [
        el('p', { class: 'topic-label' }, [shown.title]),
        close,
      ]),
      lessonCard(shown, {
        lang: options.lang,
        titleOf: (id) => options.resolve?.(id)?.title,
        onNavigate: options.resolve
          ? (id) => {
              const next = options.resolve?.(id);
              if (next?.lesson) {
                show(next);
                dialog.scrollTop = 0;
              }
            }
          : undefined,
      }),
    );
  };

  show(topic);

  // La fenêtre ne survit pas à sa fermeture : rouverte, elle est reconstruite
  // à partir de la notion demandée, qui n'est pas forcément la même.
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
}
