import { describe, expect, it } from 'vitest';
import { exercise, pack } from '../test/helpers';
import { lessonOf, topicOf, topicsWithLesson, type Lesson } from './schema';
import { PackValidationError, validatePack } from './validate';

const lesson = (over: Partial<Lesson> = {}): Lesson => ({
  image: 'Une image qui se voit.',
  rule: 'La règle en une phrase.',
  trap: { wrong: 'I have 30 years.', right: "I'm 30.", why: 'Le français dit avoir.' },
  examples: [
    { register: 'bristol', en: 'A pint on the harbourside.', fr: 'Une pinte sur le port.' },
    { register: 'work', en: 'The deploy is green.', fr: 'Le déploiement est au vert.' },
  ],
  ...over,
});

/** Un pack de test dont seule la seconde notion a une fiche. */
function taughtPack() {
  const p = pack('g', [
    { id: 'i1', topicId: 't1', exercises: [exercise()] },
    { id: 'i2', topicId: 't2', exercises: [exercise()] },
  ]);
  p.topics = p.topics.map((t) => (t.id === 't2' ? { ...t, lesson: lesson() } : t));
  return p;
}

describe('les fiches de cours', () => {
  it('ne rend une fiche que pour les notions qui en ont une', () => {
    const p = taughtPack();
    expect(lessonOf(p, 't2')?.rule).toBe('La règle en une phrase.');
    expect(lessonOf(p, 't1')).toBeUndefined();
    // Une notion absente ne doit pas lever : l'appelant demande souvent une
    // notion qui vient d'une carte, pas du pack en cours.
    expect(lessonOf(p, 'inconnue')).toBeUndefined();
    expect(topicOf(p, 'inconnue')).toBeUndefined();
  });

  it('liste les notions enseignées dans l’ordre du parcours', () => {
    const p = taughtPack();
    p.topics = [
      { id: 't3', title: 't3', prerequisites: [], order: 3, lesson: lesson() },
      ...p.topics,
    ];
    expect(topicsWithLesson(p).map((t) => t.id)).toEqual(['t2', 't3']);
  });

  it('accepte un pack dont aucune notion n’a de fiche', () => {
    const p = pack('g', [{ id: 'i1', exercises: [exercise()] }]);
    expect(() => validatePack(p)).not.toThrow();
  });

  // Le pack est téléchargé : une fiche tronquée en chemin planterait l'écran
  // de cours au moment précis où on vient y chercher de l'aide.
  it('refuse une fiche sans piège français', () => {
    const p = taughtPack();
    p.topics = p.topics.map((t) =>
      t.id === 't2' ? { ...t, lesson: { ...lesson(), trap: undefined } as unknown as Lesson } : t,
    );
    expect(() => validatePack(p)).toThrow(PackValidationError);
  });

  it('refuse un exemple dont le registre n’existe pas', () => {
    const p = taughtPack();
    p.topics = p.topics.map((t) =>
      t.id === 't2'
        ? {
            ...t,
            lesson: lesson({
              examples: [
                { register: 'pub' as unknown as 'bristol', en: 'Anything.', fr: 'Peu importe.' },
              ],
            }),
          }
        : t,
    );
    expect(() => validatePack(p)).toThrow(/register inconnu/);
  });
});
