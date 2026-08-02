/**
 * Planification — enveloppe autour de ts-fsrs (FSRS-6).
 *
 * Deux responsabilités :
 *  1. traduire une réponse humaine (juste/faux, hésitation, indice) en `Rating`
 *     FSRS, puis demander la prochaine échéance ;
 *  2. appliquer la « porte de graduation » du §3.4 : une carte ne part en
 *     révision longue qu'après avoir été retrouvée deux fois sur des jours
 *     différents, dont au moins une fois en session mélangée.
 *
 * La porte n'altère jamais `stability` / `difficulty` : le modèle FSRS reste
 * intact, on ne plafonne que la date de la prochaine révision.
 */

import {
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card as FsrsCard,
  type Grade,
} from 'ts-fsrs';
import { localDay } from '../shared/day';
import type { CardRecord, ReviewRecord } from '../storage/db';

const params = generatorParameters({
  request_retention: 0.9,
  enable_fuzz: true,
});

export const scheduler = fsrs(params);

export interface Answer {
  correct: boolean;
  /** L'indice a-t-il été ouvert avant de valider ? */
  usedHint: boolean;
  elapsedMs: number;
  /** La session en cours contient-elle au moins deux notions différentes ? */
  interleaved: boolean;
}

/** Au-delà : la réponse est juste mais laborieuse. */
const HESITATION_MS = 25_000;
/** En deçà : la réponse est venue sans effort. */
const CONFIDENT_MS = 6_000;
/** Tant que la porte de graduation n'est pas franchie, on ne dépasse pas ce délai. */
const GATE_MAX_DAYS = 1;

const DAY_MS = 24 * 60 * 60 * 1000;

export function ratingFor(a: Answer): Grade {
  if (!a.correct) return Rating.Again;
  if (a.usedHint || a.elapsedMs > HESITATION_MS) return Rating.Hard;
  if (a.elapsedMs < CONFIDENT_MS) return Rating.Easy;
  return Rating.Good;
}

export { localDay };

/** La carte a franchi la porte : FSRS peut planifier librement. */
export function hasGraduated(c: Pick<CardRecord, 'spacedSuccesses' | 'interleavedSuccess'>): boolean {
  return c.spacedSuccesses >= 2 && c.interleavedSuccess;
}

function toFsrsCard(c: CardRecord): FsrsCard {
  return {
    due: c.due,
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: c.elapsed_days,
    scheduled_days: c.scheduled_days,
    learning_steps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state,
    last_review: c.last_review,
  };
}

export interface ReviewOutcome {
  card: CardRecord;
  review: ReviewRecord;
  rating: Grade;
  /** L'échéance a-t-elle été raccourcie par la porte de graduation ? */
  gated: boolean;
}

/**
 * Applique une réponse à une carte et renvoie son nouvel état.
 * Fonction pure : rien n'est écrit en base ici (voir `session.ts`).
 */
export function applyAnswer(card: CardRecord, answer: Answer, now = new Date()): ReviewOutcome {
  const rating = ratingFor(answer);
  const { card: next } = scheduler.next(toFsrsCard(card), now, rating);

  // --- compteurs de la porte de graduation ---
  const today = localDay(now);
  let { spacedSuccesses, lastSuccessDay, interleavedSuccess, consecutiveFailures } = card;

  if (answer.correct) {
    consecutiveFailures = 0;
    // Deux réussites le même jour ne comptent que pour une : c'est
    // l'espacement qui prouve la mémorisation, pas la répétition immédiate.
    if (lastSuccessDay !== today) {
      spacedSuccesses += 1;
      lastSuccessDay = today;
    }
    if (answer.interleaved) interleavedSuccess = true;
  } else {
    consecutiveFailures += 1;
    // Un oubli rouvre la porte : il faudra à nouveau deux réussites espacées.
    // `interleavedSuccess` reste acquis — la carte a déjà prouvé qu'elle
    // résistait au mélange, inutile de le redemander.
    spacedSuccesses = 0;
    lastSuccessDay = null;
  }

  // --- porte de graduation : plafond d'échéance ---
  let due = next.due;
  let scheduled_days = next.scheduled_days;
  let gated = false;
  if (!hasGraduated({ spacedSuccesses, interleavedSuccess })) {
    const cap = new Date(now.getTime() + GATE_MAX_DAYS * DAY_MS);
    if (due.getTime() > cap.getTime()) {
      due = cap;
      scheduled_days = GATE_MAX_DAYS;
      gated = true;
    }
  }

  const updated: CardRecord = {
    ...card,
    due,
    stability: next.stability,
    difficulty: next.difficulty,
    elapsed_days: next.elapsed_days,
    scheduled_days,
    learning_steps: next.learning_steps,
    reps: next.reps,
    lapses: next.lapses,
    state: next.state,
    last_review: next.last_review,
    spacedSuccesses,
    lastSuccessDay,
    interleavedSuccess,
    consecutiveFailures,
  };

  const review: ReviewRecord = {
    cardId: card.id,
    reviewedAt: now,
    rating,
    correct: answer.correct,
    usedHint: answer.usedHint,
    elapsedMs: answer.elapsedMs,
    interleaved: answer.interleaved,
    scheduledDays: scheduled_days,
  };

  return { card: updated, review, rating, gated };
}

/** Délai lisible avant la prochaine révision. */
export function formatDelay(from: Date, to: Date): string {
  const ms = Math.max(0, to.getTime() - from.getTime());
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return 'dans un instant';
  if (minutes < 60) return `dans ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `dans ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'demain';
  if (days < 31) return `dans ${days} jours`;
  const months = Math.round(days / 30);
  return months === 1 ? 'dans un mois' : `dans ${months} mois`;
}

export { State, Rating };
