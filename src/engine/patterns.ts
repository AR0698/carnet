/**
 * Explications génériques, déduites de la comparaison mot à mot.
 *
 * Elles n'ont pas vocation à tout couvrir : les explications précises sont
 * écrites dans le contenu, exercice par exercice (`pitfalls`). Ce fichier ne
 * traite que des fautes si fréquentes chez un francophone qu'elles méritent
 * une réponse quel que soit l'exercice.
 *
 * Règle de conduite : dans le doute, ne rien dire. Une explication à côté de
 * la plaque coûte plus cher que pas d'explication du tout.
 */

import type { AnswerDiff, Replacement } from './diff';
import { MODALS } from './variants';

interface Rule {
  id: string;
  test(diff: AnswerDiff): boolean;
  explain: string;
}

const written = (r: Replacement) => r.written.join(' ');
const expected = (r: Replacement) => r.expected.join(' ');

/** Le mot a-t-il été écrit quelque part dans la réponse donnée ? */
function givenHas(diff: AnswerDiff, word: string): boolean {
  return diff.given.some((t) => t.text.toLowerCase().replace(/[^a-z']/g, '') === word);
}

function anyReplacement(diff: AnswerDiff, match: (r: Replacement) => boolean): boolean {
  return diff.replacements.some(match);
}

/**
 * Prétérits irréguliers dont la forme diffère de la base.
 * Volontairement privés de put, read, let, cut, hit, cost, lay… : leur
 * prétérit se confond avec la base, et « didn't put » est parfaitement juste.
 */
const IRREGULAR_PAST = new Set([
  'went', 'saw', 'took', 'came', 'got', 'made', 'said', 'told', 'gave', 'found',
  'thought', 'knew', 'felt', 'left', 'brought', 'bought', 'caught', 'taught',
  'wrote', 'drove', 'ate', 'drank', 'ran', 'sat', 'spoke', 'stood', 'understood',
  'won', 'lost', 'met', 'paid', 'sent', 'slept', 'spent', 'swam', 'broke',
  'chose', 'fell', 'forgot', 'heard', 'held', 'kept', 'meant', 'sold', 'sang',
  'began', 'became', 'built', 'did', 'had', 'was', 'were',
]);

/** Sujets qui imposent le -s au présent simple, sans ambiguïté possible. */
const THIRD_PERSON_SUBJECTS = new Set(['he', 'she', 'it', 'this', 'that', 'everyone', 'nobody', 'somebody', 'everybody']);

/** Mots après lesquels le verbe reste nu. */
const BARE_AFTER = new Set(['do', 'does', 'did', "don't", "doesn't", "didn't", 'to', ...MODALS]);

const BE_FORMS = new Set(['am', 'is', 'are', 'was', 'were', 'be', 'been', 'being']);

const RULES: Rule[] = [
  {
    id: 'do-vs-does',
    test: (d) =>
      anyReplacement(d, (r) => {
        const w = written(r);
        const e = expected(r);
        return (
          (['do', "don't", 'do not'].includes(w) && ['does', "doesn't", 'does not'].includes(e)) ||
          (['does', "doesn't", 'does not'].includes(w) && ['do', "don't", 'do not'].includes(e))
        );
      }),
    explain:
      'À la troisième personne du singulier, l’auxiliaire devient does : c’est lui qui porte le -s, jamais le verbe.',
  },
  {
    id: 'missing-third-person-s',
    // Sans le mot qui précède, « glass → glasses » passerait pour un -s de
    // troisième personne alors que c'est un pluriel de nom. On n'accepte donc
    // la règle que derrière un sujet non ambigu.
    test: (d) =>
      anyReplacement(d, (r) => {
        if (r.written.length !== 1 || r.expected.length !== 1) return false;
        if (!r.before || !THIRD_PERSON_SUBJECTS.has(r.before)) return false;
        const w = r.written[0]!;
        const e = r.expected[0]!;
        return e === `${w}s` || e === `${w}es`;
      }),
    explain: 'Il manque le -s de la troisième personne du singulier au présent simple.',
  },
  {
    id: 'extra-third-person-s',
    // Même prudence en sens inverse : le -s n'est fautif que juste après un
    // auxiliaire, là où le verbe doit rester nu.
    test: (d) =>
      anyReplacement(d, (r) => {
        if (r.written.length !== 1 || r.expected.length !== 1) return false;
        if (!r.before || !BARE_AFTER.has(r.before)) return false;
        const w = r.written[0]!;
        const e = r.expected[0]!;
        return w === `${e}s` || w === `${e}es`;
      }),
    explain:
      'Après un auxiliaire (do, does, did, will, can…), le verbe reste à la base : pas de -s.',
  },
  {
    id: 'missing-ing-after-be',
    test: (d) =>
      anyReplacement(d, (r) => {
        if (r.written.length !== 1 || r.expected.length !== 1) return false;
        if (!r.before || !BE_FORMS.has(r.before)) return false;
        const w = r.written[0]!;
        const e = r.expected[0]!;
        return e === `${w}ing` || e === `${w}ing`.replace(/eing$/, 'ing');
      }),
    explain:
      'Après am, is, are, was ou were, le verbe prend -ing : c’est ce qui marque l’action en cours.',
  },
  {
    id: 'for-vs-since',
    test: (d) =>
      anyReplacement(d, (r) => {
        const pair = [written(r), expected(r)].sort().join('|');
        return pair === 'for|since';
      }),
    explain:
      'for introduit une durée (for three weeks), since un point de départ (since Monday).',
  },
  {
    id: 'to-after-modal',
    test: (d) => {
      const tokens = d.given.map((t) => t.text.toLowerCase().replace(/[^a-z']/g, ''));
      const hasModalTo = tokens.some((t, i) => MODALS.has(t) && tokens[i + 1] === 'to');
      return hasModalTo && anyReplacement(d, (r) => written(r) === 'to' && r.expected.length === 0);
    },
    explain: 'Un modal (can, must, should, will…) est suivi du verbe nu : jamais de to.',
  },
  {
    id: 'past-after-did',
    // On inspecte la phrase écrite elle-même, sans passer par le diff : le
    // double marquage du passé (didn't went) est l'erreur la plus courante
    // chez un francophone, et elle se voit sans comparaison.
    test: (d) => {
      const tokens = d.given.map((t) => t.text.toLowerCase().replace(/[^a-z']/g, ''));
      return tokens.some((t, i) => {
        if (t !== 'did' && t !== "didn't") return false;
        const next = tokens[i + 1];
        if (!next) return false;
        if (IRREGULAR_PAST.has(next)) return true;
        // Les verbes dont la base finit déjà en -eed (need, feed, succeed…)
        // ne sont pas des prétérits : on les écarte.
        return next.length > 3 && next.endsWith('ed') && !next.endsWith('eed');
      });
    },
    explain: 'Après did ou didn’t, le passé est déjà marqué : le verbe qui suit reste à la base.',
  },
  {
    id: 'missing-been',
    test: (d) =>
      (givenHas(d, 'have') || givenHas(d, 'has') || givenHas(d, 'had')) &&
      anyReplacement(d, (r) => r.expected.includes('been') && r.written.length === 0),
    explain: 'Il manque been : have / has / had been + participe passé, ou + verbe en -ing.',
  },
];

/** Première explication générique qui s'applique, ou rien. */
export function explainFromDiff(diff: AnswerDiff): string | undefined {
  return RULES.find((rule) => rule.test(diff))?.explain;
}
