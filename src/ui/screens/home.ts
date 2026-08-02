import { remainingNewQuota } from '../../engine/session';
import { countAll } from '../../storage/cards';
import { db } from '../../storage/db';
import { State } from 'ts-fsrs';
import { el, mount } from '../dom';
import type { Ctx } from '../types';
import { renderPwaNotices } from './pwaNotices';

const TIME_CHOICES = [5, 15, 30];

const STATE_LABEL: Record<State, string> = {
  [State.New]: 'neuve',
  [State.Learning]: 'en apprentissage',
  [State.Review]: 'en révision',
  [State.Relearning]: 'à reprendre',
};

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
    await renderDevBar(ctx),
  );
}

/**
 * Inspecteur temporaire — il rend visible ce que l'étape 1 doit prouver :
 * l'état FSRS de chaque carte, tel qu'il est réellement en base.
 * À retirer à l'étape 5.
 */
async function renderDevBar(ctx: Ctx): Promise<HTMLElement> {
  const cards = await db.cards.where('packId').equals(ctx.pack.meta.id).toArray();
  cards.sort((a, b) => a.id.localeCompare(b.id));

  const reset = el('button', { class: 'btn btn--link', type: 'button' }, [
    'Réinitialiser la progression',
  ]);
  reset.addEventListener('click', async () => {
    if (!confirm('Effacer toute la progression enregistrée ? Cette action est définitive.')) return;
    await db.transaction('rw', db.cards, db.reviews, db.kv, async () => {
      await db.cards.clear();
      await db.reviews.clear();
      await db.kv.clear();
    });
    location.reload();
  });

  const rows = cards.map((c) =>
    el('div', {}, [
      `${c.itemId}#${c.exerciseIndex} · ${STATE_LABEL[c.state]} · échéance ${c.due.toLocaleString('fr-FR')} · ` +
        `stab ${c.stability.toFixed(2)} · diff ${c.difficulty.toFixed(2)} · ` +
        `réussites espacées ${c.spacedSuccesses}${c.interleavedSuccess ? ' · mélangée ✓' : ''}`,
    ]),
  );

  return el('div', { class: 'devbar' }, [
    el('div', {}, [`état en base (${cards.length} cartes)`]),
    ...rows,
    reset,
  ]);
}
