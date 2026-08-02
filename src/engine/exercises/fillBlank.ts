/** `fill_blank` — compléter le `___` d'une phrase. */

import { freeTextRenderer, renderInline } from './textAnswer';

export const fillBlank = freeTextRenderer(renderInline);
