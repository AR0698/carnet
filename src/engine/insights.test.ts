import { createEmptyCard } from 'ts-fsrs';
import { describe, expect, it } from 'vitest';
import type { CardRecord, ReviewRecord } from '../storage/db';
import { exercise, pack } from '../test/helpers';
import { buildInsights, needsAttention, type InsightsInput } from './insights';

const p = pack('g', [
  { id: 'i1', topicId: 'faible', exercises: [exercise()] },
  { id: 'i2', topicId: 'solide', exercises: [exercise()] },
  { id: 'i3', topicId: 'remonte', exercises: [exercise()] },
]);
p.topics = p.topics.map((t) => ({ ...t, title: `Notion ${t.id}` }));

function card(id: string, topicId: string, lapses = 0): CardRecord {
  // Voir scheduler.test.ts : l'appel doit rester hors du littéral.
  const empty = createEmptyCard(new Date('2026-01-01'));
  return {
    id,
    packId: 'g',
    itemId: id.split(':')[1]!,
    topicId,
    exerciseIndex: 0,
    ...empty,
    lapses,
    spacedSuccesses: 0,
    lastSuccessDay: null,
    interleavedSuccess: false,
    consecutiveFailures: 0,
    createdAt: new Date('2026-01-01'),
  };
}

/** `n` réponses sur une carte, dont les `correct` premières… ou dernières. */
function reviews(cardId: string, results: boolean[]): ReviewRecord[] {
  return results.map((correct, i) => ({
    cardId,
    reviewedAt: new Date(Date.UTC(2026, 0, 1 + i)),
    rating: correct ? 3 : 1,
    correct,
    usedHint: false,
    elapsedMs: 5000,
    interleaved: true,
    scheduledDays: 1,
  }));
}

const input = (over: Partial<InsightsInput> = {}): InsightsInput => ({
  carnets: [{ id: 'g', label: 'Grammaire', pack: p }],
  cards: [card('g:i1:0', 'faible'), card('g:i2:0', 'solide'), card('g:i3:0', 'remonte')],
  reviews: [],
  ...over,
});

const F = false;
const T = true;

describe('buildInsights', () => {
  it('ne juge pas une notion sous quatre réponses', () => {
    const out = buildInsights(input({ reviews: reviews('g:i1:0', [F, F, F]) }));
    expect(out.carnets[0]!.weak).toHaveLength(0);
    expect(out.carnets[0]!.undecided).toBe(1);
    expect(out.tooEarly).toBe(true);
  });

  it('classe les notions de la plus fragile à la mieux tenue', () => {
    const out = buildInsights(
      input({
        reviews: [
          ...reviews('g:i1:0', [F, F, F, T]),
          ...reviews('g:i2:0', [T, T, T, T]),
        ],
      }),
    );
    expect(out.carnets[0]!.weak.map((t) => t.topicId)).toEqual(['faible', 'solide']);
    expect(out.carnets[0]!.strong[0]!.topicId).toBe('solide');
    expect(out.carnets[0]!.accuracy).toBeCloseTo(5 / 8);
  });

  /**
   * Le cas qui justifie la lecture en deux moitiés : à 50 % de justesse
   * globale, cette notion est basse — mais elle est passée de 0 à 100 %.
   * La signaler comme fragile enverrait travailler ce qui vient d'être acquis.
   */
  it('écarte une notion basse mais en progression', () => {
    const out = buildInsights(
      input({ reviews: reviews('g:i3:0', [F, F, F, T, T, T]) }),
    );
    const topic = out.carnets[0]!.weak.find((t) => t.topicId === 'remonte')!;
    expect(topic.accuracy).toBeCloseTo(0.5);
    expect(topic.trend).toBe('up');
    expect(needsAttention(topic)).toBe(false);
  });

  it('signale une notion basse qui recule', () => {
    const out = buildInsights(input({ reviews: reviews('g:i1:0', [T, T, T, F, F, F]) }));
    const topic = out.carnets[0]!.weak[0]!;
    expect(topic.trend).toBe('down');
    expect(needsAttention(topic)).toBe(true);
  });

  it('ne prononce pas de tendance sous six réponses', () => {
    const out = buildInsights(input({ reviews: reviews('g:i1:0', [F, F, T, T]) }));
    expect(out.carnets[0]!.weak[0]!.trend).toBe('unknown');
  });

  it('ignore les réponses dont la carte a disparu', () => {
    // Mettre à jour un pack retire les cartes obsolètes sans toucher au journal.
    const out = buildInsights(
      input({ reviews: [...reviews('g:i1:0', [T, T, T, T]), ...reviews('g:disparue:0', [F, F])] }),
    );
    expect(out.carnets[0]!.answers).toBe(4);
  });

  it('remonte les cartes-sangsues, les plus atteintes d’abord', () => {
    const out = buildInsights(
      input({ cards: [card('g:i1:0', 'faible', 7), card('g:i2:0', 'solide', 5), card('g:i3:0', 'remonte', 2)] }),
    );
    expect(out.leeches.map((l) => l.lapses)).toEqual([7, 5]);
    expect(out.leeches[0]!.topicTitle).toBe('Notion faible');
    expect(out.leeches[0]!.expected).toBe('X');
  });
});
