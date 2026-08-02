/**
 * Synchronisation pack → cartes, et requêtes de sélection.
 *
 * Règle d'or : un pack peut être mis à jour (nouveaux exercices, corrections)
 * sans jamais écraser l'état FSRS des cartes déjà travaillées. On crée les
 * cartes manquantes, on retire celles dont l'exercice a disparu, on ne touche
 * pas au reste.
 */

import Dexie from 'dexie';
import { createEmptyCard, State } from 'ts-fsrs';
import { cardId, isScheduled, type ContentPack } from '../packs/schema';
import { db, type CardRecord } from './db';

/** Crée l'enregistrement d'une carte neuve (état FSRS vierge). */
function newCardRecord(
  packId: string,
  itemId: string,
  topicId: string,
  exerciseIndex: number,
  now: Date,
): CardRecord {
  const empty = createEmptyCard(now);
  return {
    id: cardId(packId, itemId, exerciseIndex),
    packId,
    itemId,
    topicId,
    exerciseIndex,
    ...empty,
    spacedSuccesses: 0,
    lastSuccessDay: null,
    interleavedSuccess: false,
    consecutiveFailures: 0,
    createdAt: now,
  };
}

export interface SyncReport {
  created: number;
  removed: number;
  kept: number;
}

/**
 * Aligne la table `cards` sur le contenu du pack.
 * Idempotent : rejouable à chaque démarrage sans effet de bord.
 */
export async function syncPackCards(pack: ContentPack, now = new Date()): Promise<SyncReport> {
  const expected = new Map<string, CardRecord>();
  for (const item of pack.items) {
    item.exercises.forEach((exercise, i) => {
      // Les mcq sont des filets de secours : ils ne se planifient pas.
      if (!isScheduled(exercise)) return;
      const id = cardId(pack.meta.id, item.id, i);
      expected.set(id, newCardRecord(pack.meta.id, item.id, item.topicId, i, now));
    });
  }

  return db.transaction('rw', db.cards, async () => {
    const existing = await db.cards.where('packId').equals(pack.meta.id).toArray();
    const existingIds = new Set(existing.map((c) => c.id));

    const toCreate = [...expected.values()].filter((c) => !existingIds.has(c.id));
    const toRemove = existing.filter((c) => !expected.has(c.id)).map((c) => c.id);

    if (toCreate.length) await db.cards.bulkAdd(toCreate);
    if (toRemove.length) await db.cards.bulkDelete(toRemove);

    return {
      created: toCreate.length,
      removed: toRemove.length,
      kept: existing.length - toRemove.length,
    };
  });
}

/**
 * Cartes à revoir maintenant (échéance passée), les plus en retard d'abord.
 * Les cartes neuves ont une échéance à leur création : on les exclut ici,
 * elles sont introduites séparément et avec un quota.
 */
export async function dueCards(packId: string, now = new Date()): Promise<CardRecord[]> {
  const rows = await db.cards
    .where('[packId+due]')
    .between([packId, Dexie.minKey], [packId, now], true, true)
    .toArray();
  return rows
    .filter((c) => c.state !== State.New)
    .sort((a, b) => a.due.getTime() - b.due.getTime());
}

/** Cartes jamais vues, dans l'ordre du pack (topic, puis item, puis exercice). */
export async function newCards(packId: string, limit: number): Promise<CardRecord[]> {
  if (limit <= 0) return [];
  const rows = await db.cards.where('[packId+state]').equals([packId, State.New]).toArray();
  rows.sort(
    (a, b) =>
      a.topicId.localeCompare(b.topicId) ||
      a.itemId.localeCompare(b.itemId) ||
      a.exerciseIndex - b.exerciseIndex,
  );
  return rows.slice(0, limit);
}

export interface PackCounts {
  total: number;
  due: number;
  fresh: number;
  mastered: number;
}

export async function countAll(packId: string, now = new Date()): Promise<PackCounts> {
  const cards = await db.cards.where('packId').equals(packId).toArray();
  return {
    total: cards.length,
    due: cards.filter((c) => c.state !== State.New && c.due <= now).length,
    fresh: cards.filter((c) => c.state === State.New).length,
    mastered: cards.filter((c) => isGraduated(c)).length,
  };
}

/** Une carte est « en maintenance » quand elle a franchi la porte de graduation. */
export function isGraduated(c: CardRecord): boolean {
  return c.state === State.Review && c.spacedSuccesses >= 2 && c.interleavedSuccess;
}
