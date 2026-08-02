/**
 * Base locale (IndexedDB via Dexie).
 *
 * Le schéma est versionné : chaque évolution ajoute un `version(n).stores(...)`
 * plutôt que de modifier le précédent. C'est ce qui permet de faire évoluer le
 * contenu et le moteur sans jamais perdre la progression de l'utilisatrice.
 */

import Dexie, { type Table } from 'dexie';
import type { State } from 'ts-fsrs';

/**
 * Une carte = un exercice d'un item. L'état FSRS est embarqué dans
 * l'enregistrement (pas de table séparée) : une seule écriture par réponse.
 */
export interface CardRecord {
  /** `${packId}:${itemId}:${exerciseIndex}` */
  id: string;
  packId: string;
  itemId: string;
  topicId: string;
  exerciseIndex: number;

  // --- état FSRS ---
  due: Date;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: State;
  last_review?: Date;

  // --- graduation en maintenance (§3.4) ---
  /** Réussites correctes sur des jours *différents*. */
  spacedSuccesses: number;
  /** Dernier jour (YYYY-MM-DD local) où la carte a été réussie. */
  lastSuccessDay: string | null;
  /** Au moins une réussite en session mélangée (≥ 2 notions). */
  interleavedSuccess: boolean;

  // --- pédagogie ---
  /** Échecs consécutifs — au-delà de 2, le mcq sert de filet de secours. */
  consecutiveFailures: number;

  createdAt: Date;
}

/** Journal des réponses — sert aux bilans et à l'export de sauvegarde. */
export interface ReviewRecord {
  seq?: number;
  cardId: string;
  reviewedAt: Date;
  /** Rating FSRS effectivement appliqué (1..4). */
  rating: number;
  correct: boolean;
  usedHint: boolean;
  elapsedMs: number;
  /** La session contenait-elle au moins 2 notions différentes ? */
  interleaved: boolean;
  /** Intervalle décidé, en jours. */
  scheduledDays: number;
}

/** Petit magasin clé/valeur : version de pack installée, réglages, séries… */
export interface KvRecord {
  key: string;
  value: unknown;
}

export class CarnetDB extends Dexie {
  cards!: Table<CardRecord, string>;
  reviews!: Table<ReviewRecord, number>;
  kv!: Table<KvRecord, string>;

  constructor() {
    super('carnet');
    this.version(1).stores({
      cards: 'id, packId, topicId, state, due, [packId+due], [packId+state]',
      reviews: '++seq, cardId, reviewedAt',
      kv: 'key',
    });
  }
}

export const db = new CarnetDB();

// --- helpers clé/valeur ---

export async function kvGet<T>(key: string): Promise<T | undefined> {
  const row = await db.kv.get(key);
  return row?.value as T | undefined;
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  await db.kv.put({ key, value });
}
