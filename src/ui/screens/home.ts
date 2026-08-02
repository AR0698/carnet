import type { Carnet } from '../../carnets';
import { formatDelay } from '../../engine/scheduler';
import { remainingNewQuota } from '../../engine/session';
import { countAll, nextDueDate, type PackCounts } from '../../storage/cards';
import { loadPrefs, savePrefs } from '../../storage/prefs';
import { GRAMMAR_PACK_ID, VOCAB_PACK_ID } from '../../carnets';
import { bristolBanner, carnetGlyph } from '../art';
import { el, mount } from '../dom';
import type { Ctx } from '../types';
import { renderPwaNotices } from './pwaNotices';

const TIME_CHOICES = [5, 15, 30];

/**
 * Ce que l'application fait de la mémoire, en clair.
 *
 * Une application de répétition espacée passe pour capricieuse tant qu'on ne
 * sait pas ce qu'elle décide à notre place : pourquoi cette carte-là, pourquoi
 * pas demain, pourquoi si peu de nouveautés. Six phrases suffisent à lever le
 * malentendu, et une méthode comprise est une méthode qu'on suit.
 */
const HOW_IT_WORKS: string[] = [
  'Tu réponds de mémoire, sans relire d’abord. Chercher fatigue — et c’est précisément cet effort qui grave.',
  'Chaque réponse déplace la carte dans le temps. Manquée, elle revient dans la journée ; retrouvée, elle s’éloigne : demain, dans trois jours, la semaine prochaine, le mois prochain.',
  'Rien n’est rangé comme « su » avant d’avoir été retrouvé deux jours différents. Deux réussites d’affilée le même jour ne prouvent rien d’autre qu’une bonne mémoire de court terme.',
  'Les notions sont mélangées au sein d’une même session, jamais révisées en bloc. C’est plus dur sur le moment, et c’est ce qui tient.',
  'Dix nouvelles notions par jour et par carnet. Le reste attend : c’est l’espacement qui travaille, pas le volume.',
  'Les trois carnets avancent séparément, chacun à son rythme. Tout vit sur cet appareil, hors ligne, sans compte.',
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
    el('span', { class: 'toggle__text' }, [el('b', {}, [label]), el('small', {}, [note])]),
  ]);
}

/** Ce qu'un carnet a dans le ventre au moment où on le regarde. */
interface CarnetState {
  carnet: Carnet;
  counts: PackCounts;
  /** Cartes réellement travaillables maintenant, quota du jour compris. */
  workable: boolean;
  /** Le quota de nouveautés est épuisé, mais il reste des notions non ouvertes. */
  quotaReached: boolean;
  nextDue: Date | null;
}

async function readState(carnet: Carnet): Promise<CarnetState> {
  const [counts, quota, nextDue] = await Promise.all([
    countAll(carnet.id),
    remainingNewQuota(carnet.id),
    nextDueDate(carnet.id),
  ]);
  const openable = Math.min(counts.fresh, quota);
  return {
    carnet,
    counts,
    workable: counts.due + openable > 0,
    quotaReached: counts.due + openable === 0 && counts.fresh > 0,
    nextDue,
  };
}

/**
 * Une file vide n'est pas la fin du parcours : c'est un rendez-vous plus tard.
 * Le dire évite de croire qu'on a « fini », et de revenir six fois dans l'heure.
 */
function restNotice(state: CarnetState): string {
  const rendezvous = state.nextDue
    ? `La prochaine remonte ${formatDelay(new Date(), state.nextDue)}.`
    : '';

  if (state.quotaReached) {
    return `Toutes les nouveautés du jour sont ouvertes — c’est l’espacement qui fait le travail, pas le volume. ${rendezvous}`;
  }
  if (state.nextDue) {
    return `Rien à revoir maintenant. ${rendezvous}`;
  }
  return 'Rien à revoir pour l’instant. Les cartes remonteront d’elles-mêmes.';
}

