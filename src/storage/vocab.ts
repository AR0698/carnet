/**
 * Le carnet Discovery — les mots et expressions saisis à la main.
 *
 * Tout le reste de l'application lit du contenu figé, servi en JSON. Ici le
 * contenu est écrit par l'apprenante, dans le train ou au comptoir, et doit
 * entrer dans la même machine de répétition espacée que la grammaire. Le pont
 * est simple : on expose le vocabulaire sous la forme d'un `ContentPack`
 * ordinaire, construit à la volée depuis IndexedDB. Le moteur ne voit pas la
 * différence — ni la session, ni FSRS, ni la porte de graduation.
 *
 * Une notion = un mot. Ce n'est pas un détail : l'entrelacement du moteur
 * travaille sur les notions, et la porte de graduation exige une réussite en
 * session mélangée. Si tout le vocabulaire ne formait qu'une seule notion,
 * aucun mot ne pourrait jamais être rangé comme su.
 */

import { BLANK, type ContentPack, type Exercise, type PackItem } from '../packs/schema';
import { db, type VocabRecord } from './db';

export const VOCAB_PACK_ID = 'my-vocab';

/** Nombre de propositions du filet de secours, en plus de la bonne réponse. */
const RESCUE_DISTRACTORS = 3;

/** Ce que le formulaire d'ajout produit — l'identité et les dates sont posées ici. */
export interface VocabDraft {
  id?: string;
  term: string;
  meaning: string;
  example?: string;
  note?: string;
  tag?: string;
}

export class VocabError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VocabError';
  }
}

/**
 * Identifiant croissant : `Date.now()` en base 36 reste trié dans l'ordre
 * alphabétique, et c'est cet ordre que `newCards()` suit pour introduire les
 * nouveautés. Les mots arrivent donc dans l'ordre où on les a rencontrés.
 */
