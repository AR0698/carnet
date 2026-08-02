/**
 * `spot_error` — repérer la faute dans une phrase et la réécrire correctement.
 *
 * On demande la phrase corrigée en entier plutôt que de faire cliquer sur le
 * mot fautif : repérer une erreur et savoir la réparer sont deux choses
 * différentes, et c'est la seconde qui compte.
 */

import { freeTextRenderer, renderSourced } from './textAnswer';

export const spotError = freeTextRenderer(renderSourced('Cette phrase contient une faute', 'flag'));