export async function renderHome(ctx: Ctx): Promise<void> {
  const [states, prefs, notices] = await Promise.all([
    Promise.all(ctx.carnets.map(readState)),
    loadPrefs(),
    renderPwaNotices(() => void renderHome(ctx)),
  ]);

  // Lue au clic, pas capturée au rendu : la case peut être cochée après coup.
  let paper = prefs.paper;

  // Un seul bouton principal par écran, même à trois carnets : il revient au
  // premier qui a quelque chose à proposer. Les autres restent discrets.
  const leading = states.find((s) => s.workable)?.carnet.id;

  const stat = (n: number, label: string) =>
    el('div', { class: 'stat' }, [el('b', {}, [String(n)]), el('span', {}, [label])]);

  function carnetSection(state: CarnetState): HTMLElement {
    const { carnet, counts } = state;
    // Un mot produit une ou deux cartes : c'est le nombre d'items qui compte
    // les mots, jamais `counts.total`.
    const words = carnet.pack.items.length;
    const empty = carnet.personal && words === 0;

    const durations = el(
      'div',
      { class: 'time-choice' },
      TIME_CHOICES.map((m) => {
        const primary = carnet.id === leading && m === 15;
        const b = el(
          'button',
          { class: `btn ${primary ? 'btn--primary' : 'btn--quiet'}`, type: 'button' },
          [`${m} min`],
        );
        b.addEventListener('click', () =>
          void ctx.nav.startSession(carnet.id, m, paper ? 'paper' : 'screen'),
        );
        return b;
      }),
    );

    const addWord = el(
      'button',
      { class: `btn ${empty ? 'btn--primary' : 'btn--link'}`, type: 'button' },
      ['J’ai un mot à ajouter'],
    );
    addWord.addEventListener('click', () => void ctx.nav.vocab({ compose: true }));

    const browse = el('button', { class: 'btn btn--link', type: 'button' }, [
      `Voir mes mots (${words})`,
    ]);
    browse.addEventListener('click', () => void ctx.nav.vocab());

    const glyph =
      carnet.id === GRAMMAR_PACK_ID
        ? 'grammar'
        : carnet.id === VOCAB_PACK_ID
          ? 'vocab'
          : 'culture';

    return el('section', { class: 'card carnet' }, [
      el('div', { class: 'carnet__head' }, [
        carnetGlyph(glyph),
        el('div', {}, [el('h2', {}, [carnet.label]), el('p', { class: 'sub' }, [carnet.tagline])]),
      ]),
      !empty &&
        el('div', { class: 'stats' }, [
          stat(counts.due, 'à revoir'),
          stat(counts.fresh, 'à découvrir'),
          stat(counts.mastered, 'en maintenance'),
        ]),
      empty
        ? el('p', { class: 'notice' }, [
            'Rien ici pour l’instant. Le premier mot que tu ajoutes entre aussitôt dans la révision.',
          ])
        : state.workable
          ? el('p', { class: 'notice' }, ['Combien de temps as-tu, là, maintenant ?'])
          : el('p', { class: 'notice' }, [restNotice(state)]),
      !empty && state.workable && durations,
      carnet.personal && el('div', { class: 'carnet__links' }, [addWord, !empty && browse]),
    ]);
  }

  const backup = el('button', { class: 'btn btn--link', type: 'button' }, ['Sauvegarder mes données']);
  backup.addEventListener('click', () => void ctx.nav.backup());

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

  mount(
    ctx.root,
    el('header', { class: 'masthead masthead--hero' }, [
      bristolBanner(),
      el('h1', {}, ['Go to Bristol']),
      el('p', { class: 'sub' }, ['L’anglais qu’il te faut pour y être chez toi.']),
    ]),
    ...notices,
    // Un carnet qui n'a pas pu s'ouvrir se dit : le silence ferait croire à
    // une progression perdue alors qu'il ne manque qu'un fichier.
    ctx.failures.length > 0 &&
      el('section', { class: 'pwa-note' }, [
        el('p', {}, [
          ctx.failures.length === 1
            ? 'Un carnet n’a pas pu être ouvert. Ta progression est intacte — il remontera à la prochaine connexion.'
            : 'Des carnets n’ont pas pu être ouverts. Ta progression est intacte — ils remonteront à la prochaine connexion.',
        ]),
        el(
          'ul',
          { class: 'pwa-note__steps' },
          ctx.failures.map((f) => el('li', {}, [`${f.id} — ${f.message}`])),
        ),
      ]),
    ...states.map(carnetSection),
    el('section', { class: 'card' }, [paperToggle]),
    el('details', { class: 'how' }, [
      el('summary', {}, ['Comment ça tient en mémoire']),
      el(
        'ul',
        {},
        HOW_IT_WORKS.map((line) => el('li', {}, [line])),
      ),
    ]),
    el('div', { class: 'footer-actions' }, [backup]),
  );
}
