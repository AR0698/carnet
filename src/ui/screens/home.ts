import { formatDelay } from '../../engine/scheduler';
import { remainingNewQuota } from '../../engine/session';
import { countAll, nextDueDate } from '../../storage/cards';
import { loadPrefs, savePrefs } from '../../storage/prefs';
import { el, mount } from '../dom';
import type { Ctx } from '../types';
import { renderPwaNotices } from './pwaNotices';

const TIME_CHOICES = [5, 15, 30];

/**
 * Ce que Carnet fait de la mémoire, en clair.
 *
 * Une application de répétition espacée passe pour capricieuse tant qu'on ne
 * sait pas ce qu'elle décide à notre place : pourquoi cette carte-là, pourquoi
 * pas demain, pourquoi si peu de nouveautés. Six phrases suffisent à lever le
 * malentendu, et une méthode comprise est une méthode qu'on suit.
 */
const HOW_IT_WORKS: string[] = [
  'Tu réponds de mémoire, sans relire d’abord. Chercher fatigue — et c’est précisément cet effort qui grave.',
  'Chaque réponse déplace la carte dans le temps. Manquée, elle revient dans la journée ; retrouvée, elle s’éloigne : demain, dans trois jours, la semaine prochaine, le mois prochain.',
  'Rien n’est rangé comme « su » avant d’avoir été retrouvé deux jours différents. Deux réussites d’affilée le même jour ne prouvent rien d’autre qu’une bonne mémoire de court terme.',
  'Les notions sont mélangées au sein d’une même session, jamais révisées en bloc. C’est plus dur sur le moment, et c’est ce qui tient.',
  'Dix nouvelles notions par jour au maximum. Le reste attend : c’est l’espacement qui travaille, pas le volume.',
  'Tout vit sur cet appareil, hors ligne. Un carnet, c’est un fichier de contenu — la grammaire anglaise aujourd’hui, n’importe quel sujet ensuite.',
];

interface ToggleOptions {
  checked: boolean;
  label: string;
  note: string;
  onChange(checked: boolean): void;
}

function toggle({ checked, label, note, onChange }: ToggleOptions): HTMLElement {
  const input = el('input', { type: 'checkbox', class: 'toggle__box' });
  input.checked = checked;
  input.addEventListener('change', () => onChange(input.checked));

  return el('label', { class: 'toggle' }, [
    input,
    el('span', { class: 'toggle__text' }, [
      el('b', {}, [label]),
      el('small', {}, [note]),
    ]),
  ]);
}

export async function renderHome(ctx: Ctx): Promise<void> {
  const packId = ctx.pack.meta.id;
  const [counts, quota, prefs, nextDue] = await Promise.all([
    countAll(packId),
    remainingNewQuota(packId),
    loadPrefs(),
    nextDueDate(packId),
  ]);

  // Ce qui est réellement travaillable maintenant : le quota du jour peut
  // limiter les nouvelles notions sans que rien ne soit « bloqué ».
  const openable = Math.min(counts.fresh, quota);
  const workable = counts.due + openable;
  const quotaReached = workable === 0 && counts.fresh > 0;

  // Lue au clic, pas capturée au rendu : la case peut être cochée après coup.
  let paper = prefs.paper;

  const stat = (n: number, label: string) =>
    el('div', { class: 'stat' }, [el('b', {}, [String(n)]), el('span', {}, [label])]);

  const choices = el(
    'div',
    { class: 'time-choice' },
    TIME_CHOICES.map((m) => {
      const b = el('button', { class: 'btn btn--quiet', type: 'button' }, [`${m} min`]);
      b.addEventListener('click', () => void ctx.nav.startSession(m, paper ? 'paper' : 'screen'));
      return b;
    }),
  );

  // Un seul bouton primaire par écran : c'est « 15 min » qui le porte.
  choices.children[1]?.classList.replace('btn--quiet', 'btn--primary');

  const paperToggle = toggle({
    checked: paper,
    label: 'J’ai un cahier à côté de moi',
    note:
      'Tu écris la réponse à la main, l’application te montre la sienne, et c’est toi qui juges. ' +
      'Écrire laisse une trace que taper ne laisse pas.',
    onChange: (v) => {
      paper = v;
      void savePrefs({ paper: v });
    },
  });

  const notices = await renderPwaNotices(() => void renderHome(ctx));

  // Une file vide n'est pas la fin du parcours : c'est un rendez-vous plus
  // tard. Le dire évite de croire qu'on a « fini », et de revenir six fois
  // dans l'heure pour vérifier.
  const nextRendezvous = nextDue ? `La prochaine remonte ${formatDelay(new Date(), nextDue)}.` : '';
  const restNotice = quotaReached
    ? `Tu as ouvert toutes les nouvelles notions prévues pour aujourd’hui — c’est l’espacement qui fait le travail, pas le volume. ${nextRendezvous}`
    : nextDue
      ? `Rien à revoir maintenant. Les cartes déjà travaillées reviennent d’elles-mêmes. ${nextRendezvous}`
      : 'Rien à revoir pour l’instant. Reviens plus tard, les cartes remonteront d’elles-mêmes.';

  mount(
    ctx.root,
    el('header', { class: 'masthead' }, [
      el('h1', {}, ['Carnet']),
      el('p', { class: 'sub' }, ['Apprendre n’importe quoi, et le retenir pour de bon.']),
    ]),
    ...notices,
    el('section', { class: 'card' }, [
      el('p', { class: 'topic-label' }, [`Carnet ouvert · ${ctx.pack.meta.title}`]),
      el('div', { class: 'stats' }, [
        stat(counts.due, 'à revoir'),
        stat(counts.fresh, 'à découvrir'),
        stat(counts.mastered, 'en maintenance'),
      ]),
      workable > 0
        ? el('p', { class: 'notice' }, ['Combien de temps as-tu, là, maintenant ?'])
        : el('p', { class: 'notice' }, [restNotice]),
      workable > 0 && choices,
      workable > 0 && paperToggle,
    ]),
    el('details', { class: 'how' }, [
      el('summary', {}, ['Comment Carnet fait tenir la mémoire']),
      el(
        'ul',
        {},
        HOW_IT_WORKS.map((line) => el('li', {}, [line])),
      ),
    ]),
  );
}
