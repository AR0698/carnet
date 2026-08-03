import type { Carnet } from '../../carnets';
import { formatDelay } from '../../engine/scheduler';
import { MAX_NEW_PER_DAY, remainingNewQuota } from '../../engine/session';
import { countAll, nextDueDate, type PackCounts } from '../../storage/cards';
import {
  dateInputValue,
  loadCountdown,
  longDate,
  parseDateInput,
  setTarget,
  type Countdown,
} from '../../storage/countdown';
import { loadPrefs, savePrefs } from '../../storage/prefs';
import { GRAMMAR_PACK_ID, VOCAB_PACK_ID, VOCABULARY_PACK_ID } from '../../carnets';
import { topicsWithLesson } from '../../packs/schema';
import { bristolBanner, carnetGlyph } from '../art';
import { el, mount } from '../dom';
import type { Ctx } from '../types';
import { renderPwaNotices } from './pwaNotices';

const TIME_CHOICES = [5, 15, 30];

/** Une vignette par carnet ; les inconnus retombent sur celle de Culture. */
const GLYPHS: Record<string, Parameters<typeof carnetGlyph>[0]> = {
  [GRAMMAR_PACK_ID]: 'grammar',
  [VOCABULARY_PACK_ID]: 'themes',
  [VOCAB_PACK_ID]: 'vocab',
};

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
  'Les carnets avancent séparément, chacun à son rythme. Tout vit sur cet appareil, hors ligne, sans compte.',
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

/**
 * Le compte à rebours — la seule chose de cet écran qui avance toute seule.
 *
 * Une application de répétition espacée n'a pas de fin : elle propose ce qui est
 * dû, chaque jour, indéfiniment. C'est honnête, et c'est démoralisant. Le
 * départ, lui, a une date, et la donner rend visible ce que l'espacement rend
 * invisible.
 *
 * La carte dit trois choses et pas une de plus : combien de jours il reste, ce
 * qu'il reste à ouvrir dedans, et si le compte tombe juste. Ce dernier point est
 * le seul qui puisse contredire l'apprenante — et c'est pour lui qu'elle existe.
 */
function countdownCard(
  countdown: Countdown,
  fresh: number,
  carnets: number,
  onChange: () => void,
): HTMLElement {
  const { daysLeft, arrived, progress } = countdown;

  const bar = el('div', { class: 'countdown__bar' });
  const fill = el('i');
  fill.style.width = `${Math.round(progress * 100)}%`;
  bar.append(fill);

  // Ce que la date impose vraiment : le neuf restant divisé par les jours qui
  // restent. Comparé au plafond de dix par carnet, ça dit si la date tient.
  const ceiling = carnets * MAX_NEW_PER_DAY;
  const perDay = daysLeft > 0 ? Math.ceil(fresh / daysLeft) : fresh;

  const n = (v: number) => v.toLocaleString('fr-FR');
  const days = `${daysLeft} jour${daysLeft > 1 ? 's' : ''}`;

  const plan = arrived
    ? 'Le jour est arrivé. Le reste se passe là-bas.'
    : fresh === 0
      ? 'Toutes les cartes sont ouvertes : il ne reste qu’à les laisser revenir.'
      : perDay > ceiling
        ? `Il reste ${n(fresh)} cartes à ouvrir et ${days} pour le faire — soit ${n(perDay)} par jour, au-delà du plafond de ${ceiling}. La date tiendra, le programme entier non : c’est l’ordre d’ouverture qui décidera de ce que tu sauras.`
        : `Il reste ${n(fresh)} cartes à ouvrir et ${days} pour le faire : ${n(perDay)} par jour suffisent.`;

  const dateForm = el('div', { class: 'countdown__form', hidden: 'hidden' });
  const input = el('input', {
    type: 'date',
    class: 'countdown__date',
    'aria-label': 'Jour du départ',
  }) as HTMLInputElement;
  input.value = dateInputValue(countdown.target);
  input.addEventListener('change', () => {
    const chosen = parseDateInput(input.value);
    if (chosen) void setTarget(chosen).then(onChange);
  });
  dateForm.append(input);

  const change = el('button', { class: 'btn btn--link', type: 'button' }, ['Changer la date']);
  change.addEventListener('click', () => {
    dateForm.hidden = false;
    change.remove();
    input.focus();
  });

  return el('section', { class: `countdown${arrived ? ' countdown--arrived' : ''}` }, [
    el('div', { class: 'countdown__head' }, [
      el('b', { class: 'countdown__days' }, [arrived ? 'C’est' : String(daysLeft)]),
      el('span', { class: 'countdown__label' }, [
        arrived ? 'aujourd’hui' : `jour${daysLeft > 1 ? 's' : ''} avant Bristol`,
      ]),
    ]),
    !arrived && bar,
    el('p', { class: 'countdown__line' }, [
      arrived
        ? 'Tu as l’anglais qu’il te faut pour y être chez toi.'
        : `Tu es à ${days} d’avoir l’anglais qu’il te faut pour y vivre.`,
    ]),
    el('p', { class: 'countdown__line' }, [plan]),
    el('div', { class: 'countdown__meta' }, [
      el('span', {}, [`Départ le ${longDate(countdown.target)}`]),
      change,
    ]),
    dateForm,
  ]);
}

