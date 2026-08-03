/**
 * Assemble un pack de contenu à partir des sources de `content/`.
 *
 *   node scripts/build-pack.mjs [id-du-pack]
 *
 * Le contenu est écrit un groupe thématique par fichier — 145 unités dans un
 * seul JSON serait impossible à relire. Ce script les recolle, valide le
 * résultat contre `schemas/content-pack.schema.json`, vérifie ce qu'un schéma
 * ne peut pas voir (références croisées, doublons, phrases recyclées d'une
 * unité à l'autre), puis écrit le pack servi à l'application.
 *
 * Il échoue bruyamment : un pack invalide ne doit jamais atteindre `public/`.
 */

import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
// Le schéma est en draft 2020-12 : c'est ce point d'entrée-là qu'il faut,
// l'export par défaut d'ajv ne connaît que draft-07.
import Ajv from 'ajv/dist/2020.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PACK_ID = process.argv[2] ?? 'english-grammar';
const SRC = join(ROOT, 'content', PACK_ID);
const OUT = join(ROOT, 'public', 'packs', `${PACK_ID}.json`);

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

// --- assemblage ---

const base = readJson(join(SRC, 'pack.json'));
const unitDir = join(SRC, 'units');
const unitFiles = readdirSync(unitDir)
  .filter((f) => f.endsWith('.json'))
  .sort(); // les fichiers sont numérotés : l'ordre alphabétique est l'ordre du parcours

const items = [];
const perGroup = [];
for (const file of unitFiles) {
  const { group, items: groupItems = [] } = readJson(join(unitDir, file));
  items.push(...groupItems);
  perGroup.push({ file, group, items: groupItems });
}

// Les fiches de cours vivent à part des exercices : ce ne sont ni le même
// travail de rédaction, ni le même rythme d'avancement, et une unité peut très
// bien avoir ses exercices sans avoir encore sa fiche. Elles sont raccrochées
// ici à leur notion, une fois pour toutes, pour que l'application n'ait jamais
// deux fichiers à recoller à l'exécution.
const lessonDir = join(SRC, 'lessons');
const lessons = new Map();
const lessonSources = new Map();
const duplicateLessons = [];

if (existsSync(lessonDir)) {
  const lessonFiles = readdirSync(lessonDir)
    .filter((f) => f.endsWith('.json'))
    .sort();

  for (const file of lessonFiles) {
    const { lessons: fileLessons = {} } = readJson(join(lessonDir, file));
    for (const [topicId, lesson] of Object.entries(fileLessons)) {
      if (lessons.has(topicId)) {
        duplicateLessons.push(`fiche en double pour ${topicId} (${lessonSources.get(topicId)} et ${file})`);
      }
      lessons.set(topicId, lesson);
      lessonSources.set(topicId, file);
    }
  }
}

const topics = base.topics.map((t) =>
  lessons.has(t.id) ? { ...t, lesson: lessons.get(t.id) } : t,
);

const pack = { meta: base.meta, topics, items };

// --- validation structurelle (JSON Schema) ---

const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(readJson(join(ROOT, 'schemas', 'content-pack.schema.json')));

if (!validate(pack)) {
  console.error(`\n✗ ${validate.errors.length} erreur(s) de structure :\n`);
  for (const e of validate.errors.slice(0, 40)) {
    console.error(`  ${e.instancePath || '(racine)'} ${e.message}`);
  }
  process.exit(1);
}

// --- validations sémantiques (hors de portée d'un JSON Schema) ---

const problems = [];
const topicIds = new Set(pack.topics.map((t) => t.id));

const seenTopicIds = new Set();
for (const t of pack.topics) {
  if (seenTopicIds.has(t.id)) problems.push(`notion en double : ${t.id}`);
  seenTopicIds.add(t.id);
  for (const p of t.prerequisites) {
    if (!topicIds.has(p)) problems.push(`notion ${t.id} : prérequis inconnu (${p})`);
  }
}

problems.push(...duplicateLessons);

// Une fiche écrite pour une notion qui n'existe pas ne s'affichera jamais, et
// rien ne le signalerait : elle disparaîtrait sans bruit à la fusion.
for (const topicId of lessons.keys()) {
  if (!topicIds.has(topicId)) {
    problems.push(`fiche ${topicId} (${lessonSources.get(topicId)}) : notion inconnue`);
  }
}

for (const t of pack.topics) {
  if (!t.lesson) continue;
  const where = `fiche ${t.id}`;

  for (const ref of t.lesson.seeAlso ?? []) {
    if (ref === t.id) problems.push(`${where} : se renvoie à elle-même`);
    else if (!topicIds.has(ref)) problems.push(`${where} : renvoi vers une notion inconnue (${ref})`);
  }

  // Les deux registres sont la raison d'être de ces fiches : une règle vue
  // seulement au bureau ne se reconnaît pas au pub, et réciproquement.
  const registers = new Set(t.lesson.examples.map((e) => e.register));
  for (const wanted of ['bristol', 'work']) {
    if (!registers.has(wanted)) problems.push(`${where} : aucun exemple du registre « ${wanted} »`);
  }
}

const seenItemIds = new Set();
for (const it of pack.items) {
  if (seenItemIds.has(it.id)) problems.push(`item en double : ${it.id}`);
  seenItemIds.add(it.id);
  if (!topicIds.has(it.topicId)) problems.push(`item ${it.id} : notion inconnue (${it.topicId})`);
}

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

