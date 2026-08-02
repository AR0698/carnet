import { beforeEach, describe, expect, it } from 'vitest';
import { exercise, pack, resetDb } from '../test/helpers';
import { BackupError, buildBackup, parseBackup, restoreBackup, summarise } from './backup';
import { syncPackCards } from './cards';
import { db } from './db';
import { saveVocab } from './vocab';

beforeEach(resetDb);

/** Ce que fait vraiment un export : passer par du texte. */
const roundTrip = async () => parseBackup(JSON.stringify(await buildBackup()));

async function seed(): Promise<void> {
  await syncPackCards(pack('g', [{ id: 'i1', exercises: [exercise(), exercise()] }]));
  await saveVocab({ term: 'gert lush', meaning: 'super', example: 'That was gert lush.' });
  await db.reviews.add({
    cardId: 'g:i1:0',
    reviewedAt: new Date('2026-05-04T10:00:00Z'),
    rating: 3,
    correct: true,
    usedHint: false,
    elapsedMs: 8000,
    recallMs: 2400,
    interleaved: true,
    scheduledDays: 3,
  });
  await db.kv.put({ key: 'prefs', value: { paper: true } });
}

describe('export', () => {
  it('emporte tout ce qui ne se retélécharge pas', async () => {
    await seed();
    const backup = await buildBackup();
    expect(summarise(backup)).toEqual({ words: 1, cards: 2, reviews: 1 });
    expect(backup.kv.some((r) => r.key === 'prefs')).toBe(true);
  });
});

describe('parseBackup', () => {
  /**
   * Le piège silencieux : sans réveil, `card.due` reste une chaîne. Les
   * comparaisons d'échéance se feraient alors en ordre alphabétique, et la
   * planification partirait en morceaux sans lever la moindre erreur.
   */
  it('réveille les dates, qui traversent le JSON en texte', async () => {
    await seed();
    const raw = JSON.stringify(await buildBackup());

    // La preuve que le problème est réel : dans le texte, ce sont des chaînes.
    expect(typeof JSON.parse(raw).cards[0].due).toBe('string');

    const parsed = parseBackup(raw);
    expect(parsed.cards.every((c) => c.due instanceof Date)).toBe(true);
    expect(parsed.cards.every((c) => c.createdAt instanceof Date)).toBe(true);
    expect(parsed.vocab.every((v) => v.createdAt instanceof Date)).toBe(true);
    expect(parsed.reviews.every((r) => r.reviewedAt instanceof Date)).toBe(true);
  });

  it('refuse ce qui n’est pas une sauvegarde, sans rien toucher', async () => {
    await seed();
    expect(() => parseBackup('pas du json')).toThrow(BackupError);
    expect(() => parseBackup('{"format":"autre chose"}')).toThrow(BackupError);
    expect(() => parseBackup(JSON.stringify({ format: 'go-to-bristol-backup', version: 99 }))).toThrow(
      BackupError,
    );
    expect(await db.cards.count()).toBe(2);
  });

  it('refuse une sauvegarde amputée d’une section', async () => {
    const backup = await buildBackup();
    const { cards: _dropped, ...sansCartes } = backup;
    expect(() => parseBackup(JSON.stringify(sansCartes))).toThrow(BackupError);
  });

  it('signale une date illisible plutôt que de fabriquer un NaN', async () => {
    await seed();
    const broken = await buildBackup();
    const raw = JSON.parse(JSON.stringify(broken));
    raw.cards[0].due = 'pas une date';
    expect(() => parseBackup(JSON.stringify(raw))).toThrow(/Date illisible/);
  });
});

describe('restoreBackup', () => {
  it('remet la base dans l’état du fichier, à l’identique', async () => {
    await seed();
    const parsed = await roundTrip();
    const before = {
      cards: await db.cards.toArray(),
      vocab: await db.vocab.toArray(),
    };

    // On saccage, puis on restaure.
    await db.cards.clear();
    await db.vocab.clear();
    await saveVocab({ term: 'intrus', meaning: 'à faire disparaître' });

    const summary = await restoreBackup(parsed);

    expect(summary).toEqual({ words: 1, cards: 2, reviews: 1 });
    expect((await db.vocab.toArray()).map((v) => v.term)).toEqual(
      before.vocab.map((v) => v.term),
    );
    const after = await db.cards.toArray();
    expect(after.map((c) => c.id).sort()).toEqual(before.cards.map((c) => c.id).sort());
    expect(after.every((c) => c.due instanceof Date)).toBe(true);
  });

  it('remplace, sans fusionner', async () => {
    await seed();
    const parsed = await roundTrip();
    await saveVocab({ term: 'ajouté après coup', meaning: 'x' });

    await restoreBackup(parsed);

    expect(await db.vocab.count()).toBe(1);
  });

  it('conserve la latence de rappel du journal', async () => {
    await seed();
    await restoreBackup(await roundTrip());
    expect((await db.reviews.toArray())[0]?.recallMs).toBe(2400);
  });
});
