/**
 * Construction et déroulé d'une session.
 *
 * La session s'ajuste au temps annoncé, pas l'inverse : on estime un nombre de
 * cartes tenable, on sert d'abord ce qui est en retard, on glisse les cartes
 * neuves au fil de l'eau, puis on dé-groupe les notions pour qu'aucune ne soit
 * révisée en bloc — c'est le mélange qui rend la mémorisation robuste.
 */

import { rescueExercise, type Exercise, type PackItem, type ContentPack } from '../packs/schema';
import { db, kvGet, kvSet, type CardRecord } from '../storage/db';
import { dueCards, newCards } from '../storage/cards';
import { applyAnswer, localDay, State, type Answer, type ReviewOutcome } from './scheduler';

/** Durée moyenne observée par carte, tous types d'exercice confondus. */
const SECONDS_PER_CARD = 45;
/**
 * À la main, on écrit plus lentement qu'on ne tape, et il faut encore relever
 * la tête pour se corriger. Même temps annoncé, moins de cartes : c'est la
 * durée promise qui est tenue, pas le nombre d'exercices.
 */
const SECONDS_PER_CARD_PAPER = 75;
/** Plafond de nouvelles notions par jour — au-delà, la charge de révision explose. */
const DEFAULT_MAX_NEW_PER_DAY = 10;

export interface SessionCard {
  card: CardRecord;
  item: PackItem;
  /** L'exercice réellement présenté — le filet de secours, le cas échéant. */
  exercise: Exercise;
  topicTitle: string;
  /** Vrai quand on sert le mcq à la place de l'exercice de production. */
  rescue: boolean;
}

/** Nombre d'échecs consécutifs au-delà duquel on tend le filet. */
const RESCUE_AFTER_FAILURES = 2;

/**
 * Comment la question est posée — jamais ce qui est demandé. La sélection des
 * cartes, le quota et la planification sont identiques dans les deux modes.
 *
 * `paper` : la réponse s'écrit à la main sur un cahier, l'application montre
 * la bonne réponse et l'apprenante juge la sienne.
 */
export type SessionMode = 'screen' | 'paper';

export interface Session {
  cards: SessionCard[];
  /** Vrai si la session couvre au moins deux notions : condition du §3.4. */
  interleaved: boolean;
  requestedMinutes: number;
  mode: SessionMode;
}

export function estimateCardCount(minutes: number, mode: SessionMode = 'screen'): number {
  const perCard = mode === 'paper' ? SECONDS_PER_CARD_PAPER : SECONDS_PER_CARD;
  return Math.max(1, Math.round((minutes * 60) / perCard));
}

/** Fusion proportionnelle : les deux files avancent au même rythme relatif. */
function weave<T>(a: T[], b: T[]): T[] {
  const out: T[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    const pa = a.length ? i / a.length : 1;
    const pb = b.length ? j / b.length : 1;
    if (j >= b.length || (i < a.length && pa <= pb)) {
      out.push(a[i]!);
      i += 1;
    } else {
      out.push(b[j]!);
      j += 1;
    }
  }
  return out;
}

/** Évite deux cartes de suite sur la même notion, sans casser l'ordre global. */
function spreadTopics(cards: CardRecord[]): CardRecord[] {
  const out = cards.slice();
  for (let i = 1; i < out.length; i++) {
    const previous = out[i - 1]!;
    const current = out[i]!;
    if (current.topicId !== previous.topicId) continue;

    const following = out[i + 1];
    const swap = out.findIndex(
      (c, k) => k > i && c.topicId !== previous.topicId && c.topicId !== following?.topicId,
    );
    if (swap > i) {
      out[i] = out[swap]!;
      out[swap] = current;
    }
  }
  return out;
}

const introducedKey = (packId: string) => `newIntroduced:${packId}`;

/** Nombre de nouvelles notions réellement découvertes aujourd'hui. */
async function newIntroducedToday(packId: string, now: Date): Promise<number> {
  const row = await kvGet<{ day: string; count: number }>(introducedKey(packId));
  return row?.day === localDay(now) ? row.count : 0;
}

/**
 * Le quota se consomme au moment où une carte neuve reçoit sa première
 * réponse, pas quand la session est composée : une session commencée puis
 * abandonnée ne doit rien coûter.
 */
async function consumeNewQuota(packId: string, now: Date): Promise<void> {
  const current = await newIntroducedToday(packId, now);
  await kvSet(introducedKey(packId), { day: localDay(now), count: current + 1 });
}

/** Nouvelles notions encore disponibles aujourd'hui. */
export async function remainingNewQuota(
  packId: string,
  maxNewPerDay = DEFAULT_MAX_NEW_PER_DAY,
  now = new Date(),
): Promise<number> {
  return Math.max(0, maxNewPerDay - (await newIntroducedToday(packId, now)));
}

export interface BuildOptions {
  maxNewPerDay?: number;
  now?: Date;
  mode?: SessionMode;
}

export async function buildSession(
  pack: ContentPack,
  availableMinutes: number,
  opts: BuildOptions = {},
): Promise<Session> {
  const now = opts.now ?? new Date();
  const maxNewPerDay = opts.maxNewPerDay ?? DEFAULT_MAX_NEW_PER_DAY;
  const mode = opts.mode ?? 'screen';
  const packId = pack.meta.id;

  const budget = estimateCardCount(availableMinutes, mode);
  const quota = await remainingNewQuota(packId, maxNewPerDay, now);

  const [due, fresh] = await Promise.all([dueCards(packId, now), newCards(packId, quota)]);

  const selected = spreadTopics(weave(due, fresh).slice(0, budget));

  const itemsById = new Map(pack.items.map((it) => [it.id, it]));
  const topicsById = new Map(pack.topics.map((t) => [t.id, t]));

  const cards: SessionCard[] = [];
  for (const card of selected) {
    const item = itemsById.get(card.itemId);
    const exercise = item?.exercises[card.exerciseIndex];
    if (!item || !exercise) continue; // carte orpheline : ignorée, purgée au prochain sync

    // Bloquée deux fois de suite : plutôt que de la faire échouer une
    // troisième fois, on propose la version à choix multiples.
    const rescue = card.consecutiveFailures >= RESCUE_AFTER_FAILURES ? rescueExercise(item) : undefined;

    cards.push({
      card,
      item,
      exercise: rescue ?? exercise,
      topicTitle: topicsById.get(card.topicId)?.title ?? card.topicId,
      rescue: rescue !== undefined,
    });
  }

  return {
    cards,
    interleaved: new Set(cards.map((c) => c.card.topicId)).size >= 2,
    requestedMinutes: availableMinutes,
    mode,
  };
}

/** Applique une réponse et persiste : une transaction, deux écritures. */
export async function recordAnswer(
  card: CardRecord,
  answer: Answer,
  now = new Date(),
): Promise<ReviewOutcome> {
  const wasNew = card.state === State.New;
  const outcome = applyAnswer(card, answer, now);

  await db.transaction('rw', db.cards, db.reviews, async () => {
    await db.cards.put(outcome.card);
    await db.reviews.add(outcome.review);
  });

  if (wasNew) await consumeNewQuota(card.packId, now);
  return outcome;
}
