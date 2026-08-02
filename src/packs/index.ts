/**
 * Chargement des packs de contenu.
 *
 * Les packs sont servis comme fichiers statiques (`/packs/<id>.json`) plutôt
 * qu'inclus dans le bundle : ils sont volumineux, ils évoluent seuls, et le
 * service worker (étape 2) pourra les mettre en cache en
 * stale-while-revalidate sans invalider l'app shell.
 */

import { validatePack } from './validate';
import type { ContentPack } from './schema';

export const DEFAULT_PACK_ID = 'english-grammar';

export function packUrl(id: string): string {
  return `${import.meta.env.BASE_URL}packs/${id}.json`;
}

export async function loadPack(id: string = DEFAULT_PACK_ID): Promise<ContentPack> {
  const url = packUrl(id);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Pack « ${id} » introuvable (${res.status}).`);
  }
  return validatePack(await res.json());
}

export * from './schema';
export { PackValidationError } from './validate';
