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

/**
 * Erreur anticipée et son explication.
 *
 * Écrite à la rédaction du contenu, servie hors ligne et instantanément.
 * C'est ce qui permet d'expliquer finement sans faire tourner de modèle sur
 * le téléphone : le travail d'analyse est fait une fois, en amont.
 */
export interface Pitfall {
  /** Réponses fautives visées. Comparées aux variantes près (contractions, orthographe). */
  answers: string[];
  /** Pourquoi c'est faux — une ou deux phrases, sans jargon. */
  explain: string;
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
  /** Erreurs prévisibles, avec l'explication qui va avec. */
  pitfalls?: Pitfall[];
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
  /** Langue de l'interface du pack : consignes, indices, explications. */
  locale: string;
  /**
   * Langue de la matière elle-même, quand elle diffère de celle des consignes
   * (grammaire anglaise expliquée en français : `fr-FR` / `en-GB`). C'est
   * celle-ci qu'on lit à voix haute.
   */
  contentLocale?: string;
}

export interface ContentPack {
  meta: PackMeta;
  topics: Topic[];
  items: PackItem[];
}

/** Version de schéma comprise par ce moteur. */
export const SUPPORTED_SCHEMA_VERSION = 1;

/** Marqueur du trou à combler dans un énoncé. */
export const BLANK = '___';

/** Langue de la matière — celle qu'on prononce. */
export function contentLang(pack: ContentPack): string {
  return pack.meta.contentLocale ?? pack.meta.locale;
}

/**
 * La phrase juste et entière d'un exercice, telle qu'elle doit s'entendre.
 *
 * Un énoncé à trou n'a de sens qu'une fois comblé ; ailleurs, la réponse
 * attendue est déjà la phrase complète. La parenthèse finale, quand il y en a
 * une, est une aide écrite à l'apprenante — le verbe à conjuguer, la forme
 * visée — et n'appartient pas à la phrase : on ne la prononce pas.
 */
export function spokenSentence(exercise: Exercise): string {
  const answer = exercise.answerSpec.accepted[0] ?? '';
  const filled = exercise.prompt.includes(BLANK)
    ? exercise.prompt.split(BLANK).join(answer)
    : answer;
  return filled.replace(/\s*\([^()]*\)\s*$/, '').trim();
}

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
