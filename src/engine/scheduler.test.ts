import { createEmptyCard } from 'ts-fsrs';
import { describe, expect, it } from 'vitest';
import type { CardRecord } from '../storage/db';
import { applyAnswer, Rating, ratingFor, type Answer } from './scheduler';

const DAY_MS = 24 * 60 * 60 * 1000;

function card(over: Partial<CardRecord> = {}): CardRecord {
  // Extrait plutôt qu'appelé dans le littéral : `createEmptyCard` est
  // générique et infère alors `CardRecord`, si bien que TypeScript croit
  // que le spread redéfinit l'identité de la carte.
  const empty = createEmptyCard(new Date('2026-01-01T09:00:00Z'));
  return {
    id: 'p:i:0',
    packId: 'p',
    itemId: 'i',
    topicId: 't',
    exerciseIndex: 0,
    ...empty,
    spacedSuccesses: 0,
    lastSuccessDay: null,
    interleavedSuccess: false,
    consecutiveFailures: 0,
    createdAt: new Date('2026-01-01T09:00:00Z'),
    ...over,
  };
}

const answer = (over: Partial<Answer> = {}): Answer => ({
  correct: true,
  usedHint: false,
  elapsedMs: 10_000,
  interleaved: true,
  ...over,
});

describe('ratingFor — ce que la note mesure', () => {
  it('note sur la latence de rappel, pas sur le temps total', () => {
    // Réponse longue à taper : 18 s au total, mais retrouvée en 2 s.
    // Sans la latence, elle serait rangée « Good » ; avec, elle vaut « Easy ».
    expect(ratingFor(answer({ elapsedMs: 18_000, recallMs: 2_000 }))).toBe(Rating.Easy);
  });

  it('une réponse courte mais longuement cherchée reste « Hard »', () => {
    expect(ratingFor(answer({ elapsedMs: 30_000, recallMs: 28_000 }))).toBe(Rating.Hard);
  });

  it('retombe sur le temps total quand rien n’a été saisi', () => {
    expect(ratingFor(answer({ elapsedMs: 3_000 }))).toBe(Rating.Easy);
  });

  it('le jugement déclaré du mode cahier prime sur toute mesure', () => {
    // 40 s d'écriture à la main : la mesure dirait « Hard », l'apprenante dit
    // que c'est venu tout seul. C'est elle qui sait.
    const a = answer({ elapsedMs: 40_000, recallMs: 40_000, effort: 'immediate' });
    expect(ratingFor(a)).toBe(Rating.Easy);
  });

  it('un indice ou un filet de secours plafonne à « Hard »', () => {
    expect(ratingFor(answer({ recallMs: 500, usedHint: true }))).toBe(Rating.Hard);
    expect(ratingFor(answer({ recallMs: 500, rescue: true }))).toBe(Rating.Hard);
  });

  it('une réponse fausse vaut « Again », quoi qu’il arrive', () => {
    expect(ratingFor(answer({ correct: false, recallMs: 200, effort: 'immediate' }))).toBe(
      Rating.Again,
    );
  });
});

describe('porte de graduation', () => {
  const day1 = new Date('2026-01-01T09:00:00Z');
  const day2 = new Date('2026-01-02T09:00:00Z');
  const day3 = new Date('2026-01-05T09:00:00Z');

  it('plafonne l’échéance à 24 h tant que la porte n’est pas franchie', () => {
    const { card: next, gated } = applyAnswer(card(), answer({ recallMs: 500 }), day1);
    expect(gated).toBe(true);
    expect(next.due.getTime() - day1.getTime()).toBeLessThanOrEqual(DAY_MS);
  });

  it('deux réussites le même jour ne comptent que pour une', () => {
    const a = applyAnswer(card(), answer(), day1);
    const b = applyAnswer(a.card, answer(), new Date(day1.getTime() + 3_600_000));
    expect(b.card.spacedSuccesses).toBe(1);
  });

  it('ouvre la planification après deux réussites sur des jours différents', () => {
    const a = applyAnswer(card(), answer(), day1);
    const b = applyAnswer(a.card, answer(), day2);
    expect(b.card.spacedSuccesses).toBe(2);
    expect(b.card.interleavedSuccess).toBe(true);
    expect(b.gated).toBe(false);
    expect(b.card.due.getTime() - day2.getTime()).toBeGreaterThan(DAY_MS);
  });

  it('reste plafonnée sans réussite en session mélangée', () => {
    const a = applyAnswer(card(), answer({ interleaved: false }), day1);
    const b = applyAnswer(a.card, answer({ interleaved: false }), day2);
    expect(b.card.spacedSuccesses).toBe(2);
    expect(b.card.interleavedSuccess).toBe(false);
    expect(b.gated).toBe(true);
  });

  it('le filet de secours débloque sans ouvrir la porte', () => {
    const a = applyAnswer(card(), answer({ rescue: true }), day1);
    expect(a.card.consecutiveFailures).toBe(0);
    expect(a.card.spacedSuccesses).toBe(0);
    expect(a.card.interleavedSuccess).toBe(false);
  });

  it('un échec rouvre la porte mais ne redemande pas l’entrelacement acquis', () => {
    const a = applyAnswer(card(), answer(), day1);
    const b = applyAnswer(a.card, answer(), day2);
    const c = applyAnswer(b.card, answer({ correct: false }), day3);
    expect(c.card.spacedSuccesses).toBe(0);
    expect(c.card.lastSuccessDay).toBeNull();
    expect(c.card.interleavedSuccess).toBe(true);
    expect(c.card.consecutiveFailures).toBe(1);
  });

  it('le plafond n’écrit jamais stability ni difficulty à la main', () => {
    const before = card();
    const { card: after } = applyAnswer(before, answer(), day1);
    // FSRS les a recalculées ; ce qu'on vérifie est qu'elles ne sont pas
    // restées figées à l'état d'avant par une intervention du plafond.
    expect(after.stability).toBeGreaterThan(0);
    expect(after.difficulty).toBeGreaterThan(0);
  });
});
