/** `produce` — produire une phrase entière à partir d'une consigne. */

import { freeTextRenderer, textareaView } from './textAnswer';

export const produce = freeTextRenderer(textareaView);
