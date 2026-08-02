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

/**
 * Un mot ou une expression saisi à la main — le carnet Discovery.
 *
 * C'est la seule donnée de cette base qui ne se retélécharge pas. Un pack perdu
 * revient d'un `fetch` ; un mot noté un soir dans un pub de Stokes Croft, non.
 * D'où la table dédiée, l'absence d'élagage automatique (`syncPackCards` ne
 * passe jamais dessus en mode destructeur) et l'export de sauvegarde.
 */
export interface VocabRecord {
  id: string;
  /** L'expression anglaise, telle qu'on l'a entendue. */
  term: string;
  /** Ce qu'elle veut dire, en français. */
  meaning: string;
  /** Une phrase anglaise qui la contient — c'est elle qui fera le texte à trou. */
  example?: string;
  /** Où on l'a croisée, à quoi elle sert : libre, jamais interrogé. */
  note?: string;
  /** Étiquette libre, pour s'y retrouver dans la liste. */
  tag?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class CarnetDB extends Dexie {
  cards!: Table<CardRecord, string>;
  reviews!: Table<ReviewRecord, number>;
  kv!: Table<KvRecord, string>;
  vocab!: Table<VocabRecord, string>;

  constructor() {
    super('carnet');
    this.version(1).stores({
      cards: 'id, packId, topicId, state, due, [packId+due], [packId+state]',
      reviews: '++seq, cardId, reviewedAt',
      kv: 'key',
    });
    // Dexie conserve les tables qu'une version ne mentionne pas : `cards`,
    // `reviews` et `kv` traversent la migration intactes, avec leur contenu.
    this.version(2).stores({
      vocab: 'id, createdAt, term',
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
