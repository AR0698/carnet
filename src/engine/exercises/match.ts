/**
 * `match` — relier quatre ou cinq mots à leur sens.
 *
 * C'est le premier contact avec une unité, et c'est le seul exercice de
 * l'application conçu pour être facile. La raison est précise : les autres
 * types demandent de récupérer une forme en mémoire, ce qui suppose qu'elle y
 * soit déjà. Le tout premier jour, elle n'y est pas — et une carte neuve qui ne
 * peut qu'échouer n'apprend rien qu'un aller-retour ne ferait mieux.
 *
 * Deux propriétés le rendent bien meilleur qu'une simple liste à lire :
 *
 * - **On y décide.** Rapprocher deux étiquettes est un choix, donc un
 *   engagement ; se tromper puis voir la bonne réponse laisse une trace que
 *   relire ne laisse pas. C'est l'effet de test appliqué au premier contact.
 * - **Les mots se voient ensemble.** Quatre mots d'une même famille montrés
 *   côte à côte se rangent les uns par rapport aux autres. Isolés, ils se
 *   ressemblent tous.
 *
 * L'identifiant de son item le fait passer en tête de l'unité : `newCards()`
 * ouvre le neuf par ordre d'item, et `<unité>-a-match` précède les mots. La
 * découverte vient donc avant la production, sans que le moteur ait à connaître
 * l'existence de ce type — voir `scripts/build-pack.mjs`.
 */

import type { Exercise, MatchPair } from '../../packs/schema';
import { el } from '../../ui/dom';
import { shuffled } from './choice';
import type { ExerciseHandle, ExerciseRenderer, GradeResult } from './types';

type Side = 'en' | 'fr';

const pairsOf = (exercise: Exercise): MatchPair[] => exercise.pairs ?? [];

/** La correspondance attendue, écrite pour être lue. */
function readable(pairs: MatchPair[]): string {
  return pairs.map((p) => `${p.en} → ${p.fr}`).join(' · ');
}

/**
 * Ce que l'apprenante a formé, sous une forme comparable.
 *
 * Le contrat `ExerciseHandle` fait transiter la réponse par une chaîne : c'est
 * ce qui permet au moteur d'ignorer complètement la forme des exercices. On
 * sérialise donc les couples, triés pour que deux appariements identiques
 * donnent la même chaîne quel que soit l'ordre des clics.
 */
function serialise(links: Map<string, string>): string {
  if (links.size === 0) return '';
  const rows = [...links].sort((a, b) => a[0].localeCompare(b[0]));
  return JSON.stringify(rows);
}

function parse(value: string): Map<string, string> {
  try {
    const rows = JSON.parse(value) as unknown;
    if (!Array.isArray(rows)) return new Map();
    return new Map(
      rows.filter(
        (r): r is [string, string] =>
          Array.isArray(r) && typeof r[0] === 'string' && typeof r[1] === 'string',
      ),
    );
  } catch {
    return new Map();
  }
}

