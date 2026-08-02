/**
 * Où ça coince.
 *
 * L'écran ne propose aucun bouton « travailler cette notion », et c'est
 * délibéré. Filtrer une session sur une seule notion, c'est de la pratique en
 * bloc — exactement ce que l'accueil dit combattre : d'excellents résultats sur
 * le moment, rien la semaine suivante. Le planificateur fait déjà le travail,
 * une carte ratée revenant plus tôt et plus souvent. Ce qui manquait n'était pas
 * le mécanisme mais la confiance dans le mécanisme, et une notion basse *qui
 * remonte* n'appelle aucune action.
 *
 * D'où trois réponses seulement : ce qui résiste, ce qui tient, et les cartes
 * qui ne rentrent décidément pas.
 */

import {
  buildInsights,
  needsAttention,
  type CarnetInsight,
  type LeechCard,
  type TopicInsight,
} from '../../engine/insights';
import { allCards, resetCard } from '../../storage/cards';
import { db } from '../../storage/db';
import { clearDispute, listDisputes, type Dispute } from '../../storage/disputes';
import { el, mount } from '../dom';
import type { Ctx } from '../types';

const percent = (v: number) => `${Math.round(v * 100)} %`;

const TREND_LABEL: Record<TopicInsight['trend'], string> = {
  up: 'en progrès',
  down: 'en recul',
  flat: 'stable',
  unknown: '',
};

function topicRow(topic: TopicInsight): HTMLElement {
  const trend = TREND_LABEL[topic.trend];
  return el('li', { class: 'insight' }, [
    el('span', { class: 'insight__title' }, [topic.title]),
    el('span', { class: 'insight__meta' }, [
      `${percent(topic.accuracy)} sur ${topic.answers} réponse${topic.answers > 1 ? 's' : ''}`,
      trend && ` · ${trend}`,
    ]),
  ]);
}

