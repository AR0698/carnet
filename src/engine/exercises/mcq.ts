/**
 * `mcq` — choisir parmi plusieurs propositions.
 *
 * Jamais planifié pour lui-même : c'est le filet de secours servi à la place
 * d'un exercice de production raté deux fois de suite (§4). Reconnaître n'est
 * pas produire — une réussite ici débloque l'apprenante, mais ne compte pas
 * comme une vraie récupération en mémoire (voir `scheduler.ts`).
 */

import { choiceRenderer } from './choice';

export const mcq = choiceRenderer({
  right: 'C’est bien celle-là.',
  wrong: (expected) => `Pas tout à fait — c’était « ${expected} ».`,
});