export async function renderHome(ctx: Ctx): Promise<void> {
  const [states, prefs, notices, countdown] = await Promise.all([
    Promise.all(ctx.carnets.map(readState)),
    loadPrefs(),
    renderPwaNotices(() => void renderHome(ctx)),
    loadCountdown(),
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

    // Choisir par où le neuf s'ouvre n'a de sens qu'avec du neuf en réserve et
    // plusieurs groupes entre lesquels arbitrer.
    const groups = new Set(carnet.pack.topics.map((t) => t.group ?? t.id));
    const canOrder = !carnet.personal && counts.fresh > 0 && groups.size > 1;
    const order = el('button', { class: 'btn btn--link', type: 'button' }, ['Par où commencer']);
    order.addEventListener('click', () => void ctx.nav.order(carnet.id));

    // Le cours de *ce* carnet-ci.
    //
    // Il vivait au pied de l'accueil, sans dire lequel il ouvrirait — c'était la
    // grammaire, faute de mieux, et le vocabulaire n'avait aucune porte. Le lien
    // vit donc maintenant dans le carnet dont il montre les fiches, et il annonce
    // combien il y en a.
    //
    // Ce que ce déplacement ne change pas, et qui est l'essentiel : il reste un
    // lien discret sur la dernière ligne de la carte, à côté de « Par où
    // commencer », jamais parmi les boutons de durée. Une porte « lire la règle »
    // aussi visible que « réviser 15 minutes » serait prise chaque fois que la
    // session fait peur, et relire à la place de chercher est exactement le troc
    // que cette application refuse.
    const taught = topicsWithLesson(carnet.pack).length;
    const course = el('button', { class: 'btn btn--link', type: 'button' }, [
      `Le cours (${taught})`,
    ]);
    course.addEventListener('click', () => void ctx.nav.course({ packId: carnet.id }));

    const links =
      (canOrder || taught > 0) &&
      el('div', { class: 'carnet__links' }, [canOrder && order, taught > 0 && course]);

    const head = el('div', { class: 'carnet__head' }, [
      carnetGlyph(GLYPHS[carnet.id] ?? 'culture'),
      el('div', {}, [el('h2', {}, [carnet.label]), el('p', { class: 'sub' }, [carnet.tagline])]),
    ]);

    // À quatre carnets, quatre cartes pleines transforment l'accueil en menu.
    // Celui qui n'a rien à proposer se replie : il dit quand il revient, et se tait.
    //
    // Il garde pourtant l'accès à ses fiches, et c'est cohérent avec le reste :
    // le seul moment où lire ne remplace aucun effort, c'est justement celui où
    // il n'y a rien à réviser.
    if (!empty && !state.workable) {
      return el('section', { class: 'card carnet carnet--quiet' }, [
        head,
        el('p', { class: 'notice' }, [restNotice(state)]),
        links,
      ]);
    }

    return el('section', { class: 'card carnet' }, [
      head,
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
        : el('p', { class: 'notice' }, ['Combien de temps as-tu, là, maintenant ?']),
      !empty && durations,
      carnet.personal && el('div', { class: 'carnet__links' }, [addWord, !empty && browse]),
      links,
    ]);
  }

  const insights = el('button', { class: 'btn btn--link', type: 'button' }, ['Où ça coince']);
  insights.addEventListener('click', () => void ctx.nav.insights());

  // La même porte, sans carnet désigné : elle ouvre l'index, où l'on choisit.
  // Elle reste en pied de page avec le diagnostic et la sauvegarde, et non à
  // côté des boutons de session — voir le lien par carnet, plus haut, pour le
  // raisonnement complet.
  const course = el('button', { class: 'btn btn--link', type: 'button' }, ['Le cours']);
  course.addEventListener('click', () => void ctx.nav.course());

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
    countdownCard(
      countdown,
      states.reduce((n, s) => n + s.counts.fresh, 0),
      states.length,
      () => void renderHome(ctx),
    ),
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
    el('div', { class: 'footer-actions' }, [insights, course, backup]),
  );
}
