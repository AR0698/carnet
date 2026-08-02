/** `transform` — réécrire une phrase donnée selon une consigne. */

import { freeTextRenderer, sourcedView } from './textAnswer';

export const transform = freeTextRenderer(sourcedView('Phrase de départ', 'plain'));
