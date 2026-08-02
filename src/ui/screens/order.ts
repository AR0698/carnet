/**
 * Par où commencer.
 *
 * Le seul levier de séquence laissé à l'apprenante, et il est étroit à dessein :
 * il ne change que l'ordre dans lequel le contenu **neuf** s'ouvre. Ce qui est
 * déjà commencé revient quand le planificateur le décide, jamais quand on le
 * demande — sans quoi on retomberait dans la pratique en bloc.
 *
 * Le choix se fait par groupe et non par notion : quatorze groupes se lisent
 * d'un coup d'œil, cent quarante-cinq notions non.
 */

import { carnetOf } from '../../carnets';
import { State } from '../../engine/scheduler';
import { packCards } from '../../storage/cards';
import { loadPriority, togglePriority } from '../../storage/priorities';
import { el, mount } from '../dom';
import type { Ctx } from '../types';

interface GroupState {
  name: string;
  topics: number;
  /** Cartes encore jamais vues dans ce groupe. */
  fresh: number;
  total: number;
  chosen: boolean;
}

export async function renderOrder(ctx: Ctx, packId: string): Promise<void> {
  const carnet = carnetOf(ctx.carnets, packId);
  if (!carnet) {
    await ctx.nav.home();
    return;
  }

  const [cards, priority] = await Promise.all([packCards(packId), loadPriority(packId)]);

  // Un pack sans groupes déclarés : la notion tient lieu de groupe.
  const groupOf = new Map(carnet.pack.topics.map((t) => [t.id, t.group ?? t.title]));

  const groups = new Map<string, GroupState>();
  for (const topic of carnet.pack.topics) {
    const name = groupOf.get(topic.id)!;
    const g = groups.get(name) ?? {
      name,
      topics: 0,
      fresh: 0,
      total: 0,
      chosen: priority.includes(name),
    };
    g.topics += 1;
    groups.set(name, g);
  }
  for (const card of cards) {
    const g = groups.get(groupOf.get(card.topicId) ?? '');
    if (!g) continue;
    g.total += 1;
    if (card.state === State.New) g.fresh += 1;
  }

  const back = el('button', { class: 'btn btn--link', type: 'button' }, ['← Retour aux carnets']);
  back.addEventListener('click', () => void ctx.nav.home());

  function row(group: GroupState): HTMLElement {
    const box = el('input', { type: 'checkbox', class: 'toggle__box' });
    box.checked = group.chosen;
    box.addEventListener('change', () => {
      void togglePriority(packId, group.name).then(() => ctx.nav.order(packId));
    });

    const opened = group.total - group.fresh;
    const state =
      group.total === 0
        ? 'pas encore écrit'
        : group.fresh === 0
          ? 'entièrement ouvert'
          : `${opened} carte${opened > 1 ? 's' : ''} sur ${group.total} ouverte${opened > 1 ? 's' : ''}`;

    return el('label', { class: 'toggle' }, [
      box,
      el('span', { class: 'toggle__text' }, [
        el('b', {}, [group.name]),
        el('small', {}, [
          `${group.topics} notion${group.topics > 1 ? 's' : ''} · ${state}`,
        ]),
      ]),
    ]);
  }

  const list = [...groups.values()];
  // Les groupes choisis remontent, puis ceux qui restent à ouvrir, puis le reste.
  list.sort(
    (a, b) => Number(b.chosen) - Number(a.chosen) || Number(b.fresh > 0) - Number(a.fresh > 0),
  );

  mount(
    ctx.root,
    el('div', { class: 'crumb' }, [back]),
    el('header', { class: 'masthead' }, [
      el('p', { class: 'topic-label' }, [carnet.label]),
      el('h1', {}, ['Par où commencer']),
      el('p', { class: 'sub' }, [
        'Les groupes cochés ouvrent leurs notions en premier. Les autres suivent dans l’ordre du carnet.',
      ]),
    ]),

    el('section', { class: 'card' }, list.map(row)),

    el('details', { class: 'how' }, [
      el('summary', {}, ['Ce que ce réglage ne fait pas']),
      el('ul', {}, [
        el('li', {}, [
          'Il ne change que l’ordre d’ouverture des notions neuves. Une carte déjà commencée revient quand le planificateur le décide.',
        ]),
        el('li', {}, [
          'Il ne filtre pas les sessions. Réviser un seul groupe en bloc donne d’excellents résultats sur le moment et rien la semaine suivante — c’est le mélange qui fait tenir.',
        ]),
        el('li', {}, [
          'Il ne touche pas au plafond de dix nouveautés par jour : c’est l’espacement qui travaille, pas le volume.',
        ]),
      ]),
    ]),
  );
}
