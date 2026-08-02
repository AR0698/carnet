/**
 * Stockage persistant.
 *
 * Sans ce drapeau, le navigateur peut évincer IndexedDB quand la place manque
 * ou après une longue inactivité — et il n'y a aucun serveur pour resynchroniser.
 * La demande est faite après une session complétée, jamais au chargement : les
 * navigateurs l'accordent d'autant plus volontiers que l'usage est réel.
 */

import { localDay } from '../shared/day';
import { kvGet, kvSet } from './db';

const KEY = 'storagePersisted';

interface PersistState {
  granted: boolean;
  lastAttemptDay: string;
}

export async function requestPersistentStorage(now = new Date()): Promise<boolean> {
  if (!navigator.storage?.persist) return false;

  const state = await kvGet<PersistState>(KEY);
  if (state?.granted) return true;

  // Une seule tentative par jour : certains navigateurs affichent une
  // permission, et la redemander à chaque session serait pénible.
  const today = localDay(now);
  if (state?.lastAttemptDay === today) return false;

  const already = await navigator.storage.persisted();
  const granted = already || (await navigator.storage.persist());

  await kvSet(KEY, { granted, lastAttemptDay: today } satisfies PersistState);
  console.info(`[carnet] stockage persistant : ${granted ? 'accordé' : 'refusé pour l’instant'}`);
  return granted;
}

/** Place occupée / disponible, pour l'écran de réglages (étape 4). */
export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (!navigator.storage?.estimate) return null;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { usage, quota };
}