// Le champ de saisie ne remplace que le premier `___` d'un énoncé, tandis que
// `spokenSentence()` recolle la réponse à *chaque* marqueur : deux trous dans la
// même phrase donnent un exercice incomplet et une lecture à voix haute qui
// répète la réponse. Un trou par énoncé, pas deux.
for (const it of pack.items) {
  for (const [k, ex] of it.exercises.entries()) {
    if (ex.type !== 'fill_blank') continue;
    const holes = ex.prompt.split('___').length - 1;
    if (holes !== 1) {
      problems.push(`item ${it.id} / exercice ${k} : un fill_blank veut exactement un ___ (il en a ${holes})`);
    }
  }
}

// Une erreur anticipée qui figure aussi parmi les bonnes réponses ferait
// passer une réponse juste pour une faute expliquée. Erreur silencieuse et
// difficile à repérer à la lecture.
for (const it of pack.items) {
  for (const [k, ex] of it.exercises.entries()) {
    const accepted = new Set(ex.answerSpec.accepted.map(norm));
    for (const pitfall of ex.pitfalls ?? []) {
      for (const wrong of pitfall.answers) {
        if (accepted.has(norm(wrong))) {
          problems.push(`item ${it.id} / exercice ${k} : « ${wrong} » est à la fois accepté et signalé comme faute`);
        }
      }
    }
  }
}

// Une phrase d'exemple réutilisée d'une unité à l'autre trahit un contenu qui
// tourne en rond : on la signale, elle est facile à laisser passer à la main.
const sentences = new Map();
for (const it of pack.items) {
  for (const ex of it.exercises) {
    for (const phrase of [ex.source, ...ex.answerSpec.accepted.slice(0, 1)]) {
      if (!phrase) continue;
      const key = norm(phrase);
      if (key.length < 18) continue; // trop court pour être un doublon significatif
      const seen = sentences.get(key);
      if (seen && seen !== it.topicId) {
        problems.push(`phrase recyclée entre ${seen} et ${it.topicId} : « ${phrase} »`);
      }
      sentences.set(key, it.topicId);
    }
  }
}

// Une fiche qui contient mot pour mot la réponse attendue par un exercice de sa
// propre unité transforme le rappel en recopie : il suffit d'ouvrir la fiche
// pour avoir la phrase sous les yeux. Ailleurs dans le pack, c'est le même
// recyclage que pour les exercices, et on le signale pareil.
const answersByTopic = new Map();
for (const it of pack.items) {
  const set = answersByTopic.get(it.topicId) ?? new Set();
  for (const ex of it.exercises) for (const a of ex.answerSpec.accepted) set.add(norm(a));
  answersByTopic.set(it.topicId, set);
}

for (const t of pack.topics) {
  if (!t.lesson) continue;
  for (const example of t.lesson.examples) {
    const key = norm(example.en);
    if (key.length < 18) continue;
    if (answersByTopic.get(t.id)?.has(key)) {
      problems.push(`fiche ${t.id} : l'exemple « ${example.en} » est la réponse d'un exercice de la même unité`);
    }
    const seen = sentences.get(key);
    if (seen && seen !== t.id) {
      problems.push(`phrase recyclée entre ${seen} et la fiche ${t.id} : « ${example.en} »`);
    }
    sentences.set(key, t.id);
  }
}

if (problems.length > 0) {
  console.error(`\n✗ ${problems.length} problème(s) de contenu :\n`);
  for (const p of problems.slice(0, 40)) console.error(`  ${p}`);
  if (problems.length > 40) console.error(`  … et ${problems.length - 40} autre(s)`);
  process.exit(1);
}

// --- écriture ---

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(pack) + '\n');

// --- rapport d'avancement ---

const withItems = new Set(pack.items.map((i) => i.topicId));
const exercises = pack.items.flatMap((i) => i.exercises);
const byType = {};
for (const ex of exercises) byType[ex.type] = (byType[ex.type] ?? 0) + 1;

console.log(`\npack ${pack.meta.id}@${pack.meta.version}`);
for (const g of perGroup) {
  const topicsOfGroup = pack.topics.filter((t) => t.group === g.group);
  const done = topicsOfGroup.filter((t) => withItems.has(t.id)).length;
  const taught = topicsOfGroup.filter((t) => t.lesson).length;
  const flag = done === topicsOfGroup.length ? '✓' : done === 0 ? ' ' : '~';
  console.log(
    `  ${flag} ${g.group.padEnd(34)} ${String(done).padStart(3)}/${String(topicsOfGroup.length).padEnd(3)} unités` +
      `  ${String(g.items.flatMap((i) => i.exercises).length).padStart(4)} exercices` +
      `  ${String(taught).padStart(3)} fiche${taught > 1 ? 's' : ' '}`,
  );
}
const taughtTotal = pack.topics.filter((t) => t.lesson).length;
console.log(
  `\n  ${withItems.size}/${pack.topics.length} unités couvertes · ` +
    `${taughtTotal}/${pack.topics.length} fiches de cours · ` +
    `${exercises.length} exercices · ` +
    Object.entries(byType)
      .sort((a, b) => b[1] - a[1])
      .map(([t, n]) => `${t} ${n}`)
      .join(' · '),
);
console.log(`  → ${OUT.replace(ROOT + '/', '')} (${(JSON.stringify(pack).length / 1024).toFixed(0)} ko)\n`);
