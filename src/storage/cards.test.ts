import { beforeEach, describe, expect, it } from 'vitest';
import { exercise, pack, resetDb } from '../test/helpers';
import { packCards, resetCard, syncPackCards } from './cards';
import { db } from './db';

beforeEach(resetDb);

describe('syncPackCards', () => {
  it('crée une carte par exercice planifié, et aucune pour le filet de secours', async () => {
    const p = pack('g', [
      { id: 'i1', exercises: [exercise(), exercise({ type: 'fill_blank', prompt: 'a ___ b' })] },
      {
        id: 'i2',
        exercises: [
          exercise(),
          exercise({ type: 'mcq', distractors: ['a', 'b'] }),
        ],
      },
    ]);

    const report = await syncPackCards(p);
    expect(report.created).toBe(3);
    expect((await packCards('g')).map((c) => c.id).sort()).toEqual(['g:i1:0', 'g:i1:1', 'g:i2:0']);
  });

  it('est rejouable sans effet de bord', async () => {
    const p = pack('g', [{ id: 'i1', exercises: [exercise()] }]);
    await syncPackCards(p);
    const second = await syncPackCards(p);
    expect(second).toEqual({ created: 0, removed: 0, kept: 1 });
  });

  it('retire les cartes dont l’exercice a disparu — pack téléchargé', async () => {
    await syncPackCards(pack('g', [{ id: 'i1', exercises: [exercise(), exercise()] }]));
    const report = await syncPackCards(pack('g', [{ id: 'i1', exercises: [exercise()] }]));

    expect(report.removed).toBe(1);
    expect((await packCards('g')).map((c) => c.id)).toEqual(['g:i1:0']);
  });

  it('laisse intact l’état FSRS des cartes conservées', async () => {
    await syncPackCards(pack('g', [{ id: 'i1', exercises: [exercise()] }]));
    await db.cards.update('g:i1:0', { stability: 42, reps: 7 });

    await syncPackCards(pack('g', [{ id: 'i1', exercises: [exercise(), exercise()] }]));

    const kept = await db.cards.get('g:i1:0');
    expect(kept?.stability).toBe(42);
    expect(kept?.reps).toBe(7);
  });

  /**
   * La garantie qui protège le carnet Discovery. Son « pack » est reconstruit à
   * chaque démarrage depuis IndexedDB : un pack vide n'y signifie pas que le
   * contenu a disparu, il peut signifier que la lecture a échoué. Un élagage
   * emporterait alors des mois de travail irremplaçable.
   */
  describe('prune: false — le carnet personnel', () => {
    it('ne retire aucune carte, même face à un pack devenu vide', async () => {
      await syncPackCards(pack('my-vocab', [{ id: 'v1', exercises: [exercise(), exercise()] }]), {
        prune: false,
      });
      expect(await db.cards.count()).toBe(2);

      const report = await syncPackCards(pack('my-vocab', []), { prune: false });

      expect(report.removed).toBe(0);
      expect(await db.cards.count()).toBe(2);
    });

    it('continue de créer les cartes manquantes', async () => {
      await syncPackCards(pack('my-vocab', [{ id: 'v1', exercises: [exercise()] }]), {
        prune: false,
      });
      const report = await syncPackCards(
        pack('my-vocab', [
          { id: 'v1', exercises: [exercise()] },
          { id: 'v2', exercises: [exercise()] },
        ]),
        { prune: false },
      );

      expect(report.created).toBe(1);
      expect(await db.cards.count()).toBe(2);
    });
  });
});

describe('resetCard', () => {
  it('remet la carte à neuf et rouvre la porte de graduation', async () => {
    await syncPackCards(pack('g', [{ id: 'i1', exercises: [exercise()] }]));
    await db.cards.update('g:i1:0', {
      lapses: 9,
      stability: 3,
      reps: 20,
      spacedSuccesses: 1,
      interleavedSuccess: true,
      consecutiveFailures: 4,
    });

    await resetCard('g:i1:0');

    const after = await db.cards.get('g:i1:0');
    expect(after?.lapses).toBe(0);
    expect(after?.reps).toBe(0);
    expect(after?.spacedSuccesses).toBe(0);
    expect(after?.interleavedSuccess).toBe(false);
    expect(after?.consecutiveFailures).toBe(0);
    // L'identité, elle, ne bouge pas : c'est la même carte du même carnet.
    expect(after?.packId).toBe('g');
    expect(after?.topicId).toBe('t1');
  });
});
