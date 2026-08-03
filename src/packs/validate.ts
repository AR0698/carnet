/**
 * Validation d'un pack au chargement.
 *
 * Étape 1 : validation structurelle manuelle, sans dépendance.
 * Étape 3 : sera remplacée / doublée par un JSON Schema dérivé de `schema.ts`.
 * Dans les deux cas, l'appelant ne voit que `validatePack()` — le reste du
 * moteur n'a pas à changer.
 */

import {
  isKnownType,
  SUPPORTED_SCHEMA_VERSION,
  type ContentPack,
  type Exercise,
  type Lesson,
} from './schema';

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

/**
 * Valide un exercice, et rend `true` si son type est de ceux que cette version
 * sait rendre.
 *
 * Un type inconnu n'est **pas** une erreur de pack. C'est la trace d'un contenu
 * plus récent que le code installé, situation normale et fréquente : les packs
 * sont relus à chaque lancement, alors qu'une nouvelle version de l'application
 * attend qu'on appuie sur « Redémarrer ». Refuser le carnet entier pour cette
 * raison — ce que faisait cette fonction — privait l'apprenante de cent huit
 * unités lisibles à cause de trois qui ne l'étaient pas encore.
 *
 * On ne vérifie donc que ce que l'on comprend, et `isScheduled` se charge de ne
 * jamais servir le reste. La vraie barrière d'incompatibilité reste
 * `meta.schemaVersion`, qui dit que la *structure* a changé — pas le catalogue.
 */
function validateExercise(ex: unknown, where: string, issues: string[]): boolean {
  if (typeof ex !== 'object' || ex === null) {
    issues.push(`${where} : l'exercice n'est pas un objet`);
    return false;
  }
  const e = ex as Partial<Exercise>;

  if (typeof e.type !== 'string' || !isKnownType(e.type)) return false;

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
  if (e.type === 'picture' && !isNonEmptyString(e.art)) {
    issues.push(`${where} : un picture a besoin d'une clé de dessin (art)`);
  }
  if (e.type === 'match' && (!Array.isArray(e.pairs) || e.pairs.length < 3)) {
    issues.push(`${where} : un match a besoin d'au moins trois couples`);
  }
  if (e.type === 'odd_one_out' && (!Array.isArray(e.distractors) || e.distractors.length < 2)) {
    issues.push(`${where} : un intrus a besoin d'au moins deux mots de la famille`);
  }
  return true;
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
  /** Exercices d'un type plus récent que cette version : comptés, pas refusés. */
  let unknown = 0;

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
      for (const [j, ex] of it.exercises.entries()) {
        if (!validateExercise(ex, `item ${it.id} / exercice ${j}`, issues)) unknown += 1;
      }
    }
  }

  if (issues.length > 0) throw new PackValidationError(issues);

  // Rien à signaler à l'apprenante — l'application marche, simplement avec un
  // exercice de moins par-ci par-là, et l'encart « Redémarrer » propose déjà la
  // version qui les comprendra. Mais si l'on ouvre la console en se demandant
  // pourquoi le compte de cartes ne colle pas, la réponse doit être là.
  if (unknown > 0) {
    console.info(
      `[carnet] ${pack.meta?.id ?? '?'} : ${unknown} exercice(s) d'un type que cette version ne connaît pas encore — ignorés jusqu'au redémarrage.`,
    );
  }

  return raw as ContentPack;
}
