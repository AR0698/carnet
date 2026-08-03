/**
 * Validation d'un pack au chargement.
 *
 * Étape 1 : validation structurelle manuelle, sans dépendance.
 * Étape 3 : sera remplacée / doublée par un JSON Schema dérivé de `schema.ts`.
 * Dans les deux cas, l'appelant ne voit que `validatePack()` — le reste du
 * moteur n'a pas à changer.
 */

import {
  SUPPORTED_SCHEMA_VERSION,
  type ContentPack,
  type Exercise,
  type ExerciseType,
  type Lesson,
} from './schema';

const EXERCISE_TYPES: ExerciseType[] = [
  'produce',
  'fill_blank',
  'spot_error',
  'transform',
  'mcq',
];

export class PackValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Pack invalide :\n- ${issues.join('\n- ')}`);
    this.name = 'PackValidationError';
    this.issues = issues;
  }
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function validateExercise(ex: unknown, where: string, issues: string[]): void {
  if (typeof ex !== 'object' || ex === null) {
    issues.push(`${where} : l'exercice n'est pas un objet`);
    return;
  }
  const e = ex as Partial<Exercise>;

  if (!EXERCISE_TYPES.includes(e.type as ExerciseType)) {
    issues.push(`${where} : type d'exercice inconnu (${String(e.type)})`);
  }
  if (!isNonEmptyString(e.prompt)) {
    issues.push(`${where} : prompt manquant ou vide`);
  }
  if (
    !e.answerSpec ||
    !Array.isArray(e.answerSpec.accepted) ||
    e.answerSpec.accepted.length === 0 ||
    !e.answerSpec.accepted.every(isNonEmptyString)
  ) {
    issues.push(`${where} : answerSpec.accepted doit contenir au moins une réponse non vide`);
  }
  if (e.hints !== undefined && !Array.isArray(e.hints)) {
    issues.push(`${where} : hints doit être un tableau`);
  }
  if (e.pitfalls !== undefined) {
    if (!Array.isArray(e.pitfalls)) {
      issues.push(`${where} : pitfalls doit être un tableau`);
    } else {
      e.pitfalls.forEach((p, k) => {
        if (!Array.isArray(p?.answers) || !p.answers.every(isNonEmptyString)) {
          issues.push(`${where} / pitfall ${k} : answers doit lister des réponses non vides`);
        }
        if (!isNonEmptyString(p?.explain)) {
          issues.push(`${where} / pitfall ${k} : explain manquant`);
        }
      });
    }
  }
  if (e.type === 'mcq' && (!Array.isArray(e.distractors) || e.distractors.length < 2)) {
    issues.push(`${where} : un mcq a besoin d'au moins deux distracteurs`);
  }
  if ((e.type === 'transform' || e.type === 'spot_error') && !isNonEmptyString(e.source)) {
    issues.push(`${where} : ce type d'exercice a besoin d'une phrase de départ (source)`);
  }
  if (e.type === 'fill_blank' && isNonEmptyString(e.prompt) && !e.prompt.includes('___')) {
    issues.push(`${where} : un fill_blank a besoin du marqueur ___ dans son énoncé`);
  }
}

/**
 * La fiche de cours d'une notion, quand il y en a une.
 *
 * Le pack est téléchargé : une fiche à moitié écrite ou tronquée en chemin
 * planterait l'écran de cours au moment précis où on vient y chercher de
 * l'aide. Mieux vaut refuser le pack au chargement, avec une raison lisible,
 * que casser après une réponse ratée.
 */
function validateLesson(lesson: unknown, where: string, issues: string[]): void {
  if (typeof lesson !== 'object' || lesson === null) {
    issues.push(`${where} : lesson doit être un objet`);
    return;
  }
  const l = lesson as Partial<Lesson>;

  for (const key of ['image', 'rule'] as const) {
    if (!isNonEmptyString(l[key])) issues.push(`${where} : lesson.${key} manquant`);
  }

  if (typeof l.trap !== 'object' || l.trap === null) {
    issues.push(`${where} : lesson.trap manquant`);
  } else {
    for (const key of ['wrong', 'right', 'why'] as const) {
      if (!isNonEmptyString(l.trap[key])) issues.push(`${where} : lesson.trap.${key} manquant`);
    }
  }

  if (!Array.isArray(l.examples) || l.examples.length === 0) {
    issues.push(`${where} : lesson.examples doit contenir au moins un exemple`);
  } else {
    l.examples.forEach((e, i) => {
      if (e?.register !== 'bristol' && e?.register !== 'work') {
        issues.push(`${where} / exemple ${i} : register inconnu (${String(e?.register)})`);
      }
      for (const key of ['en', 'fr'] as const) {
        if (!isNonEmptyString(e?.[key])) issues.push(`${where} / exemple ${i} : ${key} manquant`);
      }
    });
  }
}

