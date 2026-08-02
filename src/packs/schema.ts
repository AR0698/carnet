/**
 * Schéma d'un pack de contenu — générique, agnostique du sujet.
 *
 * Un pack décrit un domaine (grammaire anglaise, vocabulaire, code, histoire…)
 * sous forme de données pures. Le moteur ne connaît jamais le sujet : il ne
 * manipule que des `Topic`, des `Item` et des `Exercise`.
 */

export type ExerciseType =
  | 'produce'
  | 'fill_blank'
  | 'spot_error'
  | 'transform'
  | 'mcq';

export interface AnswerSpec {
  /** Réponses acceptées. La première sert de réponse canonique affichée. */
  accepted: string[];
  /** Par défaut false : la casse est ignorée. */
  caseSensitive?: boolean;
  /** Par défaut true : les accents sont ignorés à la comparaison. */
  ignoreAccents?: boolean;
}

export interface Exercise {
  type: ExerciseType;
  /** La consigne. Pour `fill_blank`, contient le marqueur `___`. */
  prompt: string;
  /**
   * Phrase de départ, affichée à part : la phrase à transformer (`transform`)
   * ou la phrase fautive à corriger (`spot_error`).
   */
  source?: string;
  answerSpec: AnswerSpec;
  /** Rappel de règle court, une phrase. Affiché à la demande. */
  hints?: string[];
  /** Uniquement pour `mcq`. */
  distractors?: string[];
}

export interface PackItem {
  id: string;
  topicId: string;
  tags: string[];
  /** Données brutes libres, spécifiques au sujet (non interprétées par le moteur). */
  fields: Record<string, string>;
  exercises: Exercise[];
}

export interface Topic {
  id: string;
  title: string;
  /** Ordre suggéré de progression — jamais un verrou d'accès. */
  prerequisites: string[];
  order: number;
  /** Groupe thématique d'affichage (optionnel). */
  group?: string;
}

export interface PackMeta {
  id: string;
  title: string;
  subject: string;
  version: string;
  schemaVersion: number;
  locale: string;
}

export interface ContentPack {
  meta: PackMeta;
  topics: Topic[];
  items: PackItem[];
}

/** Version de schéma comprise par ce moteur. */
export const SUPPORTED_SCHEMA_VERSION = 1;

/** Identifiant stable d'une carte : un exercice = une carte FSRS. */
export function cardId(packId: string, itemId: string, exerciseIndex: number): string {
  return `${packId}:${itemId}:${exerciseIndex}`;
}

/**
 * Le `mcq` n'est pas un exercice comme les autres : il ne se planifie pas.
 * C'est un filet de secours, proposé à la place d'un exercice de production
 * quand celui-ci a été raté deux fois de suite (§4). Il ne reçoit donc pas de
 * carte FSRS propre.
 */
export function isScheduled(exercise: Exercise): boolean {
  return exercise.type !== 'mcq';
}

/** Le filet de secours d'un item, s'il en a un. */
export function rescueExercise(item: PackItem): Exercise | undefined {
  return item.exercises.find((e) => e.type === 'mcq');
}
