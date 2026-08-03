/**
 * Le cours.
 *
 * Un endroit où aller comprendre, et rien d'autre : on n'y répond à rien, on
 * n'y gagne rien, aucune carte n'y bouge. C'est délibéré, et c'est la décision
 * la plus discutable de l'application — donc celle qui mérite d'être écrite.
 *
 * Une section de cours dans une application de mémorisation est un piège connu :
 * relire est facile, ça donne le sentiment très net de savoir, et ce sentiment
 * ne prédit pas ce dont on se souviendra la semaine suivante. Une explication
 * lue juste avant l'exercice transforme un rappel en recopie, et le bénéfice de
 * l'effort disparaît avec lui.
 *
 * D'où la règle que tout cet écran applique : **le cours n'est jamais sur le
 * chemin le plus court avant une réponse.** Il s'ouvre après une faute, depuis
 * le diagnostic, ou parce qu'on est venu exprès. Jamais à la place de l'effort,
 * toujours juste après.
 */

import type { Carnet } from '../../carnets';
import { GRAMMAR_PACK_ID } from '../../carnets';
import { contentLang, topicsWithLesson, type Topic } from '../../packs/schema';
import { el, mount } from '../dom';
import { lessonCard } from '../lesson';
import type { Ctx } from '../types';

/** Les carnets qui ont quelque chose à lire — les seuls à proposer ici. */
function taughtCarnets(carnets: Carnet[]): Carnet[] {
  return carnets.filter((c) => topicsWithLesson(c.pack).length > 0);
}

/** Le carnet demandé, ou le premier qui a des fiches — la grammaire d'abord. */
function carnetForCourse(carnets: Carnet[], packId?: string): Carnet | undefined {
  if (packId) return carnets.find((c) => c.id === packId);
  const taught = taughtCarnets(carnets);
  return taught.find((c) => c.id === GRAMMAR_PACK_ID) ?? taught[0];
}

