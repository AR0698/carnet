/**
 * Réglages de session.
 *
 * Ils ne changent jamais *ce* qui est révisé — la planification appartient au
 * moteur — seulement la façon dont la question est posée. Persistés comme le
 * reste : sur l'appareil, sans compte.
 */

import { kvGet, kvSet } from './db';

export interface Prefs {
  /**
   * Session menée avec un cahier à côté : on écrit à la main, l'application
   * montre la réponse, et c'est l'apprenante qui juge.
   */
  paper: boolean;
}

const KEY = 'prefs';
const DEFAULTS: Prefs = { paper: false };

export async function loadPrefs(): Promise<Prefs> {
  return { ...DEFAULTS, ...(await kvGet<Partial<Prefs>>(KEY)) };
}

export async function savePrefs(patch: Partial<Prefs>): Promise<void> {
  await kvSet(KEY, { ...(await loadPrefs()), ...patch });
}