function render(exercise: Exercise, container: HTMLElement): ExerciseHandle {
  const pairs = pairsOf(exercise);
  // Deux mélanges indépendants : mélanger une seule colonne laisserait l'autre
  // dans l'ordre de rédaction, et la première ligne serait toujours juste.
  const left = shuffled(pairs.map((p) => p.en));
  const right = shuffled(pairs.map((p) => p.fr));

  /** Les couples formés, dans le sens anglais → français. */
  const links = new Map<string, string>();
  const chips = new Map<string, HTMLButtonElement>();
  let armed: { side: Side; value: string } | null = null;
  let locked = false;
  let firstTouch: number | undefined;

  const key = (side: Side, value: string) => `${side}:${value}`;
  const partnerOf = (side: Side, value: string): string | undefined =>
    side === 'en'
      ? links.get(value)
      : [...links].find(([, fr]) => fr === value)?.[0];

  /** Le numéro d'un couple : ce qui le rend lisible sans dépendre d'une couleur. */
  function badgeOf(en: string): number {
    return [...links.keys()].sort((a, b) => a.localeCompare(b)).indexOf(en) + 1;
  }

  function paint(): void {
    for (const [side, values] of [
      ['en', left],
      ['fr', right],
    ] as Array<[Side, string[]]>) {
      for (const value of values) {
        const chip = chips.get(key(side, value));
        if (!chip) continue;
        const partner = partnerOf(side, value);
        const linked = partner !== undefined;
        const isArmed = armed?.side === side && armed.value === value;

        chip.classList.toggle('match__chip--linked', linked);
        chip.classList.toggle('match__chip--armed', isArmed);
        chip.setAttribute('aria-pressed', String(isArmed || linked));

        const badge = chip.querySelector('.match__badge');
        const n = linked ? badgeOf(side === 'en' ? value : partner!) : 0;
        if (badge) badge.textContent = n > 0 ? String(n) : '';
      }
    }
  }

  function tap(side: Side, value: string): void {
    if (locked) return;
    firstTouch ??= performance.now();

    // Une étiquette déjà appariée se libère au toucher : c'est le seul moyen de
    // revenir sur un couple, et le geste est le même que pour le former.
    const partner = partnerOf(side, value);
    if (partner !== undefined) {
      if (side === 'en') links.delete(value);
      else links.delete(partner);
      armed = null;
      paint();
      return;
    }

    if (armed?.side === side) {
      armed = armed.value === value ? null : { side, value };
      paint();
      return;
    }

    if (!armed) {
      armed = { side, value };
      paint();
      return;
    }

    const en = side === 'en' ? value : armed.value;
    const fr = side === 'fr' ? value : armed.value;
    links.set(en, fr);
    armed = null;
    paint();
  }

  function column(side: Side, values: string[], label: string): HTMLElement {
    const cells = values.map((value) => {
      const chip = el(
        'button',
        {
          class: 'match__chip',
          type: 'button',
          lang: side === 'en' ? 'en' : 'fr',
          'aria-pressed': 'false',
        },
        [el('span', { class: 'match__word' }, [value]), el('i', { class: 'match__badge' })],
      );
      chip.addEventListener('click', () => tap(side, value));
      chips.set(key(side, value), chip);
      return chip;
    });

    return el('div', { class: `match__col match__col--${side}` }, [
      el('p', { class: 'match__head' }, [label]),
      ...cells,
    ]);
  }

  container.append(
    el('p', { class: 'ex-prompt' }, [exercise.prompt]),
    el('p', { class: 'match__cue' }, [
      'Touche un mot, puis son sens. Touche un couple formé pour le défaire.',
    ]),
    el('div', { class: 'match' }, [
      column('en', left, 'Le mot'),
      column('fr', right, 'Ce que ça veut dire'),
    ]),
  );

  return {
    getValue: () => serialise(links),
    focus: () => chips.get(key('en', left[0] ?? ''))?.focus(),
    firstInputAt: () => firstTouch,
    lock: () => {
      locked = true;
      for (const chip of chips.values()) chip.disabled = true;
    },
    // Rien à valider au clavier : il n'y a pas de champ de saisie, et
    // apparier le dernier couple ne doit pas déclencher la correction — on
    // doit pouvoir revenir sur les précédents avant de s'engager.
    onSubmit: () => {},
  };
}

/**
 * Mode cahier : les deux colonnes numérotées, les couples écrits à la main.
 * Recopier « 3 → B » demande de tenir les deux listes en tête, ce qui est plus
 * exigeant que de les faire glisser l'une vers l'autre — et c'est tant mieux.
 */
function statement(exercise: Exercise, container: HTMLElement): void {
  const pairs = pairsOf(exercise);
  container.append(
    el('p', { class: 'ex-prompt' }, [exercise.prompt]),
    el('div', { class: 'match match--paper' }, [
      el('div', { class: 'match__col' }, [
        el('p', { class: 'match__head' }, ['Le mot']),
        el(
          'ol',
          { class: 'match__list' },
          shuffled(pairs.map((p) => p.en)).map((en) => el('li', { lang: 'en' }, [en])),
        ),
      ]),
      el('div', { class: 'match__col' }, [
        el('p', { class: 'match__head' }, ['Ce que ça veut dire']),
        el(
          'ol',
          { class: 'match__list match__list--letters' },
          shuffled(pairs.map((p) => p.fr)).map((fr) => el('li', {}, [fr])),
        ),
      ]),
    ]),
  );
}

function grade(exercise: Exercise, userInput: string): GradeResult {
  const pairs = pairsOf(exercise);
  const given = parse(userInput);
  const wrong = pairs.filter((p) => given.get(p.en) !== p.fr);
  const correct = wrong.length === 0 && given.size === pairs.length;

  const expected = readable(pairs);

  // On ne nomme que les couples ratés. Redonner les cinq lignes quand une seule
  // est fausse noie ce qu'il y avait à corriger, et la fiche de l'unité est à
  // un bouton de là pour le reste.
  const missed = readable(wrong);

  return {
    correct,
    expected,
    alternatives: [],
    feedback: correct
      ? 'Tout est à sa place.'
      : wrong.length === 1
        ? 'Un couple s’est trompé de voisin.'
        : `${wrong.length} couples se sont trompés de voisin.`,
    correction: correct
      ? undefined
      : {
          target: missed,
          explanation: { text: `Les bons voisins : ${missed}.`, source: 'pattern' },
        },
  };
}

export const match: ExerciseRenderer = { render, statement, grade };
