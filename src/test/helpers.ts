/** Fabriques minimales pour les tests — juste ce qu'il faut pour que ça compile. */

import type { ContentPack, Exercise } from '../packs/schema';
import { db } from '../storage/db';

export async function resetDb(): Promise<void> {
  await Promise.all([db.cards.clear(), db.reviews.clear(), db.kv.clear(), db.vocab.clear()]);
}

export function exercise(over: Partial<Exercise> = {}): Exercise {
  return {
    type: 'produce',
    prompt: 'Comment dit-on X ?',
    answerSpec: { accepted: ['X'] },
    ...over,
  };
}

/**
 * Un pack jetable : `exercisesPerItem` exercices sur `items` items, tous dans
 * la même notion sauf mention contraire.
 */
export function pack(
  id: string,
  items: { id: string; topicId?: string; exercises: Exercise[] }[],
): ContentPack {
  const topicIds = [...new Set(items.map((i) => i.topicId ?? 't1'))];
  return {
    meta: {
      id,
      title: id,
      subject: 'test',
      version: '1',
      schemaVersion: 1,
      locale: 'fr-FR',
      contentLocale: 'en-GB',
    },
    topics: topicIds.map((t, i) => ({ id: t, title: t, prerequisites: [], order: i + 1 })),
    items: items.map((i) => ({
      id: i.id,
      topicId: i.topicId ?? 't1',
      tags: [],
      fields: {},
      exercises: i.exercises,
    })),
  };
}
