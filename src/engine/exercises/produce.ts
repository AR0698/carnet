/** `produce` — produire une phrase entière à partir d'une consigne. */

import { freeTextRenderer, renderTextarea } from './textAnswer';

export const produce = freeTextRenderer(renderTextarea);