export function validatePack(raw: unknown): ContentPack {
  const issues: string[] = [];

  if (typeof raw !== 'object' || raw === null) {
    throw new PackValidationError(['le pack n\'est pas un objet JSON']);
  }
  const pack = raw as Partial<ContentPack>;

  // --- meta ---
  const meta = pack.meta;
  if (!meta) {
    issues.push('meta manquant');
  } else {
    for (const key of ['id', 'title', 'subject', 'version', 'locale'] as const) {
      if (!isNonEmptyString(meta[key])) issues.push(`meta.${key} manquant`);
    }
    if (meta.contentLocale !== undefined && !isNonEmptyString(meta.contentLocale)) {
      issues.push('meta.contentLocale, s\'il est présent, doit être une étiquette de langue');
    }
    if (typeof meta.schemaVersion !== 'number') {
      issues.push('meta.schemaVersion manquant');
    } else if (meta.schemaVersion > SUPPORTED_SCHEMA_VERSION) {
      issues.push(
        `meta.schemaVersion ${meta.schemaVersion} > ${SUPPORTED_SCHEMA_VERSION} pris en charge — mets à jour l'application`,
      );
    }
  }

  // --- topics ---
  const topicIds = new Set<string>();
  if (!Array.isArray(pack.topics) || pack.topics.length === 0) {
    issues.push('topics manquant ou vide');
  } else {
    for (const [i, t] of pack.topics.entries()) {
      if (!isNonEmptyString(t?.id)) {
        issues.push(`topics[${i}] : id manquant`);
        continue;
      }
      if (topicIds.has(t.id)) issues.push(`topics[${i}] : id dupliqué (${t.id})`);
      topicIds.add(t.id);
      if (!isNonEmptyString(t.title)) issues.push(`topic ${t.id} : title manquant`);
      if (typeof t.order !== 'number') issues.push(`topic ${t.id} : order manquant`);
      if (!Array.isArray(t.prerequisites)) issues.push(`topic ${t.id} : prerequisites doit être un tableau`);
      if (t.lesson !== undefined) validateLesson(t.lesson, `topic ${t.id}`, issues);
    }
    // Les prérequis inconnus sont une erreur de données, pas un verrou pédagogique.
    for (const t of pack.topics) {
      for (const p of t?.prerequisites ?? []) {
        if (!topicIds.has(p)) issues.push(`topic ${t.id} : prérequis inconnu (${p})`);
      }
    }
  }

  // --- items ---
  const itemIds = new Set<string>();
  if (!Array.isArray(pack.items)) {
    issues.push('items manquant');
  } else {
    for (const [i, it] of pack.items.entries()) {
      if (!isNonEmptyString(it?.id)) {
        issues.push(`items[${i}] : id manquant`);
        continue;
      }
      if (itemIds.has(it.id)) issues.push(`items[${i}] : id dupliqué (${it.id})`);
      itemIds.add(it.id);
      if (!topicIds.has(it.topicId)) {
        issues.push(`item ${it.id} : topicId inconnu (${it.topicId})`);
      }
      if (!Array.isArray(it.tags)) issues.push(`item ${it.id} : tags doit être un tableau`);
      if (typeof it.fields !== 'object' || it.fields === null) {
        issues.push(`item ${it.id} : fields doit être un objet`);
      }
      if (!Array.isArray(it.exercises) || it.exercises.length === 0) {
        issues.push(`item ${it.id} : au moins un exercice est requis`);
        continue;
      }
      it.exercises.forEach((ex, j) => validateExercise(ex, `item ${it.id} / exercice ${j}`, issues));
    }
  }

  if (issues.length > 0) throw new PackValidationError(issues);
  return raw as ContentPack;
}
