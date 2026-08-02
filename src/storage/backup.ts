/**
 * Sauvegarde et restauration.
 *
 * Tant que l'application ne servait que des packs téléchargés, perdre la base
 * ne coûtait qu'un historique de révisions : le contenu, lui, revenait d'un
 * `fetch`. Le carnet Discovery change cela — un mot noté à la volée n'existe
 * nulle part ailleurs. Or iOS évince IndexedDB après une longue inactivité, et
 * `navigator.storage.persist()` n'est qu'une demande, pas une garantie.
 *
 * D'où un export tenant dans un seul fichier lisible, et un import qui remet
 * l'appareil exactement dans l'état du fichier — sans fusion, sans arbitrage
 * silencieux entre deux versions d'une même carte.
 */

import { db, type CardRecord, type KvRecord, type ReviewRecord, type VocabRecord } from './db';

/** Marqueur de format : un fichier qui ne le porte pas n'est pas une sauvegarde. */
export const BACKUP_FORMAT = 'go-to-bristol-backup';
export const BACKUP_VERSION = 1;

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  vocab: VocabRecord[];
  cards: CardRecord[];
  reviews: ReviewRecord[];
  kv: KvRecord[];
}

export interface BackupSummary {
  words: number;
  cards: number;
  reviews: number;
}

export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

// --- export ---

export async function buildBackup(now = new Date()): Promise<Backup> {
  const [vocab, cards, reviews, kv] = await Promise.all([
    db.vocab.toArray(),
    db.cards.toArray(),
    db.reviews.toArray(),
    db.kv.toArray(),
  ]);

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    vocab,
    cards,
    reviews,
    kv,
  };
}

export function summarise(backup: Backup): BackupSummary {
  return {
    words: backup.vocab.length,
    cards: backup.cards.length,
    reviews: backup.reviews.length,
  };
}

/** Nom de fichier daté : plusieurs sauvegardes cohabitent sans s'écraser. */
export function backupFilename(now = new Date()): string {
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
  return `go-to-bristol-${stamp}.json`;
}

// --- import ---

/**
 * Les dates traversent le JSON en texte. Sans ce réveil, `card.due` serait une
 * chaîne : les comparaisons d'échéance passeraient en ordre alphabétique et la
 * planification deviendrait n'importe quoi, sans lever la moindre erreur.
 */
function reviveDate(value: unknown, where: string): Date {
  const date = typeof value === 'string' || value instanceof Date ? new Date(value) : new Date(NaN);
  if (Number.isNaN(date.getTime())) throw new BackupError(`Date illisible : ${where}.`);
  return date;
}

function reviveOptionalDate(value: unknown, where: string): Date | undefined {
  return value === undefined || value === null ? undefined : reviveDate(value, where);
}

const isArray = (v: unknown): v is unknown[] => Array.isArray(v);

/** Relit un fichier de sauvegarde. Échoue avant d'avoir rien touché à la base. */
export function parseBackup(raw: string): Backup {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new BackupError('Ce fichier n’est pas du JSON.');
  }

  if (typeof data !== 'object' || data === null) {
    throw new BackupError('Ce fichier ne contient pas de sauvegarde.');
  }
  const backup = data as Partial<Backup>;

  if (backup.format !== BACKUP_FORMAT) {
    throw new BackupError('Ce fichier n’est pas une sauvegarde de Go to Bristol.');
  }
  if (typeof backup.version !== 'number' || backup.version > BACKUP_VERSION) {
    throw new BackupError(
      `Sauvegarde en version ${String(backup.version)}, l’application en comprend ${BACKUP_VERSION} — mets-la à jour.`,
    );
  }
  for (const key of ['vocab', 'cards', 'reviews', 'kv'] as const) {
    if (!isArray(backup[key])) throw new BackupError(`Section « ${key} » manquante ou illisible.`);
  }

  const vocab = (backup.vocab as VocabRecord[]).map((v, i) => ({
    ...v,
    createdAt: reviveDate(v.createdAt, `vocab[${i}].createdAt`),
    updatedAt: reviveDate(v.updatedAt, `vocab[${i}].updatedAt`),
  }));

  const cards = (backup.cards as CardRecord[]).map((c, i) => ({
    ...c,
    due: reviveDate(c.due, `cards[${i}].due`),
    createdAt: reviveDate(c.createdAt, `cards[${i}].createdAt`),
    last_review: reviveOptionalDate(c.last_review, `cards[${i}].last_review`),
  }));

  const reviews = (backup.reviews as ReviewRecord[]).map((r, i) => ({
    ...r,
    reviewedAt: reviveDate(r.reviewedAt, `reviews[${i}].reviewedAt`),
  }));

  return {
    format: BACKUP_FORMAT,
    version: backup.version,
    exportedAt: typeof backup.exportedAt === 'string' ? backup.exportedAt : '',
    vocab,
    cards,
    reviews,
    kv: backup.kv as KvRecord[],
  };
}

/**
 * Remet la base dans l'état du fichier. Remplacement, pas fusion.
 *
 * Fusionner supposerait d'arbitrer entre deux états d'une même carte — celui de
 * l'appareil et celui du fichier — et aucun arbitrage n'est défendable sans
 * demander. Le remplacement, lui, est prévisible : on sait exactement ce qu'on
 * obtient. C'est à l'écran de prévenir avant d'appeler.
 *
 * Le tout dans une seule transaction : une restauration à moitié appliquée
 * serait pire que pas de restauration du tout.
 */
export async function restoreBackup(backup: Backup): Promise<BackupSummary> {
  await db.transaction('rw', db.vocab, db.cards, db.reviews, db.kv, async () => {
    await Promise.all([db.vocab.clear(), db.cards.clear(), db.reviews.clear(), db.kv.clear()]);
    await Promise.all([
      db.vocab.bulkAdd(backup.vocab),
      db.cards.bulkAdd(backup.cards),
      db.reviews.bulkAdd(backup.reviews),
      db.kv.bulkAdd(backup.kv),
    ]);
  });
  return summarise(backup);
}
