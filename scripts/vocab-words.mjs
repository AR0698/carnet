/**
 * Le compilateur du vocabulaire — d'un mot par ligne à ses trois exercices.
 *
 * Pourquoi un compilateur ici et pas pour la grammaire. Un exercice de
 * grammaire est un cas d'espèce : la phrase à transformer, la faute à repérer
 * et l'explication qui va avec ne se déduisent de rien, elles s'écrivent. Un
 * mot de vocabulaire, lui, est régulier — le mot, son sens, une phrase où il
 * vit — et les trois exercices qu'on en tire sont toujours les mêmes trois
 * exercices. Les écrire à la main huit cents fois produirait exactement le même
 * pack, en quarante fois plus de lignes, avec quarante fois plus d'endroits où
 * se tromper.
 *
 * Le format source tient donc en une ligne par mot :
 *
 *   { "en": "a kettle", "fr": "une bouilloire",
 *     "eg": "Stick the {kettle} on, I'm parched.", "art": "kettle" }
 *
 * Les accolades marquent le trou : c'est la forme fléchie du mot dans *cette*
 * phrase-là, qui n'est presque jamais la forme de dictionnaire (`to commute`
 * devient `commute`, `a shower` devient `shower`). La marquer à la source évite
 * de la deviner à la compilation, et de se tromper une fois sur dix.
 *
 * Trois choses sont fabriquées plutôt qu'écrites, parce que les écrire
 * n'apporterait rien :
 *
 * - **les distracteurs du filet de secours**, pris parmi les mots voisins de la
 *   même unité — c'est déjà ce que fait le carnet Discovery, et ce sont les
 *   meilleurs distracteurs qui soient : proches, plausibles, et déjà connus ;
 * - **l'appariement de découverte**, formé des premiers mots de l'unité ;
 * - **l'indice du dessin** : la première lettre et le nombre de lettres. Donner
 *   le sens français reviendrait à transformer le seul exercice qui court-
 *   circuite le français en un exercice qui repasse par lui.
 *
 * L'ordre des exercices d'un mot est un contrat, comme pour Discovery : une
 * carte est identifiée par `pack:item:index`, et insérer un exercice au milieu
 * déplacerait les cartes suivantes sur d'autres questions. D'où l'ordre fixe
 * `produce, fill_blank, picture?, mcq?` — le dessin s'ajoute après coup sans
 * rien déranger, et le `mcq` ne porte aucune carte.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** Combien de mots au maximum dans un appariement de découverte. */
const MATCH_SIZE = 5;
/** Combien de propositions dans le filet de secours, la bonne comprise. */
const MCQ_SIZE = 4;