function newId(): string {
  return `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

const clean = (v: string | undefined): string | undefined => {
  const t = v?.trim();
  return t && t.length > 0 ? t : undefined;
};

// --- lecture ---

/** Tout le vocabulaire, du plus récemment ajouté au plus ancien. */
export async function listVocab(): Promise<VocabRecord[]> {
  const rows = await db.vocab.toArray();
  return rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function getVocab(id: string): Promise<VocabRecord | undefined> {
  return db.vocab.get(id);
}

export async function countVocab(): Promise<number> {
  return db.vocab.count();
}

// --- écriture ---

/**
 * Crée ou met à jour un mot, puis réaligne ses cartes.
 *
 * Le réalignement est volontairement chirurgical : on ne retire que les cartes
 * de *ce* mot devenues sans objet — typiquement le texte à trou quand la phrase
 * d'exemple a été effacée. Jamais de balayage global : une lecture qui échoue
 * ne doit pas pouvoir emporter le carnet.
 */
export async function saveVocab(draft: VocabDraft): Promise<VocabRecord> {
  const term = draft.term.trim();
  const meaning = draft.meaning.trim();
  if (term.length === 0) throw new VocabError('Il manque l’expression anglaise.');
  if (meaning.length === 0) throw new VocabError('Il manque le sens en français.');

  const now = new Date();
  const existing = draft.id ? await db.vocab.get(draft.id) : undefined;

  const record: VocabRecord = {
    id: existing?.id ?? draft.id ?? newId(),
    term,
    meaning,
    example: clean(draft.example),
    note: clean(draft.note),
    tag: clean(draft.tag),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await db.vocab.put(record);
  await dropCardsBeyond(record.id, scheduledCount(record));
  return record;
}

/**
 * Supprime un mot, ses cartes et les réponses qui s'y rapportaient.
 *
 * Laisser les réponses derrière ferait remonter, à l'import d'une sauvegarde,
 * l'historique de mots qui n'existent plus.
 */
export async function deleteVocab(id: string): Promise<void> {
  await db.transaction('rw', db.vocab, db.cards, db.reviews, async () => {
    const cards = await db.cards.where('packId').equals(VOCAB_PACK_ID).toArray();
    const mine = cards.filter((c) => c.itemId === id).map((c) => c.id);
    if (mine.length > 0) {
      await db.cards.bulkDelete(mine);
      const orphans = await db.reviews.where('cardId').anyOf(mine).primaryKeys();
      if (orphans.length > 0) await db.reviews.bulkDelete(orphans);
    }
    await db.vocab.delete(id);
  });
}

/** Retire les cartes de ce mot dont l'exercice n'existe plus. */
async function dropCardsBeyond(itemId: string, scheduled: number): Promise<void> {
  const cards = await db.cards.where('packId').equals(VOCAB_PACK_ID).toArray();
  const stale = cards
    .filter((c) => c.itemId === itemId && c.exerciseIndex >= scheduled)
    .map((c) => c.id);
  if (stale.length > 0) await db.cards.bulkDelete(stale);
}

// --- vue « pack » ---

/** Combien d'exercices planifiés ce mot produit : la production, et le trou s'il y a un exemple. */
function scheduledCount(entry: VocabRecord): number {
  return blankedExample(entry) ? 2 : 1;
}

/**
 * La phrase d'exemple, l'expression remplacée par un trou.
 *
 * Renvoie `undefined` si l'expression ne s'y trouve pas : un texte à trou dont
 * la réponse n'apparaît nulle part serait insoluble. On préfère alors n'avoir
 * qu'un seul exercice.
 */
function blankedExample(entry: VocabRecord): string | undefined {
  if (!entry.example) return undefined;
  const needle = entry.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const at = new RegExp(needle, 'i');
  return at.test(entry.example) ? entry.example.replace(at, BLANK) : undefined;
}

/**
 * Les exercices d'un mot.
 *
 * L'ordre est un contrat : l'identifiant d'une carte contient l'indice de son
 * exercice (`my-vocab:<id>:0`). La production reste donc toujours en tête, et
 * le filet de secours — qui ne porte pas de carte — se range en dernier, pour
 * qu'apparaître ou disparaître ne décale jamais rien.
 */
function exercisesFor(entry: VocabRecord, distractors: string[]): Exercise[] {
  const exercises: Exercise[] = [
    {
      type: 'produce',
      prompt: `Comment dit-on « ${entry.meaning} » ?`,
      answerSpec: { accepted: [entry.term] },
      ...(entry.note ? { hints: [entry.note] } : {}),
    },
  ];

  const blanked = blankedExample(entry);
  if (blanked) {
    exercises.push({
      type: 'fill_blank',
      prompt: blanked,
      answerSpec: { accepted: [entry.term] },
      hints: [entry.meaning],
    });
  }

  // Le mcq ne se planifie pas : il n'apparaît qu'après deux échecs de suite,
  // avec les formes sous les yeux. Sans deux distracteurs il n'a pas de sens.
  if (distractors.length >= 2) {
    exercises.push({
      type: 'mcq',
      prompt: `Laquelle veut dire « ${entry.meaning} » ?`,
      answerSpec: { accepted: [entry.term] },
      distractors,
    });
  }

  return exercises;
}

/**
 * Les autres mots du carnet servent de distracteurs : ce sont les seuls
 * plausibles, puisque ce sont ceux qu'on est en train d'apprendre. On prend les
 * voisins immédiats dans la liste plutôt qu'un tirage au sort — le résultat est
 * stable d'une session à l'autre, donc reproductible.
 */
function neighbours(entries: VocabRecord[], index: number): string[] {
  const out: string[] = [];
  for (let step = 1; out.length < RESCUE_DISTRACTORS && step < entries.length; step++) {
    for (const k of [index - step, index + step]) {
      const other = entries[k];
      if (!other || out.length >= RESCUE_DISTRACTORS) continue;
      if (other.term.toLowerCase() !== entries[index]!.term.toLowerCase()) out.push(other.term);
    }
  }
  return out;
}

/** Le vocabulaire personnel, présenté au moteur comme n'importe quel pack. */
export function vocabPack(entries: VocabRecord[]): ContentPack {
  // Ordre d'ajout : c'est celui dans lequel les nouveautés seront introduites.
  const ordered = [...entries].sort((a, b) => a.id.localeCompare(b.id));

  const items: PackItem[] = ordered.map((entry, i) => ({
    id: entry.id,
    topicId: entry.id,
    tags: entry.tag ? [entry.tag] : [],
    fields: {
      term: entry.term,
      meaning: entry.meaning,
      ...(entry.example ? { example: entry.example } : {}),
      ...(entry.note ? { note: entry.note } : {}),
    },
    exercises: exercisesFor(entry, neighbours(ordered, i)),
  }));

  return {
    meta: {
      id: VOCAB_PACK_ID,
      title: 'Mon vocabulaire',
      subject: 'Anglais',
      version: '1',
      schemaVersion: 1,
      locale: 'fr-FR',
      contentLocale: 'en-GB',
    },
    topics: ordered.map((entry, i) => ({
      id: entry.id,
      title: entry.term,
      prerequisites: [],
      order: i + 1,
    })),
    items,
  };
}

/** Le pack du moment, lu depuis la base. */
export async function loadVocabPack(): Promise<ContentPack> {
  return vocabPack(await listVocab());
}
