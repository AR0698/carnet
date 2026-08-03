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

/**
 * Un segment de l'axe du temps — de `from` à `to`, en pourcentage de l'axe.
 *
 * `open` dit de quel côté l'action déborde du cadre : une action commencée
 * avant le début du dessin et qui dure encore n'a ni début ni fin à montrer,
 * et un segment aux deux bouts francs mentirait sur ce point précis.
 */
export interface LessonSpan {
  from: number;
  to: number;
  label: string;
  open?: 'left' | 'right' | 'both';
  /** `quiet` pour ce qui sert de décor, `strong` pour ce que la règle vise. */
  tone?: 'strong' | 'quiet';
}

/** Un instant ponctuel sur l'axe — un fait daté, par opposition à une durée. */
export interface LessonMark {
  at: number;
  label: string;
}

/**
 * Le dessin de la règle : un axe du temps, ses durées et ses instants.
 *
 * C'est un schéma, pas une décoration. Une règle de temps grammatical se voit
 * sur un axe bien plus vite qu'elle ne se lit — et ce qui est vu en même temps
 * que lu se retrouve par deux chemins au lieu d'un.
 */
export interface LessonFigure {
  /** Étiquette du repère « maintenant ». Sans elle, pas de repère tracé. */
  now?: string;
  spans?: LessonSpan[];
  marks?: LessonMark[];
}

/** Les deux registres qu'on va réellement parler. */
export type LessonRegister = 'bristol' | 'work';

export interface LessonExample {
  register: LessonRegister;
  en: string;
  /** La même chose en français — jamais du mot à mot, ce qu'on dirait vraiment. */
  fr: string;
}

/**
 * Le calque du français : la faute qu'on fait parce que la phrase française
 * est construite autrement, et ce qu'il faut dire à la place.
 */
export interface LessonTrap {
  wrong: string;
  right: string;
  /** Pourquoi le français pousse à l'erreur — une phrase. */
  why: string;
}

/** Les deux formes que l'unité sert à distinguer, et ce qui les sépare. */
export interface LessonContrast {
  left: string;
  right: string;
  note: string;
}

/**
 * La fiche de cours d'une notion — l'endroit où on va comprendre.
 *
 * Elle tient sur un écran, sans défilement, et se lit dans un ordre fixe :
 * l'image d'abord, la règle ensuite, puis le contraste, le piège du
 * francophone, et deux phrases qu'on pourrait vraiment prononcer. Cet ordre
 * n'est pas décoratif — on retient un cas concret bien avant une formulation
 * abstraite, et la formulation ne s'accroche que si elle arrive après.
 *
 * Une fiche ne se planifie pas et ne produit aucune carte : elle se consulte.
 * C'est délibéré (§ audit) — relire donne l'impression de savoir, et cette
 * impression est précisément ce que le moteur combat partout ailleurs.
 */
export interface Lesson {
  /** L'accroche mentale : la règle attachée à quelque chose qui se voit. */
  image: string;
  /** La règle en une phrase, si possible sous forme d'équation. */
  rule: string;
  figure?: LessonFigure;
  contrast?: LessonContrast;
  trap: LessonTrap;
  examples: LessonExample[];
  /** Les unités voisines — celles qu'on confond avec celle-ci. */
  seeAlso?: string[];
}

export interface Topic {
  id: string;
  title: string;
  /** Ordre suggéré de progression — jamais un verrou d'accès. */
  prerequisites: string[];
  order: number;
  /** Groupe thématique d'affichage (optionnel). */
  group?: string;
  /** La fiche de cours, quand elle est écrite. Toutes ne le sont pas encore. */
  lesson?: Lesson;
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

/** La notion d'un identifiant, si le pack la connaît. */
export function topicOf(pack: ContentPack, topicId: string): Topic | undefined {
  return pack.topics.find((t) => t.id === topicId);
}

/**
 * La fiche d'une notion, si elle est écrite.
 *
 * Toutes les unités n'en ont pas : l'appelant doit toujours pouvoir se passer
 * de fiche, et l'interface ne montre l'accès que là où il mène quelque part.
 */
export function lessonOf(pack: ContentPack, topicId: string): Lesson | undefined {
  return topicOf(pack, topicId)?.lesson;
}

/** Les notions du pack qui ont une fiche, dans l'ordre du parcours. */
export function topicsWithLesson(pack: ContentPack): Topic[] {
  return pack.topics.filter((t) => t.lesson).sort((a, b) => a.order - b.order);
}
