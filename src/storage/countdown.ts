/**
 * Le compte à rebours — combien de jours avant Bristol.
 *
 * Une application de répétition espacée n'a pas de fin : elle propose ce qui est
 * dû, chaque jour, indéfiniment. C'est honnête, et c'est démoralisant. Le départ,
 * lui, a une date. La donner rend visible ce que l'espacement rend invisible :
 * il reste tant de jours, et tant de notions à ouvrir dedans.
 *
 * La date de départ est **modifiable** : personne ne part exactement un an après
 * avoir installé une application. À défaut, on prend un an — c'est la durée que
 * l'apprenante avait en tête.
 */

import { kvGet, kvSet } from './db';

const KEY = 'countdown';

/** Un an, en jours. Ni 12 mois ni 52 semaines : des jours, comme le compteur. */
export const DEFAULT_SPAN_DAYS = 365;

/** Ce qui traverse la sauvegarde : deux chaînes ISO, jamais des `Date`.
 *  Le `kv` est exporté et réimporté tel quel, sans réveil des dates — une
 *  `Date` y partirait en texte et reviendrait en texte, sans que rien ne le
 *  signale. */
interface Stored {
  startISO: string;
  targetISO: string;
}

export interface Countdown {
  /** Le jour où le compteur a été armé. */
  start: Date;
  /** Le jour du départ. */
  target: Date;
  /** Jours entiers restants, jamais négatif. */
  daysLeft: number;
  /** Jours écoulés depuis l'armement, jamais négatif. */
  daysDone: number;
  /** Part du parcours derrière soi, de 0 à 1. */
  progress: number;
  /** Le jour est arrivé, ou passé. */
  arrived: boolean;
}

/** Minuit local du jour donné — le compteur compte des jours, pas des heures. */
function midnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Nombre de jours calendaires entre deux dates.
 *
 * L'arrondi n'est pas une coquetterie : deux fois par an, le passage à l'heure
 * d'été fait qu'un « jour » dure 23 ou 25 heures. Une division sèche rendrait
 * 364,96 et le compteur afficherait 364 un matin de mars, sans raison visible.
 */
function daysBetween(from: Date, to: Date): number {
  return Math.round((midnight(to).getTime() - midnight(from).getTime()) / 86_400_000);
}

export function addDays(d: Date, days: number): Date {
  const out = midnight(d);
  out.setDate(out.getDate() + days);
  return out;
}

function shape(stored: Stored, now: Date): Countdown {
  const start = new Date(stored.startISO);
  const target = new Date(stored.targetISO);
  const total = Math.max(1, daysBetween(start, target));
  const daysLeft = Math.max(0, daysBetween(now, target));
  const daysDone = Math.max(0, daysBetween(start, now));

  return {
    start,
    target,
    daysLeft,
    daysDone,
    progress: Math.min(1, daysDone / total),
    arrived: daysLeft === 0,
  };
}

/**
 * Lit le compteur, et l'arme au premier passage.
 *
 * L'écriture au premier appel est délibérée : un compteur qui ne démarre qu'une
 * fois réglé à la main ne démarrerait jamais. Le jour d'installation fait un
 * point de départ honnête, et la date reste modifiable ensuite.
 */
export async function loadCountdown(now: Date = new Date()): Promise<Countdown> {
  const stored = await kvGet<Stored>(KEY);
  if (stored?.startISO && stored?.targetISO) return shape(stored, now);

  const start = midnight(now);
  const fresh: Stored = {
    startISO: start.toISOString(),
    targetISO: addDays(start, DEFAULT_SPAN_DAYS).toISOString(),
  };
  await kvSet(KEY, fresh);
  return shape(fresh, now);
}

/** Change le jour du départ, sans toucher au point de départ. */
export async function setTarget(target: Date, now: Date = new Date()): Promise<Countdown> {
  const current = await kvGet<Stored>(KEY);
  const start = current?.startISO ? new Date(current.startISO) : midnight(now);
  const next: Stored = {
    startISO: start.toISOString(),
    targetISO: midnight(target).toISOString(),
  };
  await kvSet(KEY, next);
  return shape(next, now);
}

/** `YYYY-MM-DD` local — la valeur qu'attend un `<input type="date">`. */
export function dateInputValue(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Lit la valeur d'un `<input type="date">` comme une date **locale**.
 *  `new Date('2027-08-03')` serait interprétée en UTC et reculerait d'un jour
 *  à l'ouest de Greenwich. */
export function parseDateInput(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** « mardi 3 août 2027 » — la date écrite en toutes lettres. */
export function longDate(d: Date): string {
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
