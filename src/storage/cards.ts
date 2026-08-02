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

export interface SyncOptions {
  now?: Date;
  /**
   * Retirer les cartes dont l'exercice a disparu du pack.
   *
   * Vrai pour les packs téléchargés : leur contenu fait autorité, et une
   * question supprimée en amont ne doit pas continuer de tomber. Faux pour le
   * vocabulaire personnel, dont le « pack » est reconstruit à chaque démarrage
   * depuis IndexedDB : là, un pack vide ne signifie pas que le contenu a
   * disparu — il peut simplement signifier que la lecture a échoué, et
   * l'élagage emporterait alors des mois de travail. Ce carnet-là fait son
   * ménage mot par mot, au moment où on le modifie (`storage/vocab.ts`).
   */
  prune?: boolean;
}

/**
 * Aligne la table `cards` sur le contenu du pack.
 * Idempotent : rejouable à chaque démarrage sans effet de bord.
 */
export async function syncPackCards(
  pack: ContentPack,
  opts: SyncOptions = {},
): Promise<SyncReport> {
  const now = opts.now ?? new Date();
  const prune = opts.prune ?? true;
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
    const toRemove = prune ? existing.filter((c) => !expected.has(c.id)).map((c) => c.id) : [];

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

/**
 * Échéance de la prochaine carte, quand il n'y a plus rien à revoir
 * maintenant. Une file vide n'est pas la fin du parcours : c'est un rendez-vous
 * plus tard, et le dire vaut mieux que laisser croire que c'est fini.
 */
export async function nextDueDate(packId: string, now = new Date()): Promise<Date | null> {
  const rows = await db.cards
    .where('[packId+due]')
    .between([packId, now], [packId, Dexie.maxKey], false, true)
    .toArray();
  const upcoming = rows.filter((c) => c.state !== State.New).map((c) => c.due.getTime());
  return upcoming.length > 0 ? new Date(Math.min(...upcoming)) : null;
}

/** Toutes les cartes d'un carnet — pour les écrans qui montrent l'état pièce par pièce. */
export async function packCards(packId: string): Promise<CardRecord[]> {
  return db.cards.where('packId').equals(packId).toArray();
}

/** Toutes les cartes, tous carnets confondus. */
export async function allCards(): Promise<CardRecord[]> {
  return db.cards.toArray();
}

/**
 * Remet une carte à l'état neuf.
 *
 * Le recours des cartes qui ne rentrent pas : après une dizaine de rechutes,
 * l'état FSRS ne décrit plus une mémoire mais une série d'échecs, et la carte
 * revient sans fin à un jour d'intervalle. Repartir de zéro rouvre la porte de
 * graduation et lui redonne une chance d'être apprise autrement.
 *
 * Le journal des réponses n'est pas touché : ce qui a eu lieu a eu lieu, et les
 * statistiques doivent continuer de le dire.
 */
export async function resetCard(cardId: string, now = new Date()): Promise<void> {
  const card = await db.cards.get(cardId);
  if (!card) return;
  await db.cards.put({
    ...card,
    ...createEmptyCard(now),
    spacedSuccesses: 0,
    lastSuccessDay: null,
    interleavedSuccess: false,
    consecutiveFailures: 0,
  });
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
