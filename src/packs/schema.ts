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
  prompt: string;
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