export async function renderInsights(ctx: Ctx): Promise<void> {
  const [cards, reviews, disputes] = await Promise.all([
    allCards(),
    db.reviews.toArray(),
    listDisputes(),
  ]);

  const insights = buildInsights({ carnets: ctx.carnets, cards, reviews });

  const back = el('button', { class: 'btn btn--link', type: 'button' }, ['← Retour aux carnets']);
  back.addEventListener('click', () => void ctx.nav.home());

  function carnetBlock(carnet: CarnetInsight): HTMLElement | false {
    if (carnet.answers === 0) return false;

    const attention = carnet.weak.filter(needsAttention);

    return el('section', { class: 'card' }, [
      el('div', { class: 'carnet__head' }, [
        el('div', {}, [
          el('h2', {}, [carnet.label]),
          el('p', { class: 'sub' }, [
            `${carnet.answers} réponse${carnet.answers > 1 ? 's' : ''} · ${percent(carnet.accuracy)} justes`,
          ]),
        ]),
      ]),

      carnet.weak.length === 0
        ? el('p', { class: 'notice' }, [
            'Pas encore assez de réponses par notion pour dire quoi que ce soit d’honnête.',
          ])
        : el('div', {}, [
            el('p', { class: 'topic-label' }, [
              attention.length > 0 ? 'Ce qui résiste' : 'Les plus basses',
            ]),
            el(
              'ul',
              { class: 'insight-list' },
              (attention.length > 0 ? attention : carnet.weak).map(topicRow),
            ),
            attention.length === 0 &&
              el('p', { class: 'notice' }, [
                'Rien qui résiste vraiment : les notions les plus basses sont soit en progrès, soit déjà au-dessus de 70 %.',
              ]),
          ]),

      carnet.strong.length > 0 &&
        el('details', { class: 'how' }, [
          el('summary', {}, ['Ce qui tient']),
          el('ul', { class: 'insight-list' }, carnet.strong.map(topicRow)),
        ]),

      carnet.undecided > 0 &&
        el('p', { class: 'notice' }, [
          `${carnet.undecided} notion${carnet.undecided > 1 ? 's' : ''} encore trop peu travaillée${carnet.undecided > 1 ? 's' : ''} pour être jugée${carnet.undecided > 1 ? 's' : ''}.`,
        ]),
    ]);
  }

  function leechRow(leech: LeechCard): HTMLElement {
    const reset = el('button', { class: 'btn btn--link btn--danger', type: 'button' }, [
      'Repartir de zéro',
    ]);
    let armed = false;
    reset.addEventListener('click', () => {
      if (!armed) {
        armed = true;
        reset.replaceChildren(document.createTextNode('Confirmer la remise à zéro'));
        window.setTimeout(() => {
          armed = false;
          reset.replaceChildren(document.createTextNode('Repartir de zéro'));
        }, 4000);
        return;
      }
      void resetCard(leech.cardId).then(() => ctx.nav.insights());
    });

    return el('article', { class: 'vocab-item' }, [
      el('div', { class: 'vocab-item__head' }, [
        el('p', { class: 'vocab-item__meaning' }, [leech.topicTitle]),
        el('span', { class: 'chip chip--due' }, [
          `${leech.lapses} rechute${leech.lapses > 1 ? 's' : ''}`,
        ]),
      ]),
      el('p', { lang: 'en' }, [leech.prompt]),
      el('p', { class: 'vocab-item__example', lang: 'en' }, [leech.expected]),
      el('div', { class: 'vocab-item__actions' }, [reset]),
    ]);
  }

  function disputeRow(dispute: Dispute): HTMLElement {
    const done = el('button', { class: 'btn btn--link', type: 'button' }, ['C’est réglé']);
    done.addEventListener('click', () => {
      void clearDispute(dispute.cardId, dispute.given).then(() => ctx.nav.insights());
    });

    return el('article', { class: 'vocab-item' }, [
      el('p', { class: 'vocab-item__meaning' }, [dispute.prompt]),
      el('p', { lang: 'en' }, [
        el('span', { class: 'diff--missing' }, [dispute.given]),
        ' — attendu : ',
        el('span', {}, [dispute.expected]),
      ]),
      el('div', { class: 'vocab-item__actions' }, [done]),
    ]);
  }

  mount(
    ctx.root,
    el('div', { class: 'crumb' }, [back]),
    el('header', { class: 'masthead' }, [
      el('h1', {}, ['Où ça coince']),
      el('p', { class: 'sub' }, [
        'Lu dans le journal des réponses. Rien ici ne change la planification — ' +
          'une carte ratée revient déjà plus tôt et plus souvent, toute seule.',
      ]),
    ]),

    insights.tooEarly &&
      el('section', { class: 'card' }, [
        el('p', { class: 'notice' }, [
          'Il faut au moins quatre réponses sur une même notion pour en dire quelque chose. ' +
            'Reviens après quelques sessions — trois réponses ne distinguent pas une lacune d’un mauvais jour.',
        ]),
      ]),

    ...insights.carnets.map(carnetBlock),

    insights.leeches.length > 0 &&
      el('section', { class: 'card' }, [
        el('h2', {}, ['Les cartes qui ne rentrent pas']),
        el('p', { class: 'notice' }, [
          'Après autant de rechutes, l’état de la carte ne décrit plus une mémoire mais une série d’échecs, ' +
            'et elle revient sans fin à un jour d’intervalle. La remettre à zéro lui redonne une chance ; ' +
            'l’historique, lui, est conservé.',
        ]),
        el('div', { class: 'vocab-list' }, insights.leeches.slice(0, 10).map(leechRow)),
      ]),

    disputes.length > 0 &&
      el('section', { class: 'card' }, [
        el('h2', {}, ['Réponses que tu as contestées']),
        el('p', { class: 'notice' }, [
          'Des formulations comptées fausses que tu as jugées justes. À ajouter aux réponses acceptées ' +
            'du contenu, sinon elles seront refusées à nouveau.',
        ]),
        el('div', { class: 'vocab-list' }, disputes.map(disputeRow)),
      ]),
  );
}
