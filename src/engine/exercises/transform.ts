/** `transform` — réécrire une phrase donnée selon une consigne. */

import { freeTextRenderer, renderSourced } from './textAnswer';

export const transform = freeTextRenderer(renderSourced('Phrase de départ', 'plain'));
