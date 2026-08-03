/**
 * La fenêtre où du contenu neuf rencontre du code ancien.
 *
 * Elle n'est pas un accident : les packs sont relus à chaque lancement, alors
 * qu'une nouvelle version de l'application attend qu'on appuie sur
 * « Redémarrer » — délibérément, pour ne pas interrompre une révision. Ajouter
 * un type d'exercice ouvre donc à coup sûr un intervalle pendant lequel le
 * téléphone télécharge un contenu que son code ne comprend pas encore.
 *
 * Ce qui s'y passait a été observé en vrai : cent onze unités refusées d'un
 * bloc, et « un carnet n'a pas pu être ouvert » sur l'accueil, parce que trois
 * exercices sur deux mille neuf cent vingt-cinq portaient un type inconnu.
 *
 * Les deux garanties tenues ici sont donc celles-là : le pack passe, et les
 * exercices incompréhensibles ne reçoivent pas de carte — sans décaler l'index
 * de leurs voisins, ce qui réattribuerait des cartes déjà travaillées à
 * d'autres questions.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { exercise, pack, resetDb } from '../test/helpers';
import { syncPackCards } from '../storage/cards';
import { db } from '../storage/db';
import { cardId, isScheduled, type Exercise } from './schema';
import { validatePack } from './validate';

/** Un exercice d'un type que cette version ne connaît pas — le futur, en somme. */
const fromTheFuture = (): Exercise =>
  ({
    type: 'karaoke',
    prompt: 'Chante-la.',
    answerSpec: { accepted: ['la'] },
  }) as unknown as Exercise;

describe('un pack plus récent que le code installé', () => {
  beforeEach(resetDb);

  it('se charge quand même, sans lever', () => {
    const p = pack('v', [
      { id: 'i1', exercises: [exercise(), fromTheFuture(), exercise({ type: 'fill_blank', prompt: 'a ___ b' })] },
    ]);
    expect(() => validatePack(p)).not.toThrow();
  });

  it('ne crée pas de carte pour l’exercice inconnu', async () => {
    const p = pack('v', [
      { id: 'i1', exercises: [exercise(), fromTheFuture(), exercise({ type: 'fill_blank', prompt: 'a ___ b' })] },
    ]);
    await syncPackCards(p);

    const ids = (await db.cards.where('packId').equals('v').toArray()).map((c) => c.id).sort();
    expect(ids).toEqual([cardId('v', 'i1', 0), cardId('v', 'i1', 2)]);
  });

  it('ne décale pas l’index des exercices voisins', async () => {
    // La garantie qui compte vraiment. Filtrer le tableau au lieu de sauter
    // l'exercice donnerait ici la carte `v:i1:1` au `fill_blank`, alors que la
    // même carte désignera `v:i1:2` une fois l'application à jour : l'historique
    // de révision d'une question se retrouverait collé à une autre.
    const p = pack('v', [
      { id: 'i1', exercises: [exercise(), fromTheFuture(), exercise({ type: 'fill_blank', prompt: 'a ___ b' })] },
    ]);
    await syncPackCards(p);

    const later = await db.cards.get(cardId('v', 'i1', 2));
    expect(later?.exerciseIndex).toBe(2);
    expect(await db.cards.get(cardId('v', 'i1', 1))).toBeUndefined();
  });

  it('refuse toujours ce qui est vraiment cassé', () => {
    const p = pack('v', [{ id: 'i1', exercises: [exercise({ prompt: '' })] }]);
    expect(() => validatePack(p)).toThrow();
  });

  it('garde le mcq hors de la planification, et le reconnaît', () => {
    // Deux raisons distinctes de ne pas porter de carte, et il faut qu'elles le
    // restent : le mcq est connu et volontairement non planifié, l'inconnu ne
    // l'est que faute de savoir l'afficher.
    expect(isScheduled(exercise({ type: 'mcq', distractors: ['a', 'b'] }))).toBe(false);
    expect(isScheduled(fromTheFuture())).toBe(false);
    expect(isScheduled(exercise({ type: 'match', pairs: [] }))).toBe(true);
  });
});
