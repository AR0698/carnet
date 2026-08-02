import { remainingNewQuota } from '../../engine/session';
import { countAll } from '../../storage/cards';
import { el, mount } from '../dom';
import type { Ctx } from '../types';
import { renderPwaNotices } from './pwaNotices';

const TIME_CHOICES = [5, 15, 30];

export async function renderHome(ctx: Ctx): Promise<void> {
  const packId = ctx.pack.meta.id;
  const [counts, quota] = await Promise.all([countAll(packId), remainingNewQuota(packId)]);

  // Ce qui est réellement travaillable maintenant : le quota du jour peut
  // limiter les nouvelles notions sans que rien ne soit « bloqué ».
  const openable = Math.min(counts.fresh, quota);
  const workable = counts.due + openable;
  const quotaReached = workable === 0 && counts.fresh > 0;

  const stat = (n: number, label: string) =>
    el('div', { class: 'stat' }, [el('b', {}, [String(n)]), el('span', {}, [label])]);

  const choices = el(
    'div',
    { class: 'time-choice' },
    TIME_CHOICES.map((m) => {
      const b = el('button', { class: 'btn btn--quiet', type: 'button' }, [`${m} min`]);
      b.addEventListener('click', () => void ctx.nav.startSession(m));
      return b;
    }),
  );

  // Un seul bouton primaire par écran : c'est « 15 min » qui le porte.
  choices.children[1]?.classList.replace('btn--quiet', 'btn--primary');

  const notices = await renderPwaNotices(() => void renderHome(ctx));

  mount(
    ctx.root,
    el('header', { class: 'masthead' }, [
      el('h1', {}, ['Carnet']),
      el('p', { class: 'sub' }, [ctx.pack.meta.title]),
    ]),
    ...notices,
    el('section', { class: 'card' }, [
      el('div', { class: 'stats' }, [
        stat(counts.due, 'à revoir'),
        stat(counts.fresh, 'à découvrir'),
        stat(counts.mastered, 'en maintenance'),
      ]),
      workable > 0
        ? el('p', { class: 'notice' }, ['Combien de temps as-tu, là, maintenant ?'])
        : el('p', { class: 'notice' }, [
            quotaReached
              ? 'Tu as ouvert toutes les nouvelles notions prévues pour aujourd’hui. Le reste attend demain — c’est l’espacement qui fait le travail.'
              : 'Rien à revoir pour l’instant. Reviens plus tard, les cartes remonteront d’elles-mêmes.',
          ]),
      workable > 0 && choices,
    ]),
  );
}