/** Tout le texte d'une fiche, aplati — c'est là-dedans que la recherche cherche. */
function haystack(topic: Topic): string {
  const l = topic.lesson;
  if (!l) return topic.title.toLowerCase();
  return [
    topic.title,
    l.image,
    l.rule,
    l.trap.wrong,
    l.trap.right,
    l.trap.why,
    l.contrast?.left,
    l.contrast?.right,
    l.contrast?.note,
    // La scène et l'échelle portent le gros du vocabulaire d'une unité : sans
    // elles, chercher « bouilloire » ne trouverait pas la fiche qui l'enseigne.
    l.scene?.where,
    l.scene?.text,
    ...(l.scene?.gloss ?? []).flatMap((g) => [g.en, g.fr]),
    l.scale?.label,
    ...(l.scale?.steps ?? []).flatMap((s) => [s.en, s.fr]),
    ...l.examples.flatMap((e) => [e.en, e.fr]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export interface CourseOptions {
  packId?: string;
  /** Ouvre directement une fiche plutôt que l'index. */
  topicId?: string;
}

export async function renderCourse(ctx: Ctx, options: CourseOptions = {}): Promise<void> {
  const carnet = carnetForCourse(ctx.carnets, options.packId);

  const back = el('button', { class: 'btn btn--link', type: 'button' }, ['← Retour aux carnets']);
  back.addEventListener('click', () => void ctx.nav.home());

  if (!carnet) {
    mount(
      ctx.root,
      el('div', { class: 'crumb' }, [back]),
      el('header', { class: 'masthead' }, [el('h1', {}, ['Le cours'])]),
      el('section', { class: 'card' }, [
        el('p', { class: 'notice' }, ['Aucun carnet ouvert n’a de fiche pour l’instant.']),
      ]),
    );
    return;
  }

  const pack = carnet.pack;
  const lang = contentLang(pack);
  const taught = topicsWithLesson(pack);
  const titleOf = (id: string) => pack.topics.find((t) => t.id === id)?.title;

  const open = (topicId: string) => void renderCourse(ctx, { packId: carnet.id, topicId });

  // --- une fiche ---

  const asked = options.topicId ? pack.topics.find((t) => t.id === options.topicId) : undefined;

  if (asked) {
    const toIndex = el('button', { class: 'btn btn--link', type: 'button' }, ['← Toutes les fiches']);
    toIndex.addEventListener('click', () => void renderCourse(ctx, { packId: carnet.id }));

    // Feuilleter de proche en proche, dans l'ordre du parcours : c'est le
    // geste naturel une fois qu'on est dedans, et il évite le détour par
    // l'index pour aller voir l'unité d'à côté — souvent celle qu'on
    // confondait.
    const rank = taught.findIndex((t) => t.id === asked.id);
    const previous = rank > 0 ? taught[rank - 1] : undefined;
    const next = rank >= 0 && rank < taught.length - 1 ? taught[rank + 1] : undefined;

    const step = (topic: Topic | undefined, label: string) => {
      if (!topic) return false;
      const b = el('button', { class: 'btn btn--quiet', type: 'button' }, [label]);
      b.addEventListener('click', () => open(topic.id));
      return b;
    };

    mount(
      ctx.root,
      el('div', { class: 'crumb' }, [toIndex]),
      el('header', { class: 'masthead' }, [
        el('p', { class: 'topic-label' }, [asked.group ?? carnet.label]),
        el('h1', {}, [asked.title]),
      ]),
      el(
        'section',
        { class: 'card' },
        asked.lesson
          ? [lessonCard(asked, { lang, onNavigate: open, titleOf })]
          : [
              el('p', { class: 'notice' }, [
                'Cette unité n’a pas encore de fiche. Ses exercices, eux, sont déjà là — ' +
                  'la fiche viendra sans que tu aies à recommencer quoi que ce soit.',
              ]),
            ],
      ),
      el('div', { class: 'course-steps' }, [
        step(previous, '← Précédente'),
        step(next, 'Suivante →'),
      ]),
    );
    return;
  }

  // --- l'index ---

  const search = el('input', {
    type: 'search',
    class: 'course-search',
    placeholder: 'Chercher une règle, un mot, une faute…',
    'aria-label': 'Chercher dans les fiches',
  });

  const results = el('div', { class: 'course-index' });

  function draw(query: string): void {
    const q = query.trim().toLowerCase();
    const matching = q.length === 0 ? taught : taught.filter((t) => haystack(t).includes(q));

    if (matching.length === 0) {
      mount(
        results,
        el('p', { class: 'notice' }, [
          `Rien pour « ${query.trim()} ». Les fiches ne couvrent pas encore tout le carnet — ` +
            'les exercices, si.',
        ]),
      );
      return;
    }

    // Groupé comme le carnet lui-même : c'est la carte mentale qu'on a déjà,
    // et en construire une seconde pour le cours n'aiderait personne.
    const groups = new Map<string, Topic[]>();
    for (const topic of matching) {
      const key = topic.group ?? 'Autres';
      groups.set(key, [...(groups.get(key) ?? []), topic]);
    }

    mount(
      results,
      ...[...groups].map(([group, topics]) =>
        el('section', { class: 'course-group' }, [
          el('p', { class: 'topic-label' }, [group]),
          el(
            'ul',
            { class: 'course-list' },
            topics.map((topic) => {
              const row = el('button', { class: 'course-row', type: 'button' }, [
                el('span', { class: 'course-row__title' }, [topic.title]),
                el('span', { class: 'course-row__rule' }, [topic.lesson?.rule ?? '']),
              ]);
              row.addEventListener('click', () => open(topic.id));
              return el('li', {}, [row]);
            }),
          ),
        ]),
      ),
    );
  }

  search.addEventListener('input', () => draw((search as HTMLInputElement).value));
  draw('');

  // Le choix du carnet, en tête.
  //
  // L'écran ouvrait la grammaire et rien d'autre : aucun chemin ne menait aux
  // fiches de vocabulaire, qui existaient pourtant. Un onglet par carnet ayant
  // des fiches — les autres n'en ont pas, et un onglet vide serait une promesse
  // en l'air. À un seul carnet enseigné, la barre disparaît : choisir entre une
  // chose n'est pas choisir.
  const others = taughtCarnets(ctx.carnets);
  const picker =
    others.length > 1 &&
    el(
      'nav',
      { class: 'course-picker', 'aria-label': 'Carnet' },
      others.map((c) => {
        const here = c.id === carnet.id;
        const tab = el(
          'button',
          { class: 'course-picker__tab', type: 'button', 'aria-current': String(here) },
          [c.label],
        );
        if (!here) tab.addEventListener('click', () => void renderCourse(ctx, { packId: c.id }));
        return tab;
      }),
    );

  mount(
    ctx.root,
    el('div', { class: 'crumb' }, [back]),
    el('header', { class: 'masthead' }, [
      el('h1', {}, ['Le cours']),
      el('p', { class: 'sub' }, [
        'Une fiche par unité : l’image, la règle, le piège du francophone, ' +
          'et deux phrases qu’on pourrait vraiment dire.',
      ]),
    ]),
    el('section', { class: 'card' }, [
      picker,
      el('p', { class: 'notice' }, [
        `${carnet.label} — ${taught.length} fiche${taught.length > 1 ? 's' : ''} ` +
          `sur ${pack.topics.length} unités. Le cours ne fait avancer aucune carte : ` +
          'on y vient pour comprendre, pas pour réviser.',
      ]),
      search,
    ]),
    results,
  );
}
