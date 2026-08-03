/**
 * `odd_one_out` — trois mots d'une même famille, un quatrième qui n'y est pas.
 *
 * L'exercice qui manquait pour « savoir de quel mot on parle ». Traduire un mot
 * dit ce qu'il veut dire ; il ne dit pas où il s'arrête. `a stew`, `a casserole`
 * et `a roast` sont des façons de cuire — `a kettle` ne l'est pas, et c'est en
 * l'écartant qu'on découvre la frontière du groupe.
 *
 * Contrairement au `mcq`, celui-ci porte sa carte : les formes sont sous les
 * yeux, mais rien ne dit laquelle est visée. Il y a bien quelque chose à
 * retrouver.
 *
 * Les données sont celles du `mcq`, aux rôles inversés : `answerSpec` porte
 * l'intrus, `distractors` les mots qui, eux, appartiennent à la famille.
 */

import { choiceRenderer } from './choice';

export const oddOneOut = choiceRenderer({
  right: 'C’est bien lui l’intrus.',
  wrong: (expected) => `Non — celui qui n’a rien à faire là, c’est « ${expected} ».`,
});