const slug = (s) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Les articles ne distinguent rien et allongent tout : `a kettle` et
    // `the kettle` donneraient deux identifiants pour un seul mot.
    .replace(/^(a|an|the|to)\s+/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/**
 * Les identifiants d'une unité, rangés en trois étages.
 *
 * `newCards()` ouvre le neuf par ordre d'identifiant d'item : le chiffre en
 * deuxième position fait donc arriver l'appariement avant les mots et l'intrus
 * après eux, sans que le moteur ait à connaître l'existence de ces types. La
 * découverte d'abord, la production ensuite, la frontière du groupe à la fin.
 */
const matchId = (unit) => `${unit}-0-match`;
const wordId = (unit, en) => `${unit}-1-${slug(en)}`;
const oddId = (unit) => `${unit}-2-odd`;

/** Le trou d'une phrase d'exemple : `{...}`, et ce qui reste autour. */
function splitExample(eg) {
  const m = /\{([^{}]+)\}/.exec(eg);
  if (!m) return null;
  return {
    answer: m[1],
    prompt: eg.slice(0, m.index) + '___' + eg.slice(m.index + m[0].length),
    plain: eg.replace(/[{}]/g, ''),
  };
}

/**
 * L'indice d'un dessin : la première lettre et la longueur.
 *
 * Ni le sens français — ce serait rendre au mot le détour que le dessin sert à
 * lui éviter — ni une définition anglaise, qui demanderait de comprendre une
 * phrase pour retrouver un mot. La forme, et rien qu'elle : c'est ce qui manque
 * quand on a la chose en tête et pas le mot.
 */
function shapeHint(en) {
  const core = en.replace(/^(a|an|the|to)\s+/i, '');
  const letters = core.replace(/[^a-zA-Z]/g, '').length;
  return `Ça commence par « ${core[0].toLowerCase()} » et ça fait ${letters} lettres.`;
}

function pitfallsOf(word) {
  const entries = Object.entries(word.no ?? {});
  return entries.length > 0
    ? entries.map(([answers, explain]) => ({ answers: answers.split('|'), explain }))
    : undefined;
}

/** Trois voisins de la même unité, à défaut de distracteurs écrits à la main. */
function neighbours(word, unit) {
  if (word.near) return word.near;
  const others = unit.words.filter((w) => w.en !== word.en).map((w) => w.en);
  return others.slice(0, MCQ_SIZE - 1);
}

function exercisesFor(word, unit, problems, where) {
  const gap = splitExample(word.eg ?? '');
  if (!gap) {
    problems.push(`${where} : la phrase d'exemple doit marquer son trou par des accolades`);
    return [];
  }
  if (/\{[^{}]*\}/.test(gap.plain)) {
    problems.push(`${where} : une seule paire d'accolades par phrase d'exemple`);
    return [];
  }

  const accepted = [word.en, ...(word.also ?? [])];
  const pitfalls = pitfallsOf(word);

  const exercises = [
    {
      type: 'produce',
      prompt: `Comment dit-on « ${word.fr} » ?`,
      answerSpec: { accepted },
      ...(word.clue ? { hints: [word.clue] } : {}),
      ...(pitfalls ? { pitfalls } : {}),
    },
    {
      type: 'fill_blank',
      prompt: gap.prompt,
      answerSpec: { accepted: [gap.answer] },
      hints: [word.fr],
    },
  ];

  if (word.art) {
    exercises.push({
      type: 'picture',
      prompt: 'Qu’est-ce que c’est ?',
      art: word.art,
      answerSpec: { accepted },
      hints: [shapeHint(word.en)],
    });
  }

  const distractors = neighbours(word, unit);
  if (distractors.length >= 2) {
    exercises.push({
      type: 'mcq',
      prompt: `Lequel veut dire « ${word.fr} » ?`,
      answerSpec: { accepted: [word.en] },
      distractors,
      ...(pitfalls ? { pitfalls } : {}),
    });
  }

  return exercises;
}

/**
 * Compile `content/<pack>/words/*.json`.
 *
 * Rend les notions et les items à ajouter au pack, plus la liste des problèmes
 * rencontrés — jamais une exception : l'appelant les affiche avec les siens,
 * en une seule fois, ce qui évite de corriger cent fautes une par une.
 */
export function compileWords(dir, { artKeys = new Set(), firstOrder = 1 } = {}) {
  const topics = [];
  const items = [];
  const problems = [];
  const groups = [];
  const seenExamples = new Map();
  const seenArt = new Map();

  if (!existsSync(dir)) return { topics, items, problems, groups };

  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort(); // les fichiers sont numérotés : l'ordre alphabétique est celui du parcours

  let order = firstOrder;

  for (const file of files) {
    const { section, units = [] } = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    const groupItems = [];

    for (const unit of units) {
      const where = `${file} / ${unit.id}`;
      topics.push({
        id: unit.id,
        title: unit.title,
        group: section,
        order: order++,
        prerequisites: [],
      });

      const unitItems = [];

      for (const word of unit.words ?? []) {
        const id = wordId(unit.id, word.en);

        if (word.art && !artKeys.has(word.art)) {
          problems.push(`${where} : le dessin « ${word.art} » n'existe pas dans ui/vocabArt.ts`);
        }

        // Un dessin partagé par deux mots, c'est le même écran avec deux
        // réponses justes différentes : la seconde ne peut alors être trouvée
        // que par élimination, et la première finit par être comptée fausse
        // sans qu'on comprenne pourquoi.
        const owner = seenArt.get(word.art);
        if (word.art && owner) {
          problems.push(`${where} : le dessin « ${word.art} » sert déjà à « ${owner} »`);
        } else if (word.art) {
          seenArt.set(word.art, word.en);
        }

        const exercises = exercisesFor(word, unit, problems, `${where} / ${word.en}`);
        if (exercises.length === 0) continue;

        const plain = splitExample(word.eg).plain;
        const key = plain.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
        const echo = seenExamples.get(key);
        if (echo && echo !== unit.id) {
          problems.push(`${where} : phrase d'exemple déjà utilisée par ${echo} — « ${plain} »`);
        }
        seenExamples.set(key, unit.id);

        unitItems.push({
          id,
          topicId: unit.id,
          tags: [section],
          fields: {
            term: word.en,
            meaning: word.fr,
            example: plain,
            ...(word.note ? { note: word.note } : {}),
          },
          exercises,
        });
      }

      // L'appariement de découverte, en tête de l'unité. Il lui faut au moins
      // trois couples : à deux, il ne reste rien à décider.
      const pairs = (unit.words ?? []).slice(0, MATCH_SIZE).map((w) => ({ en: w.en, fr: w.fr }));
      if (pairs.length >= 3) {
        unitItems.unshift({
          id: matchId(unit.id),
          topicId: unit.id,
          tags: [section],
          fields: { kind: 'découverte' },
          exercises: [
            {
              type: 'match',
              prompt: `${unit.title} — relie chaque mot à son sens.`,
              pairs,
              answerSpec: { accepted: [pairs.map((p) => `${p.en} → ${p.fr}`).join(' · ')] },
            },
          ],
        });
      } else if ((unit.words ?? []).length > 0) {
        problems.push(`${where} : trois mots au minimum pour former un appariement`);
      }

      // L'intrus, en queue. Écrit à la main : il demande de savoir ce qui fait
      // famille, et rien dans les données ne le dit.
      if (unit.odd) {
        const { out, in: inside, why } = unit.odd;
        if (inside.includes(out)) {
          problems.push(`${where} : l'intrus « ${out} » figure aussi parmi les mots de la famille`);
        }
        unitItems.push({
          id: oddId(unit.id),
          topicId: unit.id,
          tags: [section],
          fields: { kind: 'intrus' },
          exercises: [
            {
              type: 'odd_one_out',
              prompt: unit.odd.prompt ?? 'Lequel n’appartient pas à la famille ?',
              answerSpec: { accepted: [out] },
              distractors: inside,
              hints: [why],
            },
          ],
        });
      }

      items.push(...unitItems);
      groupItems.push(...unitItems);
    }

    groups.push({ file, group: section, items: groupItems });
  }

  return { topics, items, problems, groups };
}

/**
 * Les clés de dessin disponibles, relevées dans `src/ui/vocabArt.ts`.
 *
 * Lire le TypeScript à l'expression régulière est laid, et c'est pourtant le
 * moins mauvais des trois choix : compiler le module depuis un script Node
 * demanderait une passe de build rien que pour valider, et recopier la liste
 * ici garantirait qu'elle se désynchronise. Les clés du registre sont donc
 * toutes écrites entre guillemets simples, ce qui rend le relevé sûr — et le
 * seul risque restant est d'en oublier, ce qui échoue bruyamment plutôt que de
 * laisser passer un dessin manquant.
 */
export function readArtKeys(path) {
  if (!existsSync(path)) return new Set();
  const source = readFileSync(path, 'utf8');
  const body = source.slice(source.indexOf('const DRAW'));
  return new Set([...body.matchAll(/^ {2}'([a-z0-9-]+)':/gm)].map((m) => m[1]));
}
