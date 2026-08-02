import { el, mount } from '../dom';
import type { Ctx, SessionResult } from '../types';

export function renderSummary(ctx: Ctx, result: SessionResult): void {
  const done = result.answered.length;
  const right = result.answered.filter((a) => a.correct).length;

  const dots = el(
    'div',
    { class: 'dots' },
    result.answered.map((a) => el('span', { class: `dot ${a.correct ? 'dot--on' : ''}` })),
  );

  // Plusieurs cartes ratées peuvent porter sur la même notion : on nomme la
  // notion une fois, c'est elle qui compte, pas le nombre d'exercices.
  const missed = [...new Set(result.answered.filter((a) => !a.correct).map((a) => a.topicTitle))];

  const back = el('button', { class: 'btn btn--primary', type: 'button' }, ['Revenir à l’accueil']);
  back.addEventListener('click', () => void ctx.nav.home());

  mount(
    ctx.root,
    el('header', { class: 'masthead' }, [
      el('p', { class: 'topic-label' }, [result.carnetLabel]),
      el('h1', {}, [done === 0 ? 'Session interrompue' : 'Session terminée']),
      el('p', { class: 'sub' }, [
        done === 0
          ? 'Rien n’a été enregistré. Tu peux reprendre quand tu veux.'
          : `${right} sur ${done} retrouvées.`,
      ]),
    ]),
    done > 0 &&
      el('section', { class: 'card' }, [
        dots,
        missed.length > 0
          ? el('div', {}, [
              el('p', { class: 'notice' }, [
                missed.length === 1
                  ? 'Une notion à revoir bientôt :'
                  : `${missed.length} notions à revoir bientôt :`,
              ]),
              el(
                'ul',
                { class: 'notice' },
                missed.map((title) => el('li', {}, [title])),
              ),
            ])
          : el('p', { class: 'notice' }, ['Tout est retrouvé. Les intervalles s’allongent.']),
      ]),
    el('div', { class: 'actions' }, [back]),
  );

  back.focus();
}
