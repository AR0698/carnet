import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../test/helpers';
import { syncPackCards } from './cards';
import { db } from './db';
import { deleteVocab, listVocab, loadVocabPack, saveVocab, VOCAB_PACK_ID, VocabError } from './vocab';

beforeEach(resetDb);

/** Reproduit ce que fait le démarrage : reconstruire le pack, aligner les cartes. */
async function syncVocab(): Promise<void> {
  await syncPackCards(await loadVocabPack(), { prune: false });
}

const vocabCards = () => db.cards.where('packId').equals(VOCAB_PACK_ID).toArray();

describe('saveVocab', () => {
  it('refuse un mot sans expression ou sans sens', async () => {
    await expect(saveVocab({ term: '  ', meaning: 'x' })).rejects.toBeInstanceOf(VocabError);
    await expect(saveVocab({ term: 'x', meaning: '  ' })).rejects.toBeInstanceOf(VocabError);
    expect(await db.vocab.count()).toBe(0);
  });

  it('conserve la date de création à la modification', async () => {
    const first = await saveVocab({ term: 'gert lush', meaning: 'super' });
    const again = await saveVocab({ id: first.id, term: 'gert lush', meaning: 'excellent' });
    expect(again.createdAt.getTime()).toBe(first.createdAt.getTime());
    expect(again.meaning).toBe('excellent');
    expect(await db.vocab.count()).toBe(1);
  });
});

describe('génération des exercices', () => {
  it('produit une production, et un texte à trou quand l’exemple contient l’expression', async () => {
    await saveVocab({
      term: 'gert lush',
      meaning: 'super',
      example: 'That cider was gert lush.',
    });
    const p = await loadVocabPack();
    const types = p.items[0]!.exercises.map((e) => e.type);

    expect(types).toEqual(['produce', 'fill_blank']);
    expect(p.items[0]!.exercises[1]!.prompt).toBe('That cider was ___.');
  });

  it('trouve l’expression quelle que soit la casse', async () => {
    await saveVocab({ term: 'gert lush', meaning: 'super', example: 'Gert Lush, that was.' });
    const p = await loadVocabPack();
    expect(p.items[0]!.exercises[1]!.prompt).toBe('___, that was.');
  });

  it('n’ajoute pas de texte à trou si l’expression n’est pas dans l’exemple', async () => {
    // Sinon le trou serait insoluble : la réponse n'apparaît nulle part.
    await saveVocab({ term: 'gert lush', meaning: 'super', example: 'Nothing to see here.' });
    const p = await loadVocabPack();
    expect(p.items[0]!.exercises.map((e) => e.type)).toEqual(['produce']);
  });

  it('n’ajoute le filet de secours qu’à partir de deux distracteurs', async () => {
    await saveVocab({ term: 'un', meaning: 'a' });
    expect((await loadVocabPack()).items[0]!.exercises.some((e) => e.type === 'mcq')).toBe(false);

    await saveVocab({ term: 'deux', meaning: 'b' });
    await saveVocab({ term: 'trois', meaning: 'c' });
    const p = await loadVocabPack();
    expect(p.items.every((i) => i.exercises.some((e) => e.type === 'mcq'))).toBe(true);
  });

  it('une notion par mot — sans quoi aucune session ne serait mélangée', async () => {
    await saveVocab({ term: 'un', meaning: 'a' });
    await saveVocab({ term: 'deux', meaning: 'b' });
    const p = await loadVocabPack();
    expect(p.topics).toHaveLength(2);
    expect(new Set(p.items.map((i) => i.topicId)).size).toBe(2);
  });

  it('une expression contenant des caractères d’expression régulière ne casse rien', async () => {
    await saveVocab({ term: 'a (lot) of', meaning: 'beaucoup', example: 'I have a (lot) of time.' });
    const p = await loadVocabPack();
    expect(p.items[0]!.exercises[1]!.prompt).toBe('I have ___ time.');
  });
});

describe('réconciliation des cartes', () => {
  it('retire le texte à trou quand la phrase d’exemple est effacée', async () => {
    const entry = await saveVocab({ term: 'lush', meaning: 'super', example: 'That was lush.' });
    await syncVocab();
    expect(await vocabCards()).toHaveLength(2);

    await saveVocab({ id: entry.id, term: 'lush', meaning: 'super', example: '' });

    const remaining = await vocabCards();
    expect(remaining.map((c) => c.exerciseIndex)).toEqual([0]);
  });

  it('supprimer un mot emporte ses cartes et ses réponses, et rien d’autre', async () => {
    const a = await saveVocab({ term: 'lush', meaning: 'super', example: 'That was lush.' });
    const b = await saveVocab({ term: 'gert', meaning: 'très' });
    await syncVocab();

    await db.reviews.bulkAdd([
      { cardId: `${VOCAB_PACK_ID}:${a.id}:0`, reviewedAt: new Date(), rating: 3, correct: true, usedHint: false, elapsedMs: 1, interleaved: true, scheduledDays: 1 },
      { cardId: `${VOCAB_PACK_ID}:${b.id}:0`, reviewedAt: new Date(), rating: 3, correct: true, usedHint: false, elapsedMs: 1, interleaved: true, scheduledDays: 1 },
    ]);

    await deleteVocab(a.id);

    expect((await listVocab()).map((v) => v.id)).toEqual([b.id]);
    expect((await vocabCards()).map((c) => c.itemId)).toEqual([b.id]);
    expect((await db.reviews.toArray()).map((r) => r.cardId)).toEqual([
      `${VOCAB_PACK_ID}:${b.id}:0`,
    ]);
  });

  /**
   * Le scénario redouté : la base répond une liste vide alors que des cartes
   * existent. Le démarrage ne doit rien emporter.
   */
  it('un pack vide au démarrage n’emporte aucune carte', async () => {
    await saveVocab({ term: 'lush', meaning: 'super', example: 'That was lush.' });
    await syncVocab();
    const before = await vocabCards();
    expect(before).toHaveLength(2);

    await db.vocab.clear(); // comme si la lecture avait échoué
    await syncVocab();

    expect(await vocabCards()).toHaveLength(before.length);
  });
});
